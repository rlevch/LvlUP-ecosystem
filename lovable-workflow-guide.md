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
│  (10 промптов)     (2 промпта)     (3 промпта)   (22 промпта)  (1 промпт)  │
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
- Язык интерфейса: русский
- Все формы должны иметь валидацию (react-hook-form + zod)
- Адаптивный дизайн: mobile-first (320px → 768px → 1024px → 1440px → 1920px)
- Иконки: lucide-react

Дизайн-система «Premium»:
- Стиль: премиальный, люксовый, доверительный — как финтех или частный банкинг
- Шрифты: DM Serif Display (заголовки, цифры в карточках — serif, с типографской элегантностью), DM Sans (основной текст — чистый sans-serif)
- Цветовая схема:
  - Сайдбар: тёмно-синий (#0f1d2f), с box-shadow вправо (shadow-lg)
  - Золотой акцент (#c9a84c) — CTA-кнопки, активные элементы, выделения
  - Фон основной области: кремовый (#faf8f4), карточки: белый (#fff) с border 1px solid #eeede9
  - Статус-цвета: зелёный (#2d9f6f) — подтверждено, оранжевый (#d48c2e) — ожидает, синий (#4a8cc9) — завершено, красный (#c9514c) — отменено
- Скругления: rounded-xl (13px). Тени: мягкие (shadow-sm на карточках, shadow-lg на сайдбаре)
- Сайдбар (260px):
  - Логотип "LevelUP" — DM Serif Display, "UP" золотым
  - Активный пункт: золотая вертикальная полоска слева (3px, ::before), фон rgba(gold, 0.12)
  - Аватар внизу с зелёным пульсирующим индикатором «онлайн»
- Карточки статистики: цветная полоска сверху (3px), анимация fade-up staggered, числа DM Serif Display крупным
- Кнопки: primary (золотой фон, белый текст, shadow) и secondary (белый, серая рамка)
- Таблицы: подсветка строки при hover (rgba gold 0.07)
- Хлебные крошки под заголовком
- Прогресс-бар дня: gradient золотой → зелёный
- Empty state: иконка + заголовок + описание + CTA
- Анимации: fade-up при появлении (staggered 70ms)
- Мобильная версия (≤768px): сайдбар → sticky top-bar

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

**Порядок промптов (строго последовательно): 1, 2, 3, 4, 5, 11, 12, 13, 14, 15**

### Как создать проект

1. Нажмите **"New Project"** в lovable.dev
2. Дайте имя: `levelup-platform`
3. В первый промпт вставьте: **системный контекст** + **общие типы** + **промпт 1** (ниже)
4. Дождитесь генерации, проверьте результат в превью
5. Если что-то не так — допишите уточнение в чат lovable (не пересоздавайте проект!)
6. Когда промпт готов — отправьте **следующий промпт** в тот же чат
7. Повторяйте для каждого следующего промпта

### Промпт 1 — Лендинг платформы
**Промпт 1 — Лендинг платформы:**
```
Создай лендинг коучинговой платформы LevelUP на русском языке.

TypeScript-типы для данных на этой странице:

interface CoachCard {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  specializations: string[];
  avg_rating: number;           // 0-5, из platform.coach_ratings
  total_reviews: number;
  price_from: number;           // минимальная цена из coach_services
}

interface Review {
  id: string;
  client_name: string;          // Profile.first_name + last_name
  rating: number;               // 1-5
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

Стиль: премиальный, люксовый, как финтех. Шрифты: DM Serif Display для заголовков, DM Sans для текста. Цвета: тёмно-синий (#0f1d2f) для хедера/футера, кремовый (#faf8f4) фон секций, белые (#fff) карточки с тонкой рамкой, золотой (#c9a84c) для CTA-кнопок (с shadow). Скругления: rounded-xl. Анимации появления секций при скролле (fade-up).
```

**Промпт 2 — Страница авторизации:**
```
Создай страницу входа/регистрации для платформы LevelUP на русском языке.
Используй react-hook-form + zod для валидации.

TypeScript-типы:

// Zod-схемы для валидации
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

**Промпт 3 — Дашборд коуча:**
```
Создай дашборд коуча для платформы LevelUP на русском языке.

TypeScript-типы для данных дашборда (соответствуют реальной БД):

// platform.sessions
interface Session {
  id: string;
  service_id: string;
  coach_id: string;
  client_id: string;
  scheduled_at: string;          // ISO datetime
  duration_min: number;          // default 60
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  livekit_room_name: string | null;
  notes: string | null;
  created_at: string;
  // JOIN-данные для отображения:
  client?: Pick<Profile, 'first_name' | 'last_name' | 'avatar_url'>;
  service?: Pick<CoachService, 'title' | 'type'>;
}

// platform.coach_services
interface CoachService {
  id: string;
  coach_id: string;
  title: string;
  description: string | null;
  type: 'individual_session' | 'group_session' | 'consultation' | 'package';
  price: number;                 // NUMERIC(10,2)
  duration_min: number;          // default 60
  is_active: boolean;
  created_at: string;
}

// platform.coach_ratings
interface CoachRating {
  coach_id: string;
  avg_rating: number;            // NUMERIC(3,2)
  total_reviews: number;
}

// Статистика (агрегация — вычисляется на фронте/API)
interface CoachDashboardStats {
  sessions_completed: number;
  new_clients: number;
  revenue: number;               // в рублях
  avg_rating: number;
}

// Клиент коуча (JOIN sessions + profiles)
interface ClientRow {
  client_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  last_session_at: string | null;
  next_session_at: string | null;
  sessions_total: number;
  progress_pct: number;          // 0-100
}

Layout (дизайн-система «Premium» — см. системный контекст):
- Сайдбар слева (260px, фиксированный, тёмно-синий #0f1d2f, box-shadow: 3px 0 16px rgba(0,0,0,0.1)):
  - Логотип "LevelUP" — шрифт DM Serif Display, "UP" золотым (#c9a84c)
  - Пункты меню с иконками lucide-react:
    - Дашборд (LayoutDashboard) — активный
    - Расписание (Calendar)
    - Клиенты (Users)
    - Услуги (Target)
    - Видеосессии (Video)
    - Финансы (Wallet)
    - Настройки (Settings)
  - Активный пункт: золотая вертикальная полоска слева (3px, position absolute, ::before), фон rgba(201,168,76,0.12), белый текст
  - Внизу: аватар-кружок с инициалами (золотой текст на тёмном) + зелёный пульсирующий индикатор «онлайн» (10px, border 2px solid sidebar-color, animation: pulse 2.5s infinite) + имя + роль мелким серым
- На мобильных (≤768px): сайдбар скрывается, вместо него sticky top-bar (тёмно-синий): логотип слева, аватар справа

Основная область (margin-left: sidebar-width, padding: 30px 40px, фон кремовый #faf8f4):
- Приветствие: "Добрый день," — DM Serif Display 28px, имя коуча — золотым. Под ним дата.
- Хлебные крошки: "Главная / Дашборд" мелким серым (11.5px)
- Кнопки в шапке: "Экспорт" (secondary — белый, серая рамка) и "+ Новая сессия" (primary — золотой фон, белый текст, shadow)

- Прогресс-бар дня: горизонтальная полоска в белой карточке. "Сегодня: 2 из 3 сессий". Трек серый, заполнение — gradient от золотого к зелёному. Процент справа зелёным жирным.

- 4 карточки статистики (grid 4 колонки, gap 14px):
  Каждая: белый фон, border 1px solid #eeede9, rounded-xl, цветная полоска сверху (3px — синий/зелёный/золотой/оранжевый для разных карточек).
  Внутри: метка uppercase мелким серым, число — DM Serif Display 28px тёмным, под ним бейдж изменения ("+12%" зелёным на зелёном фоне).
  Анимация: fade-up staggered (задержка 0/70/140/210ms).
  Числа анимируются от 0 до значения (animated counter, ~800ms easing).

- Двухколоночная сетка (grid: 1fr 380px, gap 20px):
  Левая колонка — "Последние сессии":
    Белая карточка, заголовок DM Serif Display, ссылка "Все сессии" золотым.
    Таблица: заголовки uppercase мелким серым, строки с hover-подсветкой (rgba gold 0.07).
    Колонки: Клиент (аватар-кружок с инициалами + имя + тип услуги мелким), Дата, Статус (бейдж цветной), Действие (кнопка "Открыть" secondary или "Начать" primary для подтверждённых).

  Правая колонка (flex column, gap 16px):
    1. "Ближайшие" — Session[] (status='confirmed', limit 3). Карточка: при hover — золотая полоска слева (3px, ::before, opacity transition). Время uppercase золотым, имя клиента, тип сессии серым, теги (длительность, тип).
    2. "Быстрые действия" — сетка 2x2: кнопки с иконкой-эмодзи, названием и подписью. При hover: золотая рамка, translateY(-2px), shadow.

- Empty state (если нет данных): крупная иконка-эмодзи (opacity 0.6), заголовок DM Serif Display, описание серым, CTA-кнопка gold.

Адаптивность:
- ≤1200px: статистика 2 колонки, контент 1 колонка, правая колонка — в ряд
- ≤768px: мобильный top-bar, статистика 2 колонки, padding уменьшен, кнопки на всю ширину
- ≤480px: статистика 1 колонка, скрыть 3-ю колонку таблицы, switcher компактнее
- ≥1600px: увеличить padding, шрифты, gap
- ≥1920px: ещё больше padding, правая колонка шире (420px)

Моковые данные: 5 Session, 8 ClientRow, 5 Notification — реалистичные русские имена. Вынеси в src/mocks/data.ts.
```

**Промпт 4 — Дашборд клиента:**
```
Создай дашборд клиента для платформы LevelUP на русском языке.

TypeScript-типы (используй те же Session, Profile, Notification что и в дашборде коуча, плюс):

// Коуч клиента (JOIN sessions + profiles + coach_ratings)
interface MyCoachCard {
  coach_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  specializations: string[];
  avg_rating: number;
  sessions_with_me: number;      // количество сессий с этим клиентом
}

// Прогресс клиента (агрегация)
interface ClientProgress {
  total_sessions: number;
  sessions_this_month: number;
  goals_set: number;
  goals_achieved: number;
  streak_days: number;           // дней подряд с активностью
}

// platform.session_packages
interface SessionPackage {
  id: string;
  service_id: string;
  sessions_total: number;
  sessions_used: number;
  price_total: number;
  expires_at: string | null;
  service?: Pick<CoachService, 'title'>;
}

Layout: такой же сайдбар как у коуча, но пункты меню другие:
  - Главная (LayoutDashboard)
  - Мои коучи (Users)
  - Сессии (Video)
  - Игры (Gamepad2)
  - Магазин (ShoppingBag)
  - Библиотека (BookOpen)
  - Диагностика (ClipboardCheck)
  - Настройки (Settings)

Основная область:
1. "Предстоящие сессии" — Session[] (status='confirmed', client_id=currentUser). Карточки: coach avatar + имя, scheduled_at, кнопка "Подключиться" (если до сессии < 10 мин)
2. "Мои коучи" — MyCoachCard[] горизонтальный скролл (avatar, имя, specializations как теги, avg_rating, кнопка "Записаться")
3. "Прогресс" — ClientProgress: визуализация (recharts AreaChart за 30 дней), progress bars для целей, streak badge
4. "Мои абонементы" — SessionPackage[] (если есть): название услуги, sessions_used/sessions_total, expires_at

Моковые данные: 3 Session, 4 MyCoachCard, 1 ClientProgress, 2 SessionPackage. Вынеси в src/mocks/data.ts.
```

**Промпт 5 — Профиль коуча (публичный) + форма бронирования:**
```
Создай публичную страницу профиля коуча для платформы LevelUP на русском языке.

TypeScript-типы (из БД):

// Полный профиль коуча (JOIN profiles + coach_ratings + verification)
interface CoachProfile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  bio: string | null;
  specializations: string[];
  phone: string | null;
  // Дополнительные поля (расширения):
  city: string | null;
  experience_years: number;
  education: string[];
  certifications: string[];
  // Из coach_ratings:
  avg_rating: number;
  total_reviews: number;
  // Верификация:
  is_verified: boolean;          // есть approved документ в verification_documents
}

// platform.coach_services (активные)
interface CoachService {
  id: string;
  title: string;
  description: string | null;
  type: 'individual_session' | 'group_session' | 'consultation' | 'package';
  price: number;
  duration_min: number;
  is_active: boolean;
}

// platform.coach_availability
interface AvailabilitySlot {
  id: string;
  day_of_week: number;          // 0=Вс, 1=Пн, ..., 6=Сб
  time_start: string;           // "09:00"
  time_end: string;             // "18:00"
  slot_duration_min: number;    // 60
}

// platform.reviews (с JOIN на client profile)
interface Review {
  id: string;
  client_first_name: string;
  client_last_name: string;
  client_avatar_url: string | null;
  rating: number;               // 1-5
  text: string | null;
  created_at: string;
}

// Форма бронирования
const bookingSchema = z.object({
  service_id: z.string().uuid(),
  date: z.string(),              // ISO date "2025-03-25"
  time_slot: z.string(),         // "10:00"
  comment: z.string().max(500).optional(),
});
type BookingForm = z.infer<typeof bookingSchema>;

Структура:
1. Шапка: CoachProfile — большое avatar_url, first_name + last_name, specializations как теги, avg_rating (звёзды + total_reviews), city, experience_years лет, is_verified → зелёная галочка
2. "О себе": bio, education (список), certifications (список с иконками)
3. "Услуги и цены": CoachService[] — карточки: title, description, duration_min мин, price ₽, кнопка "Записаться" → открывает модалку бронирования
4. "Расписание": мини-календарь на 2 недели. AvailabilitySlot[] → показать доступные дни зелёным. При клике на день показать свободные time_slot (исключая уже забронированные Session[])
5. "Отзывы": Review[] — аватар, имя, rating (звёзды), text, relative time
6. Боковая панель (sticky): кнопка "Записаться", цена от (min price из services), ближайший свободный слот

МОДАЛКА БРОНИРОВАНИЯ (BookingForm):
- Select service_id (из CoachService[])
- Календарь date (из AvailabilitySlot[])
- Select time_slot (свободные слоты в выбранный день)
- Textarea comment (опционально)
- Кнопка "Забронировать" + итого: price ₽
- onSubmit: console.log(data)

Моковые данные: 1 CoachProfile, 4 CoachService, 7 AvailabilitySlot (Пн-Пт 9-18 + Сб 10-14), 6 Review. Вынеси в src/mocks/data.ts.
```

**4. Генерация экранов для Академии (lovable-проект 2: levelup-academy.ru):**

**Промпт 6 — Лендинг академии + каталог школ:**
```
Создай лендинг платформы онлайн-школ LevelUP Academy на русском языке.

Это SaaS-платформа для создания онлайн-школ (аналог GetCourse). На лендинге две аудитории: владельцы школ и студенты.

TypeScript-типы (из БД):

// tenant.schools (публичная карточка)
interface SchoolCard {
  id: string;
  slug: string;                  // поддомен: my-school.levelup-academy.ru
  name: string;
  description: string | null;
  logo_url: string | null;       // из school_settings.theme
  courses_count: number;         // COUNT из academy.courses
  students_count: number;        // COUNT из academy.enrollments
  category: string;              // из school_settings
}

// tenant.school_plans
interface SchoolPlan {
  id: string;
  name: string;                  // Старт / Рост / Про
  price_monthly: number;
  price_yearly: number | null;
  limits: {
    max_courses: number;
    max_students: number;
    max_storage_mb: number;
  };
  commission_pct: number;        // % комиссии с продаж
  features: Record<string, boolean>;
  is_active: boolean;
}

Структура:
1. Хедер: логотип "LevelUP Academy", навигация (Каталог школ, Создать школу, Тарифы), кнопки "Войти" / "Создать школу бесплатно"
2. Hero-секция: "Создайте свою онлайн-школу за 10 минут", подзаголовок "Курсы, вебинары, сертификаты — всё в одном месте", CTA "Создать школу"
3. Возможности для владельцев: 6 карточек — "Конструктор курсов", "Видеозанятия (LiveKit)", "Сертификаты", "Приём оплаты", "Своё доменное имя", "Аналитика"
4. Каталог школ: сетка SchoolCard[] (logo_url, name, description, courses_count курсов, students_count студентов, кнопка "Перейти" → /{slug})
5. Тарифы: SchoolPlan[] — 3 колонки. Показать: name, price_monthly ₽/мес, limits.max_students, limits.max_courses, commission_pct%, features. CTA "Выбрать"
6. Футер

Моковые данные: 6 SchoolCard с категориями (Бизнес, Психология, IT и т.д.), 3 SchoolPlan (Старт — 0₽/50 студентов, Рост — 2990₽/500, Про — 9990₽/безлимит).

Стиль: яркий, образовательный. Акцентный цвет — зелёный (#22c55e) для CTA.
```

**Промпт 7 — Wizard создания школы:**
```
Создай пошаговый wizard создания онлайн-школы для LevelUP Academy на русском языке.
Используй react-hook-form + zod. Каждый шаг — отдельная зона валидации.

TypeScript-типы (соответствуют tenant.schools + tenant.school_settings + tenant.school_domains):

const createSchoolSchema = z.object({
  // Шаг 1
  name: z.string().min(3, 'Минимум 3 символа').max(100),
  description: z.string().max(200, 'Максимум 200 символов').optional(),
  category: z.enum(['business', 'psychology', 'fitness', 'it', 'languages', 'creative', 'other']),
  // Шаг 2
  logo: z.instanceof(File).optional(),
  theme: z.object({
    colors: z.object({ primary: z.string() }),
    font_family: z.string(),
    border_radius: z.string(),
  }),
  // Шаг 3
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, 'Только латиница, цифры и дефис'),
  custom_domain: z.string().optional(),
});
type CreateSchoolForm = z.infer<typeof createSchoolSchema>;

// Предустановленные темы
const THEMES = [
  { name: 'Синяя', primary: '#2563EB', font: 'Inter', radius: '8px' },
  { name: 'Зелёная', primary: '#22c55e', font: 'Inter', radius: '12px' },
  { name: 'Фиолетовая', primary: '#7c3aed', font: 'Inter', radius: '8px' },
  { name: 'Красная', primary: '#dc2626', font: 'Inter', radius: '4px' },
  { name: 'Оранжевая', primary: '#ea580c', font: 'Inter', radius: '16px' },
  { name: 'Тёмная', primary: '#1e293b', font: 'Inter', radius: '8px' },
];

Шаги (stepper сверху, показывает прогресс):

Шаг 1 — "Название и описание" (name, description, category):
- Input name (обязательно, с ошибкой)
- Textarea description (счётчик символов 0/200)
- Select category (с иконками для каждой категории)
- Кнопка "Далее" — disabled пока шаг невалиден

Шаг 2 — "Бренд" (logo, theme):
- Drag-and-drop загрузка логотипа (preview загруженного файла)
- 6 предустановленных тем (THEMES) в виде карточек + кнопка "Custom" с color picker
- Превью: мини-сайт школы с выбранной темой (header + hero + пара блоков)
- Кнопки "Назад" / "Далее"

Шаг 3 — "Домен" (slug, custom_domain):
- Поддомен: [slug].levelup-academy.ru. При вводе slug показать зелёную/красную иконку доступности (мок: "test" — занят, остальные — свободны)
- Опционально: свой домен custom_domain (с инструкцией CNAME)
- Кнопки "Назад" / "Создать школу"

Шаг 4 — "Готово!":
- Анимация конфетти (библиотека canvas-confetti)
- Ссылка: https://{slug}.levelup-academy.ru
- Кнопки "Перейти в админку" и "Создать первый курс"

onSubmit: console.log(data) на последнем шаге.

Дизайн: чистый, пошаговый, с анимациями переходов (framer-motion).
```

**5. Генерация экранов для школы (lovable-проект 4: *.levelup-academy.ru — админка):**

**Промпт 8 — Админка школы (school-admin):**
```
Создай админ-панель онлайн-школы для платформы LevelUP Academy на русском языке.

TypeScript-типы (из БД):

// tenant.school_analytics_daily
interface SchoolAnalyticsDaily {
  date: string;                  // ISO date
  new_students: number;
  active_students: number;
  revenue: number;
  lessons_completed: number;
  new_enrollments: number;
  video_minutes: number;
}

// academy.courses
interface Course {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  level: 'student' | 'basic' | 'professional' | 'master';
  price: number;
  instructor_id: string;
  status: 'draft' | 'published' | 'archived';
  is_published: boolean;
  created_at: string;
  // JOIN:
  instructor?: Pick<Profile, 'first_name' | 'last_name'>;
  enrollments_count?: number;
  modules_count?: number;
}

// academy.enrollments
interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  status: 'active' | 'completed' | 'canceled' | 'expired';
  progress_pct: number;
  enrolled_at: string;
  source: 'direct' | 'funnel' | 'promo_code' | 'import';
  // JOIN:
  student?: Pick<Profile, 'first_name' | 'last_name' | 'avatar_url'>;
  course?: Pick<Course, 'title'>;
}

// tenant.school_team_members
interface TeamMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'instructor' | 'curator' | 'manager' | 'support';
  permissions: {
    manage_courses: boolean;
    manage_students: boolean;
    manage_payments: boolean;
    manage_settings: boolean;
    manage_team: boolean;
    view_analytics: boolean;
  };
  invited_at: string;
  accepted_at: string | null;
  // JOIN:
  user?: Pick<Profile, 'first_name' | 'last_name' | 'avatar_url' | 'phone'>;
}

Layout:
- Сайдбар: логотип школы (кастомный), пункты:
  - Обзор (LayoutDashboard)
  - Курсы (GraduationCap)
  - Студенты (Users)
  - Видеозанятия (Video)
  - Лендинги (Layout)
  - Библиотека (BookOpen)
  - Финансы (Wallet)
  - Команда (UserPlus)
  - Настройки (Settings)

Главная страница (Обзор):
1. KPI-карточки (из последней SchoolAnalyticsDaily): active_students, courses_count, revenue ₽, enrollments_count
2. "Новые студенты за 30 дней" — recharts AreaChart из SchoolAnalyticsDaily[] (date → new_students)
3. "Последние записи" — DataTable<Enrollment> (student avatar+name, course.title, enrolled_at, status как Badge, source)
4. "Популярные курсы" — recharts BarChart (Course.title → enrollments_count, top 5)

Моковые данные: 30 SchoolAnalyticsDaily (за месяц), 5 Course, 10 Enrollment, 4 TeamMember. Вынеси в src/mocks/data.ts.
```

**Промпт 9 — Страница курса для студента:**
```
Создай страницу прохождения курса для онлайн-школы LevelUP Academy на русском языке.

TypeScript-типы (из БД):

// academy.modules
interface Module {
  id: string;
  course_id: string;
  title: string;
  position: number;
  type: 'module' | 'bonus' | 'exam';
  lessons: Lesson[];             // вложенные
}

// academy.lessons
interface Lesson {
  id: string;
  module_id: string;
  title: string;
  content_type: 'video' | 'text' | 'presentation' | 'quiz' | 'worksheet';
  content: string | null;        // Markdown-текст или URL видео
  position: number;
  duration: number;              // минуты
  // Для UI:
  is_completed: boolean;         // из progress tracking
  is_current: boolean;
  is_locked: boolean;            // предыдущий не завершён
}

// academy.assignments
interface Assignment {
  id: string;
  lesson_id: string;
  student_id: string;
  submission: string | null;
  grade: number | null;          // 0-10
  feedback: string | null;
  status: 'pending' | 'submitted' | 'accepted' | 'revision';
  submitted_at: string | null;
}

// academy.quizzes
interface Quiz {
  id: string;
  lesson_id: string;
  questions: Array<{
    q: string;
    type: 'single' | 'multiple';
    options: string[];
    correct: number | number[];
  }>;
  passing_score: number;         // % для прохождения
}

// Форма сдачи ДЗ
const assignmentSchema = z.object({
  submission: z.string().min(10, 'Минимум 10 символов').or(z.string().url('Ссылка на файл')),
});

Layout:
- Левая панель (сворачиваемая): Module[] → для каждого: title, type badge, Lesson[] — иконка по content_type (Video/FileText/HelpCircle), title, duration мин, статус: is_completed → ✅ / is_current → 🔵 / is_locked → 🔒
- Основная область: текущий Lesson
  - content_type='video': плеер (16:9), кнопки скорости (0.75x, 1x, 1.25x, 1.5x, 2x), кнопка "Отметить просмотренным"
  - content_type='text': Markdown-рендер (content), кнопка "Прочитано"
  - content_type='quiz': Quiz — показать вопросы, radio/checkbox для ответов, кнопка "Проверить", результат: score vs passing_score
  - content_type='worksheet': форма Assignment (textarea submission + кнопка "Отправить на проверку"). Если status='revision' — показать feedback от преподавателя
  - Под уроком: кнопки "← Предыдущий" и "Следующий →"
  - Блок комментариев/вопросов (простой список + textarea для нового)

Хедер: Course.title, progress bar (Enrollment.progress_pct%), кнопка "Вернуться к курсам"

Моковые данные: 1 Course с 3 Module (по 3-4 Lesson в каждом), 1 Quiz (3 вопроса), 2 Assignment. Вынеси в src/mocks/data.ts.
```

**6. Генерация экранов для Ассоциации (lovable-проект 5: levelup-association.ru):**

**Промпт 10 — Лендинг ассоциации:**
```
Создай главную страницу ассоциации коучей LevelUP на русском языке.

Это профессиональное сообщество коучей: сертификация, членство, реестр, мероприятия.

TypeScript-типы:

// Уровень членства
interface MembershipLevel {
  id: string;
  name: string;                  // Ассоциированный / Сертифицированный / Мастер
  slug: 'associated' | 'certified' | 'master';
  requirements: string[];        // ["100+ часов практики", "Супервизия"]
  privileges: string[];          // ["Запись в реестре", "Скидка на мероприятия"]
  annual_fee: number;            // ₽/год
}

// Мероприятие
interface Event {
  id: string;
  title: string;
  date: string;
  format: 'online' | 'offline' | 'hybrid';
  location: string | null;       // для офлайн
  speaker: string;
  description: string;
  price: number;
  seats_available: number;
}

// Коуч в реестре
interface RegistryCoach {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  level: 'associated' | 'certified' | 'master';
  city: string;
  specializations: string[];
  practice_hours: number;
  member_since: string;
}

// Статистика ассоциации (агрегация)
interface AssociationStats {
  total_members: number;
  certified_coaches: number;
  events_held: number;
  supervision_hours: number;
}

Структура:
1. Хедер: логотип "Ассоциация LevelUP", навигация (Членство, Сертификация, Реестр, Мероприятия, Стандарты)
2. Hero: "Профессиональное сообщество коучей России", подзаголовок "Сертификация, супервизия, развитие", CTA "Вступить в ассоциацию"
3. Статистика: AssociationStats — 4 числа в ряд с анимацией countUp
4. Уровни членства: MembershipLevel[] — 3 карточки с requirements, privileges, annual_fee. CTA "Подать заявку"
5. Ближайшие мероприятия: Event[] — карточки: title, date, format badge (online/offline), speaker, price ₽, seats_available мест, кнопка "Зарегистрироваться"
6. Публичный реестр коучей: RegistryCoach[] — поле поиска + фильтр по level/city/specialization + DataTable (avatar+name, level badge, city, specializations теги, practice_hours)
7. Футер

Моковые данные: 1 AssociationStats, 3 MembershipLevel, 4 Event, 10 RegistryCoach. Вынеси в src/mocks/data.ts.

Стиль: строгий, профессиональный. Шрифты: DM Serif Display (заголовки), DM Sans (текст). Цвета: тёмно-синий (#0f1d2f), золотой (#c9a84c) для акцентов, кремовый фон (#faf8f4).
```

**7. Дополнительные промпты — CRUD-формы и настройки (lovable-проект 1: Платформа):**

После генерации основных экранов, сгенерируйте формы для полного CRUD. Эти промпты вставляйте в тот же lovable-проект (Платформа):

**Промпт 11 — Настройки профиля коуча (редактирование):**
```
Создай страницу настроек профиля коуча для платформы LevelUP на русском языке.
Используй react-hook-form + zod.

TypeScript-типы:

const profileSchema = z.object({
  first_name: z.string().min(2),
  last_name: z.string().min(2),
  avatar_url: z.string().url().optional(),     // загрузка файла → URL
  bio: z.string().max(1000).optional(),
  specializations: z.array(z.string()).min(1, 'Выберите минимум 1 специализацию'),
  phone: z.string().regex(/^\+7\d{10}$/, 'Формат: +7XXXXXXXXXX').optional(),
  city: z.string().optional(),
  experience_years: z.number().min(0).max(50),
  education: z.array(z.string()),
  certifications: z.array(z.string()),
  timezone: z.string(),
});
type ProfileForm = z.infer<typeof profileSchema>;

const SPECIALIZATIONS = [
  'Карьерный коучинг', 'Лайф-коучинг', 'Бизнес-коучинг', 'Здоровье и фитнес',
  'Отношения', 'Финансовый коучинг', 'Лидерство', 'Стресс-менеджмент',
  'Тайм-менеджмент', 'Креативность',
];

Страница с табами:
Таб "Личные данные" (ProfileForm):
- Загрузка аватара (drag-and-drop с превью)
- first_name, last_name в одной строке
- bio (textarea с счётчиком символов)
- specializations — multi-select с чекбоксами из SPECIALIZATIONS
- phone (маска +7), city, experience_years (number input)
- timezone (select из популярных: Europe/Moscow, Europe/Samara и т.д.)

Таб "Образование и сертификаты":
- education — dynamic list: input + кнопка "Добавить ещё" + кнопка удалить
- certifications — dynamic list аналогично
- Секция "Верификация": загрузка документов (drag-and-drop), статус каждого: pending/approved/rejected

Кнопка "Сохранить" внизу, onSubmit: console.log(data).
```

**Промпт 12 — CRUD услуг коуча:**
```
Создай страницу управления услугами коуча для платформы LevelUP на русском языке.

TypeScript-типы:

const serviceSchema = z.object({
  title: z.string().min(3, 'Минимум 3 символа'),
  description: z.string().max(500).optional(),
  type: z.enum(['individual_session', 'group_session', 'consultation', 'package']),
  price: z.number().min(0, 'Цена не может быть отрицательной'),
  duration_min: z.number().min(15).max(480),
  is_active: z.boolean(),
});
type ServiceForm = z.infer<typeof serviceSchema>;

// Для отображения
interface CoachService {
  id: string;
  title: string;
  description: string | null;
  type: 'individual_session' | 'group_session' | 'consultation' | 'package';
  price: number;
  duration_min: number;
  is_active: boolean;
  created_at: string;
}

Страница:
1. Заголовок "Мои услуги" + кнопка "+ Новая услуга" (открывает модалку)
2. Список CoachService[] — карточки: title, type badge, price ₽, duration_min мин, is_active toggle, кнопки "Редактировать" / "Удалить"
3. Пустое состояние: "У вас пока нет услуг. Создайте первую!"

МОДАЛКА создания/редактирования (ServiceForm):
- title (input)
- type (select: Индивидуальная сессия / Групповая сессия / Консультация / Пакет)
- price (number input, суффикс ₽)
- duration_min (select: 15/30/45/60/90/120 мин)
- description (textarea)
- is_active (switch)
- Кнопки "Отменить" / "Сохранить"

onSubmit: console.log(data). При "удалении" — confirm-диалог.
Моковые данные: 3 CoachService.
```

**Промпт 13 — Расписание коуча + управление доступностью:**
```
Создай страницу расписания коуча для платформы LevelUP на русском языке.

TypeScript-типы:

interface Session {
  id: string;
  client: { first_name: string; last_name: string; avatar_url: string | null };
  service: { title: string; type: string };
  scheduled_at: string;
  duration_min: number;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
}

interface AvailabilitySlot {
  id: string;
  day_of_week: number;
  time_start: string;
  time_end: string;
  slot_duration_min: number;
  is_active: boolean;
}

const availabilitySchema = z.object({
  day_of_week: z.number().min(0).max(6),
  time_start: z.string().regex(/^\d{2}:\d{2}$/),
  time_end: z.string().regex(/^\d{2}:\d{2}$/),
  slot_duration_min: z.number(),
  is_active: z.boolean(),
});

Два таба:
Таб "Календарь":
- Полноценный недельный/месячный календарь (используй CSS Grid)
- Session[] отображаются как блоки на сетке (цвет по status)
- Клик на сессию → сайдпанель с деталями: client info, service, время, статус, кнопки "Начать" / "Отменить"

Таб "Доступность":
- Таблица 7 строк (Пн-Вс), для каждого дня: toggle is_active, time_start / time_end (time picker), slot_duration_min (select)
- AvailabilitySlot[] — визуальный блок: день → полоски доступного времени
- Кнопка "+ Добавить слот" (для доп. промежутков в один день)
- Кнопка "Сохранить расписание"

Моковые данные: 8 Session на текущую неделю, 5 AvailabilitySlot (Пн-Пт).
```

**Промпт 14 — Страница видеосессии (комната):**
```
Создай страницу видеосессии (видеокомнаты) для платформы LevelUP на русском языке.

TypeScript-типы:

interface VideoSession {
  id: string;
  session_id: string;
  coach: Pick<Profile, 'first_name' | 'last_name' | 'avatar_url'>;
  client: Pick<Profile, 'first_name' | 'last_name' | 'avatar_url'>;
  service_title: string;
  scheduled_at: string;
  duration_min: number;
  livekit_room_name: string;
}

// platform.session_notes
interface SessionNote {
  id: string;
  template_type: 'free_form' | 'GROW' | 'STAR' | 'SOAP' | 'OSCAR';
  content: Record<string, string>;  // {goal: "...", reality: "...", options: "...", will: "..."}
}

// platform.teleconsent
interface Teleconsent {
  session_id: string;
  user_id: string;
  consent_type: 'recording' | 'data_processing';
  signed_at: string;
}

Layout (полноэкранный):
- Основная область: два видео-блока (коуч + клиент) — заглушки с аватарами (реальное видео будет через LiveKit SDK)
- Нижняя панель: кнопки Микрофон вкл/выкл, Камера вкл/выкл, Демонстрация экрана, Запись (с иконкой), Чат, Завершить
- Боковая панель (скрываемая, справа):
  - Таб "Чат": список сообщений + input
  - Таб "Заметки" (только для коуча): select template_type → форма SessionNote. GROW: 4 textarea (Goal, Reality, Options, Will). STAR: 4 textarea. Free_form: 1 textarea
  - Таб "Игры": кнопки запуска МАК-карт, кубиков
- Хедер: таймер сессии (обратный отсчёт duration_min), client/coach name, кнопка свернуть

МОДАЛКА TELECONSENT (при входе):
- "Согласие на запись видеосессии"
- Чекбокс consent_type='recording': "Я согласен на видеозапись сессии"
- Чекбокс consent_type='data_processing': "Я согласен на обработку персональных данных"
- Кнопка "Подтвердить и войти" (disabled пока оба не отмечены)

Моковые данные: 1 VideoSession, шаблоны GROW/STAR/SOAP/OSCAR.
```

**Промпт 15 — Финансы коуча:**
```
Создай страницу финансов коуча для платформы LevelUP на русском языке.

TypeScript-типы:

// billing.payments (для коуча — входящие)
interface Payment {
  id: string;
  user_id: string;
  amount: number;
  currency: string;              // 'RUB'
  provider: 'yookassa' | 'manual' | 'free';
  provider_tx_id: string | null;
  status: 'pending' | 'succeeded' | 'canceled' | 'refunded';
  metadata: { session_id?: string; type: string };
  created_at: string;
  // JOIN:
  client?: Pick<Profile, 'first_name' | 'last_name'>;
  service?: Pick<CoachService, 'title'>;
}

// Статистика
interface FinanceStats {
  total_revenue: number;         // за всё время
  revenue_this_month: number;
  pending_payouts: number;       // ожидает выплаты
  sessions_paid: number;
}

Страница:
1. KPI-карточки: FinanceStats — total_revenue ₽, revenue_this_month ₽, pending_payouts ₽, sessions_paid
2. График "Доход за 6 месяцев" (recharts BarChart, помесячно)
3. DataTable<Payment> с колонками: дата, клиент, услуга, amount ₽, status (badge: зелёный/жёлтый/красный), provider
   - Фильтры: по status, по дате (date range picker)
   - Сортировка по дате, сумме
   - Пагинация
4. Кнопка "Выгрузить в Excel"

Моковые данные: 1 FinanceStats, 15 Payment за 3 месяца.
```

**8. Дополнительные промпты — CRUD-формы (lovable-проект 4: Админка школы):**

Вставляйте в lovable-проект Админки школы:

**Промпт 16 — Создание/редактирование курса (admin):**
```
Создай страницу создания и редактирования курса для админки школы LevelUP Academy на русском языке.

TypeScript-типы:

const courseSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  level: z.enum(['student', 'basic', 'professional', 'master']),
  price: z.number().min(0),
  instructor_id: z.string().uuid(),
  is_published: z.boolean(),
  landing_enabled: z.boolean(),
});
type CourseForm = z.infer<typeof courseSchema>;

const moduleSchema = z.object({
  title: z.string().min(2),
  type: z.enum(['module', 'bonus', 'exam']),
  position: z.number(),
});

const lessonSchema = z.object({
  title: z.string().min(2),
  content_type: z.enum(['video', 'text', 'presentation', 'quiz', 'worksheet']),
  content: z.string().optional(),
  duration: z.number().min(0).optional(),
  position: z.number(),
});

interface Module {
  id: string;
  title: string;
  position: number;
  type: 'module' | 'bonus' | 'exam';
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  content_type: 'video' | 'text' | 'presentation' | 'quiz' | 'worksheet';
  content: string | null;
  position: number;
  duration: number;
}

Страница (три секции):
1. Хедер: "Создание курса" (или "Редактирование: {title}"), кнопки "Сохранить черновик" / "Опубликовать"

2. Основная форма (CourseForm):
   - title (input)
   - description (rich textarea / markdown)
   - level (select: Начальный/Базовый/Профессиональный/Мастер)
   - price (number, суффикс ₽), 0 = бесплатный курс
   - instructor_id (select из TeamMember[] с ролью instructor)
   - landing_enabled (switch "Включить лендинг курса")
   - Обложка курса (drag-and-drop image upload)

3. Конструктор модулей и уроков (drag-and-drop сортировка):
   - Список Module[]: для каждого — title (inline edit), type badge, кнопка "Добавить урок", кнопка удалить
   - Внутри каждого модуля: Lesson[] — иконка content_type, title (inline edit), duration, кнопка "Редактировать" → открывает панель
   - Drag-and-drop для пересортировки модулей и уроков (используй @dnd-kit/sortable)
   - Кнопка "+ Новый модуль" внизу
   - При клике "Редактировать урок": сайдпанель с content_type select, content textarea (Markdown для текста, URL для видео), duration

Моковые данные: 1 Course с 2 Module и 3 Lesson в каждом, 3 TeamMember (instructor).
```

**Промпт 17 — Управление студентами школы:**
```
Создай страницу управления студентами для админки школы LevelUP Academy на русском языке.

TypeScript-типы:

interface StudentRow {
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  phone: string | null;
  enrolled_courses: number;
  active_courses: number;
  total_payments: number;        // ₽
  last_activity_at: string;
  enrolled_at: string;           // первая запись
}

interface Enrollment {
  id: string;
  course_title: string;
  status: 'active' | 'completed' | 'canceled' | 'expired';
  progress_pct: number;
  enrolled_at: string;
  source: 'direct' | 'funnel' | 'promo_code' | 'import';
}

Страница:
1. Хедер: "Студенты ({count})" + кнопка "Импортировать CSV" + кнопка "Добавить вручную"
2. Фильтры: поиск по имени/email, select курс, select статус, date range "записан с...по"
3. DataTable<StudentRow>:
   - avatar + first_name + last_name
   - enrolled_courses / active_courses
   - total_payments ₽
   - last_activity_at (relative time)
   - enrolled_at
   - Кнопки: "Профиль" / "Написать"
4. Клик на строку → сайдпанель "Профиль студента":
   - Инфо: имя, phone, email
   - Enrollment[] — список курсов с progress_pct bar и status badge
   - Кнопки: "Записать на курс", "Заблокировать"

Моковые данные: 15 StudentRow, 3 Enrollment для первого.
```

**Промпт 18 — Настройки школы:**
```
Создай страницу настроек школы для админки LevelUP Academy на русском языке.

TypeScript-типы (из tenant.school_settings):

const settingsSchema = z.object({
  // Основные
  name: z.string().min(3),
  description: z.string().max(500).optional(),
  // Бренд
  theme: z.object({
    colors: z.object({ primary: z.string() }),
    font_family: z.string(),
    border_radius: z.string(),
  }),
  custom_css: z.string().optional(),
  // Домен
  slug: z.string().regex(/^[a-z0-9-]+$/),
  custom_domain: z.string().optional(),
  // Email-брендинг
  email_branding: z.object({
    sender_name: z.string().optional(),
    reply_to: z.string().email().optional(),
  }),
  // Социальные сети
  socials: z.object({
    vk: z.string().url().optional(),
    telegram: z.string().optional(),
    youtube: z.string().url().optional(),
    website: z.string().url().optional(),
  }),
  // SEO
  meta_tags: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
  }),
  analytics_code: z.string().optional(),
  // Функции
  features: z.object({
    video_sessions: z.boolean(),
    chat: z.boolean(),
    certificates: z.boolean(),
    library: z.boolean(),
    gameboard: z.boolean(),
    crm: z.boolean(),
    blog: z.boolean(),
  }),
});

Страница с вертикальными табами (sidebar-навигация):
1. "Основные" — name, description
2. "Бренд" — color picker (primary), font_family select, border_radius select, custom_css textarea, live-превью
3. "Домен" — slug (поддомен), custom_domain, статус SSL (badge)
4. "Email" — sender_name, reply_to
5. "Соцсети" — VK, Telegram, YouTube, Website (input с иконками)
6. "SEO" — meta title, meta description, analytics_code textarea
7. "Функции" — toggle для каждого feature с описанием
8. "Команда" — TeamMember[] таблица: avatar+name, role badge, permissions checkboxes, кнопка "Удалить". Кнопка "Пригласить"

Каждый таб — секция формы. Одна кнопка "Сохранить все" внизу.
Моковые данные: текущие настройки школы, 3 TeamMember.
```

**9. Дополнительные промпты — SPA школы (lovable-проект 3: apps/school) — то, что видит студент:**

Это отдельное приложение от админки! Студент школы видит это на `my-school.levelup-academy.ru`. Генерируйте в отдельном lovable-проекте.

**Промпт 19 — Главная страница школы + каталог курсов (student-facing):**
```
Создай публичную главную страницу онлайн-школы для LevelUP Academy на русском языке.

Это страница конкретной школы (my-school.levelup-academy.ru), которую видят студенты и посетители. Школа имеет собственный бренд (цвета, логотип).

TypeScript-типы:

// Настройки школы (из tenant.school_settings — загружаются при инициализации)
interface SchoolPublicInfo {
  name: string;
  description: string | null;
  logo_url: string | null;
  theme: {
    colors: { primary: string };
    font_family: string;
    border_radius: string;
  };
  socials: { vk?: string; telegram?: string; youtube?: string; website?: string };
}

// academy.courses (опубликованные)
interface CourseCard {
  id: string;
  title: string;
  description: string | null;
  level: 'student' | 'basic' | 'professional' | 'master';
  price: number;                 // 0 = бесплатный
  instructor: { first_name: string; last_name: string; avatar_url: string | null };
  enrollments_count: number;
  modules_count: number;
  is_published: boolean;
  created_at: string;
}

ВАЖНО: все цвета компонентов должны использовать CSS-переменные var(--school-primary), var(--school-radius) и т.д., а не захардкоженные значения. В моках задай CSS-переменные через :root.

Структура:
1. Хедер: school logo (logo_url), school name, навигация (Курсы, О школе, Блог, Контакты), кнопки "Войти" / "Начать обучение"
2. Hero-секция: school name, description, CTA "Смотреть курсы". Фон = var(--school-primary)
3. Каталог курсов: сетка CourseCard[] — обложка, title, level badge, price (0₽ = "Бесплатно"), instructor avatar+name, enrollments_count студентов, кнопка "Подробнее"
4. Фильтры: по level, по цене (бесплатные/платные), поиск по названию
5. О школе: description (расширенный), team (инструкторы школы)
6. Футер: socials иконки, контакты, copyright

Моковые данные: 1 SchoolPublicInfo (тема: зелёная), 6 CourseCard, 3 инструктора.
```

**Промпт 20 — Личный кабинет студента школы (student-portal):**
```
Создай личный кабинет студента онлайн-школы для LevelUP Academy на русском языке.

Студент авторизован и видит свои курсы, прогресс, расписание видеозанятий, сертификаты.

TypeScript-типы:

// Мои курсы (academy.enrollments + courses)
interface MyEnrollment {
  id: string;
  course_id: string;
  course_title: string;
  course_level: string;
  instructor_name: string;
  status: 'active' | 'completed' | 'canceled' | 'expired';
  progress_pct: number;          // 0-100
  enrolled_at: string;
  next_lesson?: { title: string; content_type: string };
}

// Расписание (academy.video_sessions)
interface UpcomingVideoSession {
  id: string;
  title: string;
  type: 'lecture' | 'webinar' | 'supervision' | 'consultation' | 'group_practice';
  scheduled_at: string;
  host_name: string;
  livekit_room_name: string;
}

// academy.issued_certificates
interface Certificate {
  id: string;
  course_title: string;
  certificate_number: string;    // CERT-school-2025-001
  issued_at: string;
  pdf_url: string;
}

// academy.assignments (мои ДЗ)
interface MyAssignment {
  id: string;
  lesson_title: string;
  course_title: string;
  status: 'pending' | 'submitted' | 'accepted' | 'revision';
  grade: number | null;
  feedback: string | null;
  submitted_at: string | null;
}

Layout:
- Хедер: school logo + name, навигация: Мои курсы, Расписание, Задания, Сертификаты, Профиль
- Используй CSS-переменные var(--school-primary) и т.д.

Страница "Мои курсы" (по умолчанию):
1. MyEnrollment[] — карточки: course_title, level badge, progress_pct (progress bar), status badge, next_lesson → кнопка "Продолжить"
2. Пустое состояние: "Вы пока не записаны на курсы" + кнопка "Каталог курсов"

Страница "Расписание":
- UpcomingVideoSession[] — карточки: title, type badge, scheduled_at, host_name, кнопка "Подключиться" (если < 15 мин до начала)

Страница "Задания":
- MyAssignment[] — таблица: lesson_title, course_title, status badge, grade, submitted_at. Клик → детали + feedback

Страница "Сертификаты":
- Certificate[] — карточки: course_title, certificate_number, issued_at, кнопка "Скачать PDF"

Моковые данные: 3 MyEnrollment, 2 UpcomingVideoSession, 4 MyAssignment, 1 Certificate.
```

**10. Дополнительные промпты — недостающие модули админки школы (lovable-проект 4):**

**Промпт 21 — Промо-коды и продажи (school-admin):**
```
Создай страницу управления промо-кодами и продажами для админки школы LevelUP Academy на русском языке.

TypeScript-типы:

// tenant.school_promo_codes
interface PromoCode {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  applicable_to: { all_courses: boolean; course_ids?: string[] };
  is_active: boolean;
}

const promoCodeSchema = z.object({
  code: z.string().min(3).max(20).regex(/^[A-Z0-9-]+$/, 'Только заглавные латинские, цифры и дефис'),
  discount_type: z.enum(['percentage', 'fixed_amount']),
  discount_value: z.number().min(1),
  max_uses: z.number().min(1).nullable(),
  valid_from: z.string().nullable(),
  valid_until: z.string().nullable(),
  applicable_to: z.object({
    all_courses: z.boolean(),
    course_ids: z.array(z.string()).optional(),
  }),
});

// billing.payments (школы)
interface SchoolOrder {
  id: string;
  student_name: string;
  course_title: string;
  amount: number;
  status: 'pending' | 'succeeded' | 'canceled' | 'refunded';
  promo_code: string | null;
  created_at: string;
}

Два таба:

Таб "Промо-коды":
1. DataTable<PromoCode>: code, discount (тип+значение), used_count/max_uses, valid_until, is_active toggle, кнопки Edit/Delete
2. Кнопка "+ Создать промо-код" → модалка с promoCodeSchema формой
3. При discount_type='percentage' — показать "% скидка", при 'fixed_amount' — "₽ скидка"

Таб "Заказы":
1. DataTable<SchoolOrder>: дата, студент, курс, сумма ₽, промо-код, статус badge
2. Фильтры: по дате, по курсу, по статусу
3. KPI вверху: общая выручка, заказов за месяц, средний чек

Моковые данные: 5 PromoCode, 12 SchoolOrder.
```

**Промпт 22 — Шаблоны сертификатов (school-admin):**
```
Создай страницу управления шаблонами сертификатов для админки школы LevelUP Academy.

TypeScript-типы:

interface CertificateTemplate {
  id: string;
  title: string;
  template_html: string;         // HTML с {{student_name}}, {{course_title}} и т.д.
  variables: string[];
  is_default: boolean;
  created_at: string;
}

interface IssuedCertificate {
  id: string;
  student_name: string;
  course_title: string;
  certificate_number: string;
  issued_at: string;
  template_title: string;
}

Страница:
1. Список шаблонов: карточки с превью (рендер HTML в div), title, is_default badge, кнопки "Редактировать" / "Превью" / "Удалить"
2. Кнопка "+ Новый шаблон"

Редактор шаблона:
- title (input)
- template_html (textarea с подсветкой)
- Доступные переменные: {{student_name}}, {{course_title}}, {{date}}, {{certificate_number}}, {{school_name}} — показать как chips, по клику вставить
- is_default (switch)
- Живой превью справа: HTML с подставленными моковыми значениями
- Кнопка "Сохранить"

3. Таб "Выданные": DataTable<IssuedCertificate>

Моковые данные: 2 CertificateTemplate, 5 IssuedCertificate.
```

**Промпт 23 — Список курсов (school-admin):**
```
Создай страницу списка курсов для админки школы LevelUP Academy на русском языке.

TypeScript-типы:

// academy.courses (расширенный для таблицы)
interface CourseListItem {
  id: string;
  title: string;
  description: string | null;
  level: 'student' | 'basic' | 'professional' | 'master';
  price: number;                   // 0 = бесплатный
  status: 'draft' | 'published' | 'archived';
  is_published: boolean;
  created_at: string;
  updated_at: string;
  // JOIN/агрегация:
  instructor?: Pick<Profile, 'first_name' | 'last_name' | 'avatar_url'>;
  enrollments_count: number;       // кол-во студентов
  modules_count: number;           // кол-во модулей
  lessons_count: number;           // общее кол-во уроков
  completion_rate: number;         // % завершивших, 0-100
  revenue: number;                 // выручка по курсу ₽
}

Страница:
1. Хедер: "Курсы ({count})" + кнопка "+ Создать курс" (primary gold) → переход на страницу промпта 16

2. KPI-карточки (3 шт., над таблицей):
   - "Всего курсов" (count)
   - "Активных студентов" (сумма enrollments где status='active')
   - "Выручка за месяц" (₽)

3. Фильтры:
   - Поиск по названию (input)
   - Статус: select (Все / Черновик / Опубликован / Архив)
   - Уровень: select (Все / Начальный / Базовый / Профессиональный / Мастер)
   - Преподаватель: select из TeamMember[]

4. DataTable<CourseListItem> (@tanstack/react-table):
   - Колонки: title + level badge, instructor (avatar + имя), enrollments_count, modules_count + lessons_count, price ₽ (0 → "Бесплатно"), status badge (draft=серый, published=зелёный, archived=красный), completion_rate (mini progress bar), revenue ₽
   - Сортировка по: title, enrollments_count, price, created_at, revenue
   - Строка при hover → подсветка
   - Действия (dropdown menu): "Редактировать", "Дублировать", "Архивировать" / "Опубликовать" (toggle), "Удалить" (красный, confirmation)

5. Empty state (если нет курсов): иконка GraduationCap, "Создайте свой первый курс", описание "Добавьте модули, уроки и начните обучение студентов", CTA-кнопка "Создать курс"

Моковые данные: 8 CourseListItem с разными статусами и уровнями, 3 instructor.
```

**Промпт 24 — Финансы школы (school-admin):**
```
Создай страницу финансов для админки школы LevelUP Academy на русском языке.

TypeScript-типы:

// billing.school_transactions
interface SchoolTransaction {
  id: string;
  type: 'course_payment' | 'subscription' | 'refund' | 'payout';
  student_name: string | null;     // null для subscription/payout
  course_title: string | null;     // null для subscription/payout
  amount: number;                  // положительное для платежей, отрицательное для возвратов
  commission: number;              // комиссия платформы ₽
  net_amount: number;              // amount - commission
  status: 'succeeded' | 'pending' | 'failed' | 'refunded';
  payment_method: 'card' | 'yookassa' | 'invoice' | 'manual';
  promo_code: string | null;
  created_at: string;
}

// Агрегация
interface SchoolFinanceStats {
  total_revenue: number;           // за период
  total_commission: number;        // удержано платформой
  net_income: number;              // к выплате
  transactions_count: number;
  avg_check: number;
  refunds_count: number;
  refunds_amount: number;
}

// Для графика
interface RevenueByDay {
  date: string;
  revenue: number;
  refunds: number;
}

// Для распределения по курсам
interface RevenueByCoursePie {
  course_title: string;
  revenue: number;
  enrollments: number;
}

Страница:
1. Хедер: "Финансы" + период (date range picker: Сегодня / 7 дней / 30 дней / Квартал / Произвольный) + кнопка "Экспорт CSV" (secondary)

2. KPI-карточки (4 шт., с цветными полосками сверху):
   - "Выручка" ₽ (total_revenue, синяя полоска)
   - "Комиссия платформы" ₽ (total_commission, оранжевая)
   - "Чистый доход" ₽ (net_income, зелёная)
   - "Средний чек" ₽ (avg_check, золотая)

3. Два графика в ряд (recharts):
   - "Выручка по дням" — AreaChart (RevenueByDay[]: date → revenue, с областью refunds другим цветом)
   - "Выручка по курсам" — PieChart / DonutChart (RevenueByCoursePie[], цвета из палитры)

4. DataTable<SchoolTransaction>:
   - Колонки: дата (dd.mm.yyyy HH:mm), тип (badge: payment=зелёный, refund=красный, subscription=синий, payout=фиолетовый), студент, курс, сумма ₽, комиссия ₽, нетто ₽, промо-код (если есть), статус badge
   - Фильтры: тип (multi-select), статус, курс
   - Сортировка по дате, сумме

5. Подвал таблицы: итоги по отфильтрованным данным (сумма, кол-во)

Моковые данные: SchoolFinanceStats, 30 RevenueByDay, 5 RevenueByCoursePie, 20 SchoolTransaction.
```

**Промпт 25 — Конструктор страниц / Лендинги школы (school-admin):**
```
Создай страницу управления лендингами (страницами школы) для админки LevelUP Academy на русском языке.

TypeScript-типы:

interface SchoolPage {
  id: string;
  slug: string;                    // URL: my-school.levelup-academy.ru/{slug}
  title: string;
  type: 'home' | 'about' | 'contacts' | 'faq' | 'custom';
  status: 'published' | 'draft';
  blocks: PageBlock[];
  meta_title: string | null;
  meta_description: string | null;
  updated_at: string;
  created_at: string;
}

type BlockType = 'hero' | 'text' | 'features' | 'cta' | 'faq' | 'team' | 'gallery' | 'testimonials';

interface PageBlock {
  id: string;
  type: BlockType;
  position: number;
  data: Record<string, any>;       // содержимое зависит от type
  // Примеры data:
  // hero: { title, subtitle, button_text, button_url, background_image }
  // text: { content (Markdown) }
  // features: { items: [{ icon, title, description }] }
  // cta: { title, description, button_text, button_url }
  // faq: { items: [{ question, answer }] }
}

Два режима (switch в хедере): "Список страниц" и "Редактор"

Режим "Список страниц":
1. Хедер: "Страницы школы" + кнопка "+ Новая страница" (primary)
2. Таблица/карточки SchoolPage[]:
   - title, type badge (home=синий, about=зелёный, contacts=оранжевый, faq=фиолетовый, custom=серый)
   - slug (как ссылка: /about)
   - status toggle (published/draft)
   - blocks_count (кол-во блоков)
   - updated_at (relative time)
   - Действия: "Редактировать", "Предпросмотр" (открывает превью), "Удалить"
3. Системные страницы (home, about, contacts) нельзя удалить — только редактировать

Режим "Редактор" (при создании/редактировании страницы):
1. Хедер: title (inline edit) + slug (inline edit) + статус toggle + кнопки "Сохранить" / "Предпросмотр"

2. Левая панель (70%): конструктор блоков
   - Список блоков (drag-and-drop сортировка через @dnd-kit/sortable)
   - Каждый блок: type иконка + title + кнопки "Настроить" / "Удалить" / drag-handle
   - Кнопка "+ Добавить блок" → выбор из BlockType[] (иконка + название + описание)

3. При клике "Настроить": панель настроек блока справа (30%)
   - hero: title (input), subtitle (textarea), button_text, button_url, background_image (upload)
   - text: content (textarea / Markdown)
   - features: список items[] — icon (emoji picker), title, description. Кнопка "+ Добавить"
   - cta: title, description, button_text, button_url, background_color (color picker)
   - faq: список items[] — question, answer (textarea). Кнопка "+ Добавить"

4. Правая панель (закрываемая): SEO — meta_title, meta_description, OG image

5. Живой превью: кнопка "Предпросмотр" → рендер всех блоков в модалке (упрощённая визуализация)

Моковые данные: 4 SchoolPage (home с 3 блоками, about с 2, contacts с 1, FAQ с 1), включая блоки с реалистичным data.
```

**Промпт 26 — Видеозанятия школы (school-admin):**
```
Создай страницу управления видеозанятиями для админки школы LevelUP Academy на русском языке.

TypeScript-типы:

// academy.video_sessions
interface VideoSession {
  id: string;
  title: string;
  type: 'lecture' | 'webinar' | 'supervision' | 'consultation' | 'group_practice';
  course_id: string | null;
  course_title: string | null;
  instructor_name: string;
  scheduled_at: string;
  duration_minutes: number;
  is_recurring: boolean;
  recurrence_rule: string | null;  // RRULE
  room_url: string | null;
  recording_url: string | null;
  status: 'scheduled' | 'live' | 'completed' | 'canceled';
  max_participants: number | null;
  participants_count: number;
}

// academy.video_session_participants
interface VideoParticipant {
  id: string;
  session_id: string;
  student_name: string;
  joined_at: string | null;
  left_at: string | null;
  duration_minutes: number;
  status: 'registered' | 'attended' | 'missed';
}

const videoSessionSchema = z.object({
  title: z.string().min(3, 'Минимум 3 символа'),
  type: z.enum(['lecture', 'webinar', 'supervision', 'consultation', 'group_practice']),
  course_id: z.string().nullable(),
  scheduled_at: z.string(),
  duration_minutes: z.number().min(15).max(480),
  is_recurring: z.boolean(),
  recurrence_rule: z.string().nullable(),
  max_participants: z.number().min(1).nullable(),
});

Страница:

1. Верхняя панель KPI (4 карточки):
   - Всего занятий (за месяц)
   - Ближайшее занятие (дата+время)
   - Средняя посещаемость (%)
   - Часов проведено (за месяц)

2. Два режима отображения (toggle): Календарь / Список
   - Календарь: react-big-calendar с видео-занятиями по дням, цветовая кодировка по type
   - Список: DataTable<VideoSession> — title, type badge, course, дата, instructor, participants_count/max, status badge, действия

3. Кнопка "+ Новое занятие" → модалка с videoSessionSchema:
   - Выбор type (dropdown с иконками)
   - Привязка к курсу (select из курсов или null)
   - Дата/время (datetime picker)
   - Длительность (slider 15-480 мин)
   - Повторение (toggle → RRULE: ежедневно, еженедельно, по дням недели)
   - Макс. участников

4. При клике на занятие → детальная карточка:
   - Информация о занятии
   - Таб "Участники": DataTable<VideoParticipant> — имя, статус badge, время присутствия
   - Таб "Запись": видеоплеер (если recording_url), кнопка "Скачать"
   - Кнопки: "Начать занятие" (→ room_url), "Редактировать", "Отменить"

5. Фильтры: по type, по курсу, по статусу, по дате

Моковые данные: 8 VideoSession (разные типы и статусы), 15 VideoParticipant.
```

**Промпт 27 — Библиотека школы (school-admin):**
```
Создай страницу управления библиотекой материалов для админки школы LevelUP Academy на русском языке.

TypeScript-типы:

// content.library_items (tenant-scoped)
interface LibraryItem {
  id: string;
  title: string;
  description: string | null;
  type: 'pdf' | 'docx' | 'video' | 'audio' | 'image' | 'archive' | 'link';
  category_id: string | null;
  category_name: string | null;
  tags: string[];
  file_url: string;
  file_size: number;       // bytes
  thumbnail_url: string | null;
  access_level: 'all_students' | 'enrolled_only' | 'specific_courses';
  course_ids: string[];
  download_count: number;
  uploaded_by: string;
  created_at: string;
}

interface LibraryCategory {
  id: string;
  name: string;
  icon: string;           // lucide icon name
  items_count: number;
  sort_order: number;
}

const libraryItemSchema = z.object({
  title: z.string().min(2, 'Минимум 2 символа'),
  description: z.string().nullable(),
  type: z.enum(['pdf', 'docx', 'video', 'audio', 'image', 'archive', 'link']),
  category_id: z.string().nullable(),
  tags: z.array(z.string()),
  access_level: z.enum(['all_students', 'enrolled_only', 'specific_courses']),
  course_ids: z.array(z.string()),
});

Страница:

1. Верхняя панель KPI (4 карточки):
   - Всего материалов
   - Общий размер (МБ/ГБ)
   - Скачиваний за месяц
   - Категорий

2. Левая панель (240px) — дерево категорий:
   - Список LibraryCategory с иконками и items_count
   - Кнопка "+ Категория" → inline input
   - Drag-and-drop сортировка
   - "Все материалы" наверху (активно по умолчанию)

3. Основная область — материалы:
   - Переключатель вид: сетка / список
   - Сетка: карточки с thumbnail (или иконка по type), title, type badge, tags, download_count, access_level badge
   - Список: DataTable<LibraryItem> — title, type badge, category, size (форматированный), access badge, downloads, дата, действия
   - Фильтры: по type, по access_level, поиск по title/tags

4. Кнопка "+ Загрузить" → модалка:
   - Drag-and-drop зона для файлов (или URL для type='link')
   - Форма libraryItemSchema
   - Tags: input с chip-добавлением
   - Access level: radio group с условным select курсов при specific_courses
   - Прогресс-бар загрузки

5. При клике на материал → сайдпанель:
   - Превью (PDF-embed, видео-плеер, аудио-плеер, или иконка)
   - Метаданные: размер, тип, дата, загрузил, скачиваний
   - Кнопки: "Скачать", "Редактировать", "Удалить"
   - Управление доступом (access_level + course_ids)

Моковые данные: 4 LibraryCategory, 10 LibraryItem (разные типы), 3 курса для привязки.
```

**Промпт 28 — Полный Theme Engine (school-admin, настройки):**
```
Создай расширенную страницу настройки темы школы для админки LevelUP Academy на русском языке.

Это расширение таба "Бренд" в настройках (промпт 18). Создай ОТДЕЛЬНУЮ страницу "Конструктор темы" (доступна через сайдбар и из таба "Бренд").

TypeScript-типы:

interface SchoolTheme {
  id: string;
  preset_name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
  };
  font_heading: string;     // Google Font name
  font_body: string;        // Google Font name
  border_radius: number;    // 0-16px
  logo_url: string | null;
  favicon_url: string | null;
  custom_css: string | null;
}

