-- The application connects only with the Supabase service_role key (server-side;
-- service_role bypasses RLS). A fresh database does not automatically grant the
-- core table privileges to service_role, so without this the service client is
-- denied ("permission denied for table ..."). Grant what the app needs, and set
-- default privileges so future tables are covered too.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
