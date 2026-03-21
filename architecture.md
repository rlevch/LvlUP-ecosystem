# Архитектура платформы SCORE Coaching

## 1. Резюме требований

Экосистема SCORE Coaching состоит из **трёх отдельных сайтов на разных доменах**, объединённых общим бэкендом:

- **score-coaching.ru** — Платформа-маркетплейс (продажа услуг коучей, сессии, магазин)
- **academy-coaching.ru** — SaaS-сервис для создания онлайн-школ (по модели GetCourse), каталог школ
- **association-coaching.ru** — Сайт конкретной ассоциации SCORE (членство, сертификация, стандарты)

Под капотом все три сайта используют единую инфраструктуру: общую БД (Supabase), API Gateway, LiveKit, Redis — но каждый сайт представляет собой отдельное фронтенд-приложение (React SPA) со своим дизайном и маршрутизацией.

**🔮 Планируемое расширение:** в будущем на базе того же monorepo планируется запуск дополнительных платформ-маркетплейсов (для психологов и прикладных психологов) — каждая на своём домене, с полностью изолированной инфраструктурой (отдельный Supabase, LiveKit, Redis). Академия и Ассоциация остаются привязаны к коучингу и не затрагиваются. Подробности — в Секции 14.

**Ключевое изменение концепции:** Академия (`academy-coaching.ru`) — это не одна конкретная школа, а **платформа-конструктор онлайн-школ**. Каждый владелец школы (school_owner) получает:
- Собственный поддомен (`my-school.academy-coaching.ru`) или кастомный домен (`my-school.ru`)
- Настраиваемый бренд: цвета, логотип, favicon, фоновые изображения
- Полнофункциональную LMS: курсы, уроки, тесты, задания, сертификаты
- **Видеосессии школы** (лекции, вебинары, супервизии, групповые практики) — через LiveKit, с интерактивными инструментами (МАК-карты, доска, демонстрация экрана)
- **Чат школы** — мессенджер между студентами, кураторами и преподавателями (tenant-isolated)
- **Библиотека школы** — хранилище учебных материалов (книги, видео, документы) с категоризацией и управлением доступом
- **Блог школы** — публикация статей, новостей и анонсов для студентов и посетителей
- CRM и воронки продаж для своей школы
- Конструктор лендингов и страниц
- Аналитику и отчётность по своей школе
- Собственную команду (преподаватели, кураторы, менеджеры)
- Приём оплаты с автоматическим расщеплением (комиссия платформы + доход школы)
- **Тарифные планы** (4 уровня: Стартовый / Базовый / Профессиональный / Бизнес) с лимитами на курсы, студентов, хранилище и процентом комиссии

Решение должно работать в браузере с любых устройств, размещаться на территории РФ, соответствовать 152-ФЗ, использовать Supabase на VPS и разрабатываться начиная с lovable.dev.

---

## 2. Ключевые ограничения и их влияние на архитектуру