interface ThemePreset {
  id: string;
  name: string;
  preview_url: string;
  colors: SchoolTheme['colors'];
  font_heading: string;
  font_body: string;
  border_radius: number;
}

Страница:

1. Левая панель (320px) — настройки:
   a) Пресеты тем (10 шт., сетка 2 колонки): карточки-превью, по клику — применить
      Пресеты: Минималист, Корпоративный, Тёплый, Неон, Пастельный, Тёмный, Природа, Океан, Закат, Монохром
   b) Цвета (6 полей): color picker (react-colorful) для каждого из 6 цветов
   c) Шрифты: два dropdown (heading + body) с 15 Google Fonts (Inter, Roboto, Open Sans, Montserrat, Lato, Raleway, Poppins, Nunito, Playfair Display, Merriweather, DM Sans, DM Serif Display, Source Sans Pro, PT Sans, Fira Sans). Превью каждого шрифта в dropdown
   d) Скругление: slider 0-16px с превью
   e) Кастомный CSS: code editor (textarea с моноширинным шрифтом), с предупреждением "Опасные свойства будут удалены"
   f) Логотип + Favicon: загрузка (drag-and-drop)

2. Правая панель (оставшееся) — живой превью:
   - Мини-версия сайта школы с применённой темой
   - Показывает: header с логотипом, hero-секция, карточки курсов (2 шт.), кнопки, footer
   - Все CSS-переменные обновляются в реальном времени при изменении настроек

