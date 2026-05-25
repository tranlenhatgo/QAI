"""Per-connection WebSocket session state."""

import uuid

from server.llm.base import Message, Role


MAX_HISTORY_MESSAGES = 20


class Session:
    """Per-connection session state."""

    def __init__(self, tier: str, mode: str, capability, user_id: str = "", kb_id: str = ""):
        self.id = uuid.uuid4().hex
        self.tier = tier
        self.mode = mode
        self.capability = capability
        self.user_id = user_id
        self.kb_id = kb_id
        self.messages: list[Message] = []
        self.cancelled = False

    def add_user_message(self, content: str):
        self.messages.append(Message(role=Role.USER, content=content))
        self.cancelled = False
        self._trim_history()

    def add_assistant_message(self, content: str):
        self.messages.append(Message(role=Role.ASSISTANT, content=content))

    def cancel(self):
        self.cancelled = True

    def switch_mode(self, new_mode: str):
        from server.router import resolve_capability, Tier, Mode

        self.mode = new_mode
        self.capability = resolve_capability(
            Tier(self.tier), Mode(new_mode), self.user_id, self.kb_id
        )

    def _trim_history(self):
        """Keep last N messages to stay within context window."""
        if len(self.messages) > MAX_HISTORY_MESSAGES:
            self.messages = self.messages[-MAX_HISTORY_MESSAGES:]

    def cleanup(self):
        self.messages.clear()
