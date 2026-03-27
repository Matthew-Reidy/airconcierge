from typing import Any
from mcp.server.fastmcp import FastMCP
from .attractionsPrompt import registerAttractions

def registerPrompts(mcp: FastMCP[Any]) -> None:
    registerAttractions(mcp)