3. Нижняя панель:
   - Кнопка "Сохранить тему" (primary)
   - Кнопка "Сбросить к пресету" (secondary)
   - Кнопка "Экспорт CSS" (скачать .css файл с переменными)

Моковые данные: 10 ThemePreset с реалистичными цветовыми схемами.
```

**Промпт 29 — Тесты и квизы (school-admin):**
```
Создай страницу конструктора тестов/квизов для админки школы LevelUP Academy на русском языке.

TypeScript-типы:

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  course_id: string | null;
  course_title: string | null;
  lesson_id: string | null;
  questions_count: number;
  passing_score: number;        // 0-100%
  max_attempts: number | null;
  time_limit_minutes: number | null;
  shuffle_questions: boolean;
  show_correct_answers: boolean;
  status: 'draft' | 'published' | 'archived';
  attempts_count: number;
  avg_score: number | null;
  created_at: string;
}

interface QuizQuestion {
  id: string;
  quiz_id: string;
  type: 'single_choice' | 'multiple_choice' | 'text_answer' | 'matching' | 'ordering';
  text: string;
  image_url: string | null;
  options: QuizOption[];
  correct_answer: string | string[];  // для text_answer — строка, для matching — массив пар
  points: number;
  explanation: string | null;
  sort_order: number;
}

