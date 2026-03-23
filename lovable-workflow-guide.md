# LevelUP — Пошаговый гайд по работе с Lovable.dev

> **Цель:** Создать 5 lovable-проектов → 5 GitHub-репозиториев → экспортировать код → адаптировать в монорепу `levelup-platform`.

---

## Общая схема работы

```
┌──────────────────────────────────────────────────────────────────────┐
│                     LOVABLE.DEV (генерация UI)                      │
│                                                                      │
│  Проект 1          Проект 2        Проект 3       Проект 4     Проект 5     │
│  Platform          Academy         School         School-Admin Association  │
│  (10 промптов)     (2 промпта)     (3 промпта)   (5 промптов)  (1 промпт)  │
│      │                │                │              │             │       │
│      ▼                ▼                ▼              ▼             ▼       │
│  repo: levelup-   repo: levelup-  repo: levelup- repo: levelup- repo: levelup- │
│  lovable-platform  lovable-academy lovable-school lovable-admin  lovable-assoc │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│               МОНОРЕПОЗИТОРИЙ: levelup-platform                      │
│                                                                      │
│  apps/platform/       ← из Проекта 1                                 │
│  apps/academy/        ← из Проекта 2                                 │
│  apps/school/         ← из Проекта 3                                 │
│  apps/school-admin/   ← из Проекта 4                                 │
│  apps/association/    ← из Проекта 5                                 │
│  packages/ui/         ← shadcn/ui компоненты (из Проекта 1)         │
│  packages/shared/     ← общие типы, утилиты                         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Фаза 0. Подготовка (15 минут)

### 0.1. Войдите на lovable.dev

Зайдите на [lovable.dev](https://lovable.dev), создайте аккаунт (или войдите). Подключите свой GitHub-аккаунт в настройках — lovable автоматически создаст репозиторий для каждого проекта.

### 0.2. Скопируйте системный промпт

Этот текст нужно вставить в **начало первого промпта** каждого нового проекта lovable. Он задаёт контекст — стек, правила, стиль:

```
Контекст проекта:
- Экосистема LevelUP — платформа для коучинга (РФ)
- Стек: React 19, TypeScript, Tailwind CSS v4, shadcn/ui, React Router v7, TanStack Query (серверное состояние), Zustand (клиентское состояние)
- БД: Supabase (PostgreSQL). Все данные приходят через Supabase JS SDK (supabase.from('table').select())
- Дизайн: современный, минималистичный, профессиональный. Основные цвета: тёмно-синий (#1e3a5f), золотой акцент (#c9a84c), белый фон. Скругления: rounded-xl. Тени: мягкие (shadow-sm).
- Язык интерфейса: русский
- Все формы должны иметь валидацию (react-hook-form + zod)
- Адаптивный дизайн: mobile-first (320px → 768px → 1024px → 1440px)
- Иконки: lucide-react
- Шрифт: Inter (основной), Playfair Display (заголовки)

ВАЖНО:
- Используй TypeScript-интерфейсы, которые я даю — они соответствуют реальной схеме БД
- Моковые данные генерируй в отдельном файле src/mocks/data.ts, типизированные этими интерфейсами
- Все формы создавай с react-hook-form + zodResolver + валидацией
- Компоненты должны принимать данные через props (не хардкодить внутри)
- Таблицы данных делай с сортировкой, фильтрацией и пагинацией через @tanstack/react-table
```

### 0.3. Скопируйте общие TypeScript-типы

Этот блок типов нужно вставить в **первый промпт** каждого lovable-проекта (вместе с системным контекстом):

```typescript
// === ОБЩИЕ ТИПЫ (из схемы БД) ===

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  specializations: string[];
  timezone: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

type UserRole = 'client' | 'coach' | 'school_owner' | 'instructor' | 'admin';

interface Notification {
  id: string;
  user_id: string;
  type: 'booking' | 'payment' | 'message' | 'system';
  title: string;
  body: string | null;
  read: boolean;
  data: Record<string, any> | null;
  created_at: string;
}
```

---

## Фаза 1. Волна 1 — Платформа (приоритет MVP)

**Время:** ~3-4 часа
**Lovable-проект:** создать новый проект с названием `levelup-platform`
**GitHub-репо:** `rlevch/levelup-lovable-platform`
**Результат → `apps/platform/`**

### Как создать проект

1. Нажмите **"New Project"** в lovable.dev
2. Дайте имя: `levelup-platform`
3. В первый промпт вставьте: **системный контекст** + **общие типы** + **промпт 1** (ниже)
4. Дождитесь генерации, проверьте результат в превью
5. Если что-то не так — допишите уточнение в чат lovable (не пересоздавайте проект!)
6. Когда промпт 1 готов — отправьте **промпт 2** в тот же чат
7. Повторяйте для каждого следующего промпта

### Порядок промптов (строго последовательно)

| # | Экран | Что генерируем | Примерное время |
|---|-------|----------------|-----------------|
| 1 | Лендинг | Hero, каталог коучей, отзывы, CTA | 20 мин |
| 2 | Авторизация | Login/Register с zod-валидацией | 15 мин |
| 3 | Дашборд коуча | Сайдбар, статистика, таблица сессий, уведомления | 20 мин |
| 4 | Дашборд клиента | Мои коучи, прогресс, абонементы | 20 мин |
| 5 | Профиль коуча | Публичная страница + модалка бронирования | 20 мин |
| 11 | Настройки профиля | Форма редактирования с табами, загрузка аватара | 15 мин |
| 12 | CRUD услуг | Список + модалка создания/редактирования | 15 мин |
| 13 | Расписание | Недельный календарь + настройка доступности | 20 мин |
| 14 | Видеосессия | Комната с заметками (GROW/STAR), таймер, согласие | 20 мин |
| 15 | Финансы | KPI, график, DataTable платежей с фильтрами | 15 мин |

### Промпт 1 — Лендинг платформы

> **Что вставить в lovable:** системный контекст + общие типы + текст ниже

```
Создай лендинг коучинговой платформы LevelUP на русском языке.

TypeScript-типы для данных на этой странице:

interface CoachCard {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  specializations: string[];
  avg_rating: number;
  total_reviews: number;
  price_from: number;
}

interface Review {
  id: string;
  client_name: string;
  rating: number;
  text: string;
  created_at: string;
}

Структура страницы:
1. Хедер: логотип "LevelUP" слева, навигация (Каталог коучей, О платформе, Магазин), кнопки "Войти" и "Начать бесплатно" справа
2. Hero-секция: крупный заголовок "Найдите своего коуча", подзаголовок "Платформа для профессионального коучинга с видеосессиями, играми и инструментами роста", поле поиска коучей (строка + select специализации), CTA-кнопка "Найти коуча"
3. Блок преимуществ (3 карточки): "Видеосессии с записью", "Игровые инструменты (МАК-карты, кубики)", "Безопасность данных (152-ФЗ)"
4. Каталог коучей: горизонтальный скролл CoachCard[] (фото, имя, specializations как теги, avg_rating звёзды, price_from ₽, кнопка "Записаться")
5. Как это работает: 4 шага (Регистрация → Выбор коуча → Видеосессия → Результат)
6. Блок отзывов: карусель Review[] (аватар, имя, рейтинг, текст)
7. CTA-секция: "Начните свой путь к изменениям"
8. Футер: ссылки, контакты, копирайт

Моковые данные: создай массив из 6 CoachCard и 4 Review с реалистичными русскими именами. Вынеси в src/mocks/data.ts.

Стиль: премиальный, доверительный. Цвета: тёмно-синий (#1e3a5f) для хедера/футера, белый фон основных секций, золотой (#c9a84c) для CTA-кнопок.
```

### Промпт 2 — Авторизация

> **Что вставить:** только текст ниже (контекст уже задан в промпте 1)

```
Создай страницу входа/регистрации для платформы LevelUP на русском языке.
Используй react-hook-form + zod для валидации.

TypeScript-типы:

const loginSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(8, 'Минимум 8 символов'),
  remember: z.boolean().optional(),
});
type LoginForm = z.infer<typeof loginSchema>;

