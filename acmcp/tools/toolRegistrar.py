from typing import Any
from mcp.server.fastmcp import FastMCP

#tool registry funcs in order

from .placeInfo import registerPlaceInfo
from .searchAttractions import registerAttractions
from .searchFlights import registerFlights
from .searchHotels import registerHotels


def registerTools(mcp: FastMCP[Any]):

    registerPlaceInfo(mcp)
    registerAttractions(mcp)
    registerFlights(mcp)
    registerHotels(mcp)
