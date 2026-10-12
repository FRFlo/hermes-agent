import pytest

from gateway.outbound_messages import MessageType, with_message_type


def test_message_type_metadata_is_required_and_preserves_existing_context():
    metadata = {
        "thread_id": "thread-1",
        "reply_to_message_id": "event-1",
        "custom_adapter_flag": True,
    }

    result = with_message_type(metadata, MessageType.SYSTEM)

    assert result == {
        "thread_id": "thread-1",
        "reply_to_message_id": "event-1",
        "custom_adapter_flag": True,
        "message_type": "system",
    }
    assert metadata == {
        "thread_id": "thread-1",
        "reply_to_message_id": "event-1",
        "custom_adapter_flag": True,
    }


def test_explicit_message_type_replaces_stale_inherited_type():
    result = with_message_type(
        {"message_type": "progress", "thread_id": "thread-1"},
        MessageType.REPLY,
    )

    assert result == {"message_type": "reply", "thread_id": "thread-1"}


def test_typing_uses_progress_message_type():
    assert with_message_type(None, MessageType.PROGRESS) == {"message_type": "progress"}


@pytest.mark.asyncio
async def test_base_lifecycle_reaction_operations_receive_intent_metadata():
    from gateway.platforms.base import BasePlatformAdapter
    from gateway.platforms.event import ProcessingOutcome

    class Adapter(BasePlatformAdapter):
        _OK_EMOJI = "done"

        async def on_processing_start(self, event, metadata=None):
            await self._call_processing_operation(
                self._add_reaction, event.source.chat_id, event.message_id, "working", metadata=metadata)

        async def _remove_reaction(self, chat_id, message_id, *, metadata=None):
            self.removed = metadata

        async def _add_reaction(self, chat_id, message_id, emoji, *, metadata=None):
            self.added = metadata

        def _reactions_enabled(self):
            return True

        async def connect(self):
            pass

        async def disconnect(self):
            pass

        async def send(self, *args, **kwargs):
            pass

        async def get_chat_info(self, chat_id):
            return {}

    from types import SimpleNamespace
    adapter = Adapter.__new__(Adapter)
    event = SimpleNamespace(source=SimpleNamespace(chat_id="chat"), message_id="message")
    progress = with_message_type({"thread_id": "thread"}, MessageType.PROGRESS)
    interaction = with_message_type({"thread_id": "thread"}, MessageType.INTERACTION)

    await adapter.on_processing_start(event, metadata=progress)
    assert adapter.added == progress
    await adapter.on_processing_complete(event, ProcessingOutcome.SUCCESS, metadata=interaction)
    assert adapter.removed == interaction
    assert adapter.added == interaction
