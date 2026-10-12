"""Semantic categories for messages emitted to platform adapters."""

from enum import StrEnum
from typing import Any, Mapping, Optional


class MessageType(StrEnum):
    """What an outbound adapter message is for, independent of its presentation."""

    SYSTEM = "system"
    REPLY = "reply"
    PROGRESS = "progress"
    INTERACTION = "interaction"
    NOTIFICATION = "notification"
    ATTACHMENT = "attachment"


def with_message_type(
    metadata: Optional[Mapping[str, Any]],
    message_type: MessageType,
) -> dict[str, Any]:
    """Copy adapter metadata and stamp its required semantic message type.

    Unknown keys are retained because adapters use metadata for platform-specific
    routing. Callers must choose a type explicitly; there is deliberately no default.
    """
    result = dict(metadata or {})
    result["message_type"] = MessageType(message_type).value
    return result
