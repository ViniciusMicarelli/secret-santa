-- Support unread counters and conversation history without scanning all messages.
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages (group_id, giver, id);
