import os

from langchain_aws import ChatBedrockConverse

# Global inference profile for Claude Sonnet 4.5
# https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html
MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "global.anthropic.claude-sonnet-4-5-20250929-v1:0")


def load_model() -> ChatBedrockConverse:
    """Bedrock chat model. Uses the default AWS credential chain (execution role when deployed)."""
    return ChatBedrockConverse(
        model=MODEL_ID,
        region_name=os.getenv("AWS_REGION", "us-east-1"),
    )