| Ограничение | Последствие для архитектуры |
|---|---|
| Размещение в РФ, санкции | VPS в РФ (Selectel). Нельзя использовать Stripe, Zoom, Google Meet. Нужны отечественные аналоги |
| Supabase как БД | Self-hosted Supabase на VPS. Даёт PostgreSQL, Auth, Storage, Realtime, Edge Functions из коробки |
| Старт на lovable.dev | Генерация React + Tailwind + shadcn/ui. Код экспортируется и далее развивается командой |
| Шифрование видео и чатов | E2E шифрование через Signal Protocol для чатов; SRTP + DTLS для видео через self-hosted медиасервер |
| Три отдельных сайта | Три React SPA на разных доменах (score-coaching.ru, academy-coaching.ru, association-coaching.ru) + общий бэкенд в монорепозитории |
| **Мультитенантность (Академия-как-сервис)** | Каждая школа — отдельный tenant. Единая БД с `tenant_id` во всех academy-таблицах + RLS-изоляция. Wildcard-поддомены `*.academy-coaching.ru` + кастомные домены через Traefik + Let's Encrypt. Движок тем для кастомизации бренда каждой школы |
| Кастомные домены школ | Traefik с автоматическим TLS (Let's Encrypt, DNS-01 challenge через Selectel DNS API). Поддержка поддоменов `*.academy-coaching.ru` и собственных доменов владельцев школ |
| Расщепление платежей | ЮKassa Split Payments: автоматическое разделение оплаты между платформой (комиссия) и школой (доход). Требуется подключение каждой школы как субаккаунта |
| 🔮 **Мульти-платформенность (будущее)** | Архитектура заложена под запуск новых маркетплейсов (психологи, прикл. психологи) с **полной изоляцией** (Variant C): отдельный Supabase, LiveKit, Redis per platform. Общий только код (monorepo) и packages. Раздельная аутентификация, без SSO. Академия и Ассоциация не затрагиваются |

---

## 3. Рекомендуемая архитектура

### 3.1 Общая схема (High-Level)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            КЛИЕНТЫ (Браузер)                                 │
│                                                                              │
│  ┌────────────────────────┐  ┌──────────────────────┐  ┌─────────────────┐  │
│  │ ПЛАТФОРМА/МАРКЕТПЛЕЙС  │  │ АССОЦИАЦИЯ            │  │ АКАДЕМИЯ        │  │
│  │ score-coaching.ru       │  │ association-coaching.ru│  │ academy-        │  │
│  │ (React SPA)             │  │ (React SPA)            │  │ coaching.ru     │  │
│  │                         │  │                        │  │ (React SPA)     │  │
│  │ ┌──────┐ ┌──────────┐ │  │ ┌──────┐ ┌──────────┐ │  │ Каталог школ   │  │
│  │ │Коучи │ │Сессии    │ │  │ │Член- │ │Серти-    │ │  │ + создание     │  │
│  │ │Магазин│ │Бронир.  │ │  │ │ство  │ │фикация   │ │  │ школы          │  │
│  │ └──────┘ └──────────┘ │  │ └──────┘ └──────────┘ │  └─────────────────┘  │
│  └────────────────────────┘  └──────────────────────┘                        │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  ШКОЛЫ (TENANT SPA) — мультитенантный LMS                            │    │
│  │  my-school.academy-coaching.ru / my-school.ru                         │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐       │    │
│  │  │ Курсы/Уроки  │  │ Лендинги     │  │ Личный кабинет        │       │    │
│  │  │ (LMS)        │  │ школы        │  │ студента/владельца    │       │    │
│  │  └──────────────┘  └──────────────┘  └───────────────────────┘       │    │
│  │         Кастомные цвета, логотип, домен — всё от владельца школы      │    │
│  │         + Tenant Theme Provider (CSS-переменные из tenant.settings)   │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│       Общая авторизация (VK ID / MAX / email) через Supabase GoTrue         │
└───────────────────────────┬──────────────────────────────────────────────────┘
                            │ HTTPS (TLS 1.3)
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│   VPS #1 (Москва) — Traefik (reverse proxy, auto TLS, domain routing)  │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  Domain Router + Tenant Router (middleware):                     │   │
│   │  1. Определяет сайт по домену:                                   │   │
│   │     score-coaching.ru → Platform SPA                             │   │
│   │     association-coaching.ru → Association SPA                    │   │
│   │     academy-coaching.ru → Academy SPA (каталог школ)            │   │
│   │     *.academy-coaching.ru → School SPA (tenant по поддомену)    │   │
│   │     custom domain → tenant.school_domains → School SPA          │   │
│   │  2. Для школ: добавляет X-Tenant-ID в запрос                     │   │
│   │  3. Wildcard TLS: *.academy-coaching.ru (Let's Encrypt)          │   │
│   │     + TLS для score-coaching.ru, association-coaching.ru         │   │
│   │     + On-demand TLS для кастомных доменов школ                   │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│   SSL termination, rate limiting, gzip/brotli                           │
└───┬───────────┬───────────┬───────────┬───────────┬─────────────────────┘
    │           │           │           │           │
    ▼           ▼           ▼           ▼           ▼
┌───────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐
│Supabase│ │ API     │ │Redis     │ │MinIO    │ │AI Service│
│GoTrue  │ │Gateway  │ │+BullMQ   │ │(файлы)  │ │(GigaChat/│
│Postgres│ │(Fastify │ │(очереди, │ │(NVMe    │ │ YandexGPT│
│Realtime│ │ 4 воркера│ │ кэш,    │ │ SSD)    │ │ FastAPI) │
│Storage │ │pgBouncer│ │ tenant   │ │ tenant- │ │          │
│        │ │+Tenant  │ │ config   │ │ isolated│ │          │
│        │ │Resolver │ │ cache)   │ │ buckets │ │          │
└───────┘ └─────────┘ └──────────┘ └─────────┘ └──────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  VPS #2 (Москва) — Медиасервер (выделенный, 1 Gbps)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────────────┐ │
│  │LiveKit Server│  │LiveKit Egress│  │coturn (TURN для WebRTC         │ │
│  │(SFU, до 50  │  │(запись →     │  │ за NAT/корп. файрволлами)      │ │
│  │ видеосессий) │  │ MinIO VPS#1) │  │                                │ │
│  └─────────────┘  └──────────────┘  └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘

Внешние сервисы (РФ):
  ├── VK ID (OAuth для VK + MAX)
  ├── ЮKassa (платежи, 54-ФЗ, Split Payments для школ)
  ├── Unisender (email-рассылка, с поддержкой sender per tenant)
  ├── Selectel DNS (российский anycast DNS)
  │   ├── score-coaching.ru → VPS #1
  │   ├── association-coaching.ru → VPS #1
  │   ├── academy-coaching.ru → VPS #1
  │   └── *.academy-coaching.ru → VPS #1 (wildcard для школ)
  └── Let's Encrypt (wildcard *.academy-coaching.ru + on-demand TLS для кастомных доменов)
```

### 3.2 Стек технологий

**Frontend:**
- **React 18+** + TypeScript (генерируется lovable.dev, далее развивается вручную)
- **Tailwind CSS** + **shadcn/ui** (дизайн-система)
- **React Router v6** (маршрутизация между уровнями)
- **TanStack Query** (серверное состояние, кэширование)
- **Zustand** (клиентское состояние)

**Backend (BaaS + custom):**
- **Supabase self-hosted** на VPS — PostgreSQL 15, GoTrue Auth, Realtime (WebSockets), Storage, Edge Functions (Deno)
- **Node.js 20 + Fastify** — API Gateway для бизнес-логики, которая выходит за рамки Supabase Edge Functions
- **Bull MQ + Redis** — очереди задач (рассылка email, генерация отчётов, AI-задачи)

**Видеоконференции:**
- **LiveKit** (open-source, self-hosted) — WebRTC медиасервер, поддержка SFU, запись сессий, демонстрация экрана, E2E шифрование из коробки. Русскоязычная альтернатива Zoom/Meet.

**Мессенджер / Realtime:**
- **Supabase Realtime** (Postgres Changes + Broadcast) — чаты, уведомления
- Шифрование на уровне приложения через **libsignal-protocol-javascript** (Signal Protocol)

**Файловое хранилище:**
- **Supabase Storage** (S3-совместимый, поверх MinIO на VPS) — документы, книги, видеозаписи

**AI-сервис:**
- **Python (FastAPI)** — обёртка над LLM API (GigaChat / YandexGPT — только российские AI-провайдеры, без зарубежных fallback)
- Задачи: помощь регистрации, автоотчёты после сессий, ведение журнала посещений

**Платежи:**
- **ЮKassa** (основной) + **Тинькофф Оплата** (резервный) — рекуррентные платежи, абонементы, разовые оплаты

**Email:**
- **Unisender** или **Sendpulse** (РФ-сервисы) — транзакционные письма, напоминания

**Инфраструктура:**
- **Docker + Docker Compose** (на начальном этапе)
- **2–3 VPS** в РФ (Selectel)
- **Traefik** — reverse proxy, автоматический TLS через Let's Encrypt, **domain routing (3 сайта) + tenant routing по Host-заголовку для школ**
- **GitHub Actions** — CI/CD

### 3.3 Мультитенантная архитектура (Академия-как-сервис)

Академия работает по модели **SaaS-платформы для онлайн-школ** (аналог GetCourse). Каждый зарегистрированный пользователь может создать свою школу/академию/центр обучения и получить полнофункциональную LMS с собственным брендом.

#### 3.3.1 Модель мультитенантности

**Выбранный подход: Shared Database, Shared Schema с `tenant_id`**

```
┌───────────────────────────────────────────────────────────┐
│                    Одна PostgreSQL БД                       │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Школа A     │  │ Школа B     │  │ Школа C     │        │
│  │ tenant_id=1 │  │ tenant_id=2 │  │ tenant_id=3 │        │
│  │             │  │             │  │             │        │
│  │ Курсы       │  │ Курсы       │  │ Курсы       │        │
│  │ Студенты    │  │ Студенты    │  │ Студенты    │        │
│  │ Настройки   │  │ Настройки   │  │ Настройки   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  RLS-политики: каждый запрос видит только данные            │
│  своего tenant_id (определяется из JWT-токена)             │
└───────────────────────────────────────────────────────────┘
```

**Почему Shared Database, а не Database-per-tenant:**
- На старте (до 1000 школ) одна БД проще в обслуживании, миграциях, бэкапах
- Supabase RLS обеспечивает надёжную изоляцию данных на уровне PostgreSQL
- Общие таблицы (users, billing, association) используются всеми школами
- При росте до 10 000+ школ можно мигрировать крупных тенантов на отдельные схемы

#### 3.3.2 Разрешение тенанта (Tenant Resolution)

```
Браузер: my-school.academy-coaching.ru/courses
    │
    ▼
Traefik (reverse proxy)
    │ Host: my-school.academy-coaching.ru
    ▼
Tenant Router Middleware (Fastify plugin)
    │
    ├── 1. Извлечь slug из Host: "my-school"
    │      (или найти tenant по custom_domain в Redis-кэше)
    │
    ├── 2. Найти tenant в Redis-кэше (TTL 5 мин):
    │      tenant:slug:my-school → { id: "uuid", settings: {...} }
    │      Если нет — запросить из tenant.schools, сохранить в кэш
    │
    ├── 3. Добавить в контекст запроса:
    │      req.tenantId = "uuid"
    │      req.tenantSlug = "my-school"
    │      req.tenantSettings = { theme, features, limits }
    │
    └── 4. Supabase RLS использует tenant_id из JWT claims:
           SET LOCAL app.current_tenant_id = 'uuid';
```

**Поддерживаемые форматы доменов:**

| Тип домена | Пример | Как работает |
|---|---|---|
| **Поддомен академии** | `my-school.academy-coaching.ru` | Wildcard DNS `*.academy-coaching.ru` → VPS. Traefik извлекает slug из поддомена |
| **Кастомный домен** | `academy.my-school.ru` | Владелец добавляет CNAME → `proxy.academy-coaching.ru`. Traefik получает TLS через Let's Encrypt (HTTP-01 challenge) |
| **Полностью свой домен** | `my-school.ru` | Владелец направляет A-запись на IP VPS + добавляет домен в панели школы. On-demand TLS через Traefik |

#### 3.3.3 Движок тем (Theme Engine)

Каждый владелец школы настраивает визуальный стиль через панель управления. Настройки хранятся в `tenant.school_settings` (JSONB) и применяются на клиенте через CSS-переменные.

```
Панель владельца школы → API → tenant.school_settings (JSONB)
    │
    ▼
Клиент загружает school_settings при инициализации:
    │
    ├── CSS-переменные:
    │   --school-primary: #2563EB;        (основной цвет)
    │   --school-secondary: #7C3AED;      (вторичный цвет)
    │   --school-accent: #F59E0B;         (акцент)
    │   --school-bg: #FFFFFF;             (фон)
    │   --school-text: #1F2937;           (текст)
    │   --school-font: 'Inter', sans-serif; (шрифт)
    │   --school-radius: 8px;             (скругление углов)
    │
    ├── Логотип и favicon: URL из Supabase Storage
    │   (tenant-isolated bucket: tenants/{tenant_id}/branding/)
    │
    └── Tailwind: все компоненты UI используют var(--school-*)
        вместо захардкоженных цветов
```

**Настраиваемые элементы бренда:**

| Элемент | Что настраивает владелец | Хранение |
|---|---|---|
| **Цветовая палитра** | Primary, secondary, accent, background, text (6 цветов) | `school_settings.theme.colors` |
| **Логотип** | SVG/PNG, до 500 KB, светлая и тёмная версия | Supabase Storage `tenants/{id}/branding/logo.*` |
| **Favicon** | ICO/PNG, 32×32 и 192×192 | Supabase Storage `tenants/{id}/branding/favicon.*` |
| **Шрифт** | Выбор из 15 предустановленных Google Fonts | `school_settings.theme.font_family` |
| **Скругление углов** | 0–16 px (стиль от строгого до мягкого) | `school_settings.theme.border_radius` |
| **Фоновое изображение** | Опционально: hero-изображение для главной страницы школы | Supabase Storage `tenants/{id}/branding/hero.*` |
| **Название школы** | Отображается в header, title, emails | `school_settings.name` |
| **Описание** | Краткое описание школы для SEO и каталога | `school_settings.description` |
| **Социальные сети** | Ссылки на VK, Telegram, YouTube, Instagram | `school_settings.socials` |
| **Кастомный CSS** | Продвинутые пользователи могут добавить свой CSS (sandbox) | `school_settings.custom_css` |
| **Email-брендинг** | Имя отправителя, reply-to, шапка/подвал писем | `school_settings.email_branding` |

**Предустановленные темы (шаблоны):**

Для быстрого старта платформа предоставляет 8–10 готовых тем:
- **Минималист** — белый фон, чёрный текст, минимум цвета
- **Корпоративный** — синий + серый, строгий стиль
- **Творческий** — яркие акценты, градиенты
- **Академический** — тёмно-зелёный + золотой, классический
- **Тёплый** — оранжевый + кремовый, дружелюбный
- Каждую тему можно дополнительно кастомизировать

#### 3.3.4 Панель управления школой (School Admin Dashboard)

Владелец школы получает полнофункциональную админ-панель, аналогичную GetCourse:

```
/{school-slug}/admin/
├── /dashboard          # Обзор: выручка, студенты, активность
├── /settings           # Настройки школы
│   ├── /general        # Название, описание, контакты
│   ├── /branding       # Логотип, цвета, тема, шрифт
│   ├── /domain         # Поддомен и кастомный домен
│   ├── /payments       # Подключение ЮKassa субаккаунта, тарифы
│   ├── /email          # Брендинг писем, шаблоны уведомлений
│   └── /integrations   # Вебхуки, API-ключи, Telegram-бот
├── /courses            # Управление курсами
│   ├── /new            # Создание курса
│   ├── /:id/edit       # Редактирование: модули, уроки, тесты
│   ├── /:id/students   # Студенты курса, прогресс
│   └── /:id/analytics  # Аналитика курса: завершаемость, оценки
├── /students           # Все студенты школы
│   ├── /list           # Список с фильтрами и поиском
│   ├── /:id            # Карточка студента: курсы, платежи, активность
│   └── /import         # Импорт студентов (CSV)
├── /team               # Команда школы
│   ├── /members        # Преподаватели, кураторы, менеджеры
│   └── /invite         # Приглашение по email
├── /sales              # Продажи и маркетинг
│   ├── /funnels        # Воронки продаж
│   ├── /landings       # Лендинги курсов
│   ├── /promo-codes    # Промо-коды и скидки
│   └── /orders         # Заказы и платежи
├── /crm                # CRM школы
│   ├── /leads          # Лиды и заявки
│   └── /segments       # Сегменты аудитории
├── /content            # Контент школы
│   ├── /pages          # Статические страницы (О школе, FAQ, Контакты)
│   ├── /blog           # Блог школы
│   └── /files          # Файловый менеджер
├── /library            # 🆕 Библиотека школы (загрузка материалов, категории, доступ)
├── /video-sessions     # 🆕 Видеосессии школы (расписание, настройки записи, управление)
├── /certificates       # Шаблоны сертификатов для выпускников
├── /analytics          # Сводная аналитика
│   ├── /revenue        # Доход по периодам, курсам, источникам
│   ├── /students       # Метрики студентов: LTV, churn, retention
│   └── /marketing      # Эффективность воронок, UTM-метки
└── /subscription       # Тариф школы на платформе SCORE
    ├── /current        # Текущий тариф, лимиты, расход
    └── /upgrade        # Повышение тарифа
```

#### 3.3.5 Тарифные планы для школ (Platform Billing)

| Тариф | Цена/мес | Лимиты | Комиссия с продаж |
|---|---|---|---|
| **Стартовый** | 0 ₽ | 1 курс, 50 студентов, поддомен только | 10% |
| **Базовый** | 2 990 ₽ | 10 курсов, 500 студентов, 1 кастомный домен | 7% |
| **Профессиональный** | 7 990 ₽ | Безлимит курсов, 3 000 студентов, кастомный домен, кастомный CSS, расширенная аналитика | 5% |
| **Бизнес** | 14 990 ₽ | Безлимит всё, API-доступ, white-label email, приоритетная поддержка | 3% |

Тарифы хранятся в `tenant.school_plans` и проверяются middleware при каждом действии, превышающем лимит.

#### 3.3.6 Изоляция данных между школами

```
Уровни изоляции:

1. БД (PostgreSQL RLS):
   - Каждая academy-таблица содержит tenant_id
   - RLS-политика: WHERE tenant_id = current_setting('app.current_tenant_id')
   - Невозможно увидеть данные чужой школы даже при SQL-инъекции

2. Файловое хранилище (MinIO/Supabase Storage):
   - Bucket-политика: tenants/{tenant_id}/*
   - Каждая школа имеет изолированный "каталог" в хранилище

3. Redis-кэш:
   - Все ключи кэша префиксированы: tenant:{tenant_id}:*
   - TTL для конфигурации тенанта: 5 мин

4. API Gateway:
   - Middleware автоматически добавляет tenant_id в каждый запрос
   - Запрещён доступ к данным без валидного tenant_id
   - Rate limiting per tenant (защита от abuse)

5. Email:
   - From: "{school_name} <noreply@academy-coaching.ru>" (или кастомный sender)
   - Unsubscribe-ссылки привязаны к школе, не платформе
```

---

## 4. Архитектура базы данных (Supabase / PostgreSQL)

### 4.1 Основные доменные области (schemas)

```
PostgreSQL
├── public          — общие таблицы (users, profiles, notifications)
├── tenant          — 🆕 мультитенантность: школы, настройки, домены, тарифы, команды
├── association     — членство, сертификация, реестр, стандарты
├── academy         — курсы, уроки, задания, тесты, журнал (ВСЕ таблицы содержат tenant_id!)
├── platform        — услуги коучей, сессии, отзывы, магазин
├── chat            — сообщения, каналы, шифрованные ключи
├── billing         — подписки, платежи, абонементы, инвойсы (+ биллинг школ)
├── content         — библиотека, статьи, блог, медиафайлы (tenant-scoped для школ)
├── crm             — воронки, лиды, конверсии (tenant-scoped для школ)
└── tracking        — учёт часов практики, образования, менторинга (для сертификации по модели ICF)
```

### 4.2 Ключевые таблицы

**public schema:**
```sql
users (id, email, phone, role[], created_at, last_login)
profiles (user_id FK, first_name, last_name, avatar_url, bio, specializations[], timezone)
notifications (id, user_id FK, type, title, body, read, channel, created_at)
intake_forms (id, user_id FK, form_type, data JSONB, submitted_at)
-- form_type: client_registration | coach_registration | session_pre_questionnaire
-- Intake-формы как в SimplePractice: заполняются при регистрации и перед сессиями
form_templates (id, title, category, fields JSONB, created_by FK, is_system)
-- Библиотека шаблонов форм (1000+ как в Jane App)
```

**tenant schema (🆕 мультитенантность — школы и их настройки):**
```sql
schools (id, owner_id FK, slug, name, description, status, created_at, updated_at)
-- slug: уникальный идентификатор для поддомена (my-school.academy-coaching.ru)
-- status: draft | active | suspended | archived
-- owner_id: пользователь-создатель школы (роль school_owner)

school_settings (school_id FK PK, theme JSONB, features JSONB, limits JSONB, email_branding JSONB, socials JSONB, custom_css TEXT, meta_tags JSONB, analytics_code TEXT)
-- theme: { colors: { primary, secondary, accent, bg, text }, font_family, border_radius, logo_url, favicon_url, hero_url, dark_logo_url }
-- features: { gameboard: true, video_sessions: true, chat: true, crm: true, blog: true, certificates: true, library: true }
-- limits: { max_courses: 10, max_students: 500, max_storage_mb: 5000, max_team_members: 5 }
-- email_branding: { sender_name, reply_to, header_html, footer_html }
-- socials: { vk, telegram, youtube, instagram, website }
-- custom_css: произвольный CSS (sandbox, очищается от опасных свойств)
-- meta_tags: { title, description, og_image } для SEO
-- analytics_code: Яндекс.Метрика / VK Pixel код владельца

school_domains (id, school_id FK, domain, type, status, ssl_status, verified_at, created_at)
-- type: subdomain | custom
-- status: pending_verification | active | failed
-- ssl_status: pending | active | expired
-- Для subdomain: автоматически active (*.academy-coaching.ru wildcard)
-- Для custom: требуется DNS-верификация (CNAME → proxy.academy-coaching.ru)

school_plans (id, name, price_monthly, price_yearly, limits JSONB, commission_pct, features JSONB, is_active)
-- Тарифные планы платформы для школ (Стартовый, Базовый, Про, Бизнес)
-- limits: { max_courses, max_students, max_storage_mb, max_team_members, custom_domain, custom_css, api_access }
-- commission_pct: процент комиссии платформы с продаж школы

school_subscriptions (id, school_id FK, plan_id FK, status, current_period_start, current_period_end, trial_ends_at)
-- Подписка школы на тариф платформы
-- status: trialing | active | past_due | canceled

school_team_members (id, school_id FK, user_id FK, role, permissions JSONB, invited_at, accepted_at)
-- role: owner | admin | instructor | curator | manager | support
-- permissions: { manage_courses, manage_students, manage_payments, manage_settings, manage_team, view_analytics }
-- Команда школы: преподаватели, кураторы, менеджеры — те, кто управляет школой

school_pages (id, school_id FK, slug, title, content JSONB, type, is_published, position, created_at)
-- type: home | about | contacts | faq | custom | terms | privacy
-- Статические страницы школы (конструктор блоков, как в GetCourse)
-- content: [{ type: "hero", data: {...} }, { type: "text", data: {...} }, { type: "cta", data: {...} }]

school_promo_codes (id, school_id FK, code, discount_type, discount_value, max_uses, used_count, valid_from, valid_until, applicable_to JSONB, is_active)
-- discount_type: percentage | fixed_amount
-- applicable_to: { course_ids: [...], all_courses: true }

school_certificates_templates (id, school_id FK, title, template_html, variables JSONB, is_default, created_at)
-- Шаблоны сертификатов, выдаваемых выпускникам школы
-- template_html: HTML-шаблон с переменными {{ student_name }}, {{ course_name }}, {{ date }}
-- variables: [{ key: "student_name", label: "ФИО студента" }, ...]

school_analytics_daily (school_id FK, date, new_students, active_students, revenue, enrollments, completions, page_views)
-- Агрегированная аналитика школы (материализованное представление, обновляется ежедневно)
```

**association schema:**
```sql
memberships (id, user_id FK, tier, status, paid_until, created_at)
-- tier: student | basic | professional | master
certificates (id, user_id FK, type, issued_at, expires_at, number, status)
registry_entries (id, user_id FK, specialization, verified, public_visible)
ethics_standards (id, title, version, content, published_at)
corporate_programs (id, title, description, price, created_by FK)
international_council (id, member_name, country, role, bio, appointed_at, active)
-- Международный совет для усиления статуса ассоциации
events (id, title, type, date_start, date_end, capacity, price)
-- type: conference | forum | webinar
event_registrations (id, event_id FK, user_id FK, status, paid)
```

**academy schema (🔄 все таблицы содержат tenant_id для мультитенантной изоляции):**
```sql
courses (id, tenant_id FK→tenant.schools, title, description, level, price, instructor_id FK, status, is_published, landing_enabled, created_at)
-- tenant_id: обязательный FK на школу-владельца курса
-- level: student | basic | professional | master
-- is_published: виден ли курс студентам
-- landing_enabled: есть ли у курса собственный лендинг
modules (id, tenant_id FK, course_id FK, title, position, type)
lessons (id, tenant_id FK, module_id FK, title, content_type, content, position, duration)
-- content_type: video | text | presentation | quiz | worksheet
enrollments (id, tenant_id FK, user_id FK, course_id FK, status, progress_pct, enrolled_at, source)
-- source: direct | funnel | promo_code | import — откуда пришёл студент
assignments (id, tenant_id FK, lesson_id FK, student_id FK, submission, grade, feedback, submitted_at)
quizzes (id, tenant_id FK, lesson_id FK, questions JSONB, passing_score)
quiz_attempts (id, tenant_id FK, quiz_id FK, user_id FK, answers JSONB, score, completed_at)
attendance_journal (id, tenant_id FK, lesson_id FK, user_id FK, status, marked_by, ai_generated)
supervision_sessions (id, tenant_id FK, supervisor_id FK, student_id FK, scheduled_at, status, notes)
calendars (id, tenant_id FK, user_id FK, type, events JSONB)
subscriptions_academy (id, tenant_id FK, user_id FK, plan_id FK, status, starts_at, expires_at)
issued_certificates (id, tenant_id FK, student_id FK, course_id FK, template_id FK→tenant.school_certificates_templates, certificate_number, issued_at, pdf_url)
-- Выданные сертификаты с уникальным номером и PDF

video_sessions (id, tenant_id FK, host_id FK, title, type, livekit_room_name, status, scheduled_at, started_at, ended_at, recording_url, max_participants, settings JSONB, created_at)
-- 🆕 Видеосессии школы (преподаватель ↔ студенты)
-- type: lecture | webinar | supervision | consultation | group_practice
-- status: scheduled | live | ended | cancelled
-- settings: { recording_enabled, chat_enabled, screen_share_enabled, gameboard_enabled, waiting_room_enabled }
-- livekit_room_name: уникальное имя комнаты в LiveKit (формат: tenant_{id}_session_{id})
-- host_id: преподаватель или куратор школы

video_session_participants (id, tenant_id FK, session_id FK→video_sessions, user_id FK, role, joined_at, left_at, duration_sec)
-- role: host | co_host | participant | observer
-- Журнал участия для аналитики и автотрекинга часов
```

**Важно:** `tenant_id` добавлен во все academy-таблицы. Это позволяет:
- RLS-политикам фильтровать данные по школе
- Одному пользователю быть студентом в нескольких школах одновременно
- Преподавателю работать в нескольких школах
- Платформе агрегировать статистику по всем школам

**platform schema:**
```sql
coach_services (id, coach_id FK, title, description, type, price, duration_min)
-- type: individual_session | group_session | package | course
coach_availability (id, coach_id FK, day_of_week, time_start, time_end, recurring)
sessions (id, service_id FK, coach_id FK, client_id FK, scheduled_at, status, recording_url, consent_recording)
session_notes (id, session_id FK, content, ai_generated, created_at)
reviews (id, session_id FK, client_id FK, rating, text, created_at)
coach_ratings (coach_id FK, avg_rating, total_reviews, calculated_at)
verification_documents (id, coach_id FK, document_type, file_url, status, reviewer_id FK)
incidents (id, reported_by FK, coach_id FK, description, status, resolution)
shop_products (id, title, description, type, price, file_url, preview_url)
-- type: book | workbook | material | recording
shop_orders (id, user_id FK, items JSONB, total, status, paid_at)
session_packages (id, user_id FK, service_id FK, sessions_total, sessions_used, expires_at)
```

**chat schema:**
```sql
channels (id, type, name, created_by FK, created_at)
-- type: direct | group | course_group | session
channel_members (channel_id FK, user_id FK, role, joined_at)
messages (id, channel_id FK, sender_id FK, encrypted_content, type, created_at)
-- type: text | audio | video | file
encryption_keys (id, channel_id FK, user_id FK, public_key, encrypted_private_key)
```

**billing schema:**
```sql
plans (id, name, level, price, billing_period, features JSONB)
subscriptions (id, user_id FK, plan_id FK, status, current_period_start, current_period_end)
payments (id, user_id FK, amount, currency, provider, provider_tx_id, status, created_at)
invoices (id, user_id FK, items JSONB, total, status, due_date, paid_at)
```

**content schema:**
```sql
library_items (id, tenant_id FK NULL, title, author, type, category, file_url, preview_url, access_level, created_at)
-- 🔄 tenant_id добавлен: NULL = платформенный контент, NOT NULL = библиотека конкретной школы
-- type: book | video | audio | protocol | technique | journal | presentation | document
-- access_level: free | member | student | professional | master
-- Каждая школа может иметь свою библиотеку с материалами для студентов
blog_posts (id, author_id FK, title, content, status, published_at, level)
-- level: association | academy | platform
diagnostics_tests (id, title, description, category, questions JSONB, scoring JSONB)
test_results (id, test_id FK, user_id FK, answers JSONB, score, completed_at)
flashcard_decks (id, title, created_by FK, cards JSONB)
whiteboards (id, title, created_by FK, data JSONB, shared_with[])
presentations (id, title, file_url, created_by FK, shared_with[])
```

**gameboard schema (игровой движок — МАК, Т-игры):**
```sql
mac_decks (id, title, author_id FK, description, card_count, back_image_url, access_level, is_builtin, price, created_at)
-- access_level: free | purchased | subscription
-- is_builtin: true для предустановленных колод, false для пользовательских
mac_cards (id, deck_id FK, front_image_url, back_image_url, position)
-- front_image_url и back_image_url хранятся в Supabase Storage

game_templates (id, title, author_id FK, description, board_image_url, grid_config JSONB, dice_config JSONB, token_config JSONB, rules_url, rules_text, max_players, price, is_published, created_at)
-- grid_config: { type: "hex|square|free", cells: [...] }
-- dice_config: [{ type: "D6", faces: [1..6] }, { type: "custom", faces: ["да","нет"] }]
-- token_config: { shapes: ["circle","square"], colors: ["red","blue",...] }

game_template_decks (game_template_id FK, deck_id FK, is_required)
-- Привязка колод МАК к шаблону игры

game_sessions (id, template_id FK, host_id FK, status, state JSONB, started_at, ended_at)
-- status: waiting | active | paused | finished
-- state: текущее состояние игры (позиции фишек, открытые карты, результаты бросков)

game_participants (id, session_id FK, user_id FK, role, token_config JSONB, position_on_board JSONB, joined_at)
-- role: host | player | observer
-- token_config: { shape: "circle", color: "red" }

game_action_log (id, session_id FK, user_id FK, action_type, payload JSONB, created_at)
-- action_type: card_draw | dice_roll | token_move | note_add | card_flip | timer_start | timer_stop
-- payload: { deck_id, card_id, result, from_cell, to_cell, ... }
-- Журнал для экспорта и аналитики после сессии
```

**tracking schema (учёт часов — модель ICF ACC/PCC/MCC):**
```sql
coaching_hours (id, user_id FK, type, hours, date, description, verified_by FK, session_id FK, created_at)
-- type: practice | education | mentor_coaching | supervision | group_coaching
-- Ведущий/супервизор подтверждает часы (verified_by)
-- session_id — автоматическая привязка к проведённой сессии

certification_requirements (id, level, requirement_type, required_hours, description)
-- level: student | basic | professional | master (аналог ACC | PCC | MCC)
-- requirement_type: education | practice | mentor_coaching | supervision

certification_progress (id, user_id FK, target_level, current_hours JSONB, status, started_at, completed_at)
-- current_hours: { education: 45, practice: 80, mentor: 8 }
-- status: in_progress | requirements_met | certified

reflection_diary (id, user_id FK, session_id FK, template_type, content JSONB, created_at)
-- template_type: GROW | SOAP | STAR | free_form | thought_diary
-- Дневник рефлексии клиента / журнал коуча (инспирировано Online-Therapy.com)
```

**crm schema (🔄 CRM и авто-воронки — tenant-scoped для каждой школы):**
```sql
leads (id, tenant_id FK, source, email, phone, name, status, assigned_to FK, data JSONB, utm JSONB, created_at)
-- tenant_id: школа, которой принадлежит лид
-- source: landing | social | referral | organic | event
-- status: new | contacted | qualified | converted | lost
-- utm: { source, medium, campaign, content, term } — UTM-метки для аналитики

funnels (id, tenant_id FK, title, owner_id FK, steps JSONB, is_active, created_at)
-- steps: [{ type: "landing", url: "..." }, { type: "email", template_id: "..." }, ...]
-- Автоматические воронки продаж для каждой школы

funnel_conversions (id, tenant_id FK, funnel_id FK, lead_id FK, current_step, entered_at, converted_at)

landing_pages (id, tenant_id FK, owner_id FK, title, slug, content JSONB, is_published, created_at)
-- Конструктор лендингов для курсов школы (как в GetCourse)
-- slug: уникальный в рамках школы, доступен по {school-domain}/l/{slug}

email_campaigns (id, tenant_id FK, title, subject, body_html, segment JSONB, status, scheduled_at, sent_at, stats JSONB)
-- 🆕 Email-рассылки школы
-- segment: { filter: "enrolled_in_course", course_id: "..." } или { filter: "all_students" }
-- stats: { sent, delivered, opened, clicked, unsubscribed }

email_templates (id, tenant_id FK, title, subject, body_html, category, is_system, created_at)
-- 🆕 Шаблоны email школы (приветствие, напоминание, завершение курса и т.д.)
-- category: welcome | reminder | completion | marketing | transactional

waitlist (id, tenant_id FK, service_id FK, user_id FK, priority, status, created_at, notified_at)
-- Лист ожидания для популярных курсов школы
```

**platform schema (дополнение — teleconsent, шаблоны заметок):**
```sql
-- Добавить к существующим таблицам platform schema:
teleconsent (id, session_id FK, client_id FK, consent_type, signed_at, ip_address, document_url)
-- consent_type: session_recording | data_processing | terms_of_service
-- Цифровое согласие перед сессией (Doxy.me)

session_note_templates (id, title, template_type, fields JSONB, created_by FK, is_system)
-- template_type: SOAP | GROW | STAR | OSCAR | free_form
-- 50+ предустановленных + пользовательские шаблоны (как в Jane App)

coaching_programs (id, coach_id FK, title, description, structure JSONB, duration_weeks, price)
-- Структурированные пошаговые программы коучинга (Online-Therapy.com / CBT-стиль)
-- structure: [{ week: 1, tasks: [...], worksheets: [...], reflection: "..." }]

program_enrollments (id, program_id FK, client_id FK, current_week, progress JSONB, started_at)
-- Прогресс клиента в программе
```

### 4.3 Row Level Security (RLS) — с поддержкой мультитенантности

Supabase RLS — критически важная часть безопасности. **Все academy, crm и content таблицы фильтруются по `tenant_id`**, который передаётся через JWT claims или `SET LOCAL`.

```sql
-- ═══════════════════════════════════════════════════════════
-- TENANT-SCOPED ПОЛИТИКИ (для academy, crm, content схем)
-- ═══════════════════════════════════════════════════════════

-- Вспомогательная функция: текущий tenant_id из JWT или SET LOCAL
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
  SELECT COALESCE(
    (current_setting('app.current_tenant_id', true))::uuid,
    ((current_setting('request.jwt.claims', true)::json)->>'tenant_id')::uuid
  );
$$ LANGUAGE sql STABLE;

-- Пользователь видит только enrollments своей школы
CREATE POLICY "Tenant isolation: enrollments" ON academy.enrollments
  FOR SELECT USING (tenant_id = current_tenant_id() AND auth.uid() = user_id);

-- Инструктор видит enrollments курсов В СВОЕЙ ШКОЛЕ
CREATE POLICY "Instructors see course enrollments in their school" ON academy.enrollments
  FOR SELECT USING (
    tenant_id = current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM academy.courses
      WHERE id = enrollments.course_id
      AND instructor_id = auth.uid()
      AND tenant_id = current_tenant_id()
    )
  );

-- Владелец школы / админ школы — видит всё В СВОЕЙ ШКОЛЕ
CREATE POLICY "School admins full access" ON academy.enrollments
  FOR ALL USING (
    tenant_id = current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM tenant.school_team_members
      WHERE school_id = current_tenant_id()
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- ═══════════════════════════════════════════════════════════
-- TENANT SCHEMA — доступ к настройкам школы
-- ═══════════════════════════════════════════════════════════

-- Любой может видеть базовую информацию об активной школе (для публичных страниц)
CREATE POLICY "Public school info" ON tenant.schools
  FOR SELECT USING (status = 'active');

-- Только владелец / админ школы может изменять настройки
CREATE POLICY "School owner manages settings" ON tenant.school_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant.school_team_members
      WHERE school_id = school_settings.school_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- ═══════════════════════════════════════════════════════════
-- PLATFORM-WIDE ПОЛИТИКИ (без tenant — для ассоциации, платформы)
-- ═══════════════════════════════════════════════════════════

-- Администратор платформы видит ВСЕ данные ВСЕХ школ
CREATE POLICY "Platform admins full access" ON academy.enrollments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users
            WHERE id = auth.uid() AND 'platform_admin' = ANY(role))
  );
```

**Как tenant_id попадает в JWT:**
```
1. Пользователь заходит на my-school.academy-coaching.ru
2. Tenant Router определяет tenant_id по домену
3. При аутентификации Supabase GoTrue выдаёт JWT с custom claim:
   { "tenant_id": "uuid-of-my-school", "school_role": "student" }
4. RLS-функция current_tenant_id() читает claim из JWT
5. Все запросы автоматически фильтруются по школе
```

---

## 5. Модульная архитектура фронтенда

### 5.1 Структура монорепозитория

```
score-coaching/
├── apps/
│   ├── platform/               # 🔄 SPA маркетплейса (score-coaching.ru)
│   │   ├── src/
│   │   │   ├── app/            # Роутинг, лейауты, провайдеры
│   │   │   ├── modules/
│   │   │   │   ├── auth/       # Авторизация, регистрация, профиль
│   │   │   │   ├── marketplace/# Каталог коучей, бронирование
│   │   │   │   ├── sessions/   # Сессии коуч↔клиент
│   │   │   │   ├── shop/       # Магазин материалов
│   │   │   │   ├── coach-profile/ # Профиль и настройки коуча
│   │   │   │   ├── client-portal/ # Личный кабинет клиента
│   │   │   │   ├── chat/       # Мессенджер (коуч↔клиент)
│   │   │   │   ├── video/      # Видеоконференции (коуч↔клиент)
│   │   │   │   ├── gameboard/  # Игровой движок (МАК, Т-игры, доска)
│   │   │   │   │   ├── canvas/       # tldraw-холст + custom shapes
│   │   │   │   │   ├── mac-cards/    # Колоды МАК, раскладки, анимации
│   │   │   │   │   ├── dice/         # 3D-кубики (Three.js + cannon-es)
│   │   │   │   │   ├── tokens/       # Фишки, перемещение, snap-to-grid
│   │   │   │   │   ├── boards/       # Игровые поля, сетки, зоны
│   │   │   │   │   ├── timer/        # Таймер / секундомер
│   │   │   │   │   ├── session-log/  # Журнал действий, экспорт PDF
│   │   │   │   │   └── store/        # Магазин игр и колод
│   │   │   │   ├── whiteboard/ # Свободная доска (режим Miro)
│   │   │   │   ├── content/    # Библиотека, блог платформы
│   │   │   │   ├── documents/  # Документооборот (согласия, контракты)
│   │   │   │   ├── tracking/   # Трекинг часов, прогресс сертификации
│   │   │   │   ├── billing/    # Оплата, подписки
│   │   │   │   ├── diagnostics/# Диагностические тесты
│   │   │   │   └── ai-assistant/# AI помощник
│   │   │   └── shared/
│   │   │       ├── ui/          # Переиспользуемые UI-компоненты
│   │   │       ├── hooks/
│   │   │       ├── lib/         # Supabase client, API helpers
│   │   │       └── types/
│   │   └── package.json
│   │
│   ├── academy/                # 🆕 SPA академии (academy-coaching.ru)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── modules/
│   │   │   │   ├── auth/          # Авторизация
│   │   │   │   ├── school-catalog/# Каталог школ на академии
│   │   │   │   │   ├── list/      # Список школ с фильтрами
│   │   │   │   │   ├── create/    # Wizard создания школы
│   │   │   │   │   └── detail/    # Карточка школы
│   │   │   │   ├── my-schools/    # Мои школы (владелец/преподаватель)
│   │   │   │   ├── dashboard/     # Личный кабинет
│   │   │   │   └── billing/       # Тарифы, подписки школ
│   │   │   └── shared/
│   │   └── package.json
│   │
│   ├── association/            # 🆕 SPA ассоциации (association-coaching.ru)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── modules/
│   │   │   │   ├── auth/          # Авторизация
│   │   │   │   ├── membership/    # Членство и уровни
│   │   │   │   ├── certification/ # Сертификация и реестр
│   │   │   │   ├── registry/      # Публичный реестр коучей
│   │   │   │   ├── events/        # Конференции, форумы, вебинары
│   │   │   │   ├── standards/     # Этический кодекс и стандарты
│   │   │   │   ├── corporate/     # Корпоративные программы
│   │   │   │   ├── tracking/      # Трекинг часов (ICF модель)
│   │   │   │   └── dashboard/     # Личный кабинет члена ассоциации
│   │   │   └── shared/
│   │   └── package.json
│   │
│   ├── school/                  # SPA школы (*.academy-coaching.ru / кастомный домен)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── TenantProvider.tsx    # Загрузка tenant config, тема
│   │   │   │   ├── ThemeProvider.tsx     # CSS-переменные из school_settings.theme
│   │   │   │   └── TenantRouter.tsx      # Роутинг школы
│   │   │   ├── modules/
│   │   │   │   ├── home/           # Главная страница школы (school_pages type=home)
│   │   │   │   ├── courses/        # Каталог курсов школы
│   │   │   │   ├── course/         # Прохождение курса (уроки, тесты)
│   │   │   │   ├── student-portal/ # Личный кабинет студента школы
│   │   │   │   ├── blog/           # Блог школы
│   │   │   │   ├── pages/          # Статические страницы школы
│   │   │   │   ├── crm/            # 🔄 CRM школы (воронки, лиды)
│   │   │   │   │   ├── funnels/
│   │   │   │   │   ├── landings/
│   │   │   │   │   └── leads/
│   │   │   │   ├── chat/           # Чат школы (студент ↔ куратор)
│   │   │   │   ├── video/          # 🔄 Видеосессии школы (лекции, вебинары, супервизии)
│   │   │   │   │   ├── schedule/   # Расписание видеосессий школы
│   │   │   │   │   ├── session/    # Видеокомната (LiveKit + gameboard + чат + файлы)
│   │   │   │   │   └── recordings/ # Записи прошедших сессий
│   │   │   │   ├── library/        # 🆕 Библиотека школы (книги, видео, материалы)
│   │   │   │   ├── gameboard/      # Игровой движок (МАК, кубики — встроен в video/session)
│   │   │   │   └── billing/        # Оплата курсов школы
│   │   │   └── shared/             # Переиспользует из packages/ui
│   │   └── package.json
│   │
│   ├── school-admin/            # 🆕 Админ-панель владельца школы
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── dashboard/      # Обзор школы (метрики, графики)
│   │   │   │   ├── settings/       # Настройки: бренд, домен, платежи
│   │   │   │   │   ├── branding/   # Цвета, логотип, тема, шрифт
│   │   │   │   │   ├── domain/     # Поддомен / кастомный домен
│   │   │   │   │   ├── payments/   # ЮKassa субаккаунт
│   │   │   │   │   └── email/      # Email-брендинг
│   │   │   │   ├── courses/        # Управление курсами
│   │   │   │   ├── students/       # Студенты школы
│   │   │   │   ├── team/           # Команда (преподаватели, кураторы)
│   │   │   │   ├── sales/          # Воронки, лендинги, промо-коды
│   │   │   │   ├── analytics/      # Аналитика школы
│   │   │   │   ├── content/        # Страницы, блог, файлы
│   │   │   │   ├── library/        # 🆕 Управление библиотекой школы (загрузка, категории)
│   │   │   │   ├── video-sessions/ # 🆕 Управление видеосессиями (расписание, настройки, записи)
│   │   │   │   ├── certificates/   # Шаблоны сертификатов
│   │   │   │   └── subscription/   # Тариф школы на платформе
│   │   │   └── shared/
│   │   └── package.json
│   │
│   └── admin/                   # Админ-панель ПЛАТФОРМЫ (отдельный SPA)
│       └── src/
│           ├── modules/
│           │   ├── schools/        # 🆕 Управление всеми школами
│           │   ├── users/
│           │   └── ...
│           └── ...
├── packages/
│   ├── ui/                     # 🆕 Общая UI-библиотека (используется во всех apps)
│   │   ├── components/         # Кнопки, инпуты, карточки и т.д.
│   │   └── theme/              # Theme engine: CSS-переменные, presets
│   ├── tenant-sdk/             # 🆕 SDK для работы с tenant: resolve, settings, theme (только Academy + School)
│   ├── platform-config/        # 🔮 Конфиг платформы: брендинг, feature flags, endpoints
│   │   ├── coaching.ts          # score-coaching.ru config
│   │   └── [platform].ts       # Будущие платформы (psychology.ts, applied-psychology.ts)
│   ├── supabase/               # Миграции, seed, типы из БД
│   ├── shared-types/           # TypeScript типы, общие для front и back
│   └── encryption/             # Signal Protocol обёртка
├── services/
│   ├── api-gateway/            # Node.js + Fastify + Tenant Middleware
│   ├── ai-service/             # Python + FastAPI
│   └── email-worker/           # Bull MQ consumer (tenant-aware)
├── docker-compose.yml          # 🔮 Per-platform: docker-compose.coaching.yml, docker-compose.psychology.yml
└── turbo.json / nx.json
```

### 5.1.1 Tenant Provider и Theme Engine (фронтенд)

```typescript
// packages/tenant-sdk/src/TenantProvider.tsx
// Загружает конфигурацию школы при инициализации SPA

interface TenantConfig {
  id: string;
  slug: string;
  name: string;
  theme: {
    colors: { primary: string; secondary: string; accent: string; bg: string; text: string };
    font_family: string;
    border_radius: number;
    logo_url: string;
    dark_logo_url?: string;
    favicon_url: string;
    hero_url?: string;
  };
  features: Record<string, boolean>;
  socials: Record<string, string>;
  custom_css?: string;
}

// При загрузке SPA школы:
// 1. Определяем tenant по window.location.hostname
// 2. Запрашиваем GET /api/tenant/resolve?host={hostname}
// 3. API возвращает TenantConfig из Redis-кэша (или БД)
// 4. ThemeProvider инжектирует CSS-переменные в :root
// 5. Все компоненты UI используют var(--school-primary) и т.д.
// 6. favicon и title обновляются динамически
// 7. custom_css добавляется через <style> с sandbox-очисткой

// packages/ui/theme/apply-theme.ts
function applySchoolTheme(theme: TenantConfig['theme']) {
  const root = document.documentElement;
  root.style.setProperty('--school-primary', theme.colors.primary);
  root.style.setProperty('--school-secondary', theme.colors.secondary);
  root.style.setProperty('--school-accent', theme.colors.accent);
  root.style.setProperty('--school-bg', theme.colors.bg);
  root.style.setProperty('--school-text', theme.colors.text);
  root.style.setProperty('--school-font', theme.font_family);
  root.style.setProperty('--school-radius', `${theme.border_radius}px`);

  // Обновить favicon
  const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
  if (link && theme.favicon_url) link.href = theme.favicon_url;

  // Обновить title
  document.title = `${tenantConfig.name}`;
}
```

### 5.2 Маршрутизация (четыре контекста: платформа, академия, ассоциация, школа)

**Контекст 1: Платформа-маркетплейс (score-coaching.ru)**

```
score-coaching.ru/
├── /                           # Лендинг маркетплейса
├── /auth/*                     # Вход, регистрация
├── /coaches                    # Каталог коучей с поиском
├── /coach/:id                  # Профиль коуча
├── /my-sessions                # Мои сессии (клиент/коуч)
├── /shop                       # Магазин материалов
├── /diagnostics                # Диагностические тесты
├── /chat/*                     # Мессенджер (коуч↔клиент)
├── /video/:room-id             # Видеокомнаты (коуч↔клиент)
├── /game/                      # Игровой движок
│   ├── /new
│   ├── /:session-id
│   ├── /my-games
│   ├── /store
│   └── /deck-editor
├── /library/*                  # Библиотека платформы
├── /profile/*                  # Профиль пользователя
├── /dashboard/                 # Личный кабинет (роль-зависимый)
└── /admin/*                    # Админка ПЛАТФОРМЫ
```

**Контекст 2: Академия (academy-coaching.ru)**

```
academy-coaching.ru/
├── /                           # Лендинг академии + каталог школ
├── /auth/*                     # Вход, регистрация
├── /schools/                   # Каталог школ
│   ├── /                       # Список школ с фильтрами
│   ├── /create                 # Wizard создания своей школы
│   └── /:slug                  # Превью школы (→ redirect на домен школы)
├── /my-schools/                # Мои школы (владелец/преподаватель)
│   └── /:school-slug/admin/*   # → redirect на school-admin SPA
├── /profile/*                  # Профиль
├── /dashboard/                 # Личный кабинет
└── /billing/*                  # Тарифы, оплата подписок школ
```

**Контекст 3: Ассоциация (association-coaching.ru)**

```
association-coaching.ru/
├── /                           # Главная страница ассоциации SCORE
├── /auth/*                     # Вход, регистрация
├── /membership                 # Членство и уровни
├── /certification              # Сертификация
├── /registry                   # Публичный реестр коучей
├── /events                     # Конференции, форумы, вебинары
├── /standards                  # Этический кодекс
├── /corporate                  # Корпоративные программы
├── /tracking/*                 # Трекинг часов (ICF модель)
├── /profile/*                  # Профиль члена ассоциации
├── /dashboard/                 # Личный кабинет
└── /admin/*                    # Админка ассоциации
```

**Контекст 4: Сайт школы (my-school.academy-coaching.ru / my-school.ru)**

```
{school-domain}/
├── /                           # Главная страница школы (кастомный дизайн)
├── /auth/*                     # Вход/регистрация в школу (бренд школы)
├── /courses/                   # Каталог курсов школы
│   ├── /                       # Список курсов
│   └── /:course-slug           # Лендинг курса
├── /learn/                     # Обучение (после записи)
│   ├── /my-courses             # Мои курсы
│   ├── /course/:id             # Прохождение курса
│   ├── /course/:id/lesson/:id  # Урок
│   └── /certificates           # Мои сертификаты
├── /blog/*                     # Блог школы
├── /p/:slug                    # Статические страницы школы (О школе, FAQ, Контакты)
├── /l/:slug                    # Лендинги воронок продаж
├── /chat/*                     # Чат школы (студент ↔ куратор)
├── /video/                     # 🔄 Видеосессии школы (LiveKit)
│   ├── /schedule               # Расписание видеосессий (лекции, вебинары, супервизии)
│   ├── /:session-id            # Видеокомната (LiveKit + gameboard + демонстрация экрана + чат + файлы)
│   └── /recordings             # Записи прошедших сессий
├── /library/                   # 🆕 Библиотека школы
│   ├── /                       # Каталог материалов (книги, видео, документы)
│   └── /:item-id               # Просмотр/скачивание материала
├── /profile/*                  # Профиль студента в школе
├── /dashboard/                 # Личный кабинет студента школы
├── /admin/                     # 🆕 Админ-панель ШКОЛЫ (school-admin SPA)
│   ├── /dashboard              # Обзор: метрики, графики
│   ├── /settings/*             # Настройки школы (бренд, домен, платежи)
│   ├── /courses/*              # Управление курсами
│   ├── /students/*             # Студенты
│   ├── /team/*                 # Команда
│   ├── /sales/*                # Воронки, лендинги, промо-коды
│   ├── /crm/*                  # CRM: лиды, сегменты
│   ├── /analytics/*            # Аналитика
│   ├── /content/*              # Страницы, блог, файлы
│   ├── /library/*              # 🆕 Управление библиотекой (загрузка, категории, доступ)
│   ├── /video-sessions/*       # 🆕 Управление видеосессиями (расписание, настройки, записи)
│   └── /subscription/*         # Тариф на платформе
└── /game/*                     # Игровой движок (если включён в фичах школы)
```

**Как определяется контекст:**
```
Браузер → Host: ?
           │
           ├── score-coaching.ru → Загрузить Platform SPA
           ├── academy-coaching.ru (без поддомена) → Загрузить Academy SPA
           ├── association-coaching.ru → Загрузить Association SPA
           ├── *.academy-coaching.ru → Извлечь slug → Загрузить School SPA (tenant)
           └── Другой домен? → Поиск в tenant.school_domains → Загрузить School SPA (tenant)
```

---

## 6. Личные кабинеты по ролям

Каждый сайт имеет свой `/dashboard`, который отображает интерфейс в зависимости от роли пользователя. Роли разделены на **глобальные** (общие для всех сайтов) и **школьные** (в контексте конкретной школы/tenant). Один пользователь (один аккаунт) может иметь роли на разных сайтах — авторизация общая через Supabase GoTrue:

### 6.1 Платформенные роли (global scope — users.role[])

| Роль | Сайт | Доступные модули |
|---|---|---|
| **Администратор платформы** | Все три сайта | Управление всеми школами, пользователями, верификация, инциденты, глобальная аналитика |
| **Коуч** | score-coaching.ru | Мои услуги, расписание, клиенты, сессии, магазин материалов, блог |
| **Клиент** | score-coaching.ru | Каталог коучей, мои сессии, абонементы, диагностика |
| **Член ассоциации** | association-coaching.ru | Членство, сертификаты, реестр, события |
| **Анонимный пользователь** | score-coaching.ru | Анонимный чат с волонтёром-«слушателем» (по модели 7 Cups) |

### 6.2 Школьные роли (tenant scope — school_team_members.role + enrollments)

| Роль | Контекст | Доступные модули |
|---|---|---|
| **🆕 Владелец школы** | Школа (admin) | Полный контроль: настройки школы, бренд, домен, курсы, студенты, команда, аналитика, воронки, CRM, тариф, финансы. Может иметь несколько школ |
| **🆕 Админ школы** | Школа (admin) | Всё как у владельца, кроме: удаление школы, смена тарифа, финансовые настройки. Назначается владельцем |
| **Преподаватель/Куратор** | Школа | Управление курсами (только своими или назначенными), проверка заданий, журнал посещаемости, блог школы |
| **🆕 Менеджер школы** | Школа | CRM, лиды, воронки, лендинги, рассылки, студенты (без доступа к курсам) |
| **Супервизор** | Школа | Расписание супервизий, журнал студентов, обратная связь |
| **Студент школы** | Школа | Мои курсы (в этой школе), задания, тесты, сертификаты, чат с куратором |

### 6.3 Совмещение ролей

Один аккаунт (один email / VK ID) работает на всех трёх сайтах. Пользователь может одновременно:
- Быть **коучем** на score-coaching.ru и **владельцем школы** на academy-coaching.ru
- Быть **членом ассоциации** на association-coaching.ru и **студентом** в школе на academy-coaching.ru
- Быть **владельцем** школы A и **студентом** в школе B
- Быть **преподавателем** в нескольких школах

Глобальные роли хранятся в `users.role[]`. Школьные роли — в `tenant.school_team_members` (для команды) и `academy.enrollments` (для студентов).

---

## 7. Ключевые подсистемы: детальное описание

### 7.1 Видеоконференции (LiveKit)

**LiveKit — единственная видеоплатформа** в экосистеме SCORE Coaching. Self-hosted на выделенном VPS Selectel в Москве.

#### Почему LiveKit

1. **Полный контроль UI** — React SDK позволяет встроить виртуальную приёмную, интерактивные карточки (МАК, кубики), tldraw-доску прямо в видеосессию
2. **Брендинг** — полностью кастомный интерфейс без стороннего брендинга
3. **Контроль данных** — записи сессий хранятся на своём VPS, соответствие 152-ФЗ без зависимости от сторонних облаков
4. **Латентность в РФ** — сервер в московском ДЦ Selectel, пинг < 10 мс для 80%+ пользователей, медиатрафик не покидает территорию РФ
5. **E2E шифрование** — нативная поддержка SRTP + DTLS
6. **Open-source** — бесплатно при self-hosted, нет vendor lock-in

#### Возможности видеоконференций

| Возможность | Реализация |
|---|---|
| Групповые видеозвонки (до 50 участников) | LiveKit SFU, адаптивный битрейт |
| Индивидуальные сессии (1:1) | LiveKit Room с 2 участниками |
| Демонстрация экрана | LiveKit Screen Share API |
| Запись сессий | LiveKit Egress API → MinIO/S3 |
| Виртуальная приёмная | Room permissions + pre-join lobby |
| Интерактивная доска | tldraw поверх видео через Data Channel |
| Игровой движок (МАК-карты, кубики, токены) | React-компоненты в LiveKit VideoConference layout |
| Чат внутри сессии | LiveKit Data Channel (текст, эмодзи, реакции) |
| Обмен файлами в сессии | LiveKit Data Channel + Supabase Storage |

#### Архитектура видеоконференций (LiveKit)

```
Браузер ←→ LiveKit Server (VPS в РФ) ←→ Браузер(ы)
                     ↓
              LiveKit Egress
              (запись → MinIO/S3 на том же VPS)
```

**Оптимизация для РФ:**
- LiveKit-сервер размещается на выделенном VPS в Москве (Selectel) — минимальная задержка для 80%+ пользователей
- TURN-сервер (coturn) на VPS #2 (рядом с LiveKit) — для пользователей за NAT/файрволлом
- WebRTC использует UDP по умолчанию; TCP-fallback через TURN для проблемных сетей

**Интеграция:**
- Создание комнат и токенов через API Gateway (Fastify)
- Токены подписываются API-ключом LiveKit на сервере
- Клиент подключается по WebSocket к LiveKit напрямую

#### 🆕 Видеосессии для школ (tenant-scoped)

Преподаватели каждой школы в Академии могут проводить онлайн-занятия со студентами — **точно так же, как коучи проводят сессии на платформе**. Школьные видеосессии полностью изолированы по `tenant_id` и поддерживают все возможности платформенных сессий.

**Типы видеосессий школы:**

| Тип | Описание | Участники |
|---|---|---|
| **Лекция (lecture)** | Преподаватель ведёт занятие, студенты слушают. Демонстрация экрана, чат | 1 преподаватель → до 50 студентов |
| **Вебинар (webinar)** | Интерактивное занятие с вопросами, голосованиями | 1–3 ведущих → до 50 участников |
| **Супервизия (supervision)** | Разбор кейсов студента с обратной связью | 1 супервизор → 1–5 студентов |
| **Консультация (consultation)** | Индивидуальная работа преподавателя со студентом | 1:1 |
| **Групповая практика (group_practice)** | Студенты практикуют навыки в группе с наблюдением преподавателя | 1 преподаватель + 2–10 студентов |

**Встроенные инструменты (идентичны платформенным):**
- Интерактивные карточки МАК (игровой движок) — преподаватель может использовать колоды МАК, кубики, игровые поля прямо в видеосессии
- Демонстрация экрана (screen sharing)
- Чат внутри сессии (текст, файлы, реакции)
- Обмен файлами (через Supabase Storage, tenant-isolated bucket)
- Виртуальная приёмная (waiting room) — студенты ждут, пока преподаватель впустит
- Запись сессии (LiveKit Egress → MinIO, bucket: `tenants/{tenant_id}/recordings/`)

**Поток создания видеосессии школы:**
```
Преподаватель школы → POST /api/school/video-sessions
  │   { title, type, scheduled_at, max_participants, settings }
  │   Header: X-Tenant-Id (из JWT)
  ↓
API Gateway (Tenant Middleware проверяет tenant_id + роль instructor/owner)
  │
  ├── Создаёт запись в academy.video_sessions (tenant_id из JWT)
  ├── Генерирует LiveKit Room Name: tenant_{id}_session_{id}
  ├── Отправляет уведомления студентам (BullMQ → email + push)
  │
  ↓
В назначенное время:
  ├── Преподаватель → POST /api/livekit/token { room, identity, role: "host" }
  ├── Студент → POST /api/livekit/token { room, identity, role: "participant" }
  │   (API проверяет: студент записан на курс + tenant_id совпадает)
  └── Оба подключаются к LiveKit через WebSocket
```

#### 🆕 Библиотека школы (tenant-scoped)

Каждая школа имеет собственную **библиотеку** — хранилище учебных материалов для студентов. Данные в `content.library_items` с `tenant_id`.

**Возможности библиотеки школы:**
- Загрузка книг, видеоматериалов, аудио, презентаций, документов
- Категоризация и теги для удобной навигации
- Управление доступом: бесплатные материалы / только для студентов определённых курсов / только для подписчиков
- Поиск по названию, автору, категории
- Предпросмотр (PDF viewer, видеоплеер) и скачивание
- Файлы хранятся в Supabase Storage: `tenants/{tenant_id}/library/`

**Платформенная библиотека** (`tenant_id = NULL`) — общие ресурсы для всех пользователей платформы (ассоциация, маркетплейс). Школьная библиотека дополняет, а не заменяет платформенную.

### 7.2 Мессенджер (Supabase Realtime + Signal Protocol)

**Архитектура:**
```
Клиент A                              Клиент B
   │                                      │
   ├── Signal Protocol (шифрование) ──────┤
   │                                      │
   └── Supabase Realtime (транспорт) ─────┘
             │
        PostgreSQL
    (хранит encrypted_content)
```

Сообщения шифруются на клиенте перед отправкой. Сервер хранит только зашифрованные данные. Ключи обмениваются через таблицу `encryption_keys`.

Поддерживаемые форматы: текст, аудиосообщения, видеосообщения, файлы — как в Talkspace.

### 7.3 LMS (🔄 Мультитенантная обучающая платформа — Академия-как-сервис)

Модульная LMS, работающая в контексте конкретной школы (tenant). Каждая школа имеет свои курсы, студентов, настройки — полностью изолированные от других школ. По аналогии с GetCourse:

```
Курс
├── Модуль 1
│   ├── Урок (видео)
│   ├── Урок (текст + рабочий лист / worksheet)
│   ├── Тест (квиз с автопроверкой)
│   └── Задание (проверяет преподаватель)
├── Модуль 2
│   └── ...
└── Финальный тест / сертификация
```

Прогресс отслеживается в `enrollments.progress_pct`. Уроки открываются последовательно или по настройке преподавателя.

**Рабочие листы (worksheets)** — интерактивные формы с полями ввода, которые сохраняются в `assignments.submission` (JSONB). Инспирировано Online-Therapy.com.

**Дополнения по итогам анализа GetCourse и конкурентов:**
- **Конструктор лендингов** — преподаватель создаёт посадочную страницу для курса (drag-and-drop редактор, шаблоны). Данные в `crm.landing_pages`
- **Авто-воронки** — настраиваемые цепочки: лендинг → заявка → email-серия → предложение → оплата. Данные в `crm.funnels`
- **Видеосессии школы** — преподаватели проводят лекции, вебинары, супервизии и групповые практики через LiveKit (см. 7.1). В видеосессию встроены интерактивные карточки (МАК), демонстрация экрана, чат, обмен файлами — всё как на платформе для коучей
- **Автовебинары** — предзаписанное видео с чатом-симуляцией для масштабируемых курсов
- **Библиотека школы** — каждая школа ведёт собственную библиотеку учебных материалов (книги, видео, документы) для студентов (см. 7.1)
- **Автоматический трекинг часов** — завершение урока/занятия автоматически добавляет часы в `tracking.coaching_hours` для прогресса к сертификации

### 7.4 AI-помощник (расширенный — по итогам анализа Talkspace, Jane App, SimplePractice)

**Реализация:** Python FastAPI-сервис с интеграцией GigaChat API (Сбер) или YandexGPT.

**Функции:**

| Функция | Описание | Триггер | Инспирировано |
|---|---|---|---|
| Помощь при регистрации | Пошаговый wizard, ответы на FAQ, заполнение intake-форм | Кнопка «Помощь» на форме регистрации | SimplePractice |
| **AI Scribe** | Протоколирование сессии в реальном времени: распознавание речи → структурированные заметки по шаблону SOAP/GROW/STAR | Во время видеосессии (с согласия обеих сторон) | Jane App AI Scribe |
| **Подготовка к сессии** | Перед сессией AI формирует briefing для коуча: история клиента, прогресс в программе, паттерны из предыдущих заметок, рекомендуемые темы | За 15 мин до сессии (push-уведомление) | Talkspace AI Insights |
| Автоотчёт после занятия | Генерация краткого отчёта для преподавателя по итогам урока/сессии | Завершение видеоконференции | — |
| Журнал посещаемости | Автоматическая отметка присутствия по данным LiveKit (кто подключился, длительность) | Завершение видеоконференции | — |
| **Распознавание паттернов** | Анализ серии заметок клиента: выявление повторяющихся тем, динамика прогресса, сигналы риска | По запросу коуча или периодически | Talkspace AI |
| Дневник сессий | Структурированные заметки по шаблону SOAP/GROW с автозаполнением из AI Scribe | После сессии коуч-клиент | — |
| **Подбор упражнений** | На основе темы сессии AI рекомендует worksheets, МАК-техники, диагностические тесты из библиотеки | Во время/после сессии | THERAPlatform |
| **Автотрекинг часов** | Автоматический подсчёт часов практики, образования, менторинга по данным системы → прогресс к сертификации | После каждой сессии/урока | ICF модель |

### 7.5 Документооборот коуч–клиент

Обязательные документы, которыми обмениваются коуч и клиент перед началом и в процессе работы:

| Документ | Когда подписывается | Описание |
|---|---|---|
| **Информированное согласие** | До первой сессии | Клиент подтверждает, что понимает суть коучинга, границы ответственности, конфиденциальность, право на отказ. Обязателен перед любой работой |
| **Контракт на коучинговое сопровождение** | До первой сессии | Условия работы: количество сессий, периодичность, стоимость, условия отмены/переноса, права и обязанности сторон |
| **Договор на обучение** | При записи на курс (Академия) | Условия обучения: программа, сроки, стоимость, порядок аттестации, условия возврата |
| **Договор на оказание услуг** | При разовых/пакетных услугах (Платформа) | Юридически обязывающий договор-оферта на конкретные услуги |

**Реализация:**

```
Коуч загружает шаблоны документов (DOCX/PDF)
    │
    ├── Система генерирует персонализированный документ
    │   (подстановка: ФИО клиента, даты, стоимость, кол-во сессий)
    │
    ├── Клиент получает документ в личном кабинете / по email
    │
    ├── Клиент подписывает электронной подписью (чекбокс + ФИО + дата)
    │
    └── Подписанный документ сохраняется в Supabase Storage
        с привязкой к сессии/курсу/договору
```

**Таблицы БД (дополнение к platform schema):**
```sql
document_templates (id, owner_id FK, title, type, file_url, variables JSONB, is_system, created_at)
-- type: informed_consent | coaching_contract | training_agreement | service_agreement
-- variables: [{ key: "client_name", label: "ФИО клиента" }, { key: "sessions_count", label: "Кол-во сессий" }]
-- is_system: true для стандартных шаблонов платформы

documents (id, template_id FK, sender_id FK, recipient_id FK, session_id FK, course_id FK, status, generated_file_url, signed_file_url, variables_data JSONB, created_at, signed_at)
-- status: draft | sent | viewed | signed | expired | rejected
-- variables_data: { client_name: "Иванов И.И.", sessions_count: 10, price: 50000 }

document_signatures (id, document_id FK, signer_id FK, full_name, ip_address, user_agent, signed_at)
-- Юридически значимая фиксация факта подписания
```

**Важные детали:**
- Коуч не может начать сессию, пока клиент не подписал информированное согласие и контракт (блокировка на уровне UI + проверка в API)
- При записи на курс в Академии — автоматически генерируется договор на обучение из шаблона
- Все подписанные документы доступны в разделе «Мои документы» личного кабинета клиента и коуча
- Платформа предоставляет стандартные шаблоны документов (`is_system: true`), но коуч может загрузить свои
- Подписанные документы хранятся бессрочно в зашифрованном виде

### 7.6 Система оплаты (🔄 с поддержкой расщепления для школ)

```
Студент → Платёжная форма (React, бренд школы) → API Gateway → ЮKassa API
                                                                    ↓
                                                         ┌──────────────────────┐
                                                         │ Split Payment:        │
                                                         │ 95% → школе          │
                                                         │  5% → платформе      │
                                                         │ (% зависит от тарифа)│
                                                         └──────────┬───────────┘
                                                                    ↓
                                                          Webhook (оплата OK)
                                                                    ↓
                                                      Обновление подписки в БД
                                                      Отправка чека (54-ФЗ)
```

**Типы оплат:**

*Маркетплейс (score-coaching.ru):*
- Абонементы на пакеты сессий (разовая с лимитом)
- Покупки в магазине (разовые)

*Ассоциация (association-coaching.ru):*
- Членские взносы ассоциации (рекуррентные)
- Оплата событий/конференций (разовая)

*Академия (academy-coaching.ru):*
- 🆕 Подписка школы на тариф платформы (рекуррентная)

*Школьные (tenant-scoped, через Split Payments):*
- 🆕 Покупка курсов школы (разовая, деньги → школе минус комиссия)
- 🆕 Абонементы школы (рекуррентные)
- 🆕 Оплата вебинаров школы (разовая)

**🆕 ЮKassa Split Payments для школ:**

Каждая школа подключается как субаккаунт ЮKassa. При оплате курса студентом платёж автоматически расщепляется: основная часть → на счёт школы, комиссия → на счёт платформы. Процент комиссии зависит от тарифа школы (3–10%).

ЮKassa поддерживает 54-ФЗ (онлайн-кассы) из коробки.

### 7.7 Виртуальная приёмная (Virtual Waiting Room) — по модели Doxy.me

По аналогии с Doxy.me — перед началом видеосессии клиент попадает в «виртуальную приёмную»:

- Клиент переходит по персональной ссылке коуча (например, `score-coaching.ru/coach/ivanov` — на платформе)
- **Teleconsent** — перед входом клиент подписывает цифровое согласие (на запись, обработку данных) через чекбокс + электронную подпись. Данные сохраняются в `teleconsent` таблице
- Попадает в зал ожидания с: информацией о коуче, таймером до начала, **пре-сессионной анкетой** (intake form) при первом визите
- **Кастомизация**: коуч настраивает приёмную под себя — фоновое изображение, приветственное видео, инструкции перед сессией (как в Doxy.me)
- Коуч видит **очередь клиентов** с индикатором ожидания
- Коуч «впускает» клиента в сессию кнопкой
- Реализация: LiveKit Room с `participantCanPublish: false` до разрешения коуча

### 7.8 Подбор коуча (Matching Algorithm)

Инспирировано Calmerry — система подбора коуча по запросу клиента:

- При регистрации клиент заполняет анкету: направление (карьерный, личностный, бизнес-коучинг и т.д.), предпочтения по полу/возрасту/стилю, бюджет
- Алгоритм ранжирует коучей по: совпадению специализации, рейтингу, доступности, ценовому диапазону
- На старте — простое SQL-ранжирование с весовыми коэффициентами; позже — ML-модель на основе данных об успешных парах
- Результат: отсортированный список рекомендованных коучей с объяснением «почему подходит»

### 7.9 Аналитика (🔄 с поддержкой school-level аналитики)

Панель аналитики для администраторов, коучей и владельцев школ (инспирировано Amwell + GetCourse):

**Для администратора платформы:** количество активных школ, общий доход платформы (комиссии), количество пользователей, конверсия регистрация→создание школы, загрузка видеосервера, NPS, топ-школы по выручке.

**🆕 Для владельца школы (tenant-scoped):** доход школы по периодам/курсам, количество студентов (новые/активные/ушедшие), конверсия воронок продаж, эффективность лендингов (CTR, CR), UTM-аналитика, завершаемость курсов, средний LTV студента, churn rate, рейтинг курсов, загруженность кураторов. Данные из `tenant.school_analytics_daily` (материализованное представление).

**Для коуча:** количество сессий, доход, средний рейтинг, retention клиентов, заполненность расписания.

**Для преподавателя школы:** посещаемость, средние оценки, прогресс студентов, завершаемость курсов (в рамках своей школы).

Реализация: материализованные представления PostgreSQL + периодическое обновление через Bull MQ cron-задачи. **Все запросы аналитики фильтруются по `tenant_id`** — владелец школы видит только свои данные. Фронтенд — дашборды на **Recharts** (React-библиотека графиков).

### 7.10 Игровой движок: интерактивная доска, МАК-карты, Т-игры

Один из ключевых модулей платформы — встроенный игровой движок, объединяющий функциональность интерактивной доски (аналог Miro), работу с метафорическими ассоциативными картами (МАК) и проведение трансформационных игр (Т-игр). Инспирировано [МАК-практика](https://macpractica.ru/) и [SandBox Игропрактик](https://sandbox-pro.site/sandbox_igropraktik).

#### 7.10.1 Архитектура игрового движка

```
┌──────────────────────────────────────────────────────────────────┐
│                     Игровая комната (React)                      │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │  Холст      │  │  Панель      │  │  Видеоконференция      │  │
│  │  (tldraw)   │  │  инструментов│  │  (LiveKit, PiP-режим)  │  │
│  │             │  │              │  │                        │  │
│  │ ┌─────────┐ │  │ - Колоды МАК │  └────────────────────────┘  │
│  │ │Игровое  │ │  │ - Кубики     │                              │
│  │ │поле     │ │  │ - Фишки      │  ┌────────────────────────┐  │
│  │ │(фон)    │ │  │ - Таймер     │  │  Чат сессии            │  │
│  │ ├─────────┤ │  │ - Рисование  │  │  (Supabase Realtime)   │  │
│  │ │Фишки    │ │  │ - Пометки    │  └────────────────────────┘  │
│  │ │Карты    │ │  │ - Загрузка   │                              │
│  │ │Кубики   │ │  │   материалов │  ┌────────────────────────┐  │
│  │ └─────────┘ │  └──────────────┘  │  Журнал сессии         │  │
│  └─────────────┘                     │  (автозапись действий) │  │
│                                      └────────────────────────┘  │
└──────────────────────────┬───────────────────────────────────────┘
                           │ Supabase Realtime (WebSocket)
                           ▼
                    Синхронизация состояния
              (все участники видят одно и то же)
```

#### 7.10.2 Компоненты игрового движка

**1. Холст (Canvas) — база на tldraw**

Основа — библиотека **tldraw** (open-source, React), расширенная custom-шейпами для игровых элементов:

- Бесконечный холст с масштабированием и навигацией
- Рисование от руки, текстовые пометки, стикеры
- Загрузка фонов / игровых полей как фоновый слой
- Слои: фон → игровое поле → карты → фишки → пометки (z-index)

**2. Метафорические ассоциативные карты (МАК)**

По аналогии с МАК-практика (~100 колод):

| Функция | Описание |
|---|---|
| **Библиотека колод** | Встроенные колоды МАК (60+ на старте) + возможность загрузки своих колод |
| **Выкладывание карт** | Drag-and-drop из колоды на холст, с анимацией «переворачивания» |
| **Карта рубашкой вверх** | Клиент видит карту рубашкой вверх → клик переворачивает (только участник, кому принадлежит ход) |
| **Случайный выбор** | Кнопка «вытянуть карту» — рандом из колоды с анимацией |
| **Раскладки** | Предустановленные раскладки: линейная (3–5 карт), крест, круг, произвольная |
| **Зум карты** | Клик по карте — увеличение для детального рассмотрения |
| **Собственные колоды** | Загрузка ZIP-архива с изображениями → автоматическое создание колоды |

**3. Игровые поля**

| Функция | Описание |
|---|---|
| **Библиотека полей** | Встроенные игровые поля для популярных Т-игр + загрузка своих |
| **Загрузка поля** | Изображение (PNG/JPG/SVG) загружается как фоновый слой холста |
| **Привязка клеток** | Опционально: разметка клеток поля (сетка или произвольные зоны) для привязки фишек |
| **Масштабирование** | Поле масштабируется под размер экрана с сохранением пропорций |

**4. Кубики (Dice)**

Набор виртуальных кубиков с 3D-анимацией броска:

| Тип кубика | Описание |
|---|---|
| **D6 (стандартный)** | Классический шестигранный кубик |
| **D3** | Трёхгранный (результат 1–3) |
| **D12** | Двенадцатигранный |
| **D6 цветной** | Грани с цветами вместо чисел |
| **D2 (+/-)** | Кубик «да/нет», «плюс/минус» |
| **Пользовательский** | Создание кубика с произвольными значениями на гранях (текст, иконки) |

Реализация: **Three.js** (3D-рендеринг в браузере) для анимации броска + физика (cannon-es). Результат определяется на сервере (API Gateway) для предотвращения манипуляций. Результат броска синхронизируется через Realtime — все участники видят один и тот же бросок.

**5. Фишки (Tokens)**

| Функция | Описание |
|---|---|
| **Формы** | Круглые, квадратные, треугольные |
| **Цвета** | 8+ цветов на выбор |
| **Привязка к участнику** | Каждый участник управляет своей фишкой |
| **Перемещение** | Drag-and-drop по полю; опционально — привязка к клеткам (snap-to-grid) |
| **Анимация хода** | При броске кубика фишка автоматически перемещается на N клеток |

**6. Таймер**

- Обратный отсчёт (настраиваемый: 1, 3, 5, 10, 15 мин)
- Прямой отсчёт (секундомер)
- Виден всем участникам
- Звуковое уведомление при завершении
- Ведущий может ставить на паузу / сбрасывать

**7. Журнал сессии (автозапись)**

Каждое действие записывается автоматически:
- Какая карта была вытянута, кем, когда
- Результаты бросков кубиков
- Перемещения фишек
- Пометки и комментарии участников
- Экспорт журнала в PDF после сессии

#### 7.10.3 Роли в игровой комнате

| Роль | Возможности |
|---|---|
| **Ведущий** (коуч/преподаватель) | Полный контроль: выбор поля, колод, управление кубиками, открытие/закрытие карт, перемещение любых фишек, таймер, пометки, управление ходами |
| **Участник** (клиент/студент) | Бросает кубик (когда разрешено ведущим), тянет карту из колоды, двигает свою фишку, делает пометки в своей зоне |
| **Наблюдатель** | Только просмотр (для супервизий) |

#### 7.10.4 Режимы работы

| Режим | Описание |
|---|---|
| **Т-игра** | Полный набор: поле + фишки + кубики + карты + таймер. До 7 участников + ведущий |
| **МАК-сессия** | Холст + колоды МАК + раскладки. 1-к-1 или группа до 7 чел. |
| **Свободная доска** | Режим Miro: рисование, стикеры, загрузка изображений, совместная работа |
| **Самопрактика** | Клиент работает сам: тянет карты, делает раскладки, ведёт дневник |

#### 7.10.5 Магазин игр и колод

Интеграция с разделом магазина платформы:

- Авторы (коучи, игропрактики) загружают свои Т-игры и колоды МАК в магазин
- Каждая игра включает: игровое поле (изображение), правила (PDF/текст), набор колод, настройки кубиков и фишек
- Покупатель получает доступ к игре в своём кабинете и может проводить сессии
- Модель монетизации: разовая покупка или подписка на библиотеку игр
- Комиссия платформы с продаж (например, 20–30%)

#### 7.10.6 Техническая реализация

**Стек:**
- **tldraw** — базовый холст, рисование, навигация, custom shapes
- **Three.js + cannon-es** — 3D-анимация кубиков с физикой
- **Framer Motion** — анимации карт (переворот, выкладывание, зум)
- **Supabase Realtime** — синхронизация состояния между участниками в реальном времени
- **Supabase Storage** — хранение колод, полей, пользовательских материалов

**Синхронизация состояния:**

```
Участник A (действие: бросок кубика)
    │
    ├── 1. Запрос к API Gateway → генерация результата (серверный RNG)
    │
    ├── 2. API → Supabase Realtime broadcast:
    │       { type: "dice_roll", dice: "D6", result: 4, player: "A" }
    │
    └── 3. Все клиенты получают событие → проигрывают анимацию → показывают результат
```

**Формат хранения игры (JSONB):**
```json
{
  "game_id": "uuid",
  "board": { "image_url": "...", "grid": { "type": "hex|square|free", "cells": [...] } },
  "decks": [
    { "id": "uuid", "name": "Колода чувств", "cards": [
      { "id": "uuid", "front_url": "...", "back_url": "..." }
    ]}
  ],
  "dice": [
    { "type": "D6", "faces": [1,2,3,4,5,6] },
    { "type": "custom", "faces": ["да","нет","может быть"] }
  ],
  "tokens": { "shapes": ["circle","square"], "colors": ["red","blue","green","yellow"] },
  "rules_url": "...",
  "max_players": 7
}
```

#### 7.10.7 Интеграция игрового движка с видеосессиями (Real-Time Game-in-Video)

Ключевая возможность платформы — проведение МАК-карт, квизов и трансформационных игр **в режиме реального времени прямо во время видеосессии**. Коуч не переключается между отдельными инструментами — игровой движок встраивается в видеокомнату как интерактивный слой.

**Архитектура интеграции:**

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    Видеосессия (LiveKit Room)                             │
│                                                                          │
│  ┌─────────────────────────────────┐  ┌───────────────────────────────┐  │
│  │        ВИДЕОПОТОК               │  │    ИНТЕРАКТИВНАЯ ПАНЕЛЬ       │  │
│  │  ┌───────────┐ ┌───────────┐   │  │                               │  │
│  │  │  Коуч     │ │  Клиент   │   │  │  [МАК] [Квиз] [Т-игра] [Доска]│  │
│  │  │  (камера) │ │  (камера) │   │  │         ↓ активный модуль      │  │
│  │  └───────────┘ └───────────┘   │  │  ┌──────────────────────────┐  │  │
│  │                                 │  │  │   tldraw Canvas          │  │  │
│  │  При открытии игры →            │  │  │   + МАК-колоды           │  │  │
│  │  видео сжимается в PiP:        │  │  │   + Кубики / фишки       │  │  │
│  │  ┌─────┐                        │  │  │   + Вопросы квиза        │  │  │
│  │  │ PiP │ (перемещаемый)        │  │  │                          │  │  │
│  │  └─────┘                        │  │  └──────────────────────────┘  │  │
│  └─────────────────────────────────┘  └───────────────────────────────┘  │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Нижняя панель: Чат | Журнал действий | AI Scribe | Таймер        │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

**Режимы видео + игра:**

| Режим | Описание | Лейаут |
|---|---|---|
| **Side-by-Side** | Видео (50%) слева, игровой холст (50%) справа. Для десктопа | `grid-cols-2` |
| **PiP (Picture-in-Picture)** | Игровой холст занимает весь экран, видео в плавающем мини-окне (drag-and-drop, resizable). Для фокуса на игре | `relative` + `absolute` PiP |
| **Presenter Mode** | Коуч видит полный холст + управление, клиент видит только результат (например, выпавшую карту). Для направленных МАК-сессий | Раздельный рендер по роли |
| **Fullscreen Video** | Обратно к полному видео, холст сворачивается в мини-панель справа. Для обсуждения результатов | Видео + sidebar |

**Запуск игры во время видеосессии (UX-поток):**

1. Коуч нажимает кнопку **«Интерактивные инструменты»** на панели видеокомнаты
2. Открывается меню: `МАК-карты` | `Квиз` | `Т-игра` | `Свободная доска`
3. При выборе инструмента:
   - Создаётся запись `game_sessions` со ссылкой на `video_session_id`
   - Клиент получает уведомление через Supabase Realtime: «Коуч открыл МАК-сессию»
   - Клиент автоматически видит игровой холст (лейаут переключается на Side-by-Side или PiP)
4. Видео и аудио продолжают работать через LiveKit — никакого прерывания
5. Все действия на холсте синхронизируются через Supabase Realtime для обоих участников
6. По завершении коуч закрывает инструмент → лейаут возвращается к полному видео

**Квиз во время видеосессии:**

Квизы — отдельный интерактивный формат, встроенный в видеокомнату:

```
Коуч создаёт квиз (заранее или на лету)
    │
    ├── Вопрос отправляется клиенту через Realtime
    │       → Клиент видит вопрос поверх видео (overlay)
    │       → Варианты ответов (radio / checkbox / текст)
    │
    ├── Клиент отвечает → результат мгновенно у коуча
    │
    └── Коуч видит статистику и может обсудить ответ в реальном времени
```

Квизы хранятся в `academy.quizzes` (JSONB: вопросы, варианты, правильные ответы, пояснения). Могут использоваться как самостоятельный инструмент (в LMS) или запускаться прямо из видеосессии.

**Техническая реализация интеграции:**

```typescript
// Компонент VideoRoom расширяется GameOverlay
interface VideoGameSession {
  videoSessionId: string;      // LiveKit room ID
  gameSessionId: string | null; // null = только видео
  gameType: 'mac' | 'quiz' | 'tgame' | 'whiteboard' | null;
  layout: 'side-by-side' | 'pip' | 'presenter' | 'fullscreen-video';
}

// Supabase Realtime channel — один канал для видео+игры
const channel = supabase.channel(`session:${videoSessionId}`)
  .on('broadcast', { event: 'game:start' }, handleGameStart)
  .on('broadcast', { event: 'game:action' }, handleGameAction)
  .on('broadcast', { event: 'game:end' }, handleGameEnd)
  .on('broadcast', { event: 'quiz:question' }, handleQuizQuestion)
  .on('broadcast', { event: 'quiz:answer' }, handleQuizAnswer)
  .subscribe();
```

**Связь на уровне БД:**

```sql
-- Расширение таблицы gameboard.game_sessions
ALTER TABLE gameboard.game_sessions
  ADD COLUMN platform_session_id UUID,  -- ⚠️ Без FK: при Variant C platform schema в отдельной БД
  ADD COLUMN school_session_id UUID REFERENCES academy.video_sessions(id),
  ADD COLUMN launched_during_video BOOLEAN DEFAULT false;
-- 🔄 Поддержка обоих контекстов: платформенные сессии (коуч↔клиент) и школьные (преподаватель↔студенты)
-- CHECK: ровно один из platform_session_id / school_session_id должен быть NOT NULL если launched_during_video = true

-- Квизы в видеосессиях (оба контекста)
CREATE TABLE academy.session_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenant.schools(id),
  platform_session_id UUID,  -- ⚠️ Без FK: при Variant C platform schema будет в отдельной БД
  school_session_id UUID REFERENCES academy.video_sessions(id),
  quiz_id UUID REFERENCES academy.quizzes(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  responses JSONB DEFAULT '[]',
  completed_at TIMESTAMPTZ
);
-- tenant_id: NULL для платформенных квизов, NOT NULL для школьных
-- platform_session_id: plain UUID без FK constraint — обеспечивает совместимость с Variant C (полная изоляция платформ)
```

**Латентность и производительность:**

| Канал | Задержка | Протокол |
|---|---|---|
| Видео/аудио | < 150 мс | WebRTC (LiveKit, UDP) |
| Действия на холсте (карты, кубики) | < 100 мс | WebSocket (Supabase Realtime) |
| Квиз (вопрос → ответ) | < 100 мс | WebSocket (Supabase Realtime) |

Оба канала (WebRTC для медиа, WebSocket для данных) работают параллельно и независимо — задержка одного не влияет на другой. Это обеспечивает плавный опыт: клиент и коуч разговаривают по видео и одновременно взаимодействуют с общим холстом.

### 7.11 Учебные карточки (Flashcards, аналог Quizlet)

- Custom React-компонент с flip-анимацией (Framer Motion)
- Данные в `flashcard_decks.cards` (JSONB)
- Режимы: просмотр, тест, заучивание с интервальным повторением

### 7.12 Презентации

- Загрузка файлов (PPTX/PDF) в Supabase Storage
- Просмотр через конвертацию в изображения (LibreOffice headless на сервере)
- Синхронная демонстрация через Realtime (текущий слайд)

---

## 8. Безопасность и соответствие требованиям

### 8.1 Соответствие 152-ФЗ

- Все персональные данные хранятся на VPS в РФ
- Supabase self-hosted — полный контроль над данными
- Политика конфиденциальности и согласие на обработку ПД при регистрации
- Логирование доступа к ПД (audit log)

### 8.2 Шифрование

| Слой | Метод |
|---|---|
| Транспорт | TLS 1.3 (HTTPS) |
| Чаты | Signal Protocol (E2E) |
| Видео | DTLS-SRTP + опционально E2E (LiveKit) |
| Файлы | AES-256 at rest (Supabase Storage encryption) |
| БД | PostgreSQL TDE или pgcrypto для чувствительных полей |

### 8.3 Аутентификация и авторизация

**Способы входа (приоритет):**

| Способ | Реализация | Примечания |
|---|---|---|
| **Email + пароль** | Supabase GoTrue (встроенный) | Основной способ; подтверждение email при регистрации |
| **VK ID** | OAuth 2.0 через VK ID SDK | Единая учётная запись VK экосистемы. Supabase GoTrue поддерживает custom OAuth providers — настраивается через `supabase.auth.signInWithOAuth({ provider: 'vk' })` после регистрации приложения в [VK ID](https://id.vk.com/business) |
| **MAX (Мессенджер)** | OAuth 2.0 через VK ID | MAX входит в экосистему VK, авторизация через VK ID автоматически покрывает пользователей MAX. Если MAX в будущем выделит отдельный OAuth-провайдер — добавляется как ещё один custom provider в GoTrue |
| **Magic Link** | Supabase GoTrue (встроенный) | Вход по одноразовой ссылке на email — удобно для клиентов, которые не хотят запоминать пароль |

**Схема авторизации:**

```
Пользователь
    │
    ├── Email + пароль ──────┐
    ├── VK ID (OAuth 2.0) ───┼──→ Supabase GoTrue ──→ JWT токен ──→ Приложение
    ├── MAX (через VK ID) ───┤        │
    └── Magic Link ──────────┘        ▼
                                  users.role[]
                                  (RBAC проверка)
```

**Важно для российских пользователей:**
- VK ID — наиболее популярный OAuth-провайдер в РФ (~100 млн пользователей)
- MAX (мессенджер VK) использует ту же авторизацию VK ID, поэтому пользователи MAX автоматически могут входить через кнопку «Войти через VK»
- Яндекс ID также может быть добавлен как дополнительный провайдер (аудитория ~80 млн)
- Все OAuth-провайдеры подключаются к GoTrue как custom OIDC providers без доработки бэкенда

**Дополнительно:**
- **RBAC** — роли в `users.role[]`, проверка через RLS-политики и middleware API Gateway
- **2FA** — TOTP через Supabase Auth (опционально для повышенной безопасности)
- **Привязка нескольких способов входа** — пользователь может связать email-аккаунт с VK ID для удобства (Supabase GoTrue поддерживает identity linking)

---

## 9. Инфраструктура и деплой (500 одновременных пользователей)

> **Примечание:** эта секция описывает инфраструктуру для MVP (коучинг-экосистема: score-coaching.ru + academy-coaching.ru + association-coaching.ru). Расчёт для будущих платформ (1000+ одновременных per platform) — см. Секцию 14.5.

### 9.0 Расчёт нагрузки

**Профиль 500 одновременных пользователей (пиковая нагрузка):**

| Активность | Кол-во пользователей | Потребление ресурсов |
|---|---|---|
| Просмотр курсов, чтение (лёгкая) | ~250 | ~0.5 MB RAM / соединение → ~125 MB |
| Чат / Realtime (средняя) | ~100 | WebSocket: ~1 MB RAM / соединение → ~100 MB |
| Видеоконференция 1-к-1 | ~80 (40 сессий) | ~50 MB RAM + ~2 Mbps upload / сессия → 2 GB RAM, 80 Mbps |
| Групповая видеоконференция (5–10 чел.) | ~50 (8 групп) | ~200 MB RAM + ~10 Mbps / группа → 1.6 GB RAM, 80 Mbps |
| Загрузка/скачивание файлов | ~20 | Дисковый I/O, сеть |

**Итого пиковые требования:**
- **CPU:** ~16 ядер (API + DB + видео)
- **RAM:** ~20 GB (PostgreSQL 4 GB, LiveKit 4 GB, Supabase stack 4 GB, API 2 GB, Redis 1 GB, прочее 5 GB)
- **Сеть:** ~200 Mbps исходящий трафик (в основном видео)
- **Диск:** SSD NVMe обязательно для быстрого I/O

### 9.1 Конфигурация на первый год (до 500 одновременных, до 200 школ)

```
VPS #1 (8 vCPU, 32 GB RAM, 500 GB NVMe SSD) — Основной сервер
├── Traefik (reverse proxy, auto TLS, domain routing)
│   ├── TLS: score-coaching.ru, academy-coaching.ru, association-coaching.ru
│   ├── Wildcard TLS: *.academy-coaching.ru (Let's Encrypt, DNS-01 через Selectel API)
│   ├── On-demand TLS: для кастомных доменов школ (HTTP-01 challenge)
│   ├── Domain Router: score-coaching.ru → Platform, association-coaching.ru → Association
│   ├── Tenant Router: *.academy-coaching.ru → School SPA (tenant по Host-заголовку)
│   └── Rate limiting: per-tenant + global
├── Supabase Stack
│   ├── PostgreSQL 15 (shared_buffers=8GB, work_mem=64MB)
│   │   └── 🆕 tenant schema + tenant_id индексы на всех academy/crm таблицах
│   ├── GoTrue (авторизация + custom JWT claims с tenant_id)
│   ├── Realtime (до 500 WebSocket-соединений, tenant-scoped channels)
│   └── Storage API (tenant-isolated buckets: tenants/{id}/*)
├── API Gateway (Node.js + Fastify, cluster mode, 4 workers)
│   └── 🆕 Tenant Resolver Middleware (Host → tenant_id → req.context)
├── AI Service (Python + FastAPI, 2 workers)
├── Redis 7 (maxmemory 2GB) + BullMQ
│   └── 🆕 Tenant config cache: tenant:slug:{slug} → config (TTL 5 мин)
├── MinIO (S3-совместимое хранилище, tenant-isolated buckets)
└── Nginx (статика фронтенда — platform + academy + association + school SPA, gzip, brotli, кэш)

VPS #2 (8 vCPU, 16 GB RAM, 1 Gbps сеть) — Медиасервер (ВЫДЕЛЕННЫЙ)
├── LiveKit Server (выделенные ресурсы для видео)
├── LiveKit Egress (запись сессий → MinIO на VPS #1)
└── coturn (TURN-сервер для WebRTC за NAT — рядом с LiveKit для минимальной задержки)

Рекомендуемый провайдер: Selectel (Москва)
- ДЦ в Москве — задержка <10 мс для 80% пользователей РФ
- 1 Gbps канал без ограничений по трафику
- NVMe SSD для минимальной задержки диска

🔄 DNS (обновлено для мультитенантности):
- Selectel DNS (российские DNS-серверы!)
- НЕ Cloudflare — DNS-запросы должны разрешаться в РФ
- Selectel DNS: anycast-сеть с точками в Москве, СПб, Новосибирске
- 🆕 Wildcard A-запись: *.academy-coaching.ru → IP VPS #1
  (все поддомены школ автоматически попадают на VPS)
- A-записи: score-coaching.ru, association-coaching.ru, academy-coaching.ru → IP VPS #1
- 🆕 Для кастомных доменов школ: владелец создаёт CNAME → proxy.academy-coaching.ru
  или A-запись → IP VPS #1. Traefik автоматически получает TLS-сертификат.
```

### 9.2 Оптимизация производительности для территории РФ

**Почему всё будет работать быстро:**

1. **Нулевая задержка до сервера** — VPS в московском ДЦ, большинство пользователей РФ получают пинг 5–30 мс (вместо 100–200 мс до зарубежных серверов)

2. **Фронтенд отдаётся мгновенно:**
   - Статика (JS/CSS/изображения) раздаётся через Nginx с gzip/brotli-сжатием
   - Агрессивное кэширование: `Cache-Control: public, max-age=31536000` для хешированных ассетов
   - Service Worker для кэширования оболочки приложения (App Shell) — повторные загрузки мгновенные
   - Code splitting по маршрутам — при входе загружается только нужный модуль (~50–100 KB вместо всего бандла)

3. **API отвечает быстро:**
   - Supabase PostgREST — прямые SQL-запросы без ORM-оверхеда, ответ за 5–15 мс
   - Redis-кэш для частых запросов (каталог коучей, расписание, курсы) — ответ за 1–3 мс
   - pgBouncer для пула соединений PostgreSQL — нет задержки на установление соединения
   - Connection pooling: до 100 активных соединений к PostgreSQL

4. **Видео без тормозов:**
   - LiveKit на выделенном VPS с 1 Gbps каналом
   - Адаптивный битрейт (Simulcast) — LiveKit автоматически снижает качество при плохом канале
   - UDP-транспорт по умолчанию (минимальная задержка)
   - TURN-сервер на том же VPS — для пользователей за корпоративными файрволлами

5. **Чат работает мгновенно:**
   - Supabase Realtime на WebSocket — постоянное соединение, нет HTTP-оверхеда
   - Сообщения доставляются за 20–50 мс (в пределах одного ДЦ)
   - Оптимистичные обновления на клиенте — сообщение отображается до подтверждения сервера

6. **Российские DNS:**
   - DNS-серверы в РФ (Selectel DNS) — разрешение домена за 1–5 мс
   - Нет задержки на DNS-запросы к зарубежным серверам

**Конфигурация PostgreSQL для 500 пользователей:**
```
shared_buffers = 8GB          # 25% от RAM
effective_cache_size = 24GB    # 75% от RAM
work_mem = 64MB
maintenance_work_mem = 2GB
max_connections = 200          # через pgBouncer = до 500 клиентов
random_page_cost = 1.1         # для NVMe SSD
effective_io_concurrency = 200 # для NVMe SSD
wal_buffers = 64MB
checkpoint_completion_target = 0.9
```

**Конфигурация Nginx:**
```nginx
# Gzip + Brotli для минимального размера ответов
gzip on;
gzip_types text/plain text/css application/json application/javascript;
gzip_min_length 256;

# Кэширование статики — 1 год для хешированных файлов
location /assets/ {
    expires 365d;
    add_header Cache-Control "public, immutable";
}

# WebSocket проксирование для Supabase Realtime
location /realtime/ {
    proxy_pass http://supabase-realtime:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
}
```

### 9.3 Масштабирование (при росте свыше 500 пользователей)

```
                         ┌─── VPS: Nginx (статика + reverse proxy)
                         │
Selectel Load Balancer ──┼─── VPS: API Gateway ×2 (round-robin)
  (L4, российский)       │
                         ├─── VPS: Supabase (PostgreSQL Primary)
                         │     └── VPS: PostgreSQL Read Replica
                         │
                         ├─── VPS: LiveKit ×2 (по регионам: Москва + СПб)
                         │
                         └─── VPS: MinIO Cluster (3 узла, репликация)
```

**Когда масштабировать:**
- CPU > 70% постоянно → добавить API-воркеры
- PostgreSQL: > 100 активных соединений → добавить read-replica
- LiveKit: > 50 одновременных видеосессий → второй медиасервер
- Хранилище > 80% → расширить MinIO-кластер

---

## 10. Этапы разработки (рекомендуемый roadmap)

### Фаза 1 — MVP: Академия-как-сервис (3–4 месяца)
**Цель:** запуск academy-coaching.ru — пользователи могут создавать свои школы с полноценным набором инструментов.

**Инфраструктура и ядро:**
- 🆕 Три домена: score-coaching.ru, academy-coaching.ru, association-coaching.ru (пока academy — основной)
- Supabase self-hosted на VPS с tenant schema
- Авторизация (email + пароль) с tenant-aware JWT, общая для всех трёх доменов
- 🆕 Создание школы (wizard): название, slug, базовые настройки
- 🆕 Поддомены школ: *.academy-coaching.ru (wildcard DNS + Traefik)
- 🆕 Theme Engine: выбор цветовой палитры, логотип, базовая кастомизация
- 🆕 Панель владельца школы (school-admin): базовые настройки, бренд

**LMS и контент:**
- LMS: курсы, уроки (видео + текст), тесты — всё tenant-scoped
- Личные кабинеты (студент школы, преподаватель школы, владелец школы)
- 🆕 **Библиотека школы** — загрузка и каталогизация учебных материалов (PDF, видео, документы) с категоризацией и разграничением доступа по курсу/группе (tenant-scoped, хранение в MinIO)

**Коммуникации и видео:**
- 🆕 **Чат школы** — мессенджер между студентами, кураторами и преподавателями: личные сообщения, групповые чаты по курсу/потоку (Supabase Realtime, tenant-isolated, без E2E на MVP)
- 🆕 **Видеосессии школы** — преподаватель проводит лекции, вебинары, супервизии и групповые практики со студентами через LiveKit: демонстрация экрана, доска, расписание видеосессий в рамках курса
- Видеоконференции через LiveKit (1-к-1 и групповые) — для платформы в целом

**Монетизация:**
- Оплата курсов через ЮKassa (базовая, без split payments)
- 🆕 **Тарифные планы для школ** (4 уровня):
  - **Стартовый** (бесплатный) — до 1 курса, 20 студентов, 500 MB хранилище, 10% комиссия
  - **Базовый** — до 5 курсов, 100 студентов, 5 GB хранилище, 7% комиссия
  - **Профессиональный** — до 30 курсов, 500 студентов, 25 GB хранилище, 5% комиссия, кастомный домен
  - **Бизнес** — без лимитов, 100 GB хранилище, 3% комиссия, API, white-label
- Email-уведомления (с брендом школы)

### Фаза 2 — Монетизация школ + Маркетплейс (2–3 месяца)
**Цель:** запуск score-coaching.ru (маркетплейс коучей) + расширение возможностей школ на academy-coaching.ru.

**Школы — монетизация и рост:**
- 🆕 ЮKassa Split Payments: расщепление платежей школа↔платформа (согласно тарифным планам)
- 🆕 Кастомные домены школ (CNAME + on-demand TLS) — для тарифа Профессиональный+
- 🆕 **Блог школы** — публикация статей, новостей и анонсов для студентов и посетителей: WYSIWYG-редактор, категории, теги, SEO-мета, tenant-scoped
- 🆕 CRM школы: лиды, воронки продаж, лендинги
- 🆕 Конструктор лендингов для курсов школы
- 🆕 Промо-коды и скидки для школ
- 🆕 Команда школы: приглашение преподавателей, кураторов, менеджеров
- 🆕 Аналитика школы: доход, студенты, конверсии, UTM

**Маркетплейс коучей (score-coaching.ru):**
- Каталог коучей с поиском и фильтрами
- Календарь и бронирование сессий
- Личные кабинеты (коуч, клиент)
- Запись сессий (с согласием)
- Абонементная система
- Рейтинги и отзывы
- Магазин материалов

### Фаза 3 — Ассоциация + расширение школ (1–2 месяца)
**Цель:** запуск association-coaching.ru + продвинутые фичи школ на academy-coaching.ru.

**Ассоциация (association-coaching.ru):**
- Членство и уровни
- Сертификация и реестр
- События (конференции, форумы)
- Корпоративные программы
- Этический кодекс и стандарты

**Школы — расширенные возможности:**
- 🆕 Шаблоны сертификатов для выпускников школ
- 🆕 Статические страницы школы (конструктор блоков)
- 🆕 Email-рассылки школы (кампании, сегменты)
- 🆕 Кастомный CSS для школ (тариф Про+)
- 🆕 Каталог школ на academy-coaching.ru

### Фаза 4 — Расширенные функции (2–3 месяца)
**Цель:** продвинутые инструменты для платформы и школ.

**Платформа (score-coaching.ru):**
- AI-помощник (GigaChat / YandexGPT: отчёты, журнал, помощь)
- Интерактивная доска (tldraw)
- МАК-карты, dice (Three.js), токены — game engine
- Диагностические тесты
- Рабочие листы (worksheets)
- E2E шифрование чатов (Signal Protocol)
- 2FA

**Школы — тариф Бизнес:**
- 🆕 API для школ: вебхуки, REST API для интеграций
- 🆕 White-label email (отправка с домена школы)
- 🆕 Автовебинары для школ (предзаписанные видеосессии по расписанию)

### 🔮 Фаза 5 — Мульти-платформенное расширение (3–4 месяца)
**Цель:** запуск платформ для психологов и прикладных психологов на изолированной инфраструктуре.

- Вынесение platform-specific конфигурации в `packages/platform-config/`
- Абстрагирование всех хардкоженных URL, labels, feature flags
- Подготовка `docker-compose.[platform].yml` шаблонов
- Развёртывание изолированного кластера VPS для первой новой платформы (психологи)
- Настройка отдельного Supabase, LiveKit, Redis
- Адаптация брендинга и feature flags
- Нагрузочное тестирование (1000+ одновременных, видео)
- Запуск второй платформы (прикладные психологи) по тому же шаблону

---

## 11. Оценка стоимости инфраструктуры (для 500 одновременных)

| Компонент | Конфигурация | Стоимость/мес (ориентир) |
|---|---|---|
| VPS #1 — Основной | 8 vCPU, 32 GB RAM, 500 GB NVMe | ~12 000 – 16 000 ₽ |
| VPS #2 — Медиасервер | 8 vCPU, 16 GB RAM, 1 Gbps | ~8 000 – 12 000 ₽ |
| Домены + DNS (Selectel) | 3 домена .ru + DNS-хостинг | ~6 000 ₽/год |
| SSL | Let's Encrypt (автопродление) | бесплатно |
| ЮKassa | комиссия с транзакций | 3.5% от оборота |
| Email-сервис (Unisender) | до 50 000 писем/мес | ~3 000 – 5 000 ₽ |
| Резервное копирование | Selectel Object Storage для бэкапов | ~1 000 – 2 000 ₽ |
| 🆕 Wildcard SSL | Let's Encrypt: *.academy-coaching.ru + 3 основных домена (DNS-01 через Selectel API) | бесплатно |
| **Итого инфра** | | **~25 000 – 35 000 ₽/мес** |

**🆕 Доход платформы от школ (прогноз при 100 школах):**
- Подписки школ: ~100 × 5 000 ₽/мес (средний тариф) = **500 000 ₽/мес**
- Комиссия с продаж: ~5% от GMV школ
- Итого: инфраструктура окупается при 5–10 активных платных школах

Все open-source компоненты (Supabase, LiveKit, tldraw, MinIO, coturn) — бесплатны при self-hosted. Мультитенантная архитектура не требует дополнительных серверов — все школы работают на одной инфраструктуре.

---

## 12. Риски и митигации

| Риск | Вероятность | Митигация |
|---|---|---|
| Производительность LiveKit на VPS при 500 пользователях | Средняя | Выделенный VPS 8 vCPU / 16 GB с 1 Gbps; мониторинг через Grafana; горизонтальное масштабирование (второй LiveKit-нода через Selectel) |
| Сложность self-hosted Supabase | Средняя | Использовать официальные Docker-образы, автоматизировать обновления |
| Ограничения lovable.dev при усложнении | Высокая | Экспорт кода на раннем этапе, переход на ручную разработку после MVP |
| Доступность GigaChat/YandexGPT API | Низкая | Абстрагировать AI-сервис, поддержать несколько провайдеров |
| Нагрузка на PostgreSQL при росте | Средняя | Read-replica, материализованные представления, pgBouncer |
| 🆕 **Утечка данных между тенантами** | Низкая (но критична) | RLS на каждой таблице с tenant_id; интеграционные тесты на изоляцию; periodic audit; запрет прямого SQL без tenant_id |
| 🆕 **TLS-сертификаты для сотен кастомных доменов** | Средняя | Traefik on-demand TLS с rate limiting; кэширование сертификатов; мониторинг Let's Encrypt rate limits (50 cert/domain/week) |
| 🆕 **"Noisy neighbor" — одна школа нагружает всю платформу** | Средняя | Per-tenant rate limiting на API Gateway; Redis quotas; мониторинг CPU/RAM per tenant; при злоупотреблении — throttling |
| 🆕 **Сложность миграции БД при 1000+ школах** | Средняя | Все миграции tenant-aware; тестирование на staging с реальным объёмом данных; blue-green deploy |
| 🆕 **ЮKassa Split Payments — сложность подключения субаккаунтов** | Средняя | На MVP — централизованные платежи без split; split payments внедрять на Фазе 2 после отладки основного потока |

---

## 13. Альтернативы и обоснование выбора

**Почему не микросервисы?**
На старте это over-engineering. Монолитный API Gateway + Supabase Edge Functions покрывают потребности MVP. При росте можно выделить отдельные сервисы (видео, AI, биллинг).

**Почему не Next.js (SSR)?**
lovable.dev генерирует React SPA. SSR добавляет сложность серверного рендеринга, что не критично для приложения за авторизацией. SEO нужен только для лендинга и каталога коучей — их можно пререндерить.

**Почему LiveKit, а не другие решения?**
LiveKit — единственный видеосервис платформы. Альтернативы (VK Звонки, Jitsi) не обеспечивают нужный уровень кастомизации: встроенная виртуальная приёмная, интеграция интерактивных карточек и доски прямо в видеосессию, полный контроль записи с согласием клиента, tenant-изоляция для школ. Self-hosted на Selectel — полное соответствие 152-ФЗ без зависимости от сторонних облаков.

**Почему LiveKit, а не Jitsi?**
Jitsi тяжелее (~4 GB RAM минимум), сложнее в настройке записи, нет нативного E2E. LiveKit легче, имеет лучший React SDK и API для записи. На одном и том же VPS LiveKit обслуживает в 2–3 раза больше одновременных сессий.

**🔮 Почему полная изоляция (Variant C) для новых платформ, а не shared DB?**
При 1000+ одновременных пользователей на каждой из 3 платформ (суммарно 3000+) shared database и один LiveKit стали бы узким местом. Полная изоляция даёт: (1) падение одной платформы не затрагивает остальные; (2) LiveKit per platform — независимое масштабирование видео-нагрузки; (3) раздельные БД — проще compliance и 152-ФЗ при работе с данными разных категорий специалистов; (4) независимый деплой — обновление платформы психологов не ломает коучинг. Минус — x3 инфраструктура (~93 000 ₽/мес вместо ~30 000 ₽/мес), но при 1000+ пользователей per platform это оправдано выручкой.

**Почему три отдельных сайта, но общий бэкенд?**
Три сайта на разных доменах (score-coaching.ru, academy-coaching.ru, association-coaching.ru) визуально и концептуально независимы — каждый имеет свой дизайн, аудиторию и маршрутизацию. Но под капотом они используют один API Gateway, одну БД (Supabase), один LiveKit, один Redis. Это позволяет: (1) общая авторизация — пользователь логинится один раз и может быть коучем на платформе, владельцем школы в академии и членом ассоциации; (2) shared-компоненты в монорепозитории (пакеты `ui`, `tenant-sdk`, `encryption`); (3) единая инфраструктура — дешевле в обслуживании.

**🆕 Почему Shared Database, а не Database-per-tenant?**
При Database-per-tenant каждая школа получает свою БД — это даёт максимальную изоляцию, но резко усложняет миграции (нужно мигрировать N баз), мониторинг, бэкапы, и не позволяет делать cross-tenant запросы (каталог школ, глобальная аналитика). Supabase RLS с `tenant_id` обеспечивает надёжную изоляцию на уровне PostgreSQL при минимальной сложности. При росте до 10 000+ школ можно выделить крупных тенантов на отдельные PostgreSQL-схемы (schema-per-tenant) — это промежуточный вариант, не требующий отдельных БД.

**🆕 Почему не Kubernetes для мультитенантности?**
Kubernetes с namespace-per-tenant или pod-per-tenant даёт изоляцию на уровне инфраструктуры, но на старте (до 500 школ) это over-engineering: все школы работают на одном приложении с RLS-изоляцией. Docker Compose проще в обслуживании на 2–3 VPS. Переход на K8s оправдан при 1000+ школ или при необходимости geographic sharding (несколько регионов РФ).

**🆕 Почему CSS-переменные для тем, а не runtime CSS generation?**
CSS-in-JS решения (styled-components, Emotion) генерируют CSS на лету, что увеличивает JS-бандл и время рендеринга. CSS-переменные (`var(--school-primary)`) применяются браузером нативно, не требуют JS для рендеринга, отлично кэшируются и работают с Tailwind CSS через `@apply` / `theme()`. Настройки темы загружаются один раз при инициализации SPA и сохраняются в переменных `:root`.

---

## 🔮 14. Мульти-платформенная архитектура (план на будущее)

> **Статус:** не реализуется в текущем MVP. Архитектура закладывается сейчас, реализация — после стабилизации трёх основных сайтов.

### 14.1 Концепция

Помимо score-coaching.ru (маркетплейс коучей), планируется запуск двух дополнительных платформ-маркетплейсов:

- **Платформа для психологов** — отдельный домен, аналогичный функционал score-coaching.ru (каталог специалистов, бронирование, видеосессии, магазин, AI-помощник)
- **Платформа для прикладных психологов** — то же самое, третий домен

Каждая платформа обслуживает **1000+ одновременных пользователей** с интенсивной видео-нагрузкой.

### 14.2 Модель изоляции: Variant C (полная изоляция)

Выбрана модель **полной изоляции** инфраструктуры per platform:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ОБЩИЙ КОД (Monorepo)                            │
│                                                                         │
│  packages/ui  ·  packages/platform-config  ·  packages/shared-types     │
│  packages/encryption  ·  packages/tenant-sdk  ·  services/*             │
│                                                                         │
│  apps/platform/  — один и тот же код, конфигурируется через             │
│                    platform-config (брендинг, домен, feature flags)      │
└─────────────────┬───────────────────┬───────────────────┬───────────────┘
                  │                   │                   │
     ┌────────────▼────────┐ ┌───────▼──────────┐ ┌──────▼───────────┐
     │ КЛАСТЕР: Коучинг    │ │ КЛАСТЕР: Психол. │ │ КЛАСТЕР: Прикл.  │
     │ score-coaching.ru   │ │ [domain].ru      │ │ [domain].ru      │
     ├─────────────────────┤ ├──────────────────┤ ├──────────────────┤
     │ Supabase (PG+Auth)  │ │ Supabase         │ │ Supabase         │
     │ LiveKit (видео)     │ │ LiveKit          │ │ LiveKit          │
     │ Redis + BullMQ      │ │ Redis + BullMQ   │ │ Redis + BullMQ   │
     │ API Gateway         │ │ API Gateway      │ │ API Gateway      │
     │ AI Service          │ │ AI Service       │ │ AI Service       │
     │ MinIO (storage)     │ │ MinIO            │ │ MinIO            │
     └─────────────────────┘ └──────────────────┘ └──────────────────┘
```

**Что изолировано (per platform):**

| Компонент | Изоляция | Обоснование |
|---|---|---|
| PostgreSQL (Supabase) | Отдельная БД | Полная изоляция данных пользователей, 152-ФЗ |
| GoTrue (Auth) | Отдельный инстанс | Раздельные аккаунты, без SSO |
| LiveKit | Отдельный VPS | 1000+ видеопользователей per platform, изоляция нагрузки |
| Redis | Отдельный инстанс | Изоляция кэша, очередей, сессий |
| MinIO / S3 | Отдельные бакеты (или инстанс) | Изоляция файлов |
| API Gateway | Отдельный процесс / контейнер | Изоляция rate limits, ресурсов |

**Что общее (shared):**

| Компонент | Подход |
|---|---|
| Код (monorepo) | Один репозиторий, общие packages, конфиг per platform |
| Docker-образы | Одинаковые образы, разные `docker-compose.[platform].yml` и `.env.[platform]` |
| Traefik (опционально) | Один Traefik может маршрутизировать на все кластеры, или по одному Traefik per VPS |
| CI/CD | Единый пайплайн, деплой per platform по тегу |

### 14.3 Аутентификация

Каждая платформа имеет **свой Supabase GoTrue** — пользователи регистрируются отдельно на каждой платформе. Нет SSO, нет общего аккаунта. Это упрощает изоляцию и compliance, но означает, что специалист, работающий на двух платформах, имеет два отдельных аккаунта.

### 14.4 Фронтенд: один код — разный конфиг

Все платформы-маркетплейсы используют **одно и то же приложение** `apps/platform/`, конфигурируемое через `packages/platform-config/`:

```typescript
// packages/platform-config/coaching.ts
export const config: PlatformConfig = {
  id: 'coaching',
  domain: 'score-coaching.ru',
  name: 'SCORE Coaching',
  supabaseUrl: 'https://api.score-coaching.ru',
  supabaseAnonKey: '...',
  livekitUrl: 'wss://livekit.score-coaching.ru',
  theme: { primary: '#2563EB', secondary: '#7C3AED', ... },
  features: {
    gameboard: true,       // МАК-карты, tldraw
    macCards: true,
    diagnostics: true,
    aiAssistant: true,
    tracking: true,        // Трекинг часов сертификации
  },
  specialistLabel: 'Коуч',
  clientLabel: 'Клиент',
  catalogTitle: 'Каталог коучей',
};

// packages/platform-config/psychology.ts (будущее)
export const config: PlatformConfig = {
  id: 'psychology',
  domain: '[domain].ru',
  name: 'Платформа для психологов',
  supabaseUrl: 'https://api.[domain].ru',
  // ...аналогичная структура, другой брендинг и feature flags
  features: {
    gameboard: false,      // Психологам не нужны МАК-карты
    diagnostics: true,     // Но нужны диагностические тесты
    // ...
  },
  specialistLabel: 'Психолог',
  clientLabel: 'Клиент',
  catalogTitle: 'Каталог психологов',
};
```

Сборка: `PLATFORM=coaching turbo build --filter=platform` → бандл для score-coaching.ru.

### 14.5 Инфраструктура per platform (оценка на 1000+ одновременных)

Каждая платформа разворачивается на отдельном наборе VPS:

```
Платформа X (1000+ одновременных, интенсивное видео):

VPS-X1 (8 vCPU, 32 GB RAM, 500 GB NVMe) — Бэкенд
├── Supabase Stack (PG + GoTrue + Realtime + Storage API)
├── API Gateway (Fastify, 4 workers)
├── AI Service (FastAPI, 2 workers)
├── Redis 7 (2 GB) + BullMQ
├── MinIO
├── coturn
├── Nginx (статика platform SPA)
└── Traefik (TLS, rate limiting)

VPS-X2 (8 vCPU, 16 GB RAM, 1 Gbps) — Медиасервер (ВЫДЕЛЕННЫЙ)
├── LiveKit Server
└── LiveKit Egress (запись → MinIO на VPS-X1)
```

**Расчёт видео-нагрузки (1000 одновременных per platform):**

| Сценарий | Пользователи | Комнаты | RAM на LiveKit | Сеть (исходящая) |
|---|---|---|---|---|
| 1-к-1 сессии | ~400 (200 пар) | 200 | ~2 GB | ~400 Mbps |
| Групповые (5-10 чел.) | ~200 (30 групп) | 30 | ~1.5 GB | ~300 Mbps |
| Просмотр курсов (без видео) | ~300 | — | — | — |
| Запись/стриминг | ~100 | — | ~500 MB | ~100 Mbps |
| **Итого пик** | **1000** | **~230** | **~4 GB** | **~800 Mbps** |

При таком профиле VPS с 8 vCPU, 16 GB RAM и 1 Gbps сетью справляется. При росте — горизонтальное масштабирование LiveKit (добавление нод через Redis-based routing).

### 14.6 Суммарная инфраструктура (3 платформы)

| Компонент | Кол-во | Конфигурация | Стоимость/мес |
|---|---|---|---|
| VPS бэкенд (per platform) | 3 | 8 vCPU, 32 GB, 500 GB NVMe | 3 × ~12 000 ₽ = ~36 000 ₽ |
| VPS LiveKit (per platform) | 3 | 8 vCPU, 16 GB, 1 Gbps | 3 × ~8 000 ₽ = ~24 000 ₽ |
| VPS Academy + Association | 1 | 8 vCPU, 32 GB (как сейчас) | ~12 000 ₽ |
| LiveKit для Academy | 1 | 8 vCPU, 16 GB | ~8 000 ₽ |
| Домены + DNS | 5+ доменов | Selectel DNS | ~10 000 ₽/год |
| Email (Unisender) | общий | до 150 000 писем/мес | ~8 000 ₽ |
| Бэкапы (Selectel S3) | общий | ~500 GB | ~3 000 ₽ |
| **Итого (3 маркетплейса + академия + ассоциация)** | | | **~93 000 – 100 000 ₽/мес** |

### 14.7 Что заложить сейчас (для MVP)

Чтобы в будущем без боли запустить новые платформы, в текущей архитектуре нужно:

1. **`packages/platform-config/`** — вынести все platform-specific значения (домен, брендинг, labels, feature flags) в конфигурацию, а не хардкодить в компонентах
2. **Абстрагировать Supabase-клиент** — `createSupabaseClient(config.supabaseUrl, config.supabaseAnonKey)` вместо хардкоженных URL
3. **Абстрагировать LiveKit-клиент** — `connectToLiveKit(config.livekitUrl)` вместо жёсткого адреса
4. **Docker Compose** — структурировать как `docker-compose.base.yml` + `docker-compose.coaching.yml` (override)
5. **Не завязываться на домен** — все URL, email-шаблоны, ссылки должны использовать `config.domain`, а не строковый литерал `score-coaching.ru`
6. **ENV-переменные** — все ключи, URL, секреты — через `.env`, без хардкода в коде
7. **Specialist/Client labels** — использовать `config.specialistLabel` вместо слова «коуч» в UI
