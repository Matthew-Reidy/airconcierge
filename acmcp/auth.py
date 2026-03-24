
from mcp.server.auth.provider import AccessToken, TokenVerifier
import jwt
import time

class cognitoTokenVerifyer(TokenVerifier):


    async def verify_token(self, token: str) -> AccessToken | None:
        
        decodedToken = jwt.decode(token)
        
        return AccessToken(
            token=token,
            client_id=decodedToken["client_id"],
            scopes=[decodedToken["scope"]],
            expires_at=decodedToken["exp"]   
        )