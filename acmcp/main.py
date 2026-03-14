
import httpx
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("weather")

@mcp.tool()
def searchFlights(filters):
    pass

def main():
    # Initialize and run the server
    mcp.run(transport="stdio")

if __name__ == "__main__":
    main()