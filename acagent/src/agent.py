from langchain.agents import create_agent

from .model import load_model
from .prompts import ORCHESTRATOR_PROMPT


def build_agent():
    # tools (MCP gateway, sub-agents) will be added here
    return create_agent(
        model=load_model(),
        tools=[],
        system_prompt=ORCHESTRATOR_PROMPT,
    )