interface QuizOption {
  id: string;
  text: string;
  is_correct: boolean;
}

interface QuizAttempt {
  id: string;
  quiz_title: string;
  student_name: string;
  score: number;
  passed: boolean;
  started_at: string;
  completed_at: string | null;
  answers_count: number;
}

Страница:

1. Список квизов: DataTable<Quiz> — title, course, questions_count, passing_score%, attempts, avg_score%, status badge, действия
2. KPI: всего тестов, среднее прохождение %, сдали с первой попытки %

3. Кнопка "+ Новый тест" → переход в конструктор:
   a) Шапка: title, description, привязка к курсу/уроку
   b) Настройки: passing_score (slider), max_attempts, time_limit, shuffle, show_correct
   c) Список вопросов (drag-and-drop сортировка):
      - Каждый вопрос: карточка с type badge, text, options, points
      - Кнопка "+ Вопрос" → выбор type → форма:
        * single_choice: текст + варианты (radio, отметить правильный)
        * multiple_choice: текст + варианты (checkbox, отметить правильные)
        * text_answer: текст + правильный ответ (exact match)
        * matching: два столбца для соответствий
        * ordering: элементы для правильной последовательности
      - explanation (опционально) — пояснение к правильному ответу
   d) Кнопки: "Сохранить черновик", "Опубликовать", "Превью"

