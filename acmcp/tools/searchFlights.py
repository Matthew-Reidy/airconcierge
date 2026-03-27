from mcp.server.fastmcp import FastMCP
from typing import Any

def registerFlights(mcp: FastMCP[Any]) -> None:
    @mcp.tool()
    def searchFlights(destination: str, origin: str):
        pass