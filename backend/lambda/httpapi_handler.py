import boto3
import json
import os
from decimal import Decimal

DEFAULT_ACTOR_ID = "default-user"  # matches the agent's fallback when no user_id is sent
ROLES = {"USER": "user", "ASSISTANT": "assistant"}  # TOOL / OTHER messages are not shown

#this lambda function is used to handle http api requests from the frontend and return session data and chat history for a specific user

def lambda_handler(event, context):
    route = event.get("routeKey")

    if route == "GET /getsessions":
        return response_body(200, fetch_sessions())

    if route == "GET /getchathistory":
        session_id = (event.get("queryStringParameters") or {}).get("sessionID")
        if not session_id:
            return response_body(400, {"error": "Missing required query string parameter 'sessionID'"})
        return response_body(200, get_session_chat_history(session_id))

    return response_body(404, {"error": "Not found"})

def fetch_sessions():
    """
    Scans the session table and returns every session.

    Returns:
        list: [{"session_id": ..., "session name": ...}, ...]
    """
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(os.environ["SESSION_TABLE_NAME"]) # type: ignore

    response = table.scan()
    items = response.get('Items', [])

    # follow DynamoDB's pagination until it stops returning a LastEvaluatedKey
    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        items.extend(response.get('Items', []))

    return [
        {"session_id": item["session_id"], "session name": item.get("session_title", "")}
        for item in items
    ]

def get_session_chat_history(session_id, actor_id=DEFAULT_ACTOR_ID):
    """
    Fetches the chat history for a session from AgentCore memory.

    Args:
        session_id (str): The ID of the session.
        actor_id (str): The memory actor (user) the session belongs to.

    Returns:
        list: Messages in chronological order, e.g.
              [{"role": "user", "content": "...", "timestamp": "2026-01-01T00:00:00+00:00"}, ...]
    """
    client = boto3.client('bedrock-agentcore')
    paginator = client.get_paginator('list_events')
    pages = paginator.paginate(
        memoryId=os.environ["AGENTCORE_MEMORY_ID"],
        actorId=actor_id,
        sessionId=session_id,
        includePayloads=True,
    )

    events = [event for page in pages for event in page.get('events', [])]
    events.sort(key=lambda event: event['eventTimestamp'])

    chat_history = []
    for event in events:
        for payload in event.get('payload', []):
            message = payload.get('conversational')
            role = ROLES.get(message['role']) if message else None
            if role:
                chat_history.append({
                    "role": role,
                    "content": message['content']['text'],
                    "timestamp": event['eventTimestamp'].isoformat(),
                })

    return chat_history

def response_body(status_code, body):
    """
    Helper function to create a consistent response format.

    Args:
        status_code (int): The HTTP status code.
        body (dict): The response body.

    Returns:
        dict: A dictionary containing the status code and JSON-encoded body.
    """
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, default=_decimal_default)
    }

def _decimal_default(value):
    # DynamoDB returns numbers as Decimal, which json can't serialise
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    raise TypeError(f"Unserializable type: {type(value)}")
