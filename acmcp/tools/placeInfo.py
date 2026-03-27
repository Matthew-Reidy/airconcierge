from mcp.server.fastmcp import FastMCP
from typing import Any

def registerPlaceInfo(mcp : FastMCP[Any]) -> None:
    @mcp.tool()
    def getDetailedPlaceInfo(placeid: str | int ) -> str:
        return f"Data for {placeid}"
    