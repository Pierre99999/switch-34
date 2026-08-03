-- "archived" joins the triage statuses: a piece of feedback that is dealt
-- with, but worth keeping. Deleting is for noise; archiving is for history.
alter table feedback drop constraint if exists feedback_status_check;
alter table feedback add constraint feedback_status_check
  check (status in ('new', 'rejected', 'in_progress', 'done', 'archived'));