const registerSchema = z.object({
  first_name: z.string().min(2, 'Минимум 2 символа'),
  last_name: z.string().min(2, 'Минимум 2 символа'),
  email: z.string().email('Некорректный email'),
  password: z.string().min(8, 'Минимум 8 символов').regex(/[A-Z]/, 'Нужна заглавная буква').regex(/[0-9]/, 'Нужна цифра'),
  password_confirm: z.string(),
  role: z.enum(['client', 'coach']),
  agree_terms: z.literal(true, { errorMap: () => ({ message: 'Необходимо принять условия' }) }),
}).refine(d => d.password === d.password_confirm, { message: 'Пароли не совпадают', path: ['password_confirm'] });
type RegisterForm = z.infer<typeof registerSchema>;

Два таба: "Вход" и "Регистрация".

Таб "Вход" (LoginForm):
- Поле email (с валидацией формата, ошибка под полем)
- Поле пароль (с иконкой показать/скрыть, ошибка под полем)
- Чекбокс "Запомнить меня"
- Кнопка "Войти" (основная, золотой цвет), disabled пока форма невалидна
- Разделитель "или"
- Кнопка "Войти через VK ID" (синяя, с иконкой VK)
- Ссылка "Забыли пароль?"

Таб "Регистрация" (RegisterForm):
- Выбор роли (role): два кликабельных блока "Я коуч" (иконка briefcase) и "Я клиент" (иконка user)
- Поля: first_name, last_name, email, password (с индикатором силы), password_confirm
- Чекбокс agree_terms "Согласен с условиями использования"
- Кнопка "Зарегистрироваться" — disabled пока zod-валидация не пройдена
- Кнопка "Зарегистрироваться через VK ID"

