# План реализации новой ролевой модели Академии

> **Дата:** 2026-03-29
> **Требования:** [academy-role-requirements-v2.md](./academy-role-requirements-v2.md)
> **Статус:** Утверждение

---

## Обзор изменений

Переход от текущей модели (роли в массиве `users.role[]` + `tenant.school_team_members`) к новой модели с централизованными профилями, разделёнными таблицами ролей и механизмом invite-ссылок.

**Оценка трудозатрат:** ~8-12 дней разработки (при последовательной реализации фаз)

---

## Фаза 1: Миграция БД — новая ролевая модель (2-3 дня)

### Шаг 1.1: Создать таблицу `public.user_roles`

**Сервер:** VPS #1 (supabase-db)
**Пользователь:** deploy

Заменяем массив `users.role[]` на нормализованную таблицу:

```sql
-- Migration: 010_user_roles.sql

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('service_admin', 'student')),
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Админ видит всё
CREATE POLICY "service_admin_all" ON public.user_roles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'service_admin')
  );

-- Пользователь видит свои роли
CREATE POLICY "user_own_roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());
```

### Шаг 1.2: Создать таблицу `public.school_members`

Заменяем `tenant.school_team_members` на расширенную таблицу:

```sql
-- Migration: 011_school_members.sql

CREATE TABLE public.school_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES tenant.schools(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('school_owner', 'school_instructor', 'school_curator')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'removed')),
  invited_by UUID REFERENCES auth.users(id),
  invite_link_id UUID, -- FK добавим после создания invite_links
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, school_id, role)
);

CREATE INDEX idx_school_members_user_id ON public.school_members(user_id);
CREATE INDEX idx_school_members_school_id ON public.school_members(school_id);
CREATE INDEX idx_school_members_role ON public.school_members(role);

-- RLS
ALTER TABLE public.school_members ENABLE ROW LEVEL SECURITY;

-- Админ сервиса видит всё
CREATE POLICY "service_admin_all" ON public.school_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'service_admin')
  );

-- Владелец школы управляет членами своей школы
CREATE POLICY "owner_manage_members" ON public.school_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.school_members sm
      WHERE sm.user_id = auth.uid()
        AND sm.school_id = school_members.school_id
        AND sm.role = 'school_owner'
    )
  );

-- Пользователь видит членов школ, в которых состоит
CREATE POLICY "member_see_school" ON public.school_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.school_members sm
      WHERE sm.user_id = auth.uid() AND sm.school_id = school_members.school_id
    )
  );
```

### Шаг 1.3: Расширить `public.profiles` для юрлиц

```sql
-- Migration: 012_profiles_legal_entity.sql

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS legal_type TEXT CHECK (legal_type IN ('individual', 'self_employed', 'legal_entity'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS inn TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ogrn TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name TEXT;
```

### Шаг 1.4: Создать таблицу верификации владельцев школ

```sql
-- Migration: 013_owner_verification.sql

CREATE TABLE public.owner_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'documents_submitted', 'under_review', 'verified', 'rejected')),
  legal_type TEXT NOT NULL CHECK (legal_type IN ('self_employed', 'legal_entity')),
  inn TEXT NOT NULL,
  ogrn TEXT,
  company_name TEXT,
  documents JSONB NOT NULL DEFAULT '[]',
  -- [{type: "inn_certificate", file_url: "...", uploaded_at: "..."}, ...]
  agency_agreement_url TEXT, -- подписанный агентский договор
  agency_agreement_signed_at TIMESTAMPTZ,
  reviewer_id UUID REFERENCES auth.users(id),
  reviewer_comment TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_owner_verifications_user_id ON public.owner_verifications(user_id);
CREATE INDEX idx_owner_verifications_status ON public.owner_verifications(status);

ALTER TABLE public.owner_verifications ENABLE ROW LEVEL SECURITY;

-- Пользователь видит свою верификацию
CREATE POLICY "user_own_verification" ON public.owner_verifications
  FOR SELECT USING (user_id = auth.uid());

-- Пользователь может создавать/обновлять свою верификацию
CREATE POLICY "user_submit_verification" ON public.owner_verifications
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_update_verification" ON public.owner_verifications
  FOR UPDATE USING (user_id = auth.uid() AND status IN ('pending', 'rejected'));

-- Админ управляет всеми верификациями
CREATE POLICY "admin_manage_verifications" ON public.owner_verifications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'service_admin')
  );
```

