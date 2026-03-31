from mcp.server.fastmcp import FastMCP
from typing import Any
from utils import place

def registerPlaces(mcp: FastMCP[Any]) -> None:

    @mcp.tool()
    async def searchPlaces(query: str, fineGrained: bool, lat: float | None = None, lng: float | None = None):

        return await place.discoverPlaces(query, fineGrained, lat, lng)