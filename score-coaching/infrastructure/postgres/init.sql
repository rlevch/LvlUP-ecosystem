-- =============================================================================
-- SCORE Coaching — Инициализация бизнес-схем и таблиц
-- =============================================================================
-- Запускается при первом старте контейнера (файл 10-score-init.sql)
-- ВАЖНО: схемы auth, storage, _realtime и роли anon/authenticated/service_role
--        создаются АВТОМАТИЧЕСКИ образом supabase/postgres — не трогаем их здесь.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Бизнес-схемы (доменные области из architecture.md §4.1)
-- ---------------------------------------------------------------------------
-- Бизнес-домены
CREATE SCHEMA IF NOT EXISTS association; -- Членство, сертификация, реестр, стандарты
CREATE SCHEMA IF NOT EXISTS academy;     -- Курсы, уроки, задания, тесты, журнал
CREATE SCHEMA IF NOT EXISTS platform;    -- Услуги коучей, сессии, отзывы, магазин
CREATE SCHEMA IF NOT EXISTS chat;        -- Сообщения, каналы, шифрованные ключи
CREATE SCHEMA IF NOT EXISTS billing;     -- Подписки, платежи, абонементы, инвойсы
CREATE SCHEMA IF NOT EXISTS content;     -- Библиотека, статьи, блог, медиафайлы
CREATE SCHEMA IF NOT EXISTS crm;         -- Воронки, лиды, конверсии
CREATE SCHEMA IF NOT EXISTS tracking;    -- Учёт часов, прогресс сертификации (ICF)
CREATE SCHEMA IF NOT EXISTS gameboard;   -- Игровой движок (МАК, Т-игры)

-- ---------------------------------------------------------------------------
-- 2. Права на бизнес-схемы
-- ---------------------------------------------------------------------------
-- Роли anon, authenticated, service_role созданы образом supabase/postgres
-- Выдаём права на schemas
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA association TO authenticated, service_role;
GRANT USAGE ON SCHEMA academy TO authenticated, service_role;
GRANT USAGE ON SCHEMA platform TO authenticated, service_role;
GRANT USAGE ON SCHEMA chat TO authenticated, service_role;
GRANT USAGE ON SCHEMA billing TO authenticated, service_role;
GRANT USAGE ON SCHEMA content TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA crm TO authenticated, service_role;
GRANT USAGE ON SCHEMA tracking TO authenticated, service_role;
GRANT USAGE ON SCHEMA gameboard TO authenticated, service_role;

-- Default privileges для будущих таблиц
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA content GRANT SELECT ON TABLES TO anon;

-- ---------------------------------------------------------------------------
-- 3. Расширения
-- ---------------------------------------------------------------------------
-- uuid-ossp, pgcrypto, pgsodium, pg_net уже включены в supabase/postgres
-- Добавляем дополнительные расширения для бизнес-логики
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID генерация
CREATE EXTENSION IF NOT EXISTS "pgcrypto";        -- Шифрование
CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- Fuzzy поиск
CREATE EXTENSION IF NOT EXISTS "unaccent";        -- Нормализация текста
CREATE EXTENSION IF NOT EXISTS "btree_gist";      -- GiST для диапазонов

-- ---------------------------------------------------------------------------
-- 4. Общие таблицы (public schema) — Фаза 0.2
-- ---------------------------------------------------------------------------
-- Profiles (дополнение к auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name  TEXT,
    last_name   TEXT,
    patronymic  TEXT,
    avatar_url  TEXT,
    bio         TEXT,
    phone       TEXT,
    specializations TEXT[],
    timezone    TEXT DEFAULT 'Europe/Moscow',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- User roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN (
                    'admin', 'teacher', 'student', 'coach',
                    'client', 'supervisor', 'moderator', 'member'
                )),
    granted_at  TIMESTAMPTZ DEFAULT NOW(),
    granted_by  UUID REFERENCES auth.users(id),
    UNIQUE(user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,  -- system, chat, payment, course, session, etc.
    title       TEXT NOT NULL,
    body        TEXT,
    data        JSONB DEFAULT '{}',
    read        BOOLEAN DEFAULT FALSE,
    channel     TEXT DEFAULT 'web', -- web, email, push
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read, created_at DESC);

-- Files metadata
CREATE TABLE IF NOT EXISTS public.files (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bucket      TEXT NOT NULL,
    path        TEXT NOT NULL,
    filename    TEXT NOT NULL,
    mime_type   TEXT,
    size_bytes  BIGINT,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_owner ON public.files(owner_id);

-- ---------------------------------------------------------------------------
-- 5. RLS — базовые политики
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Profiles: пользователь видит и редактирует только свой профиль
CREATE POLICY "Users read own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Profiles: public read для каталога коучей (анонимный доступ)
CREATE POLICY "Public read profiles"
    ON public.profiles FOR SELECT TO anon
    USING (TRUE);

-- User roles: пользователь видит свои роли
CREATE POLICY "Users read own roles"
    ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id);

-- Notifications: только свои
CREATE POLICY "Users read own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- Files: только свои
CREATE POLICY "Users manage own files"
    ON public.files FOR ALL
    USING (auth.uid() = owner_id);

-- Admin: полный доступ ко всему
CREATE POLICY "Admins full access profiles"
    ON public.profiles FOR ALL
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins full access user_roles"
    ON public.user_roles FOR ALL
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- ---------------------------------------------------------------------------
-- 6. Trigger: автосоздание профиля при регистрации
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, first_name, last_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    );

    -- По умолчанию — роль 'client'
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'client');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 7. Trigger: updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Done
-- ---------------------------------------------------------------------------
-- Схемы созданы, базовые таблицы ready.
-- Миграции для academy, platform, billing и т.д. будут добавляться поэтапно.
