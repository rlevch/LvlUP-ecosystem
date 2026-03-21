-- =============================================================================
-- Supabase — настройка паролей служебных ролей
-- =============================================================================
-- Запускается ПЕРВЫМ при инициализации контейнера supabase/postgres
-- Эти роли уже созданы образом supabase/postgres — мы только задаём пароли
-- =============================================================================

\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER authenticator         WITH PASSWORD :'pgpass';
ALTER USER pgbouncer             WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin   WITH PASSWORD :'pgpass';
ALTER USER supabase_functions_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin   WITH PASSWORD :'pgpass';
