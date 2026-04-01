import os
from strands import Agent, tool
from strands_tools.code_interpreter import AgentCoreCodeInterpreter
from bedrock_agentcore import BedrockAgentCoreApp
from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig, RetrievalConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import AgentCoreMemorySessionManager
from .mcp_client.client import get_streamable_http_mcp_client
from .model.load import load_model
from dotenv import load_dotenv
from sysprompts import *
from typing import List, Any

load_dotenv()

MEMORY_ID = os.getenv("BEDROCK_AGENTCORE_MEMORY_ID")
REGION = os.getenv("AWS_REGION")
# Integrate with Bedrock AgentCore
app = BedrockAgentCoreApp()
log = app.logger

if os.getenv("LOCAL_DEV_FLAG") == "1":
    # In local dev, instantiate dummy MCP client so the code runs without deploying
    from contextlib import nullcontext
    from types import SimpleNamespace
    strands_mcp_client = nullcontext(SimpleNamespace(list_tools_sync=lambda: []))
else:
    # Import AgentCore Gateway as Streamable HTTP MCP Client
    print("connecting to the mcp")
    strands_mcp_client = get_streamable_http_mcp_client()

@app.entrypoint
async def invoke(payload, context):
    print(f"{payload} \n {context}")
    
    session_id = getattr(context, 'session_id', 'default')
    user_id = payload.get("user_id") or 'default-user'

    # Configure memory if available
    session_manager = None
    if MEMORY_ID:
        session_manager = AgentCoreMemorySessionManager(
            AgentCoreMemoryConfig(
                memory_id=MEMORY_ID,
                session_id=session_id,
                actor_id=user_id,
                retrieval_config={
                    f"/facts/{user_id}/": RetrievalConfig(top_k=10, relevance_score=0.4),
                    f"/preferences/{user_id}/": RetrievalConfig(top_k=5, relevance_score=0.5),
                    f"/summaries/{user_id}/{session_id}/": RetrievalConfig(top_k=5, relevance_score=0.4),
                    f"/episodes/{user_id}/{session_id}/": RetrievalConfig(top_k=5, relevance_score=0.4),
                }
            ),
            REGION
        )

    else:
        log.warning("MEMORY_ID is not set. Skipping memory session manager initialization.")


    # Create code interpreter
    code_interpreter = AgentCoreCodeInterpreter(
        region=REGION,
        session_name=session_id,
        auto_create=True,
        persist_sessions=True
    )

    with strands_mcp_client as client:
        # Get MCP Tools
        tools = client.list_tools_sync()
        # Create agent
        agent = Agent(
            model=load_model(),
            session_manager=session_manager,
            system_prompt=ORCHESTRATOR_PROMP,
            tools=[code_interpreter.code_interpreter, flightAgent, itinerariesAgent, accomodationAgent] + tools
        )

        # Execute and format response
        stream = agent.stream_async(payload.get("prompt"))

        async for event in stream:
            
            # Handle Text parts of the response
            # if "data" in event and isinstance(event["data"], str):
            #     #log.info(event)
            #     yield event["data"]

            # Implement additional handling for other events
            #if "toolUse" in event:
                #log.info(event)

            # Handle end of stream
            if "result" in event:
                #log.info(event)
                yield(format_response(event["result"]))

def format_response(result) -> str:
    """Extract code from metrics and format with LLM response."""
    parts = []

    # Extract executed code from metrics
    try:
        tool_metrics = result.metrics.tool_metrics.get('code_interpreter')
        if tool_metrics and hasattr(tool_metrics, 'tool'):
            action = tool_metrics.tool['input']['code_interpreter_input']['action']
            if 'code' in action:
                parts.append(f"## Executed Code:\n```{action.get('language', 'python')}\n{action['code']}\n```\n---\n")
    except (AttributeError, KeyError):
        pass  # No code to extract

    # Add LLM response
    parts.append(f"{str(result)}")
    return "\n".join(parts)


@tool(context="codeInterp")
def flightAgent(codeInterp: AgentCoreCodeInterpreter, tools: List[Any], prompt: str):

    flightAgent = Agent(
        model=load_model(),
        system_prompt=FLIGHT_AGENT_PROMPT,
        tools=[codeInterp.code_interpreter] + tools
    )

    response = flightAgent(prompt=prompt)

    log.info(response)

    return str(response)


@tool(context="codeInterp")
def accomodationAgent(codeInterp: AgentCoreCodeInterpreter, tools: List[Any], prompt: str): 

    accomodationAgent = Agent(
        model=load_model(),
        system_prompt=ACCOMODATION_AGENT_PROMPT,
        tools=[codeInterp.code_interpreter] + tools
    )
    response = accomodationAgent(prompt=prompt)

    log.info(response)

    return str(response)


@tool(context="codeInterp")
def itinerariesAgent(codeInterp: AgentCoreCodeInterpreter, tools: List[Any], prompt: str):
    itinerariesAgent = Agent(
        model=load_model(),
        system_prompt=ITINERARIES_AGENT_PROMPT,
        tools=[codeInterp.code_interpreter] + tools
    )
    
    response = itinerariesAgent(prompt=prompt)

    log.info(response)

    return str(response)




if __name__ == "__main__":
    app.run()