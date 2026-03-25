
import httpx
import os
from pydantic import AnyHttpUrl
from mcp.server.fastmcp import FastMCP
from mcp.server.auth.settings import AuthSettings
from auth import cognitoTokenVerifyer
from dotenv import load_dotenv

load_dotenv()

ISSUER_URL = os.getenv("ISSUER_URL")
RESOURCE_SERVER = os.getenv("RESOURCE_SERVER")
SCOPE=os.getenv("COGNITO_SCOPE")

if not ISSUER_URL or not RESOURCE_SERVER or not SCOPE:
    raise RuntimeError("Issuer URL and/or Resource URL not defined")

# Initialize FastMCP server
mcp = FastMCP(
    "acmcp",
    token_verifier=cognitoTokenVerifyer(),
    auth=AuthSettings(
        issuer_url=AnyHttpUrl(ISSUER_URL),
        resource_server_url=AnyHttpUrl(RESOURCE_SERVER),
        required_scopes=[SCOPE]
    )
    
)

#test tool
@mcp.tool()
def addNumbers(a: int, b: int):
    return a+b


def main():
    # Initialize and run the server
    mcp.run(transport="streamable-http")

if __name__ == "__main__":
    main()