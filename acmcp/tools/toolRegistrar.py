from typing import Any
from mcp.server.fastmcp import FastMCP

#tool registry funcs in order

from .placeInfo import registerPlaceInfo
from .searchNearby import registerNearby
from .searchFlights import registerFlights
from .searchPlaces import registerPlaces


def registerTools(mcp: FastMCP[Any]):

    registerPlaceInfo(mcp)
    registerNearby(mcp)
    registerFlights(mcp)
    registerPlaces(mcp)
