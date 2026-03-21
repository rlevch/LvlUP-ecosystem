-- =============================================================================
-- Supabase Functions / Webhooks — схема supabase_functions
-- =============================================================================
-- Нужен для Edge Functions и Database Webhooks (триггеры → HTTP-запросы)
-- Расширение pg_net уже установлено в образе supabase/postgres
-- =============================================================================

BEGIN;
  -- supabase_functions schema
  CREATE SCHEMA IF NOT EXISTS supabase_functions AUTHORIZATION supabase_admin;
  GRANT USAGE ON SCHEMA supabase_functions TO postgres, anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_functions
    GRANT ALL ON TABLES    TO postgres, anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_functions
    GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_functions
    GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

  -- Таблица миграций
  CREATE TABLE IF NOT EXISTS supabase_functions.migrations (
    version     text        PRIMARY KEY,
    inserted_at timestamptz NOT NULL DEFAULT NOW()
  );
  INSERT INTO supabase_functions.migrations (version)
  VALUES ('initial')
  ON CONFLICT DO NOTHING;

  -- Таблица аудита хуков
  CREATE TABLE IF NOT EXISTS supabase_functions.hooks (
    id           bigserial   PRIMARY KEY,
    hook_table_id integer    NOT NULL,
    hook_name    text        NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT NOW(),
    request_id   bigint
  );
  CREATE INDEX IF NOT EXISTS supabase_functions_hooks_request_id_idx
    ON supabase_functions.hooks USING btree (request_id);
  CREATE INDEX IF NOT EXISTS supabase_functions_hooks_h_table_id_h_name_idx
    ON supabase_functions.hooks USING btree (hook_table_id, hook_name);

  COMMENT ON TABLE supabase_functions.hooks IS
    'Supabase Functions Hooks: Audit trail for triggered hooks.';

  -- Функция http_request для триггеров
  CREATE OR REPLACE FUNCTION supabase_functions.http_request()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = supabase_functions
    AS $function$
    DECLARE
      request_id  bigint;
      payload     jsonb;
      url         text    := TG_ARGV[0]::text;
      method      text    := TG_ARGV[1]::text;
      headers     jsonb   DEFAULT '{}'::jsonb;
      params      jsonb   DEFAULT '{}'::jsonb;
      timeout_ms  integer DEFAULT 1000;
    BEGIN
      IF url IS NULL OR url = 'null' THEN
        RAISE EXCEPTION 'url argument is missing';
      END IF;
      IF method IS NULL OR method = 'null' THEN
        RAISE EXCEPTION 'method argument is missing';
      END IF;

      headers    := COALESCE(NULLIF(TG_ARGV[2], 'null')::jsonb, '{"Content-Type":"application/json"}'::jsonb);
      params     := COALESCE(NULLIF(TG_ARGV[3], 'null')::jsonb, '{}'::jsonb);
      timeout_ms := COALESCE(NULLIF(TG_ARGV[4], 'null')::integer, 1000);

      CASE
        WHEN method = 'GET' THEN
          SELECT http_get INTO request_id
          FROM net.http_get(url, params, headers, timeout_ms);
        WHEN method = 'POST' THEN
          payload := jsonb_build_object(
            'old_record', OLD, 'record', NEW,
            'type', TG_OP, 'table', TG_TABLE_NAME, 'schema', TG_TABLE_SCHEMA
          );
          SELECT http_post INTO request_id
          FROM net.http_post(url, payload, params, headers, timeout_ms);
        ELSE
          RAISE EXCEPTION 'method argument % is invalid', method;
      END CASE;

      INSERT INTO supabase_functions.hooks (hook_table_id, hook_name, request_id)
      VALUES (TG_RELID, TG_NAME, request_id);

      RETURN NEW;
    END
    $function$;

  -- Права для supabase_functions_admin
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_functions_admin') THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;
  END
  $$;

  GRANT ALL PRIVILEGES ON SCHEMA supabase_functions TO supabase_functions_admin;
  GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA supabase_functions TO supabase_functions_admin;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA supabase_functions TO supabase_functions_admin;
  ALTER USER supabase_functions_admin SET search_path = "supabase_functions";
  ALTER TABLE supabase_functions.migrations OWNER TO supabase_functions_admin;
  ALTER TABLE supabase_functions.hooks      OWNER TO supabase_functions_admin;
  ALTER FUNCTION supabase_functions.http_request() OWNER TO supabase_functions_admin;
  GRANT supabase_functions_admin TO postgres;

  -- Права на pg_net если расширение уже установлено
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
      GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      REVOKE ALL ON FUNCTION net.http_get(text,jsonb,jsonb,integer)  FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(text,jsonb,jsonb,jsonb,integer) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION net.http_get(text,jsonb,jsonb,integer)
        TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(text,jsonb,jsonb,jsonb,integer)
        TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END
  $$;

  INSERT INTO supabase_functions.migrations (version)
  VALUES ('20210809183423_update_grants')
  ON CONFLICT DO NOTHING;

COMMIT;
