import boto3
import json
import os
import time
import uuid
from boto3.dynamodb.conditions import Key

# this lambda function handles the websocket api routes: $connect, $disconnect, $default and chat.
#
# Session ids are uuid4 strings (36 chars) because bedrock agentcore requires a session id of at least 33 chars.
# A client resumes a session by connecting with it in the query string: wss://<host>/<stage>?sessionid=<id>
# Connection ids are stored on the session item so that later routes (which don't carry the query string)
# can find the session.

MIN_SESSION_ID_LENGTH = 33
SESSION_TTL_SECONDS = 30 * 24 * 60 * 60  # matches the agentcore memory event expiry
CONNECTION_INDEX = "connection_id-index"
TITLE_MAX_LENGTH = 40

_dynamodb = boto3.resource('dynamodb')


def lambda_handler(event, context):
    route = event["requestContext"]["routeKey"]
    connection_id = event["requestContext"]["connectionId"]

    if route == "$connect":
        return on_connect(event, connection_id)

    if route == "$disconnect":
        return on_disconnect(connection_id)

    if route == "chat":
        return on_chat(event, connection_id)

    # $default: unknown action
    send(event, connection_id, {"type": "error", "data": "Unknown action. Use action 'chat'."})
    return {"statusCode": 400}


def on_connect(event, connection_id):
    session_id = (event.get("queryStringParameters") or {}).get("sessionid")

    # no (or unusable) session id: the chat route creates a new session on the first message
    if session_id and len(session_id) >= MIN_SESSION_ID_LENGTH:
        table().update_item(
            Key={"session_id": session_id},
            UpdateExpression="SET connection_id = :c, #ttl = :t",
            ExpressionAttributeNames={"#ttl": "ttl"},
            ExpressionAttributeValues={":c": connection_id, ":t": expiry()},
        )

    return {"statusCode": 200}


def on_disconnect(connection_id):
    session_id = find_session_id(connection_id)
    if session_id:
        table().update_item(
            Key={"session_id": session_id},
            UpdateExpression="REMOVE connection_id",
        )
    return {"statusCode": 200}


def on_chat(event, connection_id):
    body = json.loads(event.get("body") or "{}")
    prompt = body.get("prompt", "")

    session_id = find_session_id(connection_id)
    if not session_id:
        # new session
        session_id = str(uuid.uuid4())
        send(event, connection_id, {"type": "session", "session_id": session_id})

    # create the item on a new session, or refresh it on an existing one.
    # the title only gets set once, from the first prompt.
    table().update_item(
        Key={"session_id": session_id},
        UpdateExpression="SET connection_id = :c, #ttl = :t, session_title = if_not_exists(session_title, :title)",
        ExpressionAttributeNames={"#ttl": "ttl"},
        ExpressionAttributeValues={
            ":c": connection_id,
            ":t": expiry(),
            ":title": prompt[:TITLE_MAX_LENGTH] or "New trip",
        },
    )

    # TODO: invoke the agent with session_id and stream chunks back with send()
    return {"statusCode": 200}


def find_session_id(connection_id):
    response = table().query(
        IndexName=CONNECTION_INDEX,
        KeyConditionExpression=Key("connection_id").eq(connection_id),
        Limit=1,
    )
    items = response.get("Items", [])
    return items[0]["session_id"] if items else None


def send(event, connection_id, payload):
    context = event["requestContext"]
    client = boto3.client(
        "apigatewaymanagementapi",
        endpoint_url=f"https://{context['domainName']}/{context['stage']}",
    )
    client.post_to_connection(ConnectionId=connection_id, Data=json.dumps(payload).encode())


def table():
    return _dynamodb.Table(os.environ["SESSION_TABLE_NAME"])  # type: ignore


def expiry():
    return int(time.time()) + SESSION_TTL_SECONDS
