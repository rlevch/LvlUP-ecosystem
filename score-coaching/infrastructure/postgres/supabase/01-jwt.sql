-- =============================================================================
-- Supabase — JWT-конфигурация на уровне базы данных
-- =============================================================================
-- Нужен Supabase PostgREST и GoTrue для верификации токенов
-- =============================================================================

\set jwt_secret `echo "$JWT_SECRET"`
\set jwt_exp    `echo "$JWT_EXP"`

ALTER DATABASE postgres SET "app.settings.jwt_secret" TO :'jwt_secret';
ALTER DATABASE postgres SET "app.settings.jwt_exp"    TO :'jwt_exp';
