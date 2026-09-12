"""Contracts for transcript changes driven by platform message mutations."""

from hermes_state import SessionDB


def test_rewind_from_platform_message_archives_tail_and_replaces_user(tmp_path):
    db = SessionDB(db_path=tmp_path / "state.db")
    try:
        sid = "discord-session"
        db.create_session(sid, source="discord")
        db.append_message(sid, "user", "old", platform_message_id="u1")
        db.append_message(sid, "assistant", "old answer")
        db.append_message(sid, "user", "later", platform_message_id="u2")
        db.record_discord_response_message_ids(sid, "u1", ["a1", "a2"])
        assert db.find_discord_response_origin(sid, "a2") == "u1"

        result = db.rewind_from_platform_message(sid, "u1", replacement_content="edited")

        assert result["target"]["platform_message_id"] == "u1"
        assert len(result["rows"]) == 3
        live = db.get_messages_as_conversation(sid)
        assert [message["content"] for message in live if message["role"] != "session_meta"] == ["edited"]
        assert db.has_archived_messages(sid)
    finally:
        db.close()


def test_rewind_from_platform_message_delete_leaves_prefix(tmp_path):
    db = SessionDB(db_path=tmp_path / "state.db")
    try:
        sid = "discord-session"
        db.create_session(sid, source="discord")
        db.append_message(sid, "user", "keep", platform_message_id="u1")
        db.append_message(sid, "assistant", "answer")
        db.append_message(sid, "user", "remove", platform_message_id="u2")

        result = db.rewind_from_platform_message(sid, "u2")

        assert result["replacement_message_id"] is None
        live = db.get_messages_as_conversation(sid)
        assert [message["content"] for message in live if message["role"] != "session_meta"] == ["keep", "answer"]
    finally:
        db.close()