### Шаг 1.5: Создать таблицу invite-ссылок

```sql
-- Migration: 014_invite_links.sql

CREATE TABLE public.invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  type TEXT NOT NULL CHECK (type IN ('team', 'course')),
  -- Для team invite:
  school_id UUID REFERENCES tenant.schools(id) ON DELETE CASCADE,
  target_role TEXT CHECK (target_role IN ('school_instructor', 'school_curator')),
  -- Для course invite:
  course_id UUID REFERENCES academy.courses(id) ON DELETE CASCADE,
  promo_code TEXT,
  -- Общие поля:
  created_by UUID NOT NULL REFERENCES auth.users(id),
  max_uses INT,
  used_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_invite_links_token ON public.invite_links(token);
CREATE INDEX idx_invite_links_school_id ON public.invite_links(school_id);
CREATE INDEX idx_invite_links_course_id ON public.invite_links(course_id);

-- Таблица использования invite-ссылок
CREATE TABLE public.invite_link_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_link_id UUID NOT NULL REFERENCES public.invite_links(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(invite_link_id, user_id)
);

ALTER TABLE public.invite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_link_usages ENABLE ROW LEVEL SECURITY;
```

### Шаг 1.6: Расширить `academy.enrollments`

```sql
-- Migration: 015_enrollments_source.sql

ALTER TABLE academy.enrollments ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'catalog'
  CHECK (source IN ('catalog', 'invite_link', 'manual', 'promo'));
ALTER TABLE academy.enrollments ADD COLUMN IF NOT EXISTS invite_link_id UUID REFERENCES public.invite_links(id);
ALTER TABLE academy.enrollments ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'not_required'
  CHECK (payment_status IN ('not_required', 'pending', 'paid', 'refunded'));
```

### Шаг 1.7: Миграция существующих данных

```sql
-- Migration: 016_migrate_roles_data.sql

-- Перенести роли из users.role[] в user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, unnest(u.role)
FROM auth.users u
WHERE u.role IS NOT NULL AND array_length(u.role, 1) > 0
ON CONFLICT DO NOTHING;

-- Перенести школьные роли из tenant.school_team_members в school_members
INSERT INTO public.school_members (user_id, school_id, role, joined_at)
SELECT stm.user_id, stm.school_id, stm.role, stm.created_at
FROM tenant.school_team_members stm
ON CONFLICT DO NOTHING;

-- Маппинг ролей при миграции:
-- platform_admin → service_admin
-- client → student
-- school_owner → school_owner (в school_members)
-- instructor → school_instructor (в school_members)
-- curator → school_curator (в school_members)
```

---

## Фаза 2: API — RBAC и новые эндпоинты (2-3 дня)

### Шаг 2.1: Рефакторинг RBAC middleware

**Файл:** `services/api/src/middleware/auth.ts`

```typescript
// Новый формат проверки ролей
interface AuthContext {
  userId: string;
  globalRoles: string[];        // из user_roles
  schoolRoles: Map<string, string[]>; // school_id → [roles]
}

// Middleware: загрузка ролей из БД
async function loadUserRoles(userId: string): Promise<AuthContext> {
  const [globalRoles, schoolRoles] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', userId),
    supabase.from('school_members').select('school_id, role').eq('user_id', userId)
  ]);
  // ... формирование AuthContext
}

// Guards
function requireGlobalRole(...roles: string[]) { /* ... */ }
function requireSchoolRole(schoolId: string, ...roles: string[]) { /* ... */ }
function requireAnySchoolRole(...roles: string[]) { /* ... */ }
```

### Шаг 2.2: Эндпоинты invite-ссылок

**Файл:** `services/api/src/routes/invites.ts`