4. Таб "Результаты": DataTable<QuizAttempt> — студент, тест, баллы, passed badge, дата, длительность

Моковые данные: 4 Quiz, 12 QuizQuestion (разные типы), 8 QuizAttempt.
```

**Промпт 30 — Рабочие листы / Worksheets (school-admin):**
```
Создай страницу управления рабочими листами (worksheets) для админки школы LevelUP Academy на русском языке.

TypeScript-типы:

interface Worksheet {
  id: string;
  title: string;
  description: string | null;
  course_id: string | null;
  course_title: string | null;
  fields: WorksheetField[];
  status: 'draft' | 'published' | 'archived';
  submissions_count: number;
  created_at: string;
}

interface WorksheetField {
  id: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'radio' | 'scale' | 'date' | 'file_upload';
  label: string;
  placeholder: string | null;
  required: boolean;
  options: string[] | null;       // для select/radio/checkbox
  scale_min: number | null;       // для scale (1-10)
  scale_max: number | null;
  sort_order: number;
}

interface WorksheetSubmission {
  id: string;
  worksheet_title: string;
  student_name: string;
  submitted_at: string;
  status: 'submitted' | 'reviewed' | 'needs_revision';
  feedback: string | null;
  answers: Record<string, any>;
}

Страница:

1. Список рабочих листов: карточки или DataTable — title, course, fields count, submissions_count, status badge, действия
2. KPI: всего листов, заполнений за месяц, ожидают проверки

