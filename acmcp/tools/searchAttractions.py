from mcp.server.fastmcp import FastMCP
from typing import Any

def registerAttractions(mcp: FastMCP[Any]) -> None:

    @mcp.tool()
    def searchAttractions(query: str, pagniationToken: str | None = None):
        return f"Data for {query}"