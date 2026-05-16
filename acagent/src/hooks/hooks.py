from typing import Any
import boto3
from strands.hooks import BeforeToolCallEvent, BeforeInvocationEvent,AfterInvocationEvent, HookProvider, HookRegistry


class loggerHook(HookProvider):
    def __init__(self, agent_name: str) -> None:
        self.agent_name = agent_name

    def register_hooks(self, registry: HookRegistry, **kwargs: Any) -> None:
        registry.add_callback(BeforeToolCallEvent, self.preToolCall)

    def preToolCall(self, event: BeforeToolCallEvent) -> None:
        if event.tool_use["name"] != "delete_files":
            return

        approval = event.interrupt(f"{self.agent_name}-approval", reason={"paths": event.tool_use["input"]["paths"]})
        if approval.lower() != "y":
            event.cancel_tool = "User denied permission to delete files"


class memoryHook(HookProvider):
    def __init__(self, app_name: str) -> None:
        self.app_name = app_name

    def register_hooks(self, registry: HookRegistry, **kwargs: Any) -> None:
        registry.add_callback(BeforeInvocationEvent, self.recollectLTM)
        registry.add_callback(AfterInvocationEvent, self.logLTM)

    def recollectLTM(self, event: BeforeInvocationEvent) -> None:
        pass

    def logLTM(self, event:AfterInvocationEvent ):
        pass