3. Кнопка "+ Новый рабочий лист" → конструктор:
   a) Шапка: title, description, привязка к курсу
   b) Конструктор полей (drag-and-drop):
      - Палитра типов полей слева (8 типов)
      - Drag на центральную область → форма появляется
      - Каждое поле: label, placeholder, required toggle
      - Для select/radio/checkbox: редактор вариантов
      - Для scale: min/max значения
   c) Правая панель: живой превью рабочего листа
   d) Кнопки: "Сохранить черновик", "Опубликовать"

4. Таб "Заполнения": DataTable<WorksheetSubmission> — студент, лист, дата, статус badge
   - При клике → просмотр ответов + поле для feedback + кнопки "Принять" / "На доработку"

Моковые данные: 3 Worksheet (с 4-6 полями каждый), 6 WorksheetSubmission.
```

**Промпт 31 — Аналитика школы (school-admin):**
```
Создай страницу аналитики для админки школы LevelUP Academy на русском языке.

TypeScript-типы:

interface SchoolAnalytics {
  period: string;         // 'day' | 'week' | 'month'
  revenue: number;
  new_students: number;
  enrollments: number;
  completions: number;
  active_students: number;
  churn_rate: number;
  avg_ltv: number;
}

interface CourseAnalytics {
  course_id: string;
  course_title: string;
  enrollments: number;
  completions: number;
  completion_rate: number;
  revenue: number;
  avg_rating: number;
  avg_progress: number;
}

