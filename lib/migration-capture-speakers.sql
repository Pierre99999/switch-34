-- Who was in the room for this round's conversation, as read off the imported
-- transcript. Deliberately NOT stored inside capture_notes: hasCaptureContent()
-- treats any non-empty value there as "a conversation was captured", and a
-- speaker list alone is not a captured conversation. That guard is what stops
-- a round being scored from nothing.
alter table deal_rounds add column if not exists capture_speakers jsonb;
