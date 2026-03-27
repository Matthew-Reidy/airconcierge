from mcp.server.fastmcp import FastMCP
from typing import Any

def registerHotels(mcp: FastMCP[Any]) -> None:

    @mcp.tool()
    def searchHotels(query: str, pagniationToken: str | None = None):
        pass