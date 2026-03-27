
from mcp.server.auth.provider import AccessToken, TokenVerifier
import jwt
import time
import os
import requests
import json

class cognitoTokenVerifyer(TokenVerifier):


    async def verify_token(self, token: str) -> AccessToken | None:
        
        signing_key = self._get_signing_key()

        decodedHeader = jwt.get_unverified_header(token)

        decodedPayload = jwt.decode(token, "secret",  options={"verify_signature": False})

        currEpochTime = time.time()
     
        if signing_key["keys"][1]["kid"] != decodedHeader["kid"]:
            return None

        if not decodedPayload["sub"] or decodedPayload["sub"] != os.getenv("CLIENT_ID"):
            return None
        
        if decodedPayload["iat"] > currEpochTime or currEpochTime > decodedPayload["exp"]:
            return None

        return AccessToken(
            token=token,
            client_id=decodedPayload["sub"],
            scopes=[decodedPayload["scope"]],
            expires_at=decodedPayload["exp"]   
        )
    
    def _get_signing_key(self):

        resp = requests.request("GET", url="https://cognito-idp.us-west-1.amazonaws.com/us-west-1_cREo3YWQ0/.well-known/jwks.json")

        return resp.json()