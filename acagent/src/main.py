from bedrock_agentcore import BedrockAgentCoreApp

from .agent import build_agent

app = BedrockAgentCoreApp()
log = app.logger

agent = build_agent()


@app.entrypoint
async def invoke(payload, context):
    """payload: {"prompt": "<user input>", "user_id": "<optional>"}"""
    prompt = payload.get("prompt", "")
    session_id = getattr(context, "session_id", None) or "default"

    async for chunk, _meta in agent.astream(
        {"messages": [{"role": "user", "content": prompt}]},
        config={"configurable": {"thread_id": session_id}},
        stream_mode="messages",
    ):
        text = chunk.text if hasattr(chunk, "text") else ""
        if text:
            yield text


if __name__ == "__main__":
    app.run()