interface StudentCohort {
  month: string;
  total: number;
  active_30d: number;
  active_60d: number;
  active_90d: number;
  churned: number;
}

Страница (5 секций):

1. Фильтр периода (вверху): последние 7/30/90 дней, этот месяц, прошлый месяц, custom range (date picker)

2. KPI-карточки (6 шт., grid 3x2):
   - Выручка за период (₽, с графиком-sparkline)
   - Новых студентов (с % изменения)
   - Записей на курсы
   - Завершений курсов
   - Retention 30 дней (%)
   - Средний LTV (₽)

3. Графики (recharts, 2 колонки):
   - Выручка по дням/неделям (AreaChart, gradient fill)
   - Студенты: новые vs ушедшие (BarChart, stacked)
   - Записи по курсам (PieChart / DonutChart)
   - Воронка: запись → начал → >50% → завершил (FunnelChart или horizontal bar)

4. Таблица "Аналитика по курсам": DataTable<CourseAnalytics> — курс, записей, завершений, completion %, выручка ₽, рейтинг ⭐, средний прогресс %. Сортировка по любому столбцу.

5. Когортный анализ: таблица-матрица StudentCohort — по месяцам, retention на 30/60/90 дней, цветовая кодировка (зелёный → красный)

Моковые данные: 30 дней SchoolAnalytics, 5 CourseAnalytics, 6 StudentCohort.
```

**Промпт 32 — Команда школы (school-admin):**
```
Создай страницу управления командой для админки школы LevelUP Academy на русском языке.

TypeScript-типы:

// tenant.school_team_members
interface TeamMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: 'school_admin' | 'instructor' | 'curator' | 'manager' | 'support';
  permissions: TeamPermissions;
  status: 'active' | 'invited' | 'suspended';
  invited_at: string;
  joined_at: string | null;
  last_active: string | null;
}

interface TeamPermissions {
  courses: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  students: { view: boolean; manage: boolean; import: boolean };
  finances: { view: boolean; manage: boolean };
  analytics: { view: boolean };
  settings: { view: boolean; manage: boolean };
  content: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  team: { view: boolean; manage: boolean };
}

interface TeamInvite {
  id: string;
  email: string;
  role: string;
  invited_by: string;
  invited_at: string;
  expires_at: string;
  status: 'pending' | 'accepted' | 'expired';
}

const inviteSchema = z.object({
  email: z.string().email('Введите корректный email'),
  role: z.enum(['instructor', 'curator', 'manager', 'support']),
  message: z.string().optional(),
});

Страница:

1. KPI (3 карточки): Всего в команде, Активных, Приглашений ожидает

2. Два таба: "Команда" и "Приглашения"

Таб "Команда":
- Карточки участников (grid 2-3 колонки): аватар, имя, email, role badge (цветной), status badge, last_active ("3 часа назад"), кнопки "Настроить права" / "Приостановить" / "Удалить"
- Фильтр по роли
- При "Настроить права" → модалка с чекбоксами TeamPermissions (grouped by section: Курсы, Студенты, Финансы и т.д.)

Таб "Приглашения":
- DataTable<TeamInvite>: email, role badge, кто пригласил, дата, expires, status badge, кнопки "Отправить повторно" / "Отменить"

3. Кнопка "+ Пригласить" → модалка с inviteSchema:
   - email input
   - role dropdown
   - Текст сообщения (optional)
   - Предустановленные права по роли (показать summary)

Моковые данные: 5 TeamMember (разные роли), 3 TeamInvite.
```

**Промпт 33 — Чат школы (school-admin):**
```
Создай страницу чата школы для админки LevelUP Academy на русском языке.

TypeScript-типы:

interface SchoolChannel {
  id: string;
  name: string;
  type: 'course_group' | 'direct' | 'announcement' | 'support';
  course_id: string | null;
  course_title: string | null;
  members_count: number;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  avatar_url: string | null;
}

interface SchoolMessage {
  id: string;
  channel_id: string;
  sender_name: string;
  sender_avatar: string | null;
  sender_role: 'instructor' | 'curator' | 'student' | 'admin';
  content: string;
  attachments: { name: string; url: string; size: number }[];
  created_at: string;
  is_pinned: boolean;
}

Страница (трёхколоночный layout):

1. Левая панель (280px) — список каналов:
   - Поиск каналов
   - Секции: "Курсовые группы", "Личные", "Объявления", "Поддержка"
   - Каждый канал: аватар/иконка, name, last_message (truncated), time, unread badge
   - Кнопка "+ Создать канал" → модалка (name, type, привязка к курсу)

2. Центральная панель — чат:
   - Шапка: название канала, members_count, кнопки "Закрепить", "Участники", "Настройки"
   - Сообщения: группировка по дате, аватар + имя + role badge + время, текст, attachments (файлы как chips)
   - Закреплённые сообщения: banner вверху
   - Ввод сообщения внизу: textarea, кнопки emoji, attach file, send

3. Правая панель (240px, скрываемая) — участники канала:
   - Список: аватар, имя, role badge, online indicator
   - Для course_group: автоматически все студенты курса + инструкторы
   - Кнопки: "Добавить участника", "Удалить"

Моковые данные: 6 SchoolChannel (разные типы), 15 SchoolMessage (с attachments), 8 участников.
```

**Промпт 34 — Split Payments / Финансы расширенные (school-admin):**
```
Создай расширенную страницу финансов школы с split payments для админки LevelUP Academy на русском языке.

Это РАСШИРЕНИЕ промпта 24 (базовые финансы). Добавь дополнительный таб "Выплаты школе" к существующим табам.

TypeScript-типы:

interface SplitPayment {
  id: string;
  order_id: string;
  student_name: string;
  course_title: string;
  total_amount: number;
  platform_fee: number;          // % от тарифа
  platform_fee_amount: number;
  school_amount: number;
  status: 'pending' | 'processed' | 'paid_out';
  created_at: string;
  paid_out_at: string | null;
}

interface PayoutRequest {
  id: string;
  amount: number;
  method: 'bank_transfer' | 'yookassa';
  bank_details: string | null;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requested_at: string;
  processed_at: string | null;
}

interface SchoolPayoutSettings {
  payout_method: 'bank_transfer' | 'yookassa';
  bank_name: string | null;
  bank_bik: string | null;
  bank_account: string | null;
  min_payout_amount: number;     // мин. сумма для вывода
  auto_payout: boolean;
  auto_payout_day: number | null; // день месяца
}

Новый таб "Выплаты школе":

1. KPI (4 карточки):
   - Баланс к выплате (₽)
   - Выплачено за месяц (₽)
   - Комиссия платформы (%)
   - Следующая автовыплата (дата)

2. DataTable<SplitPayment>: заказ, студент, курс, сумма, комиссия, к выплате школе, статус badge, дата

3. Кнопка "Запросить выплату" → модалка:
   - Сумма (макс = баланс)
   - Метод (bank_transfer/yookassa)
   - Подтверждение реквизитов

4. История выплат: DataTable<PayoutRequest>

5. Настройки выплат (SchoolPayoutSettings): метод, реквизиты, автовыплата toggle + день

Моковые данные: 8 SplitPayment, 3 PayoutRequest.
```

**Промпт 35 — Блог школы (school-admin):**
```
Создай страницу управления блогом для админки школы LevelUP Academy на русском языке.

TypeScript-типы:

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content_html: string;
  cover_image_url: string | null;
  author_name: string;
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  views_count: number;
  created_at: string;
  updated_at: string;
}

Страница:

1. Список постов: DataTable<BlogPost> — cover (thumbnail), title, author, tags (chips), status badge, views, published_at, действия (Edit/Delete/Preview)
2. KPI: всего постов, опубликовано, просмотров за месяц
3. Фильтры: по статусу, по тегам, поиск

4. Кнопка "+ Новый пост" → редактор:
   - title input
   - slug (auto-generate from title, editable)
   - cover image upload (drag-and-drop)
   - Rich-text editor (TipTap): заголовки, жирный, курсив, списки, ссылки, изображения, code blocks, цитаты
   - excerpt (textarea, 160 символов)
   - tags (chips input)
   - Правая панель: status toggle (draft/published), published_at (date picker), SEO preview
   - Кнопки: "Сохранить черновик", "Опубликовать"

Моковые данные: 5 BlogPost (2 published, 2 draft, 1 archived) с реалистичным контентом.
```

**Промпт 36 — Подписки на курсы (school-admin):**
```
Создай страницу управления подписками для админки школы LevelUP Academy на русском языке.

TypeScript-типы:

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number | null;
  included_courses: string[] | 'all';
  features: string[];
  max_students: number | null;
  is_active: boolean;
  subscribers_count: number;
  created_at: string;
}

interface StudentSubscription {
  id: string;
  student_name: string;
  plan_name: string;
  plan_id: string;
  billing_period: 'monthly' | 'yearly';
  amount: number;
  status: 'active' | 'canceled' | 'past_due' | 'expired';
  started_at: string;
  next_billing_at: string | null;
  canceled_at: string | null;
}

const planSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(10),
  price_monthly: z.number().min(0),
  price_yearly: z.number().min(0).nullable(),
  included_courses: z.union([z.literal('all'), z.array(z.string())]),
  features: z.array(z.string()),
  max_students: z.number().min(1).nullable(),
});

