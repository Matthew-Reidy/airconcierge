from typing import Any
from mcp.server.fastmcp import FastMCP

def registerAttractions(mcp: FastMCP[Any]):
    
    @mcp.prompt()
    def attractionsPrompt():
        return ":^)"