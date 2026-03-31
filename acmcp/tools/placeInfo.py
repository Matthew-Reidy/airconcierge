from mcp.server.fastmcp import Context, FastMCP
from typing import Any
import logging
from utils import place

log = logging.getLogger(__name__)
logging.basicConfig(filename="./placelogs", level=logging.INFO)

def registerPlaceInfo(mcp : FastMCP[Any]) -> None:
    @mcp.tool()
    async def getDetailedPlaceInfo(ctx: Context, placeid: str):
        
        return await place.placeDetails(placeid)
    