| Метод | Путь | Кто вызывает | Описание |
|-------|------|-------------|----------|
| `POST` | `/api/invites/team` | `school_owner` | Создать invite для преподавателя/куратора |
| `POST` | `/api/invites/course` | `school_curator` | Создать invite на курс для студента |
| `GET` | `/api/invites/:token` | Любой (auth) | Получить информацию о ссылке |
| `POST` | `/api/invites/:token/accept` | Любой (auth) | Принять приглашение |
| `DELETE` | `/api/invites/:id` | Создатель | Деактивировать ссылку |
| `GET` | `/api/invites/school/:schoolId` | `school_owner` | Список invite-ссылок школы |

### Шаг 2.3: Эндпоинты верификации

**Файл:** `services/api/src/routes/verification.ts`

| Метод | Путь | Кто вызывает | Описание |
|-------|------|-------------|----------|
| `POST` | `/api/verification/submit` | Пользователь | Подать заявку на верификацию |
| `PATCH` | `/api/verification/:id/documents` | Пользователь | Загрузить/обновить документы |
| `GET` | `/api/verification/my` | Пользователь | Мой статус верификации |
| `GET` | `/api/verification/queue` | `service_admin` | Очередь на верификацию |
| `PATCH` | `/api/verification/:id/review` | `service_admin` | Одобрить/отклонить |

### Шаг 2.4: Эндпоинты управления ролями

**Файл:** `services/api/src/routes/roles.ts`

| Метод | Путь | Кто вызывает | Описание |
|-------|------|-------------|----------|
| `GET` | `/api/roles/my` | Любой (auth) | Все мои роли (global + school-scoped) |
| `POST` | `/api/roles/assign` | `service_admin` | Назначить глобальную роль |
| `DELETE` | `/api/roles/:id` | `service_admin` | Удалить роль |
| `GET` | `/api/roles/school/:schoolId/members` | Член школы | Список участников школы |

### Шаг 2.5: Обновить JWT claims

При авторизации включать в JWT или в отдельный endpoint `/api/auth/context`:

```json
{
  "sub": "user-uuid",
  "global_roles": ["student", "service_admin"],
  "school_memberships": [
    { "school_id": "...", "roles": ["school_owner"], "school_name": "Коучинг PRO" },
    { "school_id": "...", "roles": ["school_instructor"], "school_name": "МастерКласс" }
  ]
}
```

---

## Фаза 3: Frontend — Единый ЛК с ролевым контекстом (3-4 дня)

### Шаг 3.1: Новый `useAuth` хук

**Файл:** `apps/platform/src/hooks/useAuth.ts`

```typescript
interface UseAuthReturn {
  user: User;
  globalRoles: string[];
  schoolMemberships: SchoolMembership[];
  activeContext: RoleContext; // текущий выбранный контекст
  setActiveContext: (ctx: RoleContext) => void;
  hasGlobalRole: (role: string) => boolean;
  hasSchoolRole: (schoolId: string, role: string) => boolean;
  isServiceAdmin: boolean;
  isSchoolOwner: (schoolId?: string) => boolean;
}
```

### Шаг 3.2: Компонент переключения контекста

**Файл:** `apps/platform/src/components/RoleContextSwitcher.tsx`

Боковое меню / sidebar с деревом контекстов:
- "Мои курсы" (контекст студента)
- Для каждой школы: название школы + роль
- "Администрирование" (если service_admin)

### Шаг 3.3: Динамический роутинг ЛК

```
/dashboard                     → Общий дашборд (мои курсы как студент)
/dashboard/admin               → Панель service_admin
/dashboard/school/:id          → Панель владельца школы
/dashboard/school/:id/teaching → Панель преподавателя в школе
/dashboard/school/:id/curating → Панель куратора в школе
```

### Шаг 3.4: Страницы верификации

- `/verification` — подача заявки, загрузка документов, отслеживание статуса
- `/dashboard/admin/verifications` — очередь верификации для админа

### Шаг 3.5: UI invite-ссылок

- Для владельца школы: генерация ссылок для команды (выбор роли, срок действия)
- Для куратора: генерация ссылок на курсы
- Публичная страница `/invite/:token` — обработка приглашения

### Шаг 3.6: Обработка invite-ссылок при входе

