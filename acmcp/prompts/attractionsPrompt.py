from typing import Any
from mcp.server.fastmcp import FastMCP

def registerAttractions(mcp: FastMCP[Any]):

    @mcp.prompt()
    def attractionsPrompt(lat: str, long: str, meters: str) -> str:
        
        return f"""
                find attractions and points of interest {meters} meters from the accomodation located at the following coordinates {lat}, {long}

                
                """