CREATE INDEX IF NOT EXISTS groups_text_search_idx ON groups USING GIN (to_tsvector('portuguese'::regconfig, name || ' ' || description));
CREATE INDEX IF NOT EXISTS members_user_group_idx ON members (user_id, group_id);