```
Студент получает ссылку → переходит по ней →
  ├── Авторизован? → Показать информацию о курсе → Принять → Курс в ЛК
  └── Не авторизован? → Регистрация/Вход → Redirect back → Принять → Курс в ЛК
```

Сохранять `invite_token` в localStorage/URL param для redirect после авторизации.

---

## Фаза 4: Интеграция и тестирование (1-2 дня)

### Шаг 4.1: E2E тесты критических сценариев

1. **Регистрация → получение роли student** автоматически
2. **Верификация владельца школы:** подача заявки → загрузка документов → одобрение админом → создание школы
3. **Invite-ссылка для преподавателя:** owner генерирует → преподаватель переходит → автоматическое добавление в школу
4. **Invite-ссылка на курс (платный):** куратор генерирует → студент переходит → видит курс с кнопкой оплаты → оплачивает → доступ
5. **Invite-ссылка на курс (бесплатный):** куратор генерирует → студент переходит → курс доступен сразу
6. **Совмещение ролей:** пользователь с ролями student + school_instructor видит оба контекста в ЛК

### Шаг 4.2: Проверка RLS policies

Для каждой новой таблицы проверить:
- Студент не может видеть данные чужих школ
- Владелец школы не может управлять чужими школами
- Куратор не может назначать роли
- Преподаватель видит только свои курсы

### Шаг 4.3: Обновить документацию

- Обновить `architecture.md` — новая ролевая модель
- Обновить `mvp-implementation-guide.md` — шаги миграции
- Обновить `CLAUDE.md` — ссылка на новый документ требований

---

## Порядок выполнения и зависимости

```
Фаза 1 (БД)
  │
  ├── 1.1 user_roles ──────────┐
  ├── 1.2 school_members ──────┤
  ├── 1.3 profiles extension ──┤
  ├── 1.4 owner_verifications ─┤── Все независимы, можно параллельно
  ├── 1.5 invite_links ────────┤
  ├── 1.6 enrollments ext ─────┘
  │
  └── 1.7 data migration ←── Зависит от 1.1-1.6
        │
Фаза 2 (API)
  │
  ├── 2.1 RBAC refactor ←── Зависит от 1.1, 1.2
  ├── 2.2 invite endpoints ←── Зависит от 1.5
  ├── 2.3 verification endpoints ←── Зависит от 1.4
  ├── 2.4 role management ←── Зависит от 1.1, 1.2
  └── 2.5 JWT update ←── Зависит от 2.1
        │
Фаза 3 (Frontend)
  │
  ├── 3.1 useAuth hook ←── Зависит от 2.4, 2.5
  ├── 3.2 context switcher ←── Зависит от 3.1
  ├── 3.3 dynamic routing ←── Зависит от 3.2
  ├── 3.4 verification pages ←── Зависит от 2.3
  ├── 3.5 invite UI ←── Зависит от 2.2
  └── 3.6 invite flow ←── Зависит от 3.5
        │
Фаза 4 (Тестирование) ←── Зависит от всех выше
```

---

## Риски и митигация

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Миграция данных ломает существующие сессии | Средняя | Делать миграцию в maintenance window, сохранить обратную совместимость JWT на 7 дней |
| RLS policies конфликтуют | Средняя | Тестировать каждую policy отдельно через `SET LOCAL role` |
| Invite-ссылки утечки/спам | Низкая | Лимит использований, срок действия, rate limiting |
| Сложность переключения контекста в UI | Средняя | Прототипирование в Lovable до реализации |

---

## Команды для запуска миграций

```bash
# Применить миграцию на VPS #1
ssh deploy@111.88.113.107 'docker exec -i supabase-db psql -U supabase_admin -d postgres < ~/levelup-monorepo/packages/supabase/migrations/010_user_roles.sql'

# Перестроить API после изменений
ssh deploy@111.88.113.107 'cd ~/levelup-monorepo/services/api && set -a && source .env && set +a && pm2 restart api-gateway --update-env'

# Пересобрать фронтенд
ssh deploy@111.88.113.107 'cd ~/levelup-monorepo/apps/platform && npm run build'
```