Страница (два таба):

Таб "Планы подписок":
1. Карточки SubscriptionPlan (grid 3 колонки): название, цена/мес, цена/год, features list (checkmarks), subscribers_count, is_active toggle, кнопки Edit/Delete
2. Кнопка "+ Новый план" → модалка с planSchema:
   - name, description
   - price_monthly, price_yearly (опционально)
   - included_courses: toggle "Все курсы" или select конкретных
   - features: list input (+ добавить строку)
   - max_students

Таб "Подписчики":
1. DataTable<StudentSubscription>: студент, план, период, сумма, статус badge, следующий платёж, действия
2. KPI: активных подписок, MRR (₽), churn rate %
3. Фильтры: по плану, по статусу

Моковые данные: 3 SubscriptionPlan, 8 StudentSubscription.
```

**Промпт 37 — Тарифные планы платформы (school-admin):**
```
Создай страницу тарифных планов для админки школы LevelUP Academy на русском языке.

Это ЗАМЕНА простой страницы подписки (из промпта 18, таб "Подписка") на полноценную страницу.

TypeScript-типы:

interface PlatformPlan {
  id: string;
  name: string;                    // Стартовый, Базовый, Про, Бизнес
  price_monthly: number;
  limits: {
    students: number | null;       // null = безлимит
    courses: number | null;
    storage_gb: number;
    team_members: number;
    custom_domain: boolean;
    custom_css: boolean;
    video_hours: number | null;
    support_level: 'community' | 'email' | 'priority' | 'dedicated';
  };
  features: string[];
  is_popular: boolean;
}

interface SchoolSubscription {
  plan: PlatformPlan;
  status: 'active' | 'trial' | 'past_due' | 'canceled';
  current_usage: {
    students: number;
    courses: number;
    storage_gb: number;
    team_members: number;
    video_hours_used: number;
  };
  billing_period: 'monthly' | 'yearly';
  next_billing_at: string;
  started_at: string;
}

Страница:

1. Текущий тариф (карточка): название, цена, статус badge, следующее списание
2. Использование лимитов: прогресс-бары для каждого лимита (students, courses, storage, team, video) — текущее/максимум, цветовая индикация (зелёный < 70%, оранжевый < 90%, красный > 90%)

3. Сравнение тарифов (4 колонки): pricing table
   - Стартовый (0₽): 50 студентов, 3 курса, 1 ГБ, 1 чел, community
   - Базовый (2 990₽): 500 студентов, 20 курсов, 10 ГБ, 3 чел, email
   - Про (7 990₽): 2000 студентов, безлимит курсов, 50 ГБ, 10 чел, кастомный домен, priority
   - Бизнес (14 990₽): безлимит, 200 ГБ, 30 чел, кастомный CSS, dedicated
   - Текущий тариф выделен (golden border + badge "Текущий")
   - Кнопки "Перейти" / "Текущий" на каждом

4. Переключатель monthly/yearly (скидка 20% при yearly)

5. История платежей: DataTable — дата, тариф, сумма, статус badge

Моковые данные: 4 PlatformPlan, 1 SchoolSubscription (на Базовом), 6 платежей.
```

**Промпт 38 — Кастомные домены (school-admin, настройки):**
```
Создай расширенную секцию управления доменом для админки школы LevelUP Academy на русском языке.

Это расширение таба "Домен" в настройках (промпт 18). Замени простое отображение поддомена на полноценное управление.

TypeScript-типы:

interface SchoolDomain {
  id: string;
  domain: string;
  type: 'subdomain' | 'custom';
  status: 'active' | 'pending_verification' | 'error' | 'expired';
  ssl_status: 'active' | 'pending' | 'error';
  dns_records: DnsRecord[];
  verified_at: string | null;
  expires_at: string | null;
}

interface DnsRecord {
  type: 'CNAME' | 'A' | 'TXT';
  name: string;
  value: string;
  status: 'verified' | 'pending' | 'error';
}

Секция "Домен" (внутри Settings):

1. Текущий домен: карточка с domain, type badge, status badge, ssl badge
   - Поддомен: slug.levelup-academy.ru (всегда работает)
   - Кастомный: school-example.com (если подключен)

2. Подключение кастомного домена:
   - Input для домена
   - После ввода → показать DNS-записи которые нужно добавить:
     * CNAME: www → proxy.levelup-academy.ru
     * A: @ → [IP]
     * TXT: _levelup-verify → [token]
   - Каждая запись: копируемое значение (кнопка copy), status indicator (spinner/check/error)
   - Кнопка "Проверить DNS" → анимация проверки → результат
   - SSL: статус получения сертификата (Let's Encrypt)

3. После верификации:
   - Primary domain toggle: какой домен основной (redirect с другого)
   - Кнопка "Отключить кастомный домен"

4. Предупреждения:
   - "DNS-записи могут обновляться до 48 часов"
   - "Кастомный домен доступен на тарифах Про и Бизнес"

Моковые данные: 2 SchoolDomain (subdomain active + custom pending_verification с 3 DnsRecord).
```

**11. Экспортировать и адаптировать код:**

После генерации всех экранов:


---

## Фаза 2A. Волна 2 — Академия

**Время:** ~40 минут
**Lovable-проект:** создать НОВЫЙ проект `levelup-academy`
**GitHub-репо:** `rlevch/levelup-lovable-academy`
**Результат → `apps/academy/`**

**Порядок промптов (строго последовательно): 6, 7**

### Как создать проект

1. **"New Project"** → название `levelup-academy`
2. В первый промпт: **системный контекст** + **общие типы** + **промпт 6**

> **Отличие от Платформы:** дизайн другой — акцентный цвет зелёный (#22c55e), тема яркая и образовательная.

---

## Фаза 2B. Волна 3 — SPA школы (то, что видит студент)

**Время:** ~1 час
**Lovable-проект:** создать НОВЫЙ проект `levelup-school`
**GitHub-репо:** `rlevch/levelup-lovable-school`
**Результат → `apps/school/`**

**Порядок промптов (строго последовательно): 19, 9, 20**

### Как создать проект

1. **"New Project"** → название `levelup-school`
2. В первый промпт: **системный контекст** + **общие типы** + **промпт 19**

> **КРИТИЧНО для школы:** все цвета должны использовать CSS-переменные `var(--school-primary)`, `var(--school-radius)` и т.д. Это обеспечит тенантный теминг — каждая школа выглядит по-своему.

---

## Фаза 2C. Волна 4 — Админка школы

**Время:** ~7 часов
**Lovable-проект:** создать НОВЫЙ проект `levelup-school-admin`
**GitHub-репо:** `rlevch/levelup-lovable-school-admin`
**Результат → `apps/school-admin/`**

**Порядок промптов (строго последовательно):**
8, 23, 16, 17, 24, 25, 18, 21, 22, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38

### Как создать проект

1. **"New Project"** → название `levelup-school-admin`
2. В первый промпт: **системный контекст** + **общие типы** + **промпт 8**

---

## Фаза 3. Волна 5 — Ассоциация

**Время:** ~20 минут
**Lovable-проект:** создать НОВЫЙ проект `levelup-association`
**GitHub-репо:** `rlevch/levelup-lovable-association`
**Результат → `apps/association/`**

**Порядок промптов (строго последовательно): 10**

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
mkdir -p apps/school-admin/src/modules/{dashboard,courses,students,finances,pages,settings,sales,certificates,video,library,theme,quizzes,worksheets,analytics,team,chat,subscriptions,plans,domains,blog}
cp /tmp/levelup-lovable-school-admin/src/pages/Dashboard.tsx apps/school-admin/src/modules/dashboard/
cp /tmp/levelup-lovable-school-admin/src/pages/CourseList.tsx apps/school-admin/src/modules/courses/
cp /tmp/levelup-lovable-school-admin/src/pages/CourseEditor.tsx apps/school-admin/src/modules/courses/
cp /tmp/levelup-lovable-school-admin/src/pages/Students.tsx apps/school-admin/src/modules/students/
cp /tmp/levelup-lovable-school-admin/src/pages/Finances.tsx apps/school-admin/src/modules/finances/
cp /tmp/levelup-lovable-school-admin/src/pages/PageBuilder.tsx apps/school-admin/src/modules/pages/
cp /tmp/levelup-lovable-school-admin/src/pages/Settings.tsx apps/school-admin/src/modules/settings/
cp /tmp/levelup-lovable-school-admin/src/pages/PromoCodes.tsx apps/school-admin/src/modules/sales/
cp /tmp/levelup-lovable-school-admin/src/pages/Certificates.tsx apps/school-admin/src/modules/certificates/
cp /tmp/levelup-lovable-school-admin/src/pages/VideoSessions.tsx apps/school-admin/src/modules/video/
cp /tmp/levelup-lovable-school-admin/src/pages/Library.tsx apps/school-admin/src/modules/library/
cp /tmp/levelup-lovable-school-admin/src/pages/ThemeEngine.tsx apps/school-admin/src/modules/theme/
cp /tmp/levelup-lovable-school-admin/src/pages/Quizzes.tsx apps/school-admin/src/modules/quizzes/
cp /tmp/levelup-lovable-school-admin/src/pages/Worksheets.tsx apps/school-admin/src/modules/worksheets/
cp /tmp/levelup-lovable-school-admin/src/pages/Analytics.tsx apps/school-admin/src/modules/analytics/
cp /tmp/levelup-lovable-school-admin/src/pages/Team.tsx apps/school-admin/src/modules/team/
cp /tmp/levelup-lovable-school-admin/src/pages/Chat.tsx apps/school-admin/src/modules/chat/
cp /tmp/levelup-lovable-school-admin/src/pages/SplitPayments.tsx apps/school-admin/src/modules/finances/
cp /tmp/levelup-lovable-school-admin/src/pages/Blog.tsx apps/school-admin/src/modules/blog/
cp /tmp/levelup-lovable-school-admin/src/pages/Subscriptions.tsx apps/school-admin/src/modules/subscriptions/
cp /tmp/levelup-lovable-school-admin/src/pages/Plans.tsx apps/school-admin/src/modules/plans/
cp /tmp/levelup-lovable-school-admin/src/pages/CustomDomains.tsx apps/school-admin/src/modules/domains/
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

## Контрольная точка после Волны 1

Когда все 10 промптов Платформы готовы, у вас должно быть:
- 10+ страниц/компонентов в превью lovable
- GitHub-репо `levelup-lovable-platform` с коммитами
- Файл `src/mocks/data.ts` с моковыми данными

**Действие:** Перейдите в lovable Settings → GitHub, убедитесь что репо подключено и код запушен.

---

## Сводная таблица

| Фаза | Lovable-проект | Промпты | Кол-во | → apps/ | Время |
|------|----------------|---------|--------|---------|-------|
| 1 | `levelup-platform` | 1, 2, 3, 4, 5, 11, 12, 13, 14, 15 | 10 | `apps/platform/` | 3-4 ч |
| 2A | `levelup-academy` | 6, 7 | 2 | `apps/academy/` | 40 мин |
| 2B | `levelup-school` | 19, 9, 20 | 3 | `apps/school/` | 1 ч |
| 2C | `levelup-school-admin` | 8, 23, 16, 17, 24, 25, 18, 21, 22, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38 | 22 | `apps/school-admin/` | 7 ч |
| 3 | `levelup-association` | 10 | 1 | `apps/association/` | 20 мин |
| **Итого** | **5 проектов** | **38 промптов** | **38** | **5 apps** | **~13 ч** |

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

