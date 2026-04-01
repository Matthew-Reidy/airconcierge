from typing import Any
from mcp.server.fastmcp import FastMCP

#tool registry funcs in order

from .fieldMasks import registerFieldMasks



def registerResources(mcp: FastMCP[Any]):

    registerFieldMasks(mcp)
