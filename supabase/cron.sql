-- Run as the database owner AFTER reviewing/applying migrations.
-- Enable Supabase Cron/pg_cron in the dashboard first.
select cron.schedule('turn-take-deadlines','5 seconds',$$select private.sweep_deadlines();$$);
