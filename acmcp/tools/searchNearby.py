from mcp.server.fastmcp import FastMCP
from typing import Any
from utils import place

def registerNearby(mcp: FastMCP[Any]) -> None:

    @mcp.tool()
    async def searchNearby(lat: float, lng: float, includedTypes: list[str] | None = None):
        
         
        return await place.discoverPlacesNearby(lat, lng, includedTypes)