onSubmit: console.log(data) — реальный API подключим позже.

Дизайн: по центру экрана карточка с формой, слева декоративная панель с иллюстрацией и слоганом. Мобильная версия — только форма.
```

### Промпты 3-5, 11-15

Тексты промптов 3-15 находятся в файле `mvp-implementation-guide.md`, секция "Шаг 0.10". Вставляйте их **последовательно** в чат того же lovable-проекта `levelup-platform`.

**Важно:** между промптами проверяйте превью. Если lovable что-то сделал не так — напишите уточнение, не переходите к следующему промпту.

### Контрольная точка после Волны 1

Когда все 10 промптов готовы, у вас должно быть:
- 10+ страниц/компонентов в превью lovable
- GitHub-репо `levelup-lovable-platform` с коммитами
- Файл `src/mocks/data.ts` с моковыми данными

**Действие:** Перейдите в lovable Settings → GitHub, убедитесь что репо подключено и код запушен.

---

## Фаза 2. Волна 2A — Академия

**Время:** ~40 минут
**Lovable-проект:** создать НОВЫЙ проект `levelup-academy`
**GitHub-репо:** `rlevch/levelup-lovable-academy`
**Результат → `apps/academy/`**

### Порядок промптов

| # | Экран | Что генерируем | Примерное время |
|---|-------|----------------|-----------------|
| 6 | Лендинг академии | Hero, каталог школ, тарифы | 20 мин |
| 7 | Wizard создания школы | 4-шаговый wizard с валидацией | 20 мин |

### Как создать проект

1. **"New Project"** → название `levelup-academy`
2. В первый промпт: **системный контекст** + **общие типы** + **промпт 6**

> **Отличие от Платформы:** дизайн другой — акцентный цвет зелёный (#22c55e), тема яркая и образовательная. Укажите это в промпте.

### Промпт 6 — Лендинг академии

> **Что вставить:** системный контекст + общие типы + текст промпта 6 из `mvp-implementation-guide.md`

### Промпт 7 — Wizard создания школы

> **Что вставить:** текст промпта 7 из `mvp-implementation-guide.md`

---

## Фаза 3. Волна 2B — SPA школы (то, что видит студент)

**Время:** ~1 час
**Lovable-проект:** создать НОВЫЙ проект `levelup-school`
**GitHub-репо:** `rlevch/levelup-lovable-school`
**Результат → `apps/school/`**

### Порядок промптов

| # | Экран | Что генерируем | Примерное время |
|---|-------|----------------|-----------------|
| 19 | Главная школы | Лендинг школы + каталог курсов | 20 мин |
| 9 | Страница курса | Прохождение урока, quiz, ДЗ | 25 мин |
| 20 | Личный кабинет студента | Мои курсы, расписание, сертификаты | 20 мин |

### Как создать проект

1. **"New Project"** → название `levelup-school`
2. В первый промпт: **системный контекст** + **общие типы** + **промпт 19**

> **КРИТИЧНО для школы:** все цвета должны использовать CSS-переменные `var(--school-primary)`, `var(--school-radius)` и т.д. Это обеспечит тенантный теминг — каждая школа выглядит по-своему. Это написано в промпте 19.

---

## Фаза 4. Волна 2C — Админка школы

**Время:** ~2 часа
**Lovable-проект:** создать НОВЫЙ проект `levelup-school-admin`
**GitHub-репо:** `rlevch/levelup-lovable-school-admin`
**Результат → `apps/school-admin/`**

### Порядок промптов

| # | Экран | Что генерируем | Примерное время |
|---|-------|----------------|-----------------|
| 8 | Дашборд школы | KPI, графики, таблица записей | 20 мин |
| 16 | Конструктор курса | Форма + drag-and-drop модулей/уроков | 25 мин |
| 17 | Управление студентами | DataTable + сайдпанель профиля | 20 мин |
| 18 | Настройки школы | 8 табов: бренд, домен, SEO, команда | 20 мин |
| 21 | Промо-коды и продажи | CRUD промо-кодов + таблица заказов | 15 мин |
| 22 | Шаблоны сертификатов | Редактор HTML-шаблона + превью | 15 мин |

### Как создать проект

1. **"New Project"** → название `levelup-school-admin`
2. В первый промпт: **системный контекст** + **общие типы** + **промпт 8**

---

## Фаза 5. Волна 3 — Ассоциация

**Время:** ~20 минут
**Lovable-проект:** создать НОВЫЙ проект `levelup-association`
**GitHub-репо:** `rlevch/levelup-lovable-association`
**Результат → `apps/association/`**

### Порядок промптов

| # | Экран | Что генерируем | Примерное время |
|---|-------|----------------|-----------------|
| 10 | Лендинг + реестр | Членство, мероприятия, реестр коучей | 20 мин |

### Как создать проект

1. **"New Project"** → название `levelup-association`
2. В первый промпт: **системный контекст** + **общие типы** + **промпт 10**

---

## Фаза 6. Экспорт из Lovable (30 минут)

К этому моменту у вас 5 lovable-проектов, каждый подключён к своему GitHub-репо.

### 6.1. Проверить что все репо актуальны

В каждом lovable-проекте:
1. Откройте Settings → GitHub
2. Убедитесь что все изменения запушены (если нет — нажмите "Push to GitHub")
3. Проверьте репо на GitHub — файлы на месте

### 6.2. Клонировать все 5 репо

```bash
cd /tmp
git clone https://github.com/rlevch/levelup-lovable-platform.git
git clone https://github.com/rlevch/levelup-lovable-academy.git
git clone https://github.com/rlevch/levelup-lovable-school.git
git clone https://github.com/rlevch/levelup-lovable-school-admin.git
git clone https://github.com/rlevch/levelup-lovable-association.git
```

### 6.3. Посмотреть структуру каждого

```bash
# У каждого примерно такая структура:
tree levelup-lovable-platform/src/ -L 2
# src/
# ├── components/
# │   ├── ui/           ← shadcn/ui компоненты
# │   ├── Landing.tsx
# │   ├── CoachDashboard.tsx
# │   └── ...
# ├── mocks/
# │   └── data.ts       ← моковые данные
# ├── pages/
# │   ├── Index.tsx
# │   └── ...
# ├── App.tsx
# └── main.tsx
```

---

## Фаза 7. Перенос в монорепу (1-2 часа)

### 7.1. Подготовить монорепу

```bash
cd ~/levelup-platform    # или где у вас монорепозиторий
```

### 7.2. Перенести shadcn/ui компоненты (один раз)

Берём из первого (самого полного) lovable-проекта:

```bash
mkdir -p packages/ui/src/components
cp -r /tmp/levelup-lovable-platform/src/components/ui/* packages/ui/src/components/
```

### 7.3. Перенести Платформу

```bash
# Модуль auth (промпт 2):
mkdir -p apps/platform/src/modules/auth
cp /tmp/levelup-lovable-platform/src/pages/Auth.tsx apps/platform/src/modules/auth/

# Модуль marketplace (промпт 1):
mkdir -p apps/platform/src/modules/marketplace
cp /tmp/levelup-lovable-platform/src/pages/Landing.tsx apps/platform/src/modules/marketplace/

# Модуль coach-profile (промпты 5, 11):
mkdir -p apps/platform/src/modules/coach-profile
cp /tmp/levelup-lovable-platform/src/pages/CoachProfile.tsx apps/platform/src/modules/coach-profile/
cp /tmp/levelup-lovable-platform/src/pages/ProfileSettings.tsx apps/platform/src/modules/coach-profile/
cp /tmp/levelup-lovable-platform/src/components/BookingModal.tsx apps/platform/src/modules/coach-profile/

# Модуль sessions (промпты 3, 12, 13):
mkdir -p apps/platform/src/modules/sessions
cp /tmp/levelup-lovable-platform/src/pages/CoachDashboard.tsx apps/platform/src/modules/sessions/
cp /tmp/levelup-lovable-platform/src/pages/Services.tsx apps/platform/src/modules/sessions/
cp /tmp/levelup-lovable-platform/src/pages/Schedule.tsx apps/platform/src/modules/sessions/

# Модуль client-portal (промпт 4):
mkdir -p apps/platform/src/modules/client-portal
cp /tmp/levelup-lovable-platform/src/pages/ClientDashboard.tsx apps/platform/src/modules/client-portal/

# Модуль video (промпт 14):
mkdir -p apps/platform/src/modules/video
cp /tmp/levelup-lovable-platform/src/pages/VideoSession.tsx apps/platform/src/modules/video/

# Модуль billing (промпт 15):
mkdir -p apps/platform/src/modules/billing
cp /tmp/levelup-lovable-platform/src/pages/Finance.tsx apps/platform/src/modules/billing/

# Моки:
cp -r /tmp/levelup-lovable-platform/src/mocks apps/platform/src/mocks/
```

### 7.4. Перенести Академию

```bash
mkdir -p apps/academy/src/modules/school-catalog
cp /tmp/levelup-lovable-academy/src/pages/Landing.tsx apps/academy/src/modules/school-catalog/
cp /tmp/levelup-lovable-academy/src/pages/CreateSchool.tsx apps/academy/src/modules/school-catalog/
cp -r /tmp/levelup-lovable-academy/src/mocks apps/academy/src/mocks/
```

### 7.5. Перенести SPA школы

```bash
mkdir -p apps/school/src/modules/{home,courses,course,student-portal}
cp /tmp/levelup-lovable-school/src/pages/SchoolHome.tsx apps/school/src/modules/home/
cp /tmp/levelup-lovable-school/src/pages/CourseCatalog.tsx apps/school/src/modules/courses/
cp /tmp/levelup-lovable-school/src/pages/CourseLearning.tsx apps/school/src/modules/course/
cp /tmp/levelup-lovable-school/src/pages/StudentPortal.tsx apps/school/src/modules/student-portal/
cp -r /tmp/levelup-lovable-school/src/mocks apps/school/src/mocks/
```

### 7.6. Перенести Админку школы

```bash
mkdir -p apps/school-admin/src/modules/{dashboard,courses,students,settings,sales,certificates}
cp /tmp/levelup-lovable-school-admin/src/pages/Dashboard.tsx apps/school-admin/src/modules/dashboard/
cp /tmp/levelup-lovable-school-admin/src/pages/CourseEditor.tsx apps/school-admin/src/modules/courses/
cp /tmp/levelup-lovable-school-admin/src/pages/Students.tsx apps/school-admin/src/modules/students/
cp /tmp/levelup-lovable-school-admin/src/pages/Settings.tsx apps/school-admin/src/modules/settings/
cp /tmp/levelup-lovable-school-admin/src/pages/PromoCodes.tsx apps/school-admin/src/modules/sales/
cp /tmp/levelup-lovable-school-admin/src/pages/Certificates.tsx apps/school-admin/src/modules/certificates/
cp -r /tmp/levelup-lovable-school-admin/src/mocks apps/school-admin/src/mocks/
```

### 7.7. Перенести Ассоциацию

```bash
mkdir -p apps/association/src/modules/{membership,registry,events}
cp /tmp/levelup-lovable-association/src/pages/Landing.tsx apps/association/src/modules/membership/
cp -r /tmp/levelup-lovable-association/src/mocks apps/association/src/mocks/
```

> **Примечание:** Имена файлов в lovable могут отличаться (Index.tsx, Home.tsx и т.д.). Подстройте команды `cp` под реальные имена. Каждый модуль потом получит `index.ts` с re-exports.

---

## Фаза 8. Адаптация импортов (30 минут)

### 8.1. Заменить импорты UI-компонентов

```bash
# Во всех apps — заменить lovable-пути на пакеты монорепы:
cd apps/platform
find src -name "*.tsx" -exec sed -i 's|@/components/ui/|@levelup/ui/|g' {} +
find src -name "*.tsx" -exec sed -i 's|"@/components/ui"|"@levelup/ui"|g' {} +

# Повторить для academy, school, school-admin, association
```

### 8.2. Заменить импорты типов

```bash
# В каждом app заменить локальные типы на пакет shared:
find src -name "*.tsx" -exec sed -i 's|from "\.\./types"|from "@levelup/shared/types/database"|g' {} +
find src -name "*.tsx" -exec sed -i 's|from "\.\./\.\./types"|from "@levelup/shared/types/database"|g' {} +
```

### 8.3. Заменить ссылки на роутерные

```bash
find src -name "*.tsx" -exec sed -i 's|<a href=|<Link to=|g' {} +
```

---

## Фаза 9. Проверка (15 минут)

```bash
cd ~/levelup-platform

# Проверить типы:
npx turbo typecheck

# Запустить каждое приложение:
npx turbo dev --filter=platform     # → http://localhost:5173
npx turbo dev --filter=academy      # → http://localhost:5174
npx turbo dev --filter=school       # → http://localhost:5175
npx turbo dev --filter=school-admin # → http://localhost:5176
```

Исправить ошибки импортов если есть (обычно 5-10 правок).

---

## Сводная таблица

| Фаза | Lovable-проект | Промпты | → apps/ | Время |
|------|----------------|---------|---------|-------|
| 1 | `levelup-platform` | 1, 2, 3, 4, 5, 11, 12, 13, 14, 15 | `apps/platform/` | 3-4 ч |
| 2A | `levelup-academy` | 6, 7 | `apps/academy/` | 40 мин |
| 2B | `levelup-school` | 19, 9, 20 | `apps/school/` | 1 ч |
| 2C | `levelup-school-admin` | 8, 16, 17, 18, 21, 22 | `apps/school-admin/` | 2 ч |
| 3 | `levelup-association` | 10 | `apps/association/` | 20 мин |
| **Итого** | **5 проектов** | **22 промпта** | **5 apps** | **~8 ч** |

---

## Советы по работе с Lovable

### Если lovable сделал что-то не так

Не пересоздавайте проект! Напишите в тот же чат:
```
Исправь: [что не так]. Нужно: [как должно быть].
```

Примеры уточнений:
- "Таблица должна использовать @tanstack/react-table, а не самописную"
- "Форма не использует zod — добавь zodResolver"
- "Не хватает мобильной версии — сайдбар должен сворачиваться"

### Если lovable не устанавливает нужный пакет

Напишите:
```
Установи и используй пакет @tanstack/react-table для таблицы данных.
```

### Если lovable потерял контекст

В длинных чатах lovable может забыть про стек. Напишите:
```
Напоминание: стек React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui. Все формы через react-hook-form + zod. Моки в src/mocks/data.ts.
```

### Проверка перед экспортом

Перед переходом к следующему проекту убедитесь:
- [ ] Все экраны отображаются в превью lovable
- [ ] Формы имеют zod-валидацию (ошибки появляются при невалидном вводе)
- [ ] Мобильная версия работает (проверьте в превью lovable — resize)
- [ ] Моковые данные в `src/mocks/data.ts` (не захардкожены в компонентах)
- [ ] GitHub-репо синхронизировано

---

## Что дальше после Lovable

1. **Шаг 0.11** — App Shell: настроить роутинг, layout, navigation в монорепе
2. **Шаг 0.12** — Auth: подключить Supabase Auth вместо console.log
3. **Шаг 0.13** — Заменить моки на реальные Supabase-запросы (TanStack Query)
4. **Шаг 0.14** — Подключить LiveKit для видеосессий
5. **Волна 4** — Отложенные модули (чат, gameboard, магазин, CRM, admin panel)
