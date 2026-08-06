-- A private link to a briefing.
--
-- The token is the whole access control: long, random, unguessable, and only
-- ever created on request. It is per round, so a link never widens to the
-- deal, and revoking it is one update to null.

alter table deal_rounds add column if not exists briefing_share_token text;

create unique index if not exists deal_rounds_share_token_idx
  on deal_rounds (briefing_share_token)
  where briefing_share_token is not null;
