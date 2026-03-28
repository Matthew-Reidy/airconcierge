from mcp.server.fastmcp import Context, FastMCP
from typing import Any
import logging

log = logging.getLogger(__name__)
logging.basicConfig(filename="./placelogs", level=logging.INFO)

def registerPlaceInfo(mcp : FastMCP[Any]) -> None:
    @mcp.tool()
    def getDetailedPlaceInfo(ctx: Context, placeid: str | int ) -> str:
        
        return f"Data for {placeid}"
    