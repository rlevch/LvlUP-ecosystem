# SCORE Coaching — Пошаговый гайд реализации MVP для новичка

**Аудитория:** начинающий fullstack-разработчик (junior/middle)
**Масштаб:** до 300 одновременных пользователей (2 VPS)
**Основа:** roadmap.md + architecture.md проекта SCORE Coaching

---

## Глоссарий терминов

Если вы встретили незнакомый термин — ищите его здесь.

**VPS (Virtual Private Server)** — виртуальный сервер в облаке, арендуемый у провайдера (Selectel). По сути — удалённый компьютер с Linux, на котором работает ваше приложение.

**Docker** — система контейнеризации. Каждый сервис (БД, кэш, API) запускается в изолированном контейнере. `docker-compose.yml` — конфигурационный файл, описывающий все контейнеры.

**PostgreSQL** — реляционная база данных. Хранит все данные приложения (пользователи, сессии, курсы). SQL — язык запросов к ней.

**Supabase** — open-source BaaS (Backend-as-a-Service). Из коробки даёт: PostgreSQL, авторизацию (GoTrue), Realtime (WebSocket), Storage (файлы), REST API (PostgREST).

**RLS (Row Level Security)** — механизм PostgreSQL, который автоматически фильтрует строки таблицы по правилам. Пример: «клиент видит только свои сессии». Даже если злоумышленник получит доступ к API — RLS на уровне БД не даст ему увидеть чужие данные.

**JWT (JSON Web Token)** — зашифрованный токен с данными пользователя (id, роль, tenant_id). Передаётся с каждым запросом. Сервер не хранит сессии — вся информация в токене.

**RBAC (Role-Based Access Control)** — управление доступом через роли. Каждый пользователь имеет одну или несколько ролей (coach, client, admin), определяющих, что он может делать.

**Мультитенантность (Multi-tenancy)** — архитектура, при которой одно приложение обслуживает множество изолированных клиентов (тенантов). В нашем случае каждая школа — отдельный тенант с изолированными данными.

**Redis** — сверхбыстрая in-memory база данных для кэша и очередей. Хранит данные в оперативной памяти — ответ за микросекунды.

**BullMQ** — библиотека очередей задач на Node.js (поверх Redis). Позволяет отправлять email, генерировать PDF в фоне, не блокируя основной запрос.

**MinIO** — S3-совместимое файловое хранилище на вашем VPS. Аналог Amazon S3, но локальный.

**Traefik** — reverse proxy. Принимает все входящие HTTP/HTTPS запросы и маршрутизирует их к нужным сервисам по домену. Автоматически получает TLS-сертификаты.

**TLS/HTTPS** — шифрование трафика между браузером и сервером. Let's Encrypt выдаёт бесплатные сертификаты.

**Wildcard-сертификат** — TLS-сертификат для всех поддоменов (`*.academy-coaching.ru`). Позволяет каждой школе иметь свой поддомен без ручной настройки.

**LiveKit** — open-source WebRTC-сервер для видеозвонков. SFU (Selective Forwarding Unit) — все участники отправляют видео на сервер, сервер рассылает остальным.

**WebRTC** — технология видеозвонков в браузере без плагинов. Работает через протоколы SRTP (видео) и ICE (установка соединения).

**TURN/STUN (coturn)** — серверы-помощники для WebRTC. STUN определяет ваш внешний IP. TURN — relay-сервер, который пробрасывает видеотрафик, если прямое соединение невозможно (корпоративный VPN, строгий NAT).

**pgBouncer** — пул соединений для PostgreSQL. Мультиплексирует сотни клиентских подключений в десятки реальных соединений к БД.

**Fastify** — быстрый веб-фреймворк для Node.js (альтернатива Express). Используется для API Gateway.

**CORS** — Cross-Origin Resource Sharing. Механизм браузера, который запрещает запросы между разными доменами. Нужно настроить, чтобы фронтенд на `score-coaching.ru` мог обращаться к API на `api.score-coaching.ru`.

**Webhook** — HTTP-запрос, который внешний сервис (ЮKassa) отправляет на ваш сервер при наступлении события (платёж успешен). Вы не запрашиваете статус — сервис сам вас уведомляет.

**JSONB** — тип данных в PostgreSQL для хранения JSON-документов. Позволяет хранить гибкие структуры (настройки, шаблоны форм) без жёсткой схемы.

**tsvector / tsquery** — механизм полнотекстового поиска в PostgreSQL. `tsvector` — индексированное представление текста, `tsquery` — поисковый запрос. Поддерживает морфологию русского языка.

**ORM** — Object-Relational Mapping. В нашем проекте не используется — Supabase SDK работает напрямую с PostgREST.

**CI/CD (GitHub Actions)** — автоматическая сборка и деплой кода при пуше в репозиторий.

---

## Как пользоваться этим документом

Этот гайд — не просто список задач. Каждый шаг содержит: что делать, зачем, какие технологии использовать, на что обратить внимание и какие ошибки типичны для новичков. Задачи расположены строго в порядке зависимостей — следующий шаг опирается на предыдущий.

Для масштаба в 300 одновременных клиентов используется двухсерверная архитектура из roadmap: VPS #1 (приложение, БД, API) и VPS #2 (медиасервер LiveKit + coturn). Это обеспечивает изоляцию нагрузки: видеосессии не влияют на работу платформы. Ниже указано, что нужно настроить на каждом из серверов и на что обратить внимание.

---

## Общая картина: что мы строим

Экосистема SCORE Coaching — это три связанных продукта на общем бэкенде:

1. **Платформа** (score-coaching.ru) — маркетплейс коучей: каталог, бронирование, видеосессии, оплата
2. **Академия** (academy-coaching.ru) — SaaS-конструктор онлайн-школ (аналог GetCourse)
3. **Ассоциация** (association-coaching.ru) — профессиональное сообщество (Post-MVP, в этом гайде не рассматривается)

MVP включает Фазу 0 (фундамент), Фазу 1 (Платформа) и Фазу 2 (Академия). Общий срок — 6.5–8.5 месяцев для одного разработчика.

---

## ФАЗА 0 — Фундамент (~30–35 дней)

> Без этой фазы ничего не работает. Здесь мы поднимаем сервер, базу данных, авторизацию и базовый каркас приложения.

---

### Шаг 0.1 — Заказ и настройка двух VPS (1.5–2 дня)

#### Что делать
Заказать два VPS у российского провайдера. VPS #1 — основной (приложение, БД, API). VPS #2 — медиасервер (LiveKit, coturn). Разделение нужно для 300 пользователей: видеосессии потребляют много CPU и трафика и не должны конкурировать с БД и API.

#### Конкретные действия

1. **Зарегистрироваться на Selectel** (selectel.ru) или Timeweb Cloud и заказать два сервера:

   **VPS #1 (приложение):** **8 vCPU, 32 GB RAM, 500 GB NVMe SSD, Ubuntu 22.04 LTS, 1 Gbps**
   На нём будут: Supabase (PostgreSQL, GoTrue, Realtime, Storage, PostgREST, Studio), Redis, MinIO, API Gateway (Fastify), Traefik, фронтенд-сборки (nginx).

   **VPS #2 (медиасервер):** **8 vCPU, 16 GB RAM, 200 GB NVMe SSD, Ubuntu 22.04 LTS, 1 Gbps**
   На нём будут: LiveKit Server, coturn (TURN/STUN), LiveKit Egress (запись сессий → MinIO на VPS #1).

   > **Почему два сервера?** При 300 пользователях одновременно могут проходить 30–50 видеосессий. Каждая сессия потребляет 2–5 Мбит/с и значительную долю CPU на кодирование/маршрутизацию видео. Если всё на одном VPS — видеонагрузка «душит» БД и API, пользователи получают тормоза. Выделенный медиасервер решает эту проблему.

2. **Настроить безопасность на ОБОИХ серверах** — подключиться по SSH и выполнить:

**На VPS #1 (приложение):**
```bash
# Обновить систему
sudo apt update && sudo apt upgrade -y

# Создать пользователя (не работать от root)
adduser deploy
usermod -aG sudo deploy

# Настроить SSH-ключи (на своём компьютере)
ssh-keygen -t ed25519 -C "score-coaching"
ssh-copy-id deploy@<IP-VPS-1>

# Отключить вход по паролю
sudo nano /etc/ssh/sshd_config
# PasswordAuthentication no
# PermitRootLogin no
sudo systemctl restart sshd

# Установить файрвол — VPS #1 (приложение)
sudo apt install ufw -y
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp           # HTTP (→ redirect HTTPS)
sudo ufw allow 443/tcp          # HTTPS (Traefik)
sudo ufw allow from <IP-VPS-2> to any port 9000  # MinIO API (для LiveKit Egress)
sudo ufw allow from <IP-VPS-2> to any port 6379  # Redis (если нужен с VPS #2)
sudo ufw enable

# Установить fail2ban (защита от брутфорса)
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
```

**На VPS #2 (медиасервер):**
```bash
# Аналогичная базовая настройка (apt update, adduser, SSH-ключи, fail2ban)
# ... те же команды, что выше ...

# Установить файрвол — VPS #2 (медиасервер)
sudo apt install ufw -y
sudo ufw allow OpenSSH
sudo ufw allow 7880/tcp              # LiveKit Signaling (WebSocket)
sudo ufw allow 7881/tcp              # LiveKit RTC (TCP fallback)
sudo ufw allow 50000:50500/udp       # LiveKit RTC (UDP, расширенный диапазон для 300 юзеров)
sudo ufw allow 3478/udp              # coturn TURN/STUN (UDP)
sudo ufw allow 3478/tcp              # coturn TURN (TCP)
sudo ufw allow 5349/tcp              # coturn TURN over TLS
sudo ufw allow 49152:49252/udp       # coturn relay ports
sudo ufw enable
```

3. **Настроить связь между серверами:**

Серверы общаются через внутреннюю сеть Selectel (если в одном ДЦ) или через публичные IP. LiveKit Egress будет записывать видео и отправлять на MinIO (VPS #1). API Gateway (VPS #1) будет генерировать LiveKit-токены, обращаясь к LiveKit API (VPS #2).

```bash
# Проверить связь между серверами:
# С VPS #1:
ping <IP-VPS-2>
# С VPS #2:
ping <IP-VPS-1>
curl http://<IP-VPS-1>:9000  # Проверка доступности MinIO
```

#### Зачем это нужно
Два VPS — это архитектура из roadmap, оптимальная для 300 пользователей. VPS #1 обслуживает весь веб-трафик (страницы, API, БД). VPS #2 обрабатывает тяжёлую медиа-нагрузку (видеосессии). Они не мешают друг другу: даже если все 50 видеосессий загрузят VPS #2 на 100%, сайт на VPS #1 продолжит работать быстро.

#### Почему pgBouncer нужен при 300 пользователях
При 300 одновременных пользователях каждый держит открытое соединение с PostgreSQL. С учётом Supabase Realtime, PostgREST и API Gateway — реальное число соединений может достигать 400–500. PostgreSQL по умолчанию выдерживает max_connections = 100. pgBouncer (пул соединений) решает это: 500 клиентских соединений мультиплексируются в 50–100 реальных соединений к PostgreSQL. Мы настроим его в шаге 0.3.

#### Типичные ошибки новичков
- Работать от root — создайте отдельного пользователя на каждом VPS.
- Забыть про файрвол — без него сервер будет атакован в первые часы.
- Не настроить SSH-ключи — пароли небезопасны.
- Открыть порты MinIO/Redis в интернет — они должны быть доступны только с VPS #2 (через `ufw allow from <IP-VPS-2>`).
- Забыть настроить второй VPS — оба сервера должны быть одинаково защищены.

---

### Шаг 0.2 — Docker и Docker Compose на обоих VPS (1–1.5 дня)

#### Что делать
Установить Docker на оба VPS. На каждом будет свой `docker-compose.yml` со своим набором сервисов.

#### Конкретные действия

1. **Установить Docker на ОБОИХ VPS:**

```bash
# Выполнить на VPS #1 и VPS #2:
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker deploy  # чтобы не писать sudo каждый раз
newgrp docker

# Проверить
docker --version
docker compose version
```

2. **Создать структуру проекта на VPS #1 (приложение):**

```bash
mkdir -p /home/deploy/score-coaching
cd /home/deploy/score-coaching
mkdir -p volumes/postgres volumes/redis volumes/minio
```

3. **Создать структуру проекта на VPS #2 (медиасервер):**

```bash
mkdir -p /home/deploy/score-coaching
cd /home/deploy/score-coaching
mkdir -p volumes/livekit volumes/coturn
```

4. **Создать `docker-compose.yml` на VPS #1 (приложение):**

```yaml
# VPS #1: docker-compose.yml — приложение, БД, кэш, файлы
version: "3.8"

services:
  # --- Сервисы добавляются по одному ---
  # 1. PostgreSQL + pgBouncer (шаг 0.3)
  # 2. Supabase (шаг 0.3)
  # 3. Redis (шаг 0.4)
  # 4. MinIO (шаг 0.5)
  # 5. Traefik (шаг 0.6)
  # 6. API Gateway (шаг 0.14)

networks:
  score-net:
    driver: bridge

volumes:
  postgres-data:
  redis-data:
  minio-data:
```

5. **Создать `docker-compose.yml` на VPS #2 (медиасервер):**

```yaml
# VPS #2: docker-compose.yml — медиасервер
version: "3.8"

services:
  # --- Сервисы добавляются по одному ---
  # 1. LiveKit Server (шаг 0.7)
  # 2. coturn (шаг 0.7)

networks:
  media-net:
    driver: bridge
```

#### Зачем два docker-compose.yml
Каждый VPS управляется отдельно. VPS #1 можно перезапустить (обновление API) — видеосессии на VPS #2 не пострадают. И наоборот: перезапуск LiveKit не затронет БД и API.

#### Что такое Docker (для новичка)
Представьте, что каждый сервис (база данных, кэш, файловое хранилище) живёт в своей «коробке». Коробки не мешают друг другу, но могут общаться через внутреннюю сеть. `docker-compose.yml` — это файл-рецепт, описывающий все коробки и как они связаны.

#### Типичные ошибки новичков
- Забыть добавить пользователя в группу docker (придётся писать sudo перед каждой командой).
- Не создать volumes для данных — при перезапуске контейнера данные пропадут.

---

### Шаг 0.3 — Supabase (self-hosted) (2–3 дня)

#### Что делать
Развернуть Supabase — это BaaS (Backend-as-a-Service), который из коробки даёт: PostgreSQL 15 (база данных), GoTrue (авторизация), Realtime (WebSocket-подписки), Storage (файловое хранилище), PostgREST (автоматический REST API для таблиц), Studio (веб-интерфейс для управления БД).

#### Конкретные действия

1. **Склонировать официальный репозиторий Supabase:**

```bash
cd /home/deploy/score-coaching
git clone --depth 1 https://github.com/supabase/supabase
cp -r supabase/docker/* .
cp .env.example .env
```

2. **Настроить `.env` файл — ЭТО КРИТИЧЕСКИ ВАЖНО:**

```bash
nano .env
```

Обязательно изменить:
- `POSTGRES_PASSWORD` — сложный пароль (32+ символов)
- `JWT_SECRET` — случайная строка 64+ символов (сгенерировать: `openssl rand -base64 64`)
- `ANON_KEY` и `SERVICE_ROLE_KEY` — сгенерировать через jwt.io с вашим JWT_SECRET
- `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` — для доступа к Studio
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — для отправки email (пока можно оставить пустым)
- `SITE_URL` — `https://score-coaching.ru`
- `API_EXTERNAL_URL` — `https://api.score-coaching.ru`

3. **Запустить:**

```bash
docker compose up -d
```

4. **Проверить, что всё работает:**

```bash
# Все контейнеры должны быть в статусе "Up"
docker compose ps

# Открыть Studio в браузере: http://<IP-сервера>:8000
# (временно, потом закроем прямой доступ через Traefik)
```

5. **Настроить PostgreSQL для 300 пользователей** — создать файл конфигурации:

```bash
nano volumes/db/postgresql.conf
```

```ini
# Для VPS #1 с 32 GB RAM и 300 пользователей
shared_buffers = 8GB
effective_cache_size = 24GB
work_mem = 128MB
maintenance_work_mem = 1GB
max_connections = 300
wal_buffers = 64MB
checkpoint_completion_target = 0.9
random_page_cost = 1.1         # для NVMe SSD
effective_io_concurrency = 200  # для NVMe SSD
```

6. **Установить и настроить pgBouncer** (пул соединений):

```yaml
# Добавить в docker-compose.yml на VPS #1:
pgbouncer:
  image: edoburu/pgbouncer:latest
  restart: unless-stopped
  environment:
    DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD}@supabase-db:5432/postgres
    POOL_MODE: transaction
    DEFAULT_POOL_SIZE: 60
    MAX_CLIENT_CONN: 600
    MAX_DB_CONNECTIONS: 100
    RESERVE_POOL_SIZE: 10
  networks:
    - score-net
  ports:
    - "127.0.0.1:6432:6432"  # Только localhost
  depends_on:
    - supabase-db
```

> **Зачем pgBouncer при 300 пользователях:** каждый пользователь через Supabase Realtime, PostgREST и API Gateway открывает соединения с PostgreSQL. При 300 юзерах реальное число соединений может достигнуть 500+. pgBouncer мультиплексирует их: 600 клиентских соединений → 60–100 реальных соединений к PostgreSQL. Режим `transaction` означает, что соединение выделяется только на время транзакции.

> **Куда направлять запросы:** API Gateway и другие сервисы подключаются к pgBouncer (порт 6432), а не напрямую к PostgreSQL (порт 5432). Supabase-компоненты (PostgREST, GoTrue) идут напрямую к PostgreSQL — они уже оптимизированы.

#### Зачем это нужно
Supabase заменяет огромное количество бэкенд-работы. Вместо того чтобы писать свой REST API, систему авторизации, real-time уведомления и файловое хранилище с нуля — вы получаете всё это из коробки. Для одного разработчика это критически важная экономия времени.

#### Как Supabase связан с архитектурой проекта
В архитектуре SCORE Coaching Supabase — центральный элемент бэкенда. Фронтенд (React) подключается к Supabase напрямую через JavaScript SDK. RLS (Row Level Security) в PostgreSQL обеспечивает безопасность: каждый пользователь видит только свои данные.

#### Важно для 300 пользователей
- **pgBouncer обязателен** — без него PostgreSQL захлебнётся от количества соединений. Настройте его сразу.
- Горизонтальное масштабирование PostgREST пока не нужно — одного инстанса хватит до 500+ пользователей.

#### Типичные ошибки новичков
- Оставить стандартные пароли из .env.example — это катастрофа для безопасности.
- Не сгенерировать корректные JWT-ключи — авторизация не будет работать.
- Не примонтировать volume для PostgreSQL — при перезапуске потеряете все данные.

---

### Шаг 0.4 — Redis и BullMQ (0.5–1 день)

#### Что делать
Добавить Redis — быстрое key-value хранилище для кэша и очередей задач.

#### Конкретные действия

1. **Добавить Redis в `docker-compose.yml`:**

```yaml
redis:
  image: redis:7-alpine
  restart: unless-stopped
  command: redis-server --maxmemory 1gb --maxmemory-policy allkeys-lru --requirepass ${REDIS_PASSWORD}
  volumes:
    - redis-data:/data
  networks:
    - score-net
  ports:
    - "127.0.0.1:6379:6379"  # только localhost, не наружу!
```

2. **Добавить REDIS_PASSWORD в `.env`:**

```bash
REDIS_PASSWORD=ваш_сложный_пароль_для_redis
```

3. **Запустить и проверить:**

```bash
docker compose up -d redis
docker exec -it score-coaching-redis-1 redis-cli -a $REDIS_PASSWORD ping
# Должен ответить: PONG
```

#### Зачем это нужно
Redis используется в проекте для: кэширования данных тенантов (школ) в Академии — вместо запроса в БД каждый раз; очередей задач через BullMQ — отправка email, генерация PDF-сертификатов, push-уведомления; хранения сессий и временных данных.

#### Что такое Redis (для новичка)
Redis — это сверхбыстрая база данных, которая хранит данные в оперативной памяти. В отличие от PostgreSQL (который хранит данные на диске), Redis отвечает за микросекунды. Но данные в Redis — временные (кэш). Если Redis перезапустить, кэш пропадёт — и это нормально.

#### Настройки для 300 пользователей
- **1 GB памяти для Redis** — достаточный запас для кэша тенантов, очередей BullMQ и сессий.
- При высокой нагрузке Redis может принимать соединения от API Gateway, Supabase Realtime и BullMQ-воркеров одновременно. 1 GB гарантирует стабильную работу.
- BullMQ (библиотека для очередей) будем настраивать позже, когда будем писать API Gateway.

---

### Шаг 0.5 — MinIO (файловое хранилище) (0.5 дня)

#### Что делать
Развернуть MinIO — S3-совместимое хранилище для файлов (аватарки, документы, видеозаписи, материалы курсов).

#### Конкретные действия

1. **Добавить MinIO в `docker-compose.yml`:**

```yaml
minio:
  image: minio/minio:latest
  restart: unless-stopped
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: ${MINIO_ROOT_USER}
    MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
  volumes:
    - minio-data:/data
  networks:
    - score-net
  ports:
    - "127.0.0.1:9000:9000"   # API
    - "127.0.0.1:9001:9001"   # Console (UI)
```

2. **Создать бакеты (папки для файлов) через MinIO Console:**

Открыть `http://<IP>:9001`, залогиниться и создать бакеты:
- `avatars` — аватарки пользователей
- `documents` — документы (контракты, согласия)
- `courses` — материалы курсов (видео, PDF)
- `materials` — библиотека платформы
- `tenants` — изолированные файлы школ (для Академии)

3. **Настроить CORS для загрузки с фронтенда:**

В MinIO Console → Configuration → API → добавить CORS:
```json
{
  "CORSRules": [{
    "AllowedOrigins": ["https://score-coaching.ru", "https://*.academy-coaching.ru"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"]
  }]
}
```

#### Зачем это нужно
В проекте много файлов: аватарки коучей, сертификаты, дипломы для верификации, видеоматериалы курсов, домашние задания студентов. Всё это нужно где-то хранить. MinIO — это локальный аналог Amazon S3, работающий на вашем VPS.

#### Что такое MinIO (для новичка)
Это «облачное хранилище файлов», только на вашем собственном сервере. Бакет (bucket) — аналог папки верхнего уровня. Внутри бакета файлы организованы по путям. Supabase Storage под капотом использует тот же MinIO.

---

### Шаг 0.6 — Traefik (reverse proxy + TLS) (1.5–2 дня)

#### Что делать
Настроить Traefik — reverse proxy, который: принимает все входящие запросы; автоматически получает TLS-сертификаты (HTTPS); маршрутизирует запросы к нужным сервисам по домену.

#### Конкретные действия

1. **Создать конфигурацию Traefik:**

```bash
mkdir -p /home/deploy/score-coaching/traefik
nano /home/deploy/score-coaching/traefik/traefik.yml
```

```yaml
# traefik.yml
api:
  dashboard: true

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

providers:
  docker:
    exposedByDefault: false
  file:
    directory: /etc/traefik/dynamic

certificatesResolvers:
  letsencrypt:
    acme:
      email: rlevch@gmail.com
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
  # Для wildcard *.academy-coaching.ru нужен DNS challenge
  letsencrypt-dns:
    acme:
      email: rlevch@gmail.com
      storage: /letsencrypt/acme-dns.json
      dnsChallenge:
        provider: selectel  # Selectel DNS API
```

2. **Добавить Traefik в `docker-compose.yml`:**

```yaml
traefik:
  image: traefik:v3.0
  restart: unless-stopped
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - ./traefik/traefik.yml:/traefik.yml:ro
    - ./traefik/dynamic:/etc/traefik/dynamic:ro
    - ./traefik/letsencrypt:/letsencrypt
  networks:
    - score-net
```

3. **Создать динамическую конфигурацию маршрутов:**

```bash
nano /home/deploy/score-coaching/traefik/dynamic/routes.yml
```

```yaml
http:
  routers:
    # Платформа
    platform:
      rule: "Host(`score-coaching.ru`)"
      service: platform
      tls:
        certResolver: letsencrypt

    # Академия (каталог школ)
    academy:
      rule: "Host(`academy-coaching.ru`)"
      service: academy
      tls:
        certResolver: letsencrypt

    # Школы (поддомены)
    school:
      rule: "HostRegexp(`{subdomain:[a-z0-9-]+}.academy-coaching.ru`)"
      service: school
      tls:
        certResolver: letsencrypt-dns
        domains:
          - main: "academy-coaching.ru"
            sans:
              - "*.academy-coaching.ru"

    # Supabase API
    supabase-api:
      rule: "Host(`api.score-coaching.ru`)"
      service: supabase-api
      tls:
        certResolver: letsencrypt

  services:
    # Сервисы будут добавлены по мере создания фронтенда
    platform:
      loadBalancer:
        servers:
          - url: "http://platform-spa:3000"
    academy:
      loadBalancer:
        servers:
          - url: "http://academy-spa:3001"
    school:
      loadBalancer:
        servers:
          - url: "http://school-spa:3002"
    supabase-api:
      loadBalancer:
        servers:
          - url: "http://supabase-kong:8000"
```

#### Зачем это нужно
Traefik — это «дверь» вашего сервера в интернет. Когда пользователь набирает `score-coaching.ru`, запрос попадает в Traefik, который решает, куда его отправить: к фронтенду платформы, к API, к школе на поддомене и т.д. Traefik также автоматически получает HTTPS-сертификаты от Let's Encrypt.

#### Как работает маршрутизация (для новичка)
```
Пользователь → score-coaching.ru → Traefik → Platform SPA
Пользователь → academy-coaching.ru → Traefik → Academy SPA
Пользователь → my-school.academy-coaching.ru → Traefik → School SPA
Пользователь → api.score-coaching.ru → Traefik → Supabase/API Gateway
```

#### Что такое wildcard-сертификат
Обычный сертификат работает для одного домена (score-coaching.ru). Wildcard-сертификат (`*.academy-coaching.ru`) работает для любого поддомена: `my-school.academy-coaching.ru`, `another-school.academy-coaching.ru` — без необходимости получать отдельный сертификат для каждого. Для этого нужен DNS challenge через Selectel DNS API.

#### Типичные ошибки новичков
- Забыть открыть порты 80 и 443 в файрволе.
- Не настроить DNS-записи до запуска Traefik — Let's Encrypt не сможет проверить домен.
- Монтировать docker.sock без `:ro` — потенциальная уязвимость.

---

### Шаг 0.7 — LiveKit + coturn на VPS #2 (медиасервер) (2–3 дня)

#### Что делать
Развернуть на VPS #2 выделенный медиасервер: LiveKit (WebRTC SFU для видеозвонков) + coturn (TURN/STUN для пользователей за NAT/VPN). Это российская альтернатива Zoom/Google Meet, работающая на вашем оборудовании.

#### Конкретные действия

> **Все действия ниже выполняются на VPS #2 (медиасервер).**

1. **Сгенерировать ключи LiveKit:**

```bash
docker run --rm livekit/generate --api-key devkey --api-secret $(openssl rand -base64 32)
```

Сохранить `api-key` и `api-secret` — они понадобятся для подключения из API Gateway на VPS #1.

2. **Создать конфигурацию LiveKit:**

```bash
mkdir -p /home/deploy/score-coaching/livekit
nano /home/deploy/score-coaching/livekit/config.yaml
```

```yaml
# livekit-config.yaml — конфигурация для 300 пользователей на выделенном VPS
port: 7880
rtc:
  port_range_start: 50000
  port_range_end: 50500     # расширенный диапазон для 300 пользователей
  tcp_port: 7881
  use_external_ip: true

keys:
  devkey: <ваш_api_secret>

room:
  max_participants: 10      # макс. в одной комнате (коуч-сессии обычно 1:1)
  empty_timeout: 300        # закрыть комнату через 5 мин без участников

# Встроенный TURN — базовый, coturn рядом для надёжности
turn:
  enabled: true
  udp_port: 3478
  tls_port: 5349

logging:
  level: info

# Для 300 пользователей: ~30-50 одновременных видеосессий
# Каждая сессия потребляет ~2-5 Мбит/с → пиковый трафик ~150-250 Мбит/с
# VPS #2 с 8 vCPU и 1 Gbps справится
```

3. **Создать конфигурацию coturn:**

```bash
nano /home/deploy/score-coaching/coturn/turnserver.conf
```

```ini
# coturn — TURN/STUN сервер для пользователей за NAT/VPN/корп. файрволами
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=<длинный_секрет_для_coturn>
realm=score-coaching.ru
total-quota=300
stale-nonce=600
# Relay ports для медиа-трафика
min-port=49152
max-port=49252
# Логирование
log-file=/var/log/turnserver.log
simple-log
# Внешний IP (IP VPS #2)
external-ip=<IP-VPS-2>
```

4. **Создать `docker-compose.yml` на VPS #2:**

```yaml
# VPS #2: docker-compose.yml — медиасервер
version: "3.8"

services:
  livekit:
    image: livekit/livekit-server:latest
    restart: unless-stopped
    command: --config /etc/livekit.yaml --node-ip ${VPS2_EXTERNAL_IP}
    volumes:
      - ./livekit/config.yaml:/etc/livekit.yaml
    ports:
      - "7880:7880"              # Signaling (HTTP/WebSocket)
      - "7881:7881"              # RTC (TCP fallback)
      - "50000-50500:50000-50500/udp"  # RTC (UDP) — расширенный диапазон
    networks:
      - media-net

  coturn:
    image: coturn/coturn:latest
    restart: unless-stopped
    volumes:
      - ./coturn/turnserver.conf:/etc/turnserver.conf
    ports:
      - "3478:3478/udp"         # STUN/TURN (UDP)
      - "3478:3478/tcp"         # TURN (TCP)
      - "5349:5349/tcp"         # TURN over TLS
      - "49152-49252:49152-49252/udp"  # Relay ports
    networks:
      - media-net

networks:
  media-net:
    driver: bridge
```

5. **Запустить и проверить:**

```bash
# На VPS #2:
docker compose up -d
docker compose ps  # Оба контейнера должны быть Up

# Проверить LiveKit — открыть https://meet.livekit.io:
# URL: ws://<IP-VPS-2>:7880
# API Key: devkey
# API Secret: <ваш секрет>
# Должно подключиться и показать видео

# Проверить coturn:
# Установить утилиту turnutils (если нужна проверка):
sudo apt install coturn-utils -y
turnutils_uclient -T -p 3478 <IP-VPS-2>
```

6. **Настроить доступ API Gateway (VPS #1) к LiveKit (VPS #2):**

API Gateway на VPS #1 будет генерировать LiveKit-токены. Для этого ему нужно знать LiveKit API endpoint:

```bash
# В .env на VPS #1 добавить:
LIVEKIT_HOST=ws://<IP-VPS-2>:7880     # Для фронтенда (через Traefik)
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=<ваш_секрет>
```

#### Зачем это нужно
LiveKit — ключевой компонент для видеосессий коуч↔клиент. Он обеспечивает: видео и аудио в реальном времени; демонстрацию экрана; чат внутри сессии (Data Channel); поддержку TURN для пользователей за корпоративными VPN/NAT.

#### Что такое WebRTC и SFU (для новичка)
WebRTC — технология для видеозвонков в браузере без плагинов. SFU (Selective Forwarding Unit) — сервер-посредник: вместо того чтобы каждый участник отправлял видео каждому другому напрямую (что плохо масштабируется), все отправляют видео на сервер, а сервер рассылает его остальным.

#### Зачем coturn отдельно от LiveKit
LiveKit имеет встроенный TURN, но он базовый. Coturn — специализированный, проверенный временем TURN-сервер. При 300 пользователях часть из них будет за корпоративными VPN/NAT, где WebRTC напрямую не пройдёт. Coturn обеспечивает relay-соединение через TCP/TLS — это работает даже в самых жёстких сетевых окружениях. При 300 пользователях надёжность TURN критична.

#### Зачем выделенный VPS для медиа
Видеопотоки — самая тяжёлая нагрузка в проекте. При 30–50 одновременных сессиях LiveKit потребляет 4–6 vCPU и 150–250 Мбит/с трафика. Если это на одном VPS с PostgreSQL — БД начнёт тормозить, API станет медленным, пользователи на сайте получат задержки. Выделенный VPS #2 изолирует медиа-нагрузку: сайт и API работают стабильно, даже когда все 50 сессий идут одновременно.

---

### Шаг 0.8 — Регистрация доменов и DNS (1 день)

#### Что делать
Зарегистрировать домены и настроить DNS-записи.

#### Конкретные действия

1. **Зарегистрировать домены (.ru):**
   - `score-coaching.ru` — Платформа
   - `academy-coaching.ru` — Академия
   - `association-coaching.ru` — Ассоциация (на будущее)

   Регистраторы: reg.ru, nic.ru, Selectel DNS.

2. **Настроить DNS-записи (Selectel DNS или другой провайдер):**

```
# A-записи — всё на VPS #1 (Traefik принимает весь веб-трафик)
score-coaching.ru          A    <IP-VPS-1>
www.score-coaching.ru      A    <IP-VPS-1>
api.score-coaching.ru      A    <IP-VPS-1>
academy-coaching.ru        A    <IP-VPS-1>
www.academy-coaching.ru    A    <IP-VPS-1>
*.academy-coaching.ru      A    <IP-VPS-1>    # Wildcard для школ!
association-coaching.ru    A    <IP-VPS-1>
# LiveKit WebSocket — на VPS #2 (медиасервер)
livekit.score-coaching.ru  A    <IP-VPS-2>
turn.score-coaching.ru     A    <IP-VPS-2>
```

> **Обратите внимание:** все веб-домены указывают на VPS #1 (приложение). Отдельные поддомены `livekit.` и `turn.` указывают на VPS #2 (медиасервер). Фронтенд будет подключаться к видеосерверу через `wss://livekit.score-coaching.ru`.

3. **Проверить DNS:**

```bash
# Подождать 5–30 минут после настройки, затем:
dig score-coaching.ru +short
# Должен показать IP VPS #1
dig myschool.academy-coaching.ru +short
# Тоже IP VPS #1 (wildcard)
dig livekit.score-coaching.ru +short
# Должен показать IP VPS #2 (медиасервер)
```

#### Зачем нужна wildcard-запись
`*.academy-coaching.ru` означает, что ЛЮБОЙ поддомен (my-school.academy-coaching.ru, best-coach.academy-coaching.ru) будет указывать на ваш VPS. Это ключевой элемент мультитенантности: каждая школа получает свой поддомен автоматически, без ручной настройки DNS.

---

### Шаг 0.9 — Инициализация монорепозитория (2–3 дня)

#### Что делать
Создать структуру проекта: монорепозиторий с несколькими React-приложениями и общими пакетами.

#### Конкретные действия

1. **Создать монорепозиторий:**

```bash
# На своём компьютере (не на сервере)
mkdir score-coaching && cd score-coaching
git init

# Инициализировать package.json
npm init -y

# Установить Turborepo для управления монорепо
npm install turbo --save-dev
```

2. **Создать структуру папок:**

```bash
mkdir -p apps/platform/src          # Платформа (score-coaching.ru)
mkdir -p apps/academy/src           # Академия (academy-coaching.ru)
mkdir -p apps/school/src            # SPA школы (*.academy-coaching.ru)
mkdir -p apps/school-admin/src      # Админка школы
mkdir -p apps/admin/src             # Админ-панель платформы
mkdir -p packages/ui/src            # Общие UI-компоненты
mkdir -p packages/shared-types/src  # Общие TypeScript-типы
mkdir -p packages/supabase/src      # Supabase-клиент, типы БД
mkdir -p services/api-gateway/src   # API Gateway (Fastify)
mkdir -p services/email-worker/src  # Email-воркер (BullMQ)
```

3. **Настроить каждое React-приложение (пример для platform):**

```bash
cd apps/platform
npm create vite@latest . -- --template react-ts
npm install react-router-dom @tanstack/react-query zustand
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Установить shadcn/ui
npx shadcn-ui@latest init
```

4. **Настроить Turborepo (`turbo.json` в корне):**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {}
  }
}
```

5. **Настроить рабочие пространства (`package.json` в корне):**

```json
{
  "name": "score-coaching",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*",
    "services/*"
  ]
}
```

#### Зачем монорепозиторий
Все три сайта (Платформа, Академия, Школы) используют одни и те же компоненты, типы данных, утилиты. Монорепозиторий позволяет: переиспользовать код между приложениями через `packages/`; менять общий компонент (кнопку, модалку) в одном месте — изменения подхватят все приложения; запускать `turbo dev` — и все приложения стартуют одновременно.

#### Что такое монорепозиторий (для новичка)
Обычно каждый проект — отдельный Git-репозиторий. Монорепо — один репозиторий с несколькими проектами внутри. Turborepo умеет: запускать команды параллельно во всех проектах, кэшировать результаты сборки, учитывать зависимости между проектами.

#### Типичные ошибки новичков
- Не настроить workspaces — тогда общие пакеты не будут линковаться.
- Дублировать код между apps — вместо этого выносите в packages.
- Использовать Yarn/PNPM если незнакомы — на старте npm + turborepo достаточно.

---

### Шаг 0.10 — Генерация UI в lovable.dev (2–3 дня)

#### Что делать
Использовать lovable.dev (AI-генератор UI) для быстрого создания базовых экранов.

#### Конкретные действия

1. **Зарегистрироваться на lovable.dev** и описать нужные экраны:
   - «Лендинг коучинговой платформы: hero-секция, преимущества, каталог коучей, CTA, отзывы»
   - «Страница логина: email + пароль, кнопка VK ID, восстановление пароля»
   - «Страница регистрации: выбор роли (коуч/клиент), email, пароль, имя»
   - «Дашборд коуча: сайдбар с навигацией, расписание, ближайшие сессии, уведомления»
   - «Дашборд клиента: мои коучи, предстоящие сессии, рекомендации»

2. **Экспортировать код** из lovable.dev (React + Tailwind + shadcn/ui).

3. **Адаптировать к монорепозиторию:**
   - Скопировать компоненты в `apps/platform/src/`
   - Общие компоненты (кнопки, модалки, карточки) вынести в `packages/ui/`
   - Привести именование файлов в единый стиль
   - Удалить захардкоженные данные, заменить на пропсы

#### Зачем это нужно
lovable.dev экономит 30–40% времени на вёрстке. Вместо того чтобы вручную верстать каждую кнопку и форму, вы получаете готовый React-код с Tailwind-стилями, который нужно только адаптировать к вашей структуре.

#### Советы по работе с lovable.dev
- Давайте максимально конкретные промты: не «сделай дашборд», а «дашборд коуча с сайдбаром слева (пункты: Расписание, Клиенты, Сессии, Финансы), хедером с аватаром и уведомлениями, основной областью с карточками ближайших сессий».
- Генерируйте по одному экрану за раз.
- Экспортированный код — черновик, не финал. Вам всё равно нужно будет подключить реальные данные, роутинг, авторизацию.

---

### Шаг 0.11 — App Shell платформы (2 дня)

#### Что делать
Создать «каркас» приложения: навигацию, роутинг, layout для авторизованных и неавторизованных пользователей.

#### Конкретные действия

1. **Настроить React Router с ленивой загрузкой:**

```tsx
// apps/platform/src/app/router.tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';

const LandingPage = lazy(() => import('../modules/landing/LandingPage'));
const LoginPage = lazy(() => import('../modules/auth/LoginPage'));
const RegisterPage = lazy(() => import('../modules/auth/RegisterPage'));
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));
const CoachDashboard = lazy(() => import('../modules/coach-profile/CoachDashboard'));
const ClientDashboard = lazy(() => import('../modules/client-portal/ClientDashboard'));

const router = createBrowserRouter([
  // Публичные маршруты
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/coach/:slug', element: lazy(() => import('../modules/marketplace/CoachProfile')) },

  // Защищённые маршруты (требуют авторизации)
  {
    path: '/dashboard',
    element: <DashboardLayout />,    // Sidebar + Header
    children: [
      { path: 'coach', element: <CoachDashboard /> },
      { path: 'client', element: <ClientDashboard /> },
      { path: 'sessions', element: lazy(() => import('../modules/sessions/SessionsList')) },
      { path: 'chat', element: lazy(() => import('../modules/chat/ChatPage')) },
      { path: 'calendar', element: lazy(() => import('../modules/calendar/CalendarPage')) },
      // ... остальные маршруты
    ],
  },
]);
```

2. **Создать DashboardLayout с сайдбаром:**

```tsx
// apps/platform/src/app/layouts/DashboardLayout.tsx
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from '../../shared/ui/Sidebar';
import { Header } from '../../shared/ui/Header';
import { useAuth } from '../../modules/auth/useAuth';

export default function DashboardLayout() {
  const { user, loading } = useAuth();

  if (loading) return <div>Загрузка...</div>;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header user={user} />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />   {/* Здесь отрисовывается текущая страница */}
        </main>
      </div>
    </div>
  );
}
```

#### Зачем lazy loading
Без lazy loading браузер загружает ВСЕ страницы при открытии сайта (даже те, которые пользователь никогда не откроет). С lazy loading каждая страница загружается только когда пользователь на неё переходит — это ускоряет первую загрузку сайта.

---

### Шаг 0.12 — Авторизация (Email + VK ID) (3–5 дней)

#### Что делать
Подключить регистрацию и вход через email и VK ID, используя GoTrue (часть Supabase).

#### Конкретные действия

1. **Настроить Supabase Auth (email):**

```tsx
// packages/supabase/src/client.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

```tsx
// Регистрация
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword',
  options: {
    data: {
      first_name: 'Иван',
      last_name: 'Петров',
      role: 'client',  // или 'coach'
    }
  }
});

// Вход
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'securepassword',
});

// Выход
await supabase.auth.signOut();

// Восстановление пароля
await supabase.auth.resetPasswordForEmail('user@example.com');
```

2. **Подключить VK ID OAuth:**

Зарегистрировать приложение на `id.vk.com/about/business/go`. Получить `client_id` и `client_secret`. Добавить redirect URL: `https://api.score-coaching.ru/auth/v1/callback`.

```tsx
// Вход через VK ID
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'vkontakte',    // Supabase поддерживает VK как провайдер
  options: {
    redirectTo: 'https://score-coaching.ru/dashboard',
  }
});
```

Если Supabase GoTrue не поддерживает VK ID «из коробки», нужно реализовать custom OAuth flow через API Gateway.

3. **Создать хук `useAuth`:**

```tsx
// apps/platform/src/modules/auth/useAuth.ts
import { useEffect, useState } from 'react';
import { supabase } from '@score/supabase';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Получить текущую сессию
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Подписаться на изменения авторизации
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}
```

#### Зачем VK ID
В России VK — крупнейшая соцсеть. VK ID позволяет пользователям входить одним кликом без создания пароля. MAX (мессенджер VK) использует тот же VK ID.

#### Типичные ошибки новичков
- Хранить токены в localStorage вручную — Supabase SDK делает это сам.
- Не обрабатывать ошибки авторизации (неверный пароль, пользователь не найден).
- Забыть про подтверждение email — без SMTP настройки регистрация зависнет на этапе «подтвердите email».

---

### Шаг 0.13 — RBAC (роли и доступы) (2–3 дня)

#### Что делать
Реализовать систему ролей: кто что может видеть и делать.

#### Конкретные действия

1. **Создать таблицу ролей (SQL-миграция):**

```sql
-- Добавить колонку ролей в таблицу users
ALTER TABLE public.users ADD COLUMN roles TEXT[] DEFAULT ARRAY['client'];

-- Глобальные роли:
-- platform_admin — суперадмин платформы
-- coach — зарегистрированный коуч
-- client — клиент
-- moderator — модератор контента
-- association_member — член ассоциации

-- Школьные роли (хранятся в tenant.school_team_members):
-- school_owner, school_admin, instructor, curator, manager, student
```

2. **Создать RLS-политики (пример для сессий):**

```sql
-- Клиент видит только свои сессии
CREATE POLICY "Clients see own sessions" ON platform.sessions
  FOR SELECT USING (client_id = auth.uid());

-- Коуч видит сессии, где он — коуч
CREATE POLICY "Coaches see own sessions" ON platform.sessions
  FOR SELECT USING (coach_id = auth.uid());

-- Админ видит всё
CREATE POLICY "Admins see all" ON platform.sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND 'platform_admin' = ANY(roles))
  );
```

3. **Создать хук проверки ролей на фронте:**

```tsx
// packages/shared/src/hooks/useRole.ts
export function useRole() {
  const { user } = useAuth();

  const isCoach = user?.user_metadata?.roles?.includes('coach');
  const isClient = user?.user_metadata?.roles?.includes('client');
  const isAdmin = user?.user_metadata?.roles?.includes('platform_admin');

  return { isCoach, isClient, isAdmin };
}
```

#### Зачем RLS
Row Level Security — главная линия безопасности в Supabase. Даже если злоумышленник получит доступ к API, RLS на уровне PostgreSQL не даст ему увидеть чужие данные. Для мультитенантной Академии это критически важно: школа A не должна видеть студентов школы B.

---

### Шаг 0.14 — API Gateway (Fastify) (2–3 дня)

#### Что делать
Создать Node.js-сервер на Fastify для бизнес-логики, которая выходит за рамки Supabase: интеграция с ЮKassa, LiveKit токены, email через BullMQ, Tenant Router.

#### Конкретные действия

1. **Инициализировать сервис:**

```bash
cd services/api-gateway
npm init -y
npm install fastify @fastify/cors @fastify/helmet @supabase/supabase-js
npm install bullmq ioredis livekit-server-sdk
npm install -D typescript @types/node tsx
```

2. **Создать сервер:**

```ts
// services/api-gateway/src/server.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: [
    'https://score-coaching.ru',
    'https://academy-coaching.ru',
    /\.academy-coaching\.ru$/,   // Все поддомены школ
  ],
});

// Health check
app.get('/health', async () => ({ status: 'ok' }));

// Маршруты будут добавляться по мере реализации фич:
// /api/livekit/token — получение токена для видеосессии
// /api/payments/* — интеграция с ЮKassa
// /api/tenant/resolve — определение школы по домену

await app.listen({ port: 4000, host: '0.0.0.0' });
```

3. **Добавить в Docker Compose:**

```yaml
# Добавить в docker-compose.yml на VPS #1:
api-gateway:
  build: ./services/api-gateway
  restart: unless-stopped
  environment:
    - SUPABASE_URL=http://supabase-kong:8000
    - SUPABASE_SERVICE_KEY=${SERVICE_ROLE_KEY}
    - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
    - PGBOUNCER_URL=postgres://postgres:${POSTGRES_PASSWORD}@pgbouncer:6432/postgres
    - LIVEKIT_HOST=ws://${VPS2_EXTERNAL_IP}:7880      # LiveKit на VPS #2
    - LIVEKIT_API_KEY=${LIVEKIT_API_KEY}
    - LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}
    - NODE_CLUSTER_WORKERS=4                            # 4 воркера для 300 пользователей
  networks:
    - score-net
```

#### Зачем нужен API Gateway, если есть Supabase
Supabase отлично справляется с CRUD-операциями (создать, прочитать, обновить, удалить). Но есть задачи, которые ему не по силам: генерация LiveKit-токенов (требуется серверный секрет); обработка webhook'ов от ЮKassa (подтверждение платежей); отправка email через очередь (BullMQ + Redis); определение тенанта по домену (Tenant Router для Академии); бизнес-логика (бронирование: проверка слотов + создание сессии + отправка уведомлений — всё в одной транзакции).

---

### Шаг 0.15 — Схема БД: общие таблицы (2 дня)

#### Что делать
Создать миграции для общих таблиц, которые используются всеми приложениями.

#### Конкретные действия

1. **Создать миграцию через Supabase CLI или Studio:**

```sql
-- Миграция: 001_initial_schema.sql

-- Профили пользователей (расширение auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  specializations TEXT[],
  timezone TEXT DEFAULT 'Europe/Moscow',
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Автоматическое создание профиля при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Уведомления
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,        -- booking, payment, message, system
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN DEFAULT FALSE,
  data JSONB,                -- дополнительные данные (ссылка, ID сессии и т.д.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users see own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());
```

2. **Создать схемы для доменных областей:**

```sql
CREATE SCHEMA IF NOT EXISTS platform;    -- услуги коучей, сессии
CREATE SCHEMA IF NOT EXISTS academy;     -- курсы, уроки, задания
CREATE SCHEMA IF NOT EXISTS tenant;      -- мультитенантность (школы)
CREATE SCHEMA IF NOT EXISTS chat;        -- мессенджер
CREATE SCHEMA IF NOT EXISTS billing;     -- оплата, подписки
CREATE SCHEMA IF NOT EXISTS content;     -- библиотека, тесты
CREATE SCHEMA IF NOT EXISTS tracking;    -- учёт часов (для ассоциации)
```

#### Зачем разделение на схемы
Схемы (schemas) в PostgreSQL — это как «папки» для таблиц. Вместо одной кучи таблиц `users, sessions, courses, payments...` мы группируем их по доменам: `platform.sessions`, `academy.courses`, `billing.payments`. Это: упрощает понимание структуры, позволяет настраивать RLS по схемам, соответствует архитектуре (каждый модуль работает со своей схемой).

---

### Шаг 0.16 — Email-сервис (1 день)

#### Что делать
Настроить отправку email через Unisender + BullMQ.

#### Конкретные действия

1. **Зарегистрироваться на Unisender** (unisender.com) — российский email-сервис.

2. **Создать email-воркер:**

```ts
// services/email-worker/src/worker.ts
import { Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!);

const emailWorker = new Worker('email', async (job) => {
  const { to, subject, html, template } = job.data;

  // Отправка через Unisender API
  const response = await fetch('https://api.unisender.com/ru/api/sendEmail', {
    method: 'POST',
    body: new URLSearchParams({
      api_key: process.env.UNISENDER_API_KEY!,
      email: to,
      sender_name: 'SCORE Coaching',
      sender_email: 'noreply@score-coaching.ru',
      subject,
      body: html,
    }),
  });

  console.log(`Email sent to ${to}: ${subject}`);
}, { connection });
```

3. **Добавить отправку email из API Gateway:**

```ts
// В любом месте API Gateway:
import { Queue } from 'bullmq';

const emailQueue = new Queue('email', { connection: redis });

// Пример: уведомление о бронировании
await emailQueue.add('booking-confirmation', {
  to: 'client@example.com',
  subject: 'Сессия забронирована',
  html: '<h1>Ваша сессия подтверждена</h1><p>Дата: ...</p>',
});
```

#### Зачем BullMQ а не отправлять сразу
Если отправлять email прямо в обработчике запроса, пользователь будет ждать 1–3 секунды, пока письмо уйдёт. С очередью: API мгновенно отвечает «ок», задача на отправку email ставится в очередь, отдельный воркер забирает задачу и отправляет письмо в фоне.

---

### Шаг 0.17 — CI/CD (GitHub Actions) (1–2 дня)

#### Что делать
Настроить автоматическую сборку и деплой при пуше в main.

#### Конкретные действия

1. **Создать `.github/workflows/deploy.yml`:**

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npx turbo lint
      - run: npx turbo build

      - name: Deploy to VPS #1 (приложение)
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS1_HOST }}
          username: deploy
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /home/deploy/score-coaching
            git pull origin main
            docker compose up -d --build

      - name: Deploy to VPS #2 (медиасервер)
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS2_HOST }}
          username: deploy
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /home/deploy/score-coaching
            docker compose pull
            docker compose up -d
```

2. **Добавить секреты в GitHub:**
   - Settings → Secrets → New: `VPS1_HOST`, `VPS2_HOST`, `SSH_PRIVATE_KEY`

#### Зачем CI/CD
Без CI/CD каждый деплой — ручной процесс: «зайти на сервер по SSH, сделать git pull, пересобрать...». С GitHub Actions это происходит автоматически: пушнул код → через 2–3 минуты изменения на сервере.

---

### Шаг 0.18 — Мониторинг (1–1.5 дня)

#### Что делать
При 300 пользователях и двух серверах мониторинг становится важнее: нужно видеть состояние обоих VPS и понимать, где узкое место. Рекомендуем Grafana + Prometheus — полноценный стек, который окупится при диагностике проблем.

#### Конкретные действия

1. **Установить Prometheus + Grafana на VPS #1:**

```yaml
# Добавить в docker-compose.yml на VPS #1:
prometheus:
  image: prom/prometheus:latest
  restart: unless-stopped
  volumes:
    - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    - prometheus-data:/prometheus
  networks:
    - score-net
  ports:
    - "127.0.0.1:9090:9090"

grafana:
  image: grafana/grafana:latest
  restart: unless-stopped
  environment:
    GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
  volumes:
    - grafana-data:/var/lib/grafana
  networks:
    - score-net
  ports:
    - "127.0.0.1:3333:3000"
```

2. **Установить node_exporter на ОБОИХ VPS:**

```bash
# На VPS #1 и VPS #2:
docker run -d --name node-exporter --net="host" --pid="host" \
  -v "/:/host:ro,rslave" \
  quay.io/prometheus/node-exporter:latest \
  --path.rootfs=/host
```

3. **Настроить prometheus.yml:**

```yaml
# prometheus/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'vps1-node'
    static_configs:
      - targets: ['localhost:9100']

  - job_name: 'vps2-node'
    static_configs:
      - targets: ['<IP-VPS-2>:9100']

  - job_name: 'postgresql'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'livekit'
    static_configs:
      - targets: ['<IP-VPS-2>:7880']
    metrics_path: /metrics
```

4. **Создать базовые дашборды в Grafana:**
   - CPU, RAM, диск, сеть — для обоих VPS
   - PostgreSQL: активные соединения, запросы/сек, размер БД
   - LiveKit: активные комнаты, участники, трафик
   - Redis: использование памяти, команды/сек

5. **Настроить алерты в Telegram:**
   - Создать Telegram-бота через @BotFather
   - Настроить уведомления: CPU > 80%, RAM > 90%, диск > 85%, контейнер упал, PostgreSQL connections > 250

6. **Добавить UptimeRobot** (uptimerobot.com) — внешний мониторинг доступности:
   - Проверяет `score-coaching.ru` каждые 5 минут
   - Присылает уведомление если сайт упал

#### Почему Grafana + Prometheus, а не Netdata
При двух серверах нужен единый центр мониторинга. Grafana + Prometheus собирает метрики с обоих VPS в одном дашборде. Netdata показывает только один сервер. При диагностике проблемы («почему сайт тормозит?») вы видите оба VPS одновременно: может, на VPS #2 LiveKit сожрал всю CPU, или на VPS #1 PostgreSQL исчерпал соединения.

---

### Шаг 0.19 — Автоматические бэкапы PostgreSQL (0.5 дня)

#### Что делать
Настроить ежедневное автоматическое резервное копирование базы данных с загрузкой в MinIO.

#### Конкретные действия

1. **Создать скрипт бэкапа на VPS #1:**

```bash
mkdir -p /home/deploy/scripts /home/deploy/backups
nano /home/deploy/scripts/backup.sh
```

```bash
#!/bin/bash
# Автоматический бэкап PostgreSQL → MinIO
set -e

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/home/deploy/backups
BACKUP_FILE="db_${DATE}.sql.gz"

# 1. Создать дамп и сразу сжать
docker exec supabase-db pg_dump -U postgres --clean --if-exists | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"

# 2. Загрузить в MinIO (бакет backups)
docker run --rm --network score-net \
  -v "${BACKUP_DIR}:/backups" \
  minio/mc:latest \
  sh -c "mc alias set myminio http://minio:9000 \${MINIO_ROOT_USER} \${MINIO_ROOT_PASSWORD} && \
         mc cp /backups/${BACKUP_FILE} myminio/backups/"

# 3. Удалить локальные бэкапы старше 7 дней
find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +7 -delete

echo "[$(date)] Backup completed: ${BACKUP_FILE}"
```

```bash
chmod +x /home/deploy/scripts/backup.sh
```

2. **Добавить в crontab (ежедневно в 3:00):**

```bash
crontab -e
# Добавить строку:
0 3 * * * /home/deploy/scripts/backup.sh >> /home/deploy/logs/backup.log 2>&1
```

3. **Создать бакет backups в MinIO:**

В MinIO Console → Buckets → Create → `backups`

4. **Проверить вручную:**

```bash
/home/deploy/scripts/backup.sh
# Проверить, что файл появился:
ls -la /home/deploy/backups/
# И в MinIO Console → backups
```

#### Как восстановить из бэкапа

```bash
# 1. Скачать бэкап из MinIO (или использовать локальный)
gunzip db_20260321_030000.sql.gz

# 2. Восстановить
docker exec -i supabase-db psql -U postgres < db_20260321_030000.sql
```

#### Зачем это нужно
Потеря данных — самое страшное, что может случиться с продуктом. Бэкап — ваша страховка. При 300 пользователях дамп БД будет весить 50–200 МБ (в сжатом виде), резервное копирование займёт секунды.

---

### Шаг 0.20 — Полные конфигурационные файлы (reference)

> Этот шаг — не отдельная задача, а **справочник**. Здесь собраны финальные версии конфигов, которые вы создавали по частям в шагах 0.1–0.19. Скопируйте их целиком, подставив свои значения.

#### .env для VPS #1 (приложение)

```bash
# === .env — VPS #1 (приложение) ===
# Скопируйте этот файл как .env и замените все значения в < >

# ─── PostgreSQL ────────────────────────────────
POSTGRES_PASSWORD=<сгенерировать: openssl rand -base64 32>
POSTGRES_DB=postgres
POSTGRES_PORT=5432

# ─── Supabase ──────────────────────────────────
JWT_SECRET=<сгенерировать: openssl rand -base64 64>
ANON_KEY=<сгенерировать JWT с ролью anon на jwt.io, используя JWT_SECRET>
SERVICE_ROLE_KEY=<сгенерировать JWT с ролью service_role на jwt.io, используя JWT_SECRET>
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<придумать сложный пароль>
SITE_URL=https://score-coaching.ru
API_EXTERNAL_URL=https://api.score-coaching.ru
SUPABASE_PUBLIC_URL=https://api.score-coaching.ru

# ─── Redis ─────────────────────────────────────
REDIS_PASSWORD=<сгенерировать: openssl rand -base64 32>

# ─── MinIO ─────────────────────────────────────
MINIO_ROOT_USER=scoreadmin
MINIO_ROOT_PASSWORD=<сгенерировать: openssl rand -base64 32>

# ─── LiveKit (VPS #2) ─────────────────────────
LIVEKIT_HOST=wss://livekit.score-coaching.ru
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=<секрет из шага 0.7>
VPS2_EXTERNAL_IP=<IP-адрес VPS #2>

# ─── ЮKassa ───────────────────────────────────
YOOKASSA_SHOP_ID=<получить при подключении>
YOOKASSA_SECRET_KEY=<получить при подключении>

# ─── Email (Unisender) ─────────────────────────
UNISENDER_API_KEY=<получить при регистрации>
SMTP_HOST=smtp.unisender.com
SMTP_PORT=587
SMTP_USER=<email>
SMTP_PASS=<пароль>

# ─── Grafana ───────────────────────────────────
GRAFANA_PASSWORD=<придумать сложный пароль>

# ─── Общее ─────────────────────────────────────
NODE_ENV=production
VPS1_EXTERNAL_IP=<IP-адрес VPS #1>
```

#### .env для VPS #2 (медиасервер)

```bash
# === .env — VPS #2 (медиасервер) ===

# ─── LiveKit ───────────────────────────────────
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=<тот же секрет, что на VPS #1>
VPS2_EXTERNAL_IP=<IP-адрес VPS #2>

# ─── coturn ────────────────────────────────────
TURN_SECRET=<сгенерировать: openssl rand -base64 32>
TURN_REALM=score-coaching.ru

# ─── MinIO на VPS #1 (для Egress, Post-MVP) ───
MINIO_ENDPOINT=http://<IP-VPS-1>:9000
MINIO_ACCESS_KEY=scoreadmin
MINIO_SECRET_KEY=<тот же пароль MinIO, что на VPS #1>
```

#### Полный docker-compose.yml для VPS #1 (приложение)

```yaml
# === VPS #1: docker-compose.yml ===
# Все сервисы приложения, БД, кэша, файлов
version: "3.8"

services:
  # ─── Supabase (включает PostgreSQL, GoTrue, Realtime, PostgREST, Studio) ──
  # Используйте официальный docker-compose от Supabase:
  # git clone https://github.com/supabase/supabase && cp -r supabase/docker/* .
  # Ниже — дополнительные сервисы, которые добавляются к нему.

  # ─── pgBouncer (пул соединений) ──────────────────────────────────────────
  pgbouncer:
    image: edoburu/pgbouncer:latest
    restart: unless-stopped
    environment:
      DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD}@supabase-db:5432/postgres
      POOL_MODE: transaction
      DEFAULT_POOL_SIZE: 60
      MAX_CLIENT_CONN: 600
      MAX_DB_CONNECTIONS: 100
      RESERVE_POOL_SIZE: 10
    networks:
      - score-net
    ports:
      - "127.0.0.1:6432:6432"
    depends_on:
      - supabase-db

  # ─── Redis ───────────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --maxmemory 1gb --maxmemory-policy allkeys-lru --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    networks:
      - score-net
    ports:
      - "127.0.0.1:6379:6379"

  # ─── MinIO (файловое хранилище) ──────────────────────────────────────────
  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - minio-data:/data
    networks:
      - score-net
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"

  # ─── API Gateway (Fastify) ──────────────────────────────────────────────
  api-gateway:
    build: ./services/api-gateway
    restart: unless-stopped
    environment:
      SUPABASE_URL: http://supabase-kong:8000
      SUPABASE_SERVICE_KEY: ${SERVICE_ROLE_KEY}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      PGBOUNCER_URL: postgres://postgres:${POSTGRES_PASSWORD}@pgbouncer:6432/postgres
      LIVEKIT_HOST: ${LIVEKIT_HOST}
      LIVEKIT_API_KEY: ${LIVEKIT_API_KEY}
      LIVEKIT_API_SECRET: ${LIVEKIT_API_SECRET}
      YOOKASSA_SHOP_ID: ${YOOKASSA_SHOP_ID}
      YOOKASSA_SECRET_KEY: ${YOOKASSA_SECRET_KEY}
      NODE_CLUSTER_WORKERS: "4"
    networks:
      - score-net
    depends_on:
      - redis
      - pgbouncer

  # ─── Email Worker (BullMQ) ──────────────────────────────────────────────
  email-worker:
    build: ./services/email-worker
    restart: unless-stopped
    environment:
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      UNISENDER_API_KEY: ${UNISENDER_API_KEY}
    networks:
      - score-net
    depends_on:
      - redis

  # ─── Traefik (reverse proxy) ────────────────────────────────────────────
  traefik:
    image: traefik:v3.0
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/traefik.yml:/traefik.yml:ro
      - ./traefik/dynamic:/etc/traefik/dynamic:ro
      - ./traefik/letsencrypt:/letsencrypt
    networks:
      - score-net

  # ─── Prometheus (метрики) ───────────────────────────────────────────────
  prometheus:
    image: prom/prometheus:latest
    restart: unless-stopped
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    networks:
      - score-net
    ports:
      - "127.0.0.1:9090:9090"

  # ─── Grafana (дашборды) ─────────────────────────────────────────────────
  grafana:
    image: grafana/grafana:latest
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - grafana-data:/var/lib/grafana
    networks:
      - score-net
    ports:
      - "127.0.0.1:3333:3000"

networks:
  score-net:
    driver: bridge

volumes:
  redis-data:
  minio-data:
  prometheus-data:
  grafana-data:
```

#### Полный docker-compose.yml для VPS #2 (медиасервер)

```yaml
# === VPS #2: docker-compose.yml ===
# LiveKit + coturn (видеосессии и TURN relay)
version: "3.8"

services:
  # ─── LiveKit Server (WebRTC SFU) ────────────────────────────────────────
  livekit:
    image: livekit/livekit-server:latest
    restart: unless-stopped
    command: --config /etc/livekit.yaml --node-ip ${VPS2_EXTERNAL_IP}
    volumes:
      - ./livekit/config.yaml:/etc/livekit.yaml
    ports:
      - "7880:7880"
      - "7881:7881"
      - "50000-50500:50000-50500/udp"
    networks:
      - media-net

  # ─── coturn (TURN/STUN сервер) ──────────────────────────────────────────
  coturn:
    image: coturn/coturn:latest
    restart: unless-stopped
    volumes:
      - ./coturn/turnserver.conf:/etc/turnserver.conf
    ports:
      - "3478:3478/udp"
      - "3478:3478/tcp"
      - "5349:5349/tcp"
      - "49152-49252:49152-49252/udp"
    networks:
      - media-net

  # ─── node_exporter (метрики для Prometheus на VPS #1) ───────────────────
  node-exporter:
    image: quay.io/prometheus/node-exporter:latest
    restart: unless-stopped
    pid: host
    volumes:
      - /:/host:ro,rslave
    command: --path.rootfs=/host
    ports:
      - "9100:9100"
    networks:
      - media-net

networks:
  media-net:
    driver: bridge
```

---

### ✅ Итог Фазы 0

После выполнения всех шагов у вас есть:
- **VPS #1** (приложение): Docker, Supabase (PostgreSQL + pgBouncer + GoTrue + Realtime + Storage), Redis, MinIO, Traefik, API Gateway
- **VPS #2** (медиасервер): Docker, LiveKit Server, coturn (TURN/STUN)
- Три домена с HTTPS (включая wildcard для поддоменов школ), livekit/turn-поддомены на VPS #2
- Монорепозиторий с React-приложениями и общими пакетами
- Авторизация (email + VK ID) с RBAC
- API Gateway (Fastify, 4 воркера) для бизнес-логики
- Email-сервис через очередь (BullMQ)
- CI/CD (GitHub Actions) с деплоем на оба VPS
- Мониторинг (Grafana + Prometheus) с метриками обоих серверов

**Это фундамент, на котором строится всё остальное.**

---

## ФАЗА 1 — MVP Платформы (~45–55 дней)

> Коучи продают услуги, проводят видеосессии с клиентами. Полный цикл: найти коуча → забронировать → оплатить → провести видеосессию → оставить отзыв.

---

### Шаг 1.1 — Схема БД платформы (3 дня)

#### Что делать
Создать таблицы для всех сущностей платформы: услуги коучей, сессии, отзывы, расписание, верификация, пакеты сессий.

#### Конкретные действия

```sql
-- Миграция: 002_platform_schema.sql

-- Услуги коучей
CREATE TABLE platform.coach_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'individual_session',
  price NUMERIC(10,2) NOT NULL,
  duration_min INT NOT NULL DEFAULT 60,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Доступность коуча
CREATE TABLE platform.coach_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  slot_duration_min INT DEFAULT 60,
  is_active BOOLEAN DEFAULT TRUE
);

-- Сессии
CREATE TABLE platform.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES platform.coach_services(id),
  coach_id UUID REFERENCES auth.users(id),
  client_id UUID REFERENCES auth.users(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_min INT NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'pending',
  -- status: pending | confirmed | in_progress | completed | cancelled | no_show
  livekit_room_name TEXT,
  payment_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Заметки к сессиям (шаблоны GROW/STAR/SOAP/OSCAR)
CREATE TABLE platform.session_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES platform.sessions(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES auth.users(id),
  template_type TEXT DEFAULT 'free_form',
  content JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Шаблоны заметок (50+ предустановленных)
CREATE TABLE platform.session_note_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  template_type TEXT NOT NULL,
  fields JSONB NOT NULL,    -- [{ key: "goal", label: "Цель", type: "textarea" }, ...]
  created_by UUID REFERENCES auth.users(id),
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Отзывы
CREATE TABLE platform.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES platform.sessions(id),
  client_id UUID REFERENCES auth.users(id),
  coach_id UUID REFERENCES auth.users(id),
  rating INT CHECK (rating BETWEEN 1 AND 5),
  text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Агрегированный рейтинг коуча
CREATE TABLE platform.coach_ratings (
  coach_id UUID PRIMARY KEY REFERENCES auth.users(id),
  avg_rating NUMERIC(3,2) DEFAULT 0,
  total_reviews INT DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Верификация коучей
CREATE TABLE platform.verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,   -- diploma, certificate, license
  file_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  reviewer_id UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teleconsent (согласие на запись)
CREATE TABLE platform.teleconsent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES platform.sessions(id),
  user_id UUID REFERENCES auth.users(id),
  consent_type TEXT NOT NULL,
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET
);

-- Пакеты сессий (абонементы)
CREATE TABLE platform.session_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id),
  service_id UUID REFERENCES platform.coach_services(id),
  sessions_total INT NOT NULL,
  sessions_used INT DEFAULT 0,
  price_total NUMERIC(10,2) NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS на все таблицы
ALTER TABLE platform.coach_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.session_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.teleconsent ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.session_packages ENABLE ROW LEVEL SECURITY;

-- Индексы
CREATE INDEX idx_sessions_coach ON platform.sessions(coach_id);
CREATE INDEX idx_sessions_client ON platform.sessions(client_id);
CREATE INDEX idx_sessions_scheduled ON platform.sessions(scheduled_at);
CREATE INDEX idx_services_coach ON platform.coach_services(coach_id);
CREATE INDEX idx_reviews_coach ON platform.reviews(coach_id);
```

#### На что обратить внимание
- Каждая таблица должна иметь RLS — без этого Supabase не будет фильтровать данные.
- Индексы на часто фильтруемые колонки (coach_id, client_id, scheduled_at) — без них запросы будут медленными.
- JSONB для гибких структур (content заметок, fields шаблонов) — позволяет менять структуру без миграций.

---

### Шаг 1.2 — Профиль и каталог коучей (6 дней)

#### Что делать
Создать публичные профили коучей и каталог с поиском и фильтрами.

#### Ключевые компоненты

1. **Публичный профиль коуча** (`/coach/ivan-petrov`):
   - Фото, имя, специализация, сертификации
   - Рейтинг и отзывы
   - Стоимость сессий
   - Кнопка «Забронировать»
   - SEO-friendly URL (slug из имени)

2. **Каталог коучей** (`/coaches`):
   - Полнотекстовый поиск (PostgreSQL `to_tsvector` / `to_tsquery`)
   - Фильтры: специализация, цена (от–до), рейтинг, язык, формат (онлайн/оффлайн)
   - Пагинация
   - Карточки коучей с кратким описанием

3. **Верификация коучей**:
   - Загрузка документов (дипломы, сертификаты) в MinIO
   - Админ просматривает → одобряет/отклоняет
   - Верифицированный бейдж на профиле

#### Пример полнотекстового поиска

```sql
-- Добавить tsvector колонку для поиска
ALTER TABLE public.profiles ADD COLUMN search_vector TSVECTOR;

-- Обновлять при изменении данных
CREATE OR REPLACE FUNCTION profiles_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('russian',
    coalesce(NEW.first_name, '') || ' ' ||
    coalesce(NEW.last_name, '') || ' ' ||
    coalesce(NEW.bio, '') || ' ' ||
    coalesce(array_to_string(NEW.specializations, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_search_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_search_update();

CREATE INDEX idx_profiles_search ON public.profiles USING GIN(search_vector);
```

```tsx
// Поиск с фронтенда
const { data } = await supabase
  .from('profiles')
  .select('*, coach_ratings(*)')
  .textSearch('search_vector', 'коучинг карьера')
  .gte('coach_ratings.avg_rating', 4.0)
  .order('coach_ratings.avg_rating', { ascending: false })
  .range(0, 19); // первые 20 результатов
```

---

### Шаг 1.3 — Расписание и бронирование (7.5 дней)

#### Что делать
Реализовать: настройку расписания коуча, бронирование слотов клиентом, календари коуча и клиента.

#### Ключевые компоненты

1. **Расписание коуча** — настройка доступности:
   - Рабочие дни и часы
   - Длительность слотов (30/45/60/90 мин)
   - Исключения (отпуск, праздники)
   - Поддержка часовых поясов

2. **Бронирование сессии** — полный flow:
   - Клиент выбирает дату → видит свободные слоты → выбирает слот → оплачивает → сессия создана
   - Email-уведомления обеим сторонам

3. **Календари** (react-big-calendar):
   - Календарь коуча: все сессии + свободные слоты
   - Календарь клиента: предстоящие и прошлые сессии
   - Вид: день/неделя/месяц
   - Экспорт в iCal (.ics)

4. **Подбор коуча (Matching)**:
   - Анкета клиента (запрос, предпочтения)
   - Алгоритм ранжирования: совпадение специализации × рейтинг × доступность

#### Библиотеки

```bash
npm install react-big-calendar date-fns ical-generator
```

#### Пример генерации свободных слотов

```ts
// services/api-gateway/src/routes/slots.ts
function getAvailableSlots(coachId: string, date: Date) {
  // 1. Получить расписание коуча из coach_availability
  // 2. Получить уже забронированные сессии на эту дату
  // 3. Вычислить свободные слоты = расписание − занятые
  // 4. Учесть часовой пояс клиента

  const availability = await getCoachAvailability(coachId, date);
  const booked = await getBookedSessions(coachId, date);

  return availability.filter(slot =>
    !booked.some(session =>
      isOverlapping(slot.start, slot.end, session.scheduled_at, session.end_at)
    )
  );
}
```

---

### Шаг 1.4 — Видеосессии (LiveKit) (9.5 дней)

#### Что делать
Реализовать видеокомнату для проведения сессий коуч↔клиент.

#### Ключевые компоненты

1. **Видеокомната** (LiveKit React SDK):
   - Камера + микрофон
   - Демонстрация экрана
   - Чат внутри сессии (Data Channel)
   - Адаптивная сетка (1:1 или 1:many)

2. **Teleconsent** (согласие на запись):
   - Модальное окно перед сессией
   - Обе стороны нажимают «Согласен»
   - Без согласия — запись невозможна (заглушка для будущего)

3. **Заметки во время сессии**:
   - Панель справа от видео
   - 50+ предустановленных шаблонов (GROW, STAR, SOAP, OSCAR, free form)
   - Автосохранение

4. **Таймер сессии**:
   - Обратный отсчёт от длительности сессии
   - Уведомление за 5 минут до конца

#### Установка библиотек

```bash
npm install @livekit/components-react livekit-client
```

#### Генерация токена (на сервере)

```ts
// services/api-gateway/src/routes/livekit.ts
import { AccessToken } from 'livekit-server-sdk';

app.post('/api/livekit/token', async (req, reply) => {
  const { sessionId, userId, userName } = req.body;

  // Проверить, что пользователь — участник сессии
  const session = await getSession(sessionId);
  if (session.coach_id !== userId && session.client_id !== userId) {
    return reply.status(403).send({ error: 'Forbidden' });
  }

  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    { identity: userId, name: userName }
  );

  token.addGrant({
    room: `session_${sessionId}`,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  return { token: await token.toJwt() };
});
```

#### Компонент видеокомнаты

```tsx
// apps/platform/src/modules/video/VideoRoom.tsx
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';

export function VideoRoom({ token, sessionId }: Props) {
  return (
    <LiveKitRoom
      serverUrl={import.meta.env.VITE_LIVEKIT_URL}  // wss://livekit.score-coaching.ru (VPS #2)
      token={token}
      connect={true}
    >
      <div className="flex h-screen">
        {/* Видео-область */}
        <div className="flex-1">
          <VideoConference />
        </div>

        {/* Панель заметок */}
        <div className="w-96 border-l">
          <SessionNotes sessionId={sessionId} />
        </div>
      </div>
    </LiveKitRoom>
  );
}
```

---

### Шаг 1.5 — Мессенджер (9 дней)

#### Что делать
Реализовать чат: direct-сообщения между коучем и клиентом, групповые чаты, файлы, push-уведомления.

#### Ключевые компоненты

1. **Схема БД чата** (chat.channels, chat.messages, chat.channel_members)
2. **UI чата**: список диалогов, окно сообщений, ввод текста
3. **Realtime через Supabase**: подписка на новые сообщения
4. **Файлы в чате**: загрузка изображений и файлов через MinIO
5. **Push-уведомления**: Service Worker + Web Push API

#### SQL-миграция: схема чата

```sql
-- Миграция: 010_chat_schema.sql
CREATE SCHEMA IF NOT EXISTS chat;

-- Каналы (диалоги и группы)
CREATE TABLE chat.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('direct', 'group', 'course_group', 'session')),
  name TEXT,                              -- NULL для direct-чатов
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Участники каналов
CREATE TABLE chat.channel_members (
  channel_id UUID REFERENCES chat.channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  role TEXT DEFAULT 'member',             -- member | admin
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (channel_id, user_id)
);

-- Сообщения
CREATE TABLE chat.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat.channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  encrypted_content TEXT NOT NULL,        -- Зашифрованный текст сообщения
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'audio', 'video', 'file')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ключи шифрования (для будущего E2E)
CREATE TABLE chat.encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES chat.channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  public_key TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL
);

-- Индексы для быстрого поиска сообщений
CREATE INDEX idx_messages_channel ON chat.messages(channel_id, created_at DESC);
CREATE INDEX idx_channel_members_user ON chat.channel_members(user_id);

-- RLS: пользователь видит только свои каналы
ALTER TABLE chat.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see messages in their channels" ON chat.messages
  FOR SELECT USING (
    channel_id IN (SELECT channel_id FROM chat.channel_members WHERE user_id = auth.uid())
  );

ALTER TABLE chat.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their channels" ON chat.channels
  FOR SELECT USING (
    id IN (SELECT channel_id FROM chat.channel_members WHERE user_id = auth.uid())
  );
```

#### Realtime-подписка на сообщения

```tsx
// Подписка на новые сообщения в канале
useEffect(() => {
  const channel = supabase
    .channel(`chat:${channelId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'chat',
      table: 'messages',
      filter: `channel_id=eq.${channelId}`,
    }, (payload) => {
      setMessages(prev => [...prev, payload.new]);
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [channelId]);
```

---

### Шаг 1.6 — Документооборот (4 дня)

#### Что делать
Реализовать intake-формы, информированное согласие и контракты.

#### Ключевые компоненты

1. **Intake-формы**: конструктор форм (JSONB), заполнение при регистрации и перед сессиями
2. **Информированное согласие и контракт**: шаблоны документов, цифровая подпись (checkbox + дата + IP)

#### Конструктор intake-форм (React-компонент)

```tsx
// apps/platform/src/components/IntakeFormBuilder.tsx
// Конструктор форм — коуч создаёт форму из блоков

import { useState } from 'react';
import { Button } from '@/packages/ui';
import { supabase } from '@/packages/supabase';

// Типы полей формы
type FieldType = 'text' | 'textarea' | 'select' | 'checkbox' | 'date' | 'scale';

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  options?: string[];        // Для select
  min?: number; max?: number; // Для scale
}

interface IntakeFormBuilderProps {
  coachId: string;
  onSave: (formId: string) => void;
}

export function IntakeFormBuilder({ coachId, onSave }: IntakeFormBuilderProps) {
  const [title, setTitle] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);

  const addField = (type: FieldType) => {
    setFields(prev => [...prev, {
      id: crypto.randomUUID(),
      type,
      label: '',
      required: false,
    }]);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
  };

  const saveForm = async () => {
    const { data, error } = await supabase
      .from('intake_forms')
      .insert({
        coach_id: coachId,
        title,
        schema: fields,  // JSONB — вся структура формы
        is_active: true,
      })
      .select('id')
      .single();

    if (!error && data) onSave(data.id);
  };

  return (
    <div className="space-y-4">
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Название формы (напр. «Первичная анкета»)"
        className="w-full border rounded px-3 py-2"
      />

      {fields.map(field => (
        <div key={field.id} className="border rounded p-3 space-y-2">
          <input
            value={field.label}
            onChange={e => updateField(field.id, { label: e.target.value })}
            placeholder="Текст вопроса"
            className="w-full border-b px-2 py-1"
          />
          <div className="flex gap-2 text-sm">
            <span>Тип: {field.type}</span>
            <label>
              <input
                type="checkbox"
                checked={field.required}
                onChange={e => updateField(field.id, { required: e.target.checked })}
              /> Обязательное
            </label>
            <button onClick={() => removeField(field.id)} className="text-red-500 ml-auto">
              Удалить
            </button>
          </div>
        </div>
      ))}

      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={() => addField('text')}>+ Текст</Button>
        <Button variant="outline" onClick={() => addField('textarea')}>+ Длинный текст</Button>
        <Button variant="outline" onClick={() => addField('select')}>+ Выбор</Button>
        <Button variant="outline" onClick={() => addField('checkbox')}>+ Чекбокс</Button>
        <Button variant="outline" onClick={() => addField('date')}>+ Дата</Button>
        <Button variant="outline" onClick={() => addField('scale')}>+ Шкала</Button>
      </div>

      <Button onClick={saveForm} disabled={!title || fields.length === 0}>
        Сохранить форму
      </Button>
    </div>
  );
}
```

#### Цифровая подпись согласия

```tsx
// apps/platform/src/components/ConsentForm.tsx
export function ConsentForm({ documentId, onSign }: { documentId: string; onSign: () => void }) {
  const [agreed, setAgreed] = useState(false);

  const signDocument = async () => {
    // Записываем факт подписания с IP и датой
    await supabase.from('document_signatures').insert({
      document_id: documentId,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      signed_at: new Date().toISOString(),
      ip_address: await fetch('https://api.ipify.org?format=json').then(r => r.json()).then(d => d.ip),
      user_agent: navigator.userAgent,
    });
    onSign();
  };

  return (
    <div className="space-y-4">
      {/* Текст документа загружается по documentId */}
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-1" />
        <span>Я прочитал(а) и принимаю условия данного документа</span>
      </label>
      <Button onClick={signDocument} disabled={!agreed}>Подписать</Button>
    </div>
  );
}
```

---

### Шаг 1.7 — Оплата (ЮKassa) (9.5 дней)

#### Что делать
Подключить приём платежей: банковские карты, SBP, YooMoney. Фискализация по 54-ФЗ. Абонементы (пакеты сессий).

#### SQL-миграция: схема оплат

```sql
-- Миграция: 011_billing_schema.sql
CREATE SCHEMA IF NOT EXISTS billing;

-- Тарифные планы платформы
CREATE TABLE billing.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                     -- Базовый / Профи / Мастер
  level TEXT NOT NULL,                    -- basic | professional | master
  price NUMERIC(10,2) NOT NULL,           -- Цена в рублях
  billing_period TEXT DEFAULT 'monthly',  -- monthly | yearly
  features JSONB DEFAULT '{}',            -- {"max_sessions": 10, "video_recording": true}
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Подписки пользователей
CREATE TABLE billing.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  plan_id UUID NOT NULL REFERENCES billing.plans(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Все платежи (от ЮKassa и будущих провайдеров)
CREATE TABLE billing.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'RUB',
  provider TEXT DEFAULT 'yookassa',       -- yookassa | manual | free
  provider_tx_id TEXT,                    -- ID транзакции в ЮKassa
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'canceled', 'refunded')),
  metadata JSONB DEFAULT '{}',            -- {"session_id": "...", "type": "session_payment"}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Счета (для будущей бухгалтерии)
CREATE TABLE billing.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  items JSONB NOT NULL,                   -- [{"description": "Сессия 60мин", "amount": 5000}]
  total NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_payments_user ON billing.payments(user_id, created_at DESC);
CREATE INDEX idx_payments_provider_tx ON billing.payments(provider_tx_id);
CREATE INDEX idx_subscriptions_user ON billing.subscriptions(user_id);

-- RLS: пользователь видит только свои платежи
ALTER TABLE billing.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own payments" ON billing.payments
  FOR SELECT USING (user_id = auth.uid());

ALTER TABLE billing.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own subscriptions" ON billing.subscriptions
  FOR SELECT USING (user_id = auth.uid());
```

#### Конкретные действия

1. **Зарегистрироваться на ЮKassa** (yookassa.ru):
   - Подать заявку на подключение
   - Получить `shopId` и `secretKey`
   - Настроить webhook URL: `https://api.score-coaching.ru/api/payments/webhook`

2. **Установить SDK:**

```bash
cd services/api-gateway
npm install @yookassa/sdk
```

3. **Создать платёж:**

```ts
// services/api-gateway/src/routes/payments.ts
import { YooCheckout } from '@yookassa/sdk';

const checkout = new YooCheckout({
  shopId: process.env.YOOKASSA_SHOP_ID!,
  secretKey: process.env.YOOKASSA_SECRET_KEY!,
});

app.post('/api/payments/create', async (req, reply) => {
  const { sessionId, amount, description, email } = req.body;

  const payment = await checkout.createPayment({
    amount: { value: amount.toFixed(2), currency: 'RUB' },
    capture: true,
    confirmation: {
      type: 'redirect',
      return_url: `https://score-coaching.ru/dashboard/sessions/${sessionId}?paid=true`,
    },
    description,
    receipt: {
      customer: { email },
      items: [{
        description,
        quantity: '1',
        amount: { value: amount.toFixed(2), currency: 'RUB' },
        vat_code: 1,  // без НДС (для ИП на УСН)
      }],
    },
    metadata: { session_id: sessionId },
  });

  return { confirmation_url: payment.confirmation.confirmation_url };
});
```

4. **Обработать webhook (подтверждение оплаты):**

```ts
app.post('/api/payments/webhook', async (req, reply) => {
  const event = req.body;

  if (event.event === 'payment.succeeded') {
    const payment = event.object;
    const sessionId = payment.metadata.session_id;

    // Обновить статус сессии
    await supabase
      .from('sessions')
      .update({ status: 'confirmed', payment_id: payment.id })
      .eq('id', sessionId);

    // Отправить уведомления обеим сторонам
    await emailQueue.add('payment-success', { sessionId });
  }

  return { status: 'ok' };
});
```

5. **Абонементы (пакеты сессий):**
   - Пакеты: 5 сессий (−10%), 10 сессий (−15%), 20 сессий (−20%)
   - При бронировании — списание из пакета вместо обычной оплаты

#### 54-ФЗ: онлайн-касса
ЮKassa умеет отправлять фискальные чеки автоматически. Нужно передать `receipt` в запросе на создание платежа (уже в примере выше). Это обязательно по закону для приёма платежей от физлиц.

---

### Шаг 1.8 — Контент и библиотека (5.5 дней)

#### Что делать
Создать библиотеку платформы (книги, видео, протоколы, техники) и диагностические тесты.

#### Ключевые компоненты

1. **Библиотека платформы**: каталог с фильтрами (тип, категория, уровень доступа), предпросмотр и скачивание
2. **Диагностические тесты**: конструктор (вопросы + scoring JSONB), прохождение клиентами, результаты и интерпретация

#### SQL-миграция: схема контента

```sql
-- Миграция: 012_content_schema.sql
CREATE SCHEMA IF NOT EXISTS content;

-- Библиотека: книги, видео, протоколы, техники
CREATE TABLE content.library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenant.schools(id),  -- NULL = контент платформы, NOT NULL = контент школы
  title TEXT NOT NULL,
  author TEXT,
  type TEXT NOT NULL CHECK (type IN ('book', 'video', 'audio', 'protocol', 'technique', 'journal', 'presentation', 'document')),
  category TEXT,                          -- Категория для фильтрации
  file_url TEXT,                          -- URL файла в MinIO
  preview_url TEXT,                       -- Превью / обложка
  access_level TEXT DEFAULT 'free' CHECK (access_level IN ('free', 'member', 'student', 'professional', 'master')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Блог-посты
CREATE TABLE content.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content TEXT,                           -- Markdown или HTML
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  level TEXT DEFAULT 'platform' CHECK (level IN ('association', 'academy', 'platform')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Диагностические тесты
CREATE TABLE content.diagnostics_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,                          -- Тип теста (личностный, профессиональный и т.д.)
  questions JSONB NOT NULL,               -- [{"q": "Вопрос", "type": "scale", "options": [...]}]
  scoring JSONB NOT NULL,                 -- {"ranges": [{"min": 0, "max": 30, "label": "Низкий"}]}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Результаты тестов
CREATE TABLE content.test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES content.diagnostics_tests(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  answers JSONB NOT NULL,
  score NUMERIC(5,2),
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Флэш-карточки (для учебных материалов)
CREATE TABLE content.flashcard_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  cards JSONB NOT NULL,                   -- [{"front": "Термин", "back": "Определение"}]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Презентации
CREATE TABLE content.presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  shared_with UUID[] DEFAULT '{}',        -- Массив user_id
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Интерактивные доски (для сессий)
CREATE TABLE content.whiteboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  data JSONB DEFAULT '{}',                -- Данные доски (фигуры, текст, связи)
  shared_with UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_library_items_type ON content.library_items(type, access_level);
CREATE INDEX idx_library_items_tenant ON content.library_items(tenant_id);
CREATE INDEX idx_test_results_user ON content.test_results(user_id);

-- RLS
ALTER TABLE content.library_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public items visible to all" ON content.library_items
  FOR SELECT USING (access_level = 'free' OR tenant_id IS NULL);

ALTER TABLE content.test_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own results" ON content.test_results
  FOR SELECT USING (user_id = auth.uid());
```

#### Компонент: каталог библиотеки

```tsx
// apps/platform/src/pages/Library.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/packages/supabase';

const ITEM_TYPES = ['all', 'book', 'video', 'audio', 'protocol', 'technique'] as const;
const ACCESS_LEVELS = ['all', 'free', 'member', 'student', 'professional'] as const;

export default function LibraryPage() {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [accessFilter, setAccessFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['library', typeFilter, accessFilter, search],
    queryFn: async () => {
      let query = supabase
        .from('content.library_items')
        .select('*')
        .is('tenant_id', null)  // Только контент платформы
        .order('created_at', { ascending: false });

      if (typeFilter !== 'all') query = query.eq('type', typeFilter);
      if (accessFilter !== 'all') query = query.eq('access_level', accessFilter);
      if (search) query = query.ilike('title', `%${search}%`);

      const { data } = await query;
      return data ?? [];
    },
  });

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Библиотека</h1>

      {/* Фильтры */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по названию..."
          className="border rounded px-3 py-2 flex-1 min-w-[200px]"
        />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border rounded px-3 py-2">
          {ITEM_TYPES.map(t => <option key={t} value={t}>{t === 'all' ? 'Все типы' : t}</option>)}
        </select>
        <select value={accessFilter} onChange={e => setAccessFilter(e.target.value)} className="border rounded px-3 py-2">
          {ACCESS_LEVELS.map(l => <option key={l} value={l}>{l === 'all' ? 'Все уровни' : l}</option>)}
        </select>
      </div>

      {/* Сетка карточек */}
      {isLoading ? (
        <p>Загрузка...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <div key={item.id} className="border rounded-lg p-4 hover:shadow-md transition">
              {item.preview_url && (
                <img src={item.preview_url} alt={item.title} className="w-full h-40 object-cover rounded mb-3" />
              )}
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{item.type}</span>
              <h3 className="font-semibold mt-2">{item.title}</h3>
              {item.author && <p className="text-sm text-gray-500">{item.author}</p>}
              <div className="mt-3 flex justify-between items-center">
                <span className="text-xs text-gray-400">{item.access_level}</span>
                <a href={item.file_url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm hover:underline">
                  Открыть →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### Компонент: прохождение диагностического теста

```tsx
// apps/platform/src/components/DiagnosticTest.tsx
import { useState } from 'react';
import { supabase } from '@/packages/supabase';
import { Button } from '@/packages/ui';

interface Question {
  q: string;
  type: 'scale' | 'single' | 'multi';
  options?: string[];
  min?: number;
  max?: number;
}

export function DiagnosticTest({ testId, questions, scoring }: {
  testId: string;
  questions: Question[];
  scoring: { ranges: { min: number; max: number; label: string; description: string }[] };
}) {
  const [answers, setAnswers] = useState<Record<number, number | string>>({});
  const [result, setResult] = useState<{ score: number; label: string; description: string } | null>(null);

  const submitTest = async () => {
    // Подсчёт баллов (для шкальных вопросов)
    const totalScore = Object.values(answers).reduce((sum: number, v) => sum + (typeof v === 'number' ? v : 0), 0);
    const range = scoring.ranges.find(r => totalScore >= r.min && totalScore <= r.max);

    // Сохраняем результат в БД
    const userId = (await supabase.auth.getUser()).data.user?.id;
    await supabase.from('content.test_results').insert({
      test_id: testId,
      user_id: userId,
      answers,
      score: totalScore,
    });

    setResult({ score: totalScore, label: range?.label ?? '', description: range?.description ?? '' });
  };

  if (result) {
    return (
      <div className="text-center p-8 border rounded-lg">
        <h2 className="text-xl font-bold">Ваш результат: {result.score} баллов</h2>
        <p className="text-lg mt-2 text-blue-600">{result.label}</p>
        <p className="mt-4 text-gray-600">{result.description}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {questions.map((q, idx) => (
        <div key={idx} className="border rounded p-4">
          <p className="font-medium mb-3">{idx + 1}. {q.q}</p>
          {q.type === 'scale' && (
            <input
              type="range"
              min={q.min ?? 1}
              max={q.max ?? 10}
              value={answers[idx] as number ?? 5}
              onChange={e => setAnswers(prev => ({ ...prev, [idx]: Number(e.target.value) }))}
              className="w-full"
            />
          )}
          {q.type === 'single' && q.options?.map((opt, oi) => (
            <label key={oi} className="block">
              <input
                type="radio"
                name={`q-${idx}`}
                onChange={() => setAnswers(prev => ({ ...prev, [idx]: oi }))}
              /> {opt}
            </label>
          ))}
        </div>
      ))}
      <Button onClick={submitTest} disabled={Object.keys(answers).length < questions.length}>
        Завершить тест
      </Button>
    </div>
  );
}
```

---

### Шаг 1.9 — Личные кабинеты (12 дней)

#### Что делать
Создать полные кабинеты для всех ролей.

#### Кабинет коуча (4 дня)
- Мои услуги (CRUD)
- Расписание и календарь
- Список клиентов
- Сессии (предстоящие + прошлые)
- Заметки к сессиям
- Финансы (заработок, история оплат)
- Статистика (рейтинг, количество отзывов)
- Профиль

#### Кабинет клиента (3 дня)
- Мои коучи
- Предстоящие и прошлые сессии
- Intake-формы
- Документы (согласия, контракты)
- Абонементы
- История оплат
- Избранные коучи

#### Профиль пользователя (2 дня)
- Загрузка и кроп аватара
- Редактирование ФИО, контактов
- Смена пароля
- Привязка/отвязка VK/MAX

#### Админ-панель платформы (3 дня)
- Все пользователи (поиск, фильтры)
- Верификация коучей (очередь документов)
- Модерация контента
- Финансы (общая статистика)
- Инциденты и жалобы
- Настройки платформы

#### Пример: Dashboard-страница коуча

```tsx
// apps/platform/src/pages/coach/Dashboard.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/packages/supabase';
import { useAuth } from '@/hooks/useAuth';

export default function CoachDashboard() {
  const { user } = useAuth();

  // Загружаем статистику коуча одним запросом
  const { data: stats } = useQuery({
    queryKey: ['coach-stats', user?.id],
    queryFn: async () => {
      const [sessions, clients, earnings] = await Promise.all([
        // Предстоящие сессии
        supabase.from('sessions')
          .select('id, scheduled_at, client:users!client_id(full_name)', { count: 'exact' })
          .eq('coach_id', user!.id)
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at')
          .limit(5),
        // Уникальные клиенты
        supabase.from('sessions')
          .select('client_id')
          .eq('coach_id', user!.id)
          .then(r => new Set(r.data?.map(s => s.client_id)).size),
        // Заработок за текущий месяц
        supabase.from('billing.payments')
          .select('amount')
          .eq('status', 'succeeded')
          .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
          .then(r => r.data?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0),
      ]);

      return {
        upcomingSessions: sessions.data ?? [],
        totalSessions: sessions.count ?? 0,
        totalClients: clients,
        monthlyEarnings: earnings,
      };
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Добро пожаловать, {user?.user_metadata?.full_name}</h1>

      {/* Карточки со статистикой */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Предстоящие сессии" value={stats?.totalSessions ?? 0} />
        <StatCard title="Всего клиентов" value={stats?.totalClients ?? 0} />
        <StatCard title="Заработок (мес.)" value={`${stats?.monthlyEarnings?.toLocaleString()} ₽`} />
      </div>

      {/* Ближайшие сессии */}
      <div className="border rounded-lg p-4">
        <h2 className="font-semibold mb-3">Ближайшие сессии</h2>
        {stats?.upcomingSessions.length === 0 ? (
          <p className="text-gray-500">Нет запланированных сессий</p>
        ) : (
          <ul className="space-y-2">
            {stats?.upcomingSessions.map(s => (
              <li key={s.id} className="flex justify-between items-center border-b pb-2">
                <span>{s.client?.full_name}</span>
                <span className="text-sm text-gray-500">
                  {new Date(s.scheduled_at).toLocaleString('ru-RU')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
```

#### Пример: Dashboard-страница клиента

```tsx
// apps/platform/src/pages/client/Dashboard.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/packages/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';

export default function ClientDashboard() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['client-dashboard', user?.id],
    queryFn: async () => {
      const [upcoming, coaches, forms] = await Promise.all([
        supabase.from('sessions')
          .select('id, scheduled_at, coach:users!coach_id(full_name, avatar_url)')
          .eq('client_id', user!.id)
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at')
          .limit(3),
        supabase.from('sessions')
          .select('coach_id, coach:users!coach_id(full_name, avatar_url)')
          .eq('client_id', user!.id),
        supabase.from('intake_form_responses')
          .select('id, form:intake_forms(title)', { count: 'exact' })
          .eq('user_id', user!.id)
          .eq('status', 'pending'),
      ]);

      return {
        upcomingSessions: upcoming.data ?? [],
        myCoaches: [...new Map((coaches.data ?? []).map(c => [c.coach_id, c.coach])).values()],
        pendingForms: forms.count ?? 0,
      };
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Личный кабинет</h1>

      {/* Уведомление о незаполненных формах */}
      {(data?.pendingForms ?? 0) > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <p>У вас {data?.pendingForms} незаполненных анкет. <Link to="/forms" className="text-blue-600 underline">Заполнить →</Link></p>
        </div>
      )}

      {/* Ближайшие сессии */}
      <div className="border rounded-lg p-4">
        <h2 className="font-semibold mb-3">Ближайшие сессии</h2>
        {data?.upcomingSessions.map(s => (
          <div key={s.id} className="flex items-center gap-3 border-b py-2">
            <img src={s.coach?.avatar_url} className="w-8 h-8 rounded-full" alt="" />
            <span>{s.coach?.full_name}</span>
            <span className="ml-auto text-sm text-gray-500">
              {new Date(s.scheduled_at).toLocaleString('ru-RU')}
            </span>
          </div>
        ))}
        {data?.upcomingSessions.length === 0 && (
          <p className="text-gray-500">Нет запланированных сессий. <Link to="/catalog" className="text-blue-600">Найти коуча →</Link></p>
        )}
      </div>

      {/* Мои коучи */}
      <div className="border rounded-lg p-4">
        <h2 className="font-semibold mb-3">Мои коучи</h2>
        <div className="flex gap-4">
          {data?.myCoaches.map((c: any, i: number) => (
            <div key={i} className="text-center">
              <img src={c.avatar_url} className="w-12 h-12 rounded-full mx-auto" alt="" />
              <p className="text-sm mt-1">{c.full_name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

### Шаг 1.10 — Лендинг и тестирование (10–12 дней)

#### Что делать

1. **Лендинг платформы** (2 дня):
   - Для коучей: «Продавайте свои услуги»
   - Для клиентов: «Найдите своего коуча»
   - SEO-метатеги, Open Graph превью

2. **E2E тестирование** (3 дня):
   - Установить Playwright: `npm install -D @playwright/test`
   - Написать минимум 15 сценариев: регистрация → логин → поиск коуча → бронирование → оплата (тестовая) → видеосессия → заметки → отзыв → чат

3. **Нагрузочное тестирование** (2 дня):
   - Установить k6: `brew install k6` или Docker
   - Тест: 100 одновременных пользователей, типичные операции (поиск, бронирование, чат)
   - Убедиться, что время ответа < 500ms при 300 пользователях

4. **Онбординг пилотных коучей** (2 дня):
   - 5–10 тестовых профилей
   - Провести тестовые сессии
   - Собрать обратную связь

5. **Багфикс** (3 дня):
   - Буфер на исправление найденных ошибок

---

### ✅ Итог Фазы 1

Полнофункциональный маркетплейс коучей:
- Каталог с поиском, фильтрами и matching
- Бронирование + оплата (ЮKassa, абонементы, 54-ФЗ)
- Видеосессии (LiveKit) с teleconsent, заметками (50+ шаблонов), таймером, демонстрацией экрана
- Календари коуча и клиента (день/неделя/месяц + iCal)
- Мессенджер (direct + группы + файлы + push)
- Документооборот (intake, согласия, контракты)
- Библиотека и диагностические тесты
- Полные кабинеты + админ-панель

**Можно запускать score-coaching.ru и начинать монетизацию.**

---

## ФАЗА 2 — MVP Академии (~55–65 дней)

> SaaS-платформа для онлайн-школ. Мультитенантная. Каждая школа на своём поддомене с базовым брендингом, LMS и оплатой.

---

### Шаг 2.1 — Мультитенантная инфраструктура (12.5 дней)

> Это самый технически сложный блок во всём проекте. Ошибка здесь = утечка данных школы. Будьте предельно внимательны.

#### Что делать
Реализовать изоляцию данных между школами: каждая школа видит только свои данные.

#### Ключевые компоненты

1. **Схема БД tenant** (3 дня):

```sql
-- Миграция: 003_tenant_schema.sql

CREATE TABLE tenant.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id),
  slug TEXT UNIQUE NOT NULL,  -- Поддомен: my-school.academy-coaching.ru
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',  -- draft | active | suspended | archived
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tenant.school_settings (
  school_id UUID PRIMARY KEY REFERENCES tenant.schools(id),
  theme JSONB DEFAULT '{"colors": {"primary": "#2563EB"}, "font_family": "Inter", "border_radius": "8px"}',
  features JSONB DEFAULT '{"gameboard": false, "video_sessions": true, "chat": true, "crm": false, "blog": false, "certificates": true, "library": true}',
  limits JSONB DEFAULT '{"max_courses": 1, "max_students": 50, "max_storage_mb": 5120, "max_team_members": 3}',
  email_branding JSONB DEFAULT '{}',      -- {sender_name, reply_to, header_html, footer_html}
  socials JSONB DEFAULT '{}',             -- {vk, telegram, youtube, instagram, website}
  custom_css TEXT DEFAULT '',
  meta_tags JSONB DEFAULT '{}',           -- {title, description, og_image}
  analytics_code TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Домены школ (поддомены + кастомные)
CREATE TABLE tenant.school_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES tenant.schools(id),
  domain TEXT NOT NULL UNIQUE,            -- my-school.academy-coaching.ru или custom.com
  type TEXT DEFAULT 'subdomain' CHECK (type IN ('subdomain', 'custom')),
  status TEXT DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'active', 'failed')),
  ssl_status TEXT DEFAULT 'pending' CHECK (ssl_status IN ('pending', 'active', 'expired')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Тарифные планы для школ
CREATE TABLE tenant.school_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                     -- Старт / Рост / Про
  price_monthly NUMERIC(10,2) NOT NULL,
  price_yearly NUMERIC(10,2),
  limits JSONB NOT NULL,                  -- {max_courses, max_students, max_storage_mb}
  commission_pct NUMERIC(4,2) DEFAULT 5,  -- Комиссия платформы с продаж школы
  features JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE
);

-- Подписки школ на планы
CREATE TABLE tenant.school_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES tenant.schools(id),
  plan_id UUID NOT NULL REFERENCES tenant.school_plans(id),
  status TEXT DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_ends_at TIMESTAMPTZ
);

-- Команда школы (роли и права)
CREATE TABLE tenant.school_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES tenant.schools(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'instructor', 'curator', 'manager', 'support')),
  permissions JSONB DEFAULT '{"manage_courses": false, "manage_students": false, "manage_payments": false, "manage_settings": false, "manage_team": false, "view_analytics": true}',
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(school_id, user_id)
);

-- Страницы школы (лендинг, about, contacts и т.д.)
CREATE TABLE tenant.school_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES tenant.schools(id),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  content JSONB DEFAULT '[]',             -- Блоки контента: [{type: "hero", data: {...}}, ...]
  type TEXT DEFAULT 'custom' CHECK (type IN ('home', 'about', 'contacts', 'faq', 'custom', 'terms', 'privacy')),
  is_published BOOLEAN DEFAULT FALSE,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, slug)
);

-- Промо-коды школы
CREATE TABLE tenant.school_promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES tenant.schools(id),
  code TEXT NOT NULL,
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value NUMERIC(10,2) NOT NULL,
  max_uses INT,
  used_count INT DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  applicable_to JSONB DEFAULT '{"all_courses": true}',  -- {course_ids: [...]} или {all_courses: true}
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(school_id, code)
);

-- Шаблоны сертификатов
CREATE TABLE tenant.school_certificates_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES tenant.schools(id),
  title TEXT NOT NULL,
  template_html TEXT NOT NULL,            -- HTML с переменными {{student_name}}, {{course_title}} и т.д.
  variables JSONB DEFAULT '["student_name", "course_title", "date", "certificate_number"]',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Аналитика школы (агрегированная по дням)
CREATE TABLE tenant.school_analytics_daily (
  school_id UUID NOT NULL REFERENCES tenant.schools(id),
  date DATE NOT NULL,
  new_students INT DEFAULT 0,
  active_students INT DEFAULT 0,
  revenue NUMERIC(10,2) DEFAULT 0,
  enrollments INT DEFAULT 0,
  completions INT DEFAULT 0,
  page_views INT DEFAULT 0,
  PRIMARY KEY (school_id, date)
);

-- Индексы
CREATE INDEX idx_school_domains_domain ON tenant.school_domains(domain);
CREATE INDEX idx_school_team_user ON tenant.school_team_members(user_id);
CREATE INDEX idx_school_pages_school ON tenant.school_pages(school_id, is_published);
```

2. **Функция current_tenant_id()** (1 день):

```sql
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
  SELECT COALESCE(
    (current_setting('app.current_tenant_id', true))::uuid,
    ((current_setting('request.jwt.claims', true)::json)->>'tenant_id')::uuid
  );
$$ LANGUAGE sql STABLE;
```

3. **RLS-политики для мультитенантности** (2 дня):

```sql
-- Каждая academy-таблица фильтруется по tenant_id
CREATE POLICY "Tenant isolation" ON academy.courses
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY "Tenant isolation" ON academy.enrollments
  FOR ALL USING (tenant_id = current_tenant_id());
-- ... для всех academy-таблиц
```

4. **Tenant Router Middleware** (Fastify) (3 дня):

```ts
// services/api-gateway/src/plugins/tenantRouter.ts
import { FastifyRequest } from 'fastify';
import IORedis from 'ioredis';

const redis = new IORedis(process.env.REDIS_URL!);

export async function tenantRouter(req: FastifyRequest) {
  const host = req.headers.host || '';

  // Извлечь slug из поддомена
  const match = host.match(/^([a-z0-9-]+)\.academy-coaching\.ru$/);
  if (!match) return; // Не школьный поддомен

  const slug = match[1];

  // Проверить кэш Redis
  const cached = await redis.get(`tenant:slug:${slug}`);
  if (cached) {
    req.tenantId = JSON.parse(cached).id;
    return;
  }

  // Запросить из БД
  const { data: school } = await supabase
    .from('schools')
    .select('id, name, status')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (!school) throw new Error('School not found');

  // Сохранить в кэш на 5 минут
  await redis.setex(`tenant:slug:${slug}`, 300, JSON.stringify(school));
  req.tenantId = school.id;
}
```

5. **JWT с tenant claims** (2 дня):
   - При логине на поддомене школы — добавить `tenant_id` и `school_role` в JWT
   - Supabase GoTrue custom claims или через Edge Function

6. **Изоляция файлового хранилища** (1 день):
   - Bucket-политика: `tenants/{tenant_id}/*`
   - Файлы школы A не видны школе B

7. **Rate limiting per tenant** (1 день):
   - Ограничение запросов на школу (защита от abuse)

#### КРИТИЧЕСКИ ВАЖНО ДЛЯ ТЕСТИРОВАНИЯ

Создайте две тестовые школы и проверьте:
- Школа A НЕ видит курсы/студентов школы B
- При SQL-инъекции данные не утекают (RLS работает)
- Файлы школы A недоступны из школы B
- Кэш в Redis корректно инвалидируется при изменении настроек

---

### Шаг 2.2 — Academy SPA + Wizard создания школы (8.5 дней)

#### Что делать

1. **Academy SPA** (academy-coaching.ru):
   - Лендинг: «Создайте свою онлайн-школу»
   - Каталог школ с фильтрами
   - Авторизация

2. **Wizard создания школы** (пошаговый):
   - Шаг 1: Название школы
   - Шаг 2: Slug (поддомен) — автогенерация из названия + проверка уникальности
   - Шаг 3: Описание
   - Шаг 4: Выбор пресета темы (3 варианта)
   - Шаг 5: Создание → redirect на school-admin

3. **Личный кабинет**: мои школы, быстрый переход в school-admin

---

### Шаг 2.3 — School SPA + Базовый бренд (7 дней)

#### Что делать

1. **TenantProvider + ThemeProvider**:
   - Определение школы по hostname
   - CSS-переменные: `--school-primary`, `--school-bg`, `--school-text`
   - Favicon и title из настроек школы

2. **School SPA** (для `*.academy-coaching.ru`):
   - Главная страница школы
   - Каталог курсов школы
   - Авторизация (в бренде школы)

3. **3 пресета тем**:
   - Минималист (белый/серый)
   - Корпоративный (синий/серый)
   - Тёплый (оранжевый/кремовый)

#### TenantProvider: определение школы по домену

```tsx
// apps/school/src/providers/TenantProvider.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/packages/supabase';

interface School {
  id: string;
  slug: string;
  name: string;
  status: string;
}

interface SchoolSettings {
  theme: {
    colors: { primary: string; bg?: string; text?: string };
    font_family?: string;
    border_radius?: string;
    logo_url?: string;
    favicon_url?: string;
  };
  features: Record<string, boolean>;
}

interface TenantContextType {
  school: School | null;
  settings: SchoolSettings | null;
  isLoading: boolean;
  error: string | null;
}

const TenantContext = createContext<TenantContextType>({
  school: null, settings: null, isLoading: true, error: null,
});

export const useTenant = () => useContext(TenantContext);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TenantContextType>({
    school: null, settings: null, isLoading: true, error: null,
  });

  useEffect(() => {
    const detectTenant = async () => {
      // Определяем slug школы из hostname
      // Примеры: my-school.academy-coaching.ru → slug = "my-school"
      const hostname = window.location.hostname;
      const slug = hostname.split('.')[0]; // Первая часть поддомена

      if (!slug || slug === 'academy-coaching' || slug === 'www') {
        setState(prev => ({ ...prev, isLoading: false, error: 'Школа не найдена' }));
        return;
      }

      // Загружаем данные школы из Supabase
      const { data: school, error: schoolErr } = await supabase
        .from('tenant.schools')
        .select('id, slug, name, status')
        .eq('slug', slug)
        .eq('status', 'active')
        .single();

      if (schoolErr || !school) {
        setState(prev => ({ ...prev, isLoading: false, error: 'Школа не найдена или неактивна' }));
        return;
      }

      // Загружаем настройки школы
      const { data: settings } = await supabase
        .from('tenant.school_settings')
        .select('theme, features')
        .eq('school_id', school.id)
        .single();

      setState({ school, settings, isLoading: false, error: null });
    };

    detectTenant();
  }, []);

  return (
    <TenantContext.Provider value={state}>
      {children}
    </TenantContext.Provider>
  );
}
```

#### ThemeProvider: применение бренда школы через CSS-переменные

```tsx
// apps/school/src/providers/ThemeProvider.tsx
import { useEffect, ReactNode } from 'react';
import { useTenant } from './TenantProvider';

// 3 пресета тем
const PRESETS = {
  minimalist: { primary: '#1a1a1a', bg: '#ffffff', text: '#333333' },
  corporate:  { primary: '#2563EB', bg: '#F8FAFC', text: '#1E293B' },
  warm:       { primary: '#EA580C', bg: '#FFFBEB', text: '#451A03' },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useTenant();

  useEffect(() => {
    if (!settings?.theme) return;

    const root = document.documentElement;
    const colors = settings.theme.colors;

    // Устанавливаем CSS-переменные из настроек школы
    root.style.setProperty('--school-primary', colors.primary);
    root.style.setProperty('--school-bg', colors.bg ?? '#ffffff');
    root.style.setProperty('--school-text', colors.text ?? '#1a1a1a');

    if (settings.theme.font_family) {
      root.style.setProperty('--school-font', settings.theme.font_family);
    }
    if (settings.theme.border_radius) {
      root.style.setProperty('--school-radius', settings.theme.border_radius);
    }

    // Favicon
    if (settings.theme.favicon_url) {
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (link) link.href = settings.theme.favicon_url;
    }
  }, [settings]);

  return <>{children}</>;
}

// Использование в apps/school/src/main.tsx:
// <TenantProvider>
//   <ThemeProvider>
//     <RouterProvider router={router} />
//   </ThemeProvider>
// </TenantProvider>
```

---

### Шаг 2.4 — LMS: система обучения (28.5 дней)

> Самый объёмный блок Фазы 2. Полноценная LMS с курсами, уроками, ДЗ, сертификатами, календарями.

#### Что делать

1. **School-Admin: управление курсами** (3 дня):
   - CRUD курсов и модулей
   - Drag-and-drop сортировка
   - Статусы: черновик / опубликован / архив

2. **Редактор уроков** (3 дня):
   - Rich-text редактор (TipTap)
   - Загрузка видео (MinIO, tenant-isolated)
   - Прикрепление файлов (PDF, DOCX)

3. **Студент: каталог курсов школы** (2 дня):
   - Список с фильтрами
   - Карточка курса: описание, программа, преподаватель, кнопка покупки

4. **Студент: прохождение курса** (3 дня):
   - Навигация по модулям/урокам
   - Просмотр видео (plyr.js)
   - Прогресс-бар
   - Отметка «пройдено»

5. **Домашние задания** (3 дня):
   - Студент загружает файл/текст
   - Преподаватель видит в school-admin
   - Оценка + комментарий
   - Статусы: ожидает, принято, на доработку

6. **Сертификаты** (2.5 дня):
   - Конструктор шаблонов (HTML + переменные)
   - Генерация PDF с уникальным номером
   - Скачивание + email

7. **Календарь преподавателя** (3.5 дня):
   - react-big-calendar: создание занятий, повторяющиеся, отмена/перенос

8. **Календарь студента** (2.5 дня):
   - Все занятия + дедлайны ДЗ + тесты
   - Фильтр по курсу
   - iCal-экспорт

#### SQL-миграция: схема академии

```sql
-- Миграция: 013_academy_schema.sql
CREATE SCHEMA IF NOT EXISTS academy;

-- Курсы (привязаны к школе через tenant_id)
CREATE TABLE academy.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant.schools(id),
  title TEXT NOT NULL,
  description TEXT,
  level TEXT DEFAULT 'basic' CHECK (level IN ('student', 'basic', 'professional', 'master')),
  price NUMERIC(10,2) DEFAULT 0,
  instructor_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_published BOOLEAN DEFAULT FALSE,
  landing_enabled BOOLEAN DEFAULT FALSE,  -- Показывать лендинг курса
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Модули курса (разделы)
CREATE TABLE academy.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant.schools(id),
  course_id UUID NOT NULL REFERENCES academy.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INT DEFAULT 0,                 -- Порядок сортировки
  type TEXT DEFAULT 'module'              -- module | bonus | exam
);

-- Уроки внутри модулей
CREATE TABLE academy.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant.schools(id),
  module_id UUID NOT NULL REFERENCES academy.modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('video', 'text', 'presentation', 'quiz', 'worksheet')),
  content TEXT,                           -- Markdown-текст или URL видео
  position INT DEFAULT 0,
  duration INT DEFAULT 0                  -- Длительность в минутах (для видео)
);

-- Записи студентов на курсы
CREATE TABLE academy.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant.schools(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  course_id UUID NOT NULL REFERENCES academy.courses(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'canceled', 'expired')),
  progress_pct NUMERIC(5,2) DEFAULT 0,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'direct' CHECK (source IN ('direct', 'funnel', 'promo_code', 'import')),
  UNIQUE(tenant_id, user_id, course_id)
);

-- Домашние задания
CREATE TABLE academy.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant.schools(id),
  lesson_id UUID NOT NULL REFERENCES academy.lessons(id),
  student_id UUID NOT NULL REFERENCES auth.users(id),
  submission TEXT,                         -- Текст или URL файла
  grade NUMERIC(3,1),                     -- Оценка (0-10)
  feedback TEXT,                          -- Комментарий преподавателя
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'accepted', 'revision')),
  submitted_at TIMESTAMPTZ
);

-- Квизы (тесты к урокам)
CREATE TABLE academy.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant.schools(id),
  lesson_id UUID NOT NULL REFERENCES academy.lessons(id),
  questions JSONB NOT NULL,               -- [{"q": "Вопрос?", "type": "single", "options": [...], "correct": 0}]
  passing_score NUMERIC(5,2) DEFAULT 70   -- Проходной балл в %
);

-- Попытки квизов
CREATE TABLE academy.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant.schools(id),
  quiz_id UUID NOT NULL REFERENCES academy.quizzes(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  answers JSONB NOT NULL,                 -- [{"question_idx": 0, "selected": 1}]
  score NUMERIC(5,2),
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Выданные сертификаты
CREATE TABLE academy.issued_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant.schools(id),
  student_id UUID NOT NULL REFERENCES auth.users(id),
  course_id UUID NOT NULL REFERENCES academy.courses(id),
  template_id UUID REFERENCES tenant.school_certificates_templates(id),
  certificate_number TEXT NOT NULL UNIQUE, -- Формат: CERT-{school_slug}-{year}-{seq}
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  pdf_url TEXT                            -- URL в MinIO
);

-- Видеосессии школы (лекции, вебинары, супервизии)
CREATE TABLE academy.video_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant.schools(id),
  host_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('lecture', 'webinar', 'supervision', 'consultation', 'group_practice')),
  livekit_room_name TEXT NOT NULL,        -- Формат: tenant_{id}_session_{id}
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  recording_url TEXT,
  max_participants INT DEFAULT 50,
  settings JSONB DEFAULT '{"recording_enabled": false, "chat_enabled": true, "screen_share_enabled": true, "waiting_room_enabled": false}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Участники видеосессий
CREATE TABLE academy.video_session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant.schools(id),
  session_id UUID NOT NULL REFERENCES academy.video_sessions(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role TEXT DEFAULT 'participant' CHECK (role IN ('host', 'co_host', 'participant', 'observer')),
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  duration_sec INT DEFAULT 0
);

-- Календари пользователей школы
CREATE TABLE academy.calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant.schools(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT DEFAULT 'personal',           -- personal | course | school
  events JSONB DEFAULT '[]'               -- [{title, start, end, type, recurring}]
);

-- Индексы
CREATE INDEX idx_courses_tenant ON academy.courses(tenant_id, is_published);
CREATE INDEX idx_enrollments_user ON academy.enrollments(user_id, tenant_id);
CREATE INDEX idx_enrollments_course ON academy.enrollments(course_id, tenant_id);
CREATE INDEX idx_lessons_module ON academy.lessons(module_id, position);
CREATE INDEX idx_assignments_student ON academy.assignments(student_id, tenant_id);
CREATE INDEX idx_video_sessions_tenant ON academy.video_sessions(tenant_id, scheduled_at);

-- RLS: мультитенантная изоляция
ALTER TABLE academy.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation: courses" ON academy.courses
  FOR SELECT USING (tenant_id = current_tenant_id());

ALTER TABLE academy.enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation: enrollments" ON academy.enrollments
  FOR SELECT USING (tenant_id = current_tenant_id() AND auth.uid() = user_id);
CREATE POLICY "Instructors see course enrollments" ON academy.enrollments
  FOR SELECT USING (
    tenant_id = current_tenant_id()
    AND course_id IN (SELECT id FROM academy.courses WHERE instructor_id = auth.uid())
  );
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

ALTER TABLE academy.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation: assignments" ON academy.assignments
  FOR SELECT USING (tenant_id = current_tenant_id());

ALTER TABLE academy.video_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation: video_sessions" ON academy.video_sessions
  FOR SELECT USING (tenant_id = current_tenant_id());
```

#### Библиотеки

```bash
npm install @tiptap/react @tiptap/starter-kit plyr-react react-big-calendar
npm install puppeteer  # Для генерации PDF-сертификатов
```

#### Пример: Редактор курса (School-Admin)

```tsx
// apps/school-admin/src/pages/CourseEditor.tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/packages/supabase';
import { useTenant } from '@/providers/TenantProvider';
import { Button } from '@/packages/ui';

export default function CourseEditor() {
  const { courseId } = useParams();
  const { school } = useTenant();
  const queryClient = useQueryClient();
  const isNew = courseId === 'new';

  const [form, setForm] = useState({
    title: '', description: '', price: 0, level: 'basic', is_published: false,
  });

  // Загрузка существующего курса
  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('academy.courses')
        .select('*, modules(*, lessons(*))')
        .eq('id', courseId)
        .single();
      return data;
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (course) setForm(course);
  }, [course]);

  // Сохранение
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isNew) {
        return supabase.from('academy.courses').insert({
          ...form,
          tenant_id: school!.id,
          instructor_id: (await supabase.auth.getUser()).data.user?.id,
        }).select().single();
      }
      return supabase.from('academy.courses')
        .update(form)
        .eq('id', courseId)
        .select()
        .single();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['course'] }),
  });

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">{isNew ? 'Новый курс' : 'Редактирование курса'}</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Название курса</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full border rounded px-3 py-2" placeholder="Основы коучинга" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Описание</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full border rounded px-3 py-2 h-32" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Цена (₽)</label>
            <input type="number" value={form.price}
              onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
              className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Уровень</label>
            <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
              className="w-full border rounded px-3 py-2">
              <option value="student">Студент</option>
              <option value="basic">Базовый</option>
              <option value="professional">Профессионал</option>
              <option value="master">Мастер</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.is_published}
            onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))} />
          <span>Опубликовать курс</span>
        </label>
      </div>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
      </Button>
    </div>
  );
}
```

#### Пример: Просмотр урока (студент)

```tsx
// apps/school/src/pages/LessonViewer.tsx
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/packages/supabase';
import Plyr from 'plyr-react';
import 'plyr-react/plyr.css';

export default function LessonViewer() {
  const { lessonId } = useParams();

  const { data: lesson } = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: async () => {
      const { data } = await supabase
        .from('academy.lessons')
        .select('*, module:academy.modules(title, course_id)')
        .eq('id', lessonId)
        .single();
      return data;
    },
  });

  // Отметка «пройдено»
  const markComplete = useMutation({
    mutationFn: async () => {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      await supabase.from('academy.lesson_progress').upsert({
        lesson_id: lessonId,
        user_id: userId,
        completed_at: new Date().toISOString(),
      });
    },
  });

  if (!lesson) return <p>Загрузка...</p>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">{lesson.title}</h1>

      {/* Видео-урок */}
      {lesson.content_type === 'video' && (
        <div className="mb-6">
          <Plyr source={{ type: 'video', sources: [{ src: lesson.content, type: 'video/mp4' }] }} />
        </div>
      )}

      {/* Текстовый урок */}
      {lesson.content_type === 'text' && (
        <div className="prose max-w-none mb-6" dangerouslySetInnerHTML={{ __html: lesson.content }} />
      )}

      {/* Кнопка завершения */}
      <button
        onClick={() => markComplete.mutate()}
        className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
      >
        {markComplete.isSuccess ? '✓ Пройдено' : 'Отметить как пройденный'}
      </button>
    </div>
  );
}
```

#### Пример: Отправка домашнего задания

```tsx
// apps/school/src/components/HomeworkSubmission.tsx
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/packages/supabase';
import { useTenant } from '@/providers/TenantProvider';
import { Button } from '@/packages/ui';

export function HomeworkSubmission({ lessonId }: { lessonId: string }) {
  const { school } = useTenant();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      let fileUrl: string | null = null;

      // Загружаем файл в MinIO (tenant-isolated путь)
      if (file) {
        const path = `tenants/${school!.id}/homework/${lessonId}/${userId}/${file.name}`;
        const { data } = await supabase.storage.from('academy').upload(path, file);
        if (data) fileUrl = data.path;
      }

      // Создаём запись задания
      await supabase.from('academy.assignments').insert({
        tenant_id: school!.id,
        lesson_id: lessonId,
        student_id: userId,
        submission: fileUrl ? `Файл: ${fileUrl}\n\n${text}` : text,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      });
    },
  });

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <h3 className="font-semibold">Домашнее задание</h3>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Напишите ваш ответ..."
        className="w-full border rounded px-3 py-2 h-32"
      />

      <input
        type="file"
        onChange={e => setFile(e.target.files?.[0] ?? null)}
        className="text-sm"
      />

      <Button onClick={() => submit.mutate()} disabled={submit.isPending || (!text && !file)}>
        {submit.isPending ? 'Отправка...' : 'Отправить задание'}
      </Button>

      {submit.isSuccess && (
        <p className="text-green-600">✓ Задание отправлено! Ожидайте проверки преподавателя.</p>
      )}
    </div>
  );
}
```

#### Пример: Генерация сертификата (API)

```ts
// services/api-gateway/src/routes/certificates.ts
import puppeteer from 'puppeteer';
import { supabase } from '../lib/supabase';
import { FastifyInstance } from 'fastify';

export default async function certificateRoutes(app: FastifyInstance) {
  app.post('/api/certificates/generate', async (req, reply) => {
    const { studentId, courseId, tenantId } = req.body as any;

    // 1. Загружаем данные
    const [student, course, template] = await Promise.all([
      supabase.from('users').select('full_name, email').eq('id', studentId).single(),
      supabase.from('academy.courses').select('title').eq('id', courseId).single(),
      supabase.from('tenant.school_certificates_templates')
        .select('template_html, variables')
        .eq('school_id', tenantId)
        .eq('is_default', true)
        .single(),
    ]);

    // 2. Генерируем уникальный номер
    const certNumber = `CERT-${tenantId.slice(0, 8)}-${new Date().getFullYear()}-${Date.now().toString(36)}`;

    // 3. Подставляем переменные в HTML-шаблон
    let html = template.data!.template_html;
    html = html.replace('{{student_name}}', student.data!.full_name);
    html = html.replace('{{course_title}}', course.data!.title);
    html = html.replace('{{date}}', new Date().toLocaleDateString('ru-RU'));
    html = html.replace('{{certificate_number}}', certNumber);

    // 4. Генерируем PDF через Puppeteer
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', landscape: true, printBackground: true });
    await browser.close();

    // 5. Сохраняем PDF в MinIO
    const pdfPath = `tenants/${tenantId}/certificates/${certNumber}.pdf`;
    await supabase.storage.from('academy').upload(pdfPath, pdfBuffer, { contentType: 'application/pdf' });

    // 6. Записываем в БД
    await supabase.from('academy.issued_certificates').insert({
      tenant_id: tenantId,
      student_id: studentId,
      course_id: courseId,
      certificate_number: certNumber,
      pdf_url: pdfPath,
    });

    return reply.send({ certificateNumber: certNumber, pdfUrl: pdfPath });
  });
}
```

---

### Шаг 2.5 — Оплата курсов (3 дня)

#### Что делать

1. **Покупка курса**: кнопка «Купить» → ЮKassa → webhook → enrollment
2. **Управление подпиской школы**: страница тарифов (на старте — один бесплатный)

#### Упрощение для старта
Вся оплата идёт на платформу. Расчёт со школами — вручную. Split Payments (автоматическое расщепление) — в Post-MVP, когда будет 10+ активных школ.

---

### Шаг 2.6 — School-Admin Dashboard (11.5 дней)

#### Что делать

1. **SPA каркас** (2 дня): навигация, layout
2. **Дашборд** (1.5 дня): обзорные цифры (студенты, курсы, выручка)
3. **Настройки школы** (2 дня): general, branding, domain
4. **Управление студентами** (2.5 дня): список, карточка, импорт CSV
5. **Конструктор страниц** (2.5 дня): hero, text, CTA блоки
6. **Управление подпиской** (1 день): текущий тариф, лимиты

#### Пример: School-Admin Dashboard

```tsx
// apps/school-admin/src/pages/Dashboard.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/packages/supabase';
import { useTenant } from '@/providers/TenantProvider';

export default function SchoolAdminDashboard() {
  const { school } = useTenant();

  const { data: stats } = useQuery({
    queryKey: ['school-admin-stats', school?.id],
    queryFn: async () => {
      const [students, courses, revenue, analytics] = await Promise.all([
        // Общее число студентов
        supabase.from('academy.enrollments')
          .select('user_id', { count: 'exact', head: true })
          .eq('tenant_id', school!.id),
        // Опубликованные курсы
        supabase.from('academy.courses')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', school!.id)
          .eq('is_published', true),
        // Выручка за текущий месяц (из аналитики)
        supabase.from('tenant.school_analytics_daily')
          .select('revenue')
          .eq('school_id', school!.id)
          .gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
        // Последние 7 дней активности
        supabase.from('tenant.school_analytics_daily')
          .select('date, new_students, active_students, page_views')
          .eq('school_id', school!.id)
          .order('date', { ascending: false })
          .limit(7),
      ]);

      const monthlyRevenue = revenue.data?.reduce((sum, r) => sum + Number(r.revenue), 0) ?? 0;

      return {
        totalStudents: students.count ?? 0,
        totalCourses: courses.count ?? 0,
        monthlyRevenue,
        weeklyChart: (analytics.data ?? []).reverse(),
      };
    },
    enabled: !!school,
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Панель управления: {school?.name}</h1>

      {/* Карточки */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Студенты</p>
          <p className="text-3xl font-bold">{stats?.totalStudents ?? '—'}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Курсы</p>
          <p className="text-3xl font-bold">{stats?.totalCourses ?? '—'}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Выручка (мес.)</p>
          <p className="text-3xl font-bold">{stats?.monthlyRevenue?.toLocaleString() ?? '—'} ₽</p>
        </div>
      </div>

      {/* Таблица активности за неделю */}
      <div className="bg-white border rounded-lg p-4">
        <h2 className="font-semibold mb-3">Активность за 7 дней</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Дата</th>
              <th className="text-right py-2">Новые</th>
              <th className="text-right py-2">Активные</th>
              <th className="text-right py-2">Просмотры</th>
            </tr>
          </thead>
          <tbody>
            {stats?.weeklyChart.map(day => (
              <tr key={day.date} className="border-b">
                <td className="py-2">{new Date(day.date).toLocaleDateString('ru-RU')}</td>
                <td className="text-right">{day.new_students}</td>
                <td className="text-right">{day.active_students}</td>
                <td className="text-right">{day.page_views}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

#### Пример: Управление студентами

```tsx
// apps/school-admin/src/pages/Students.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/packages/supabase';
import { useTenant } from '@/providers/TenantProvider';

export default function StudentsManagement() {
  const { school } = useTenant();
  const [search, setSearch] = useState('');

  const { data: students = [] } = useQuery({
    queryKey: ['school-students', school?.id, search],
    queryFn: async () => {
      let query = supabase
        .from('academy.enrollments')
        .select(`
          user_id,
          enrolled_at,
          status,
          progress_pct,
          course:academy.courses(title),
          user:auth.users(email, raw_user_meta_data)
        `)
        .eq('tenant_id', school!.id)
        .order('enrolled_at', { ascending: false });

      // Поиск работает через join с users
      const { data } = await query;
      if (!data) return [];

      // Клиентская фильтрация по имени/email (для MVP достаточно)
      if (search) {
        return data.filter(s =>
          s.user?.email?.includes(search) ||
          s.user?.raw_user_meta_data?.full_name?.toLowerCase().includes(search.toLowerCase())
        );
      }
      return data;
    },
    enabled: !!school,
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Студенты</h1>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени или email..."
          className="border rounded px-3 py-2 w-64"
        />
      </div>

      <table className="w-full border rounded-lg overflow-hidden">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-3">Студент</th>
            <th className="text-left px-4 py-3">Курс</th>
            <th className="text-center px-4 py-3">Прогресс</th>
            <th className="text-center px-4 py-3">Статус</th>
            <th className="text-right px-4 py-3">Дата записи</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => (
            <tr key={i} className="border-t">
              <td className="px-4 py-3">
                <div>{s.user?.raw_user_meta_data?.full_name ?? 'Без имени'}</div>
                <div className="text-xs text-gray-500">{s.user?.email}</div>
              </td>
              <td className="px-4 py-3">{s.course?.title}</td>
              <td className="text-center px-4 py-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${s.progress_pct}%` }} />
                </div>
                <span className="text-xs">{s.progress_pct}%</span>
              </td>
              <td className="text-center px-4 py-3">
                <span className={`text-xs px-2 py-1 rounded ${
                  s.status === 'active' ? 'bg-green-100 text-green-700' :
                  s.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'
                }`}>{s.status}</span>
              </td>
              <td className="text-right px-4 py-3 text-sm text-gray-500">
                {new Date(s.enrolled_at).toLocaleDateString('ru-RU')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

#### Пример: Конструктор страниц школы

```tsx
// apps/school-admin/src/pages/PageBuilder.tsx
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/packages/supabase';
import { useTenant } from '@/providers/TenantProvider';
import { Button } from '@/packages/ui';

// Типы блоков для конструктора
type BlockType = 'hero' | 'text' | 'cta' | 'features' | 'testimonials';

interface PageBlock {
  id: string;
  type: BlockType;
  data: Record<string, any>;
}

const BLOCK_DEFAULTS: Record<BlockType, Record<string, any>> = {
  hero:         { title: 'Добро пожаловать', subtitle: '', background_url: '' },
  text:         { content: '' },
  cta:          { title: 'Начните обучение', button_text: 'Записаться', button_url: '/courses' },
  features:     { items: [{ icon: '📚', title: 'Курсы', desc: '' }] },
  testimonials: { items: [{ name: '', text: '', avatar: '' }] },
};

export default function PageBuilder() {
  const { school } = useTenant();
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [title, setTitle] = useState('Главная');
  const [slug, setSlug] = useState('home');

  const addBlock = (type: BlockType) => {
    setBlocks(prev => [...prev, { id: crypto.randomUUID(), type, data: { ...BLOCK_DEFAULTS[type] } }]);
  };

  const updateBlock = (id: string, data: Record<string, any>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, data } : b));
  };

  const removeBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const savePage = useMutation({
    mutationFn: async () => {
      await supabase.from('tenant.school_pages').upsert({
        school_id: school!.id,
        slug,
        title,
        content: blocks,  // JSONB — массив блоков
        type: slug === 'home' ? 'home' : 'custom',
        is_published: true,
      });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Конструктор страниц</h1>

      <div className="grid grid-cols-2 gap-4">
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Название страницы" className="border rounded px-3 py-2" />
        <input value={slug} onChange={e => setSlug(e.target.value)}
          placeholder="URL (slug)" className="border rounded px-3 py-2" />
      </div>

      {/* Список блоков */}
      {blocks.map(block => (
        <div key={block.id} className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium uppercase text-gray-500">{block.type}</span>
            <button onClick={() => removeBlock(block.id)} className="text-red-500 text-sm">Удалить</button>
          </div>
          {block.type === 'hero' && (
            <div className="space-y-2">
              <input value={block.data.title} onChange={e => updateBlock(block.id, { ...block.data, title: e.target.value })}
                className="w-full border rounded px-3 py-2" placeholder="Заголовок" />
              <input value={block.data.subtitle} onChange={e => updateBlock(block.id, { ...block.data, subtitle: e.target.value })}
                className="w-full border rounded px-3 py-2" placeholder="Подзаголовок" />
            </div>
          )}
          {block.type === 'text' && (
            <textarea value={block.data.content} onChange={e => updateBlock(block.id, { ...block.data, content: e.target.value })}
              className="w-full border rounded px-3 py-2 h-24" placeholder="Текст блока..." />
          )}
          {block.type === 'cta' && (
            <div className="grid grid-cols-2 gap-2">
              <input value={block.data.title} onChange={e => updateBlock(block.id, { ...block.data, title: e.target.value })}
                className="border rounded px-3 py-2" placeholder="Заголовок" />
              <input value={block.data.button_text} onChange={e => updateBlock(block.id, { ...block.data, button_text: e.target.value })}
                className="border rounded px-3 py-2" placeholder="Текст кнопки" />
            </div>
          )}
        </div>
      ))}

      {/* Добавление блоков */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={() => addBlock('hero')}>+ Hero</Button>
        <Button variant="outline" onClick={() => addBlock('text')}>+ Текст</Button>
        <Button variant="outline" onClick={() => addBlock('cta')}>+ CTA</Button>
        <Button variant="outline" onClick={() => addBlock('features')}>+ Фичи</Button>
        <Button variant="outline" onClick={() => addBlock('testimonials')}>+ Отзывы</Button>
      </div>

      <Button onClick={() => savePage.mutate()} disabled={savePage.isPending}>
        {savePage.isPending ? 'Сохранение...' : 'Сохранить страницу'}
      </Button>
    </div>
  );
}
```

---

### Шаг 2.7 — Тестирование и запуск Академии (13.5 дней)

#### Что делать

1. **E2E тестирование** (3 дня): 15+ сценариев (создание школы → настройка → курс → покупка → прохождение → ДЗ → сертификат)
2. **Тест мультитенантности** (2 дня): изоляция данных между двумя школами
3. **Нагрузочное тестирование** (1.5 дня): k6, 30 школ, 300 студентов
4. **Лендинг Академии** (2 дня)
5. **Пилотные школы** (2 дня): 2–3 тестовые школы с курсами
6. **Багфикс** (3 дня)

---

### ✅ Итог Фазы 2

SaaS-платформа для онлайн-школ:
- Создание школы на поддомене с базовым брендом
- Полнофункциональная LMS: курсы, уроки, ДЗ с проверкой, сертификаты
- Календари преподавателя и студента
- Оплата курсов через ЮKassa
- School-Admin: управление всем
- Каталог школ

**Можно запускать academy-coaching.ru и начинать монетизацию.**

---

## Архитектура для 300 одновременных пользователей (2 VPS)

### Распределение сервисов по серверам

| Сервис | VPS #1 (приложение) | VPS #2 (медиасервер) |
|--------|:---:|:---:|
| PostgreSQL + pgBouncer | ✅ | — |
| Supabase (GoTrue, Realtime, PostgREST, Storage, Studio) | ✅ | — |
| Redis + BullMQ | ✅ | — |
| MinIO (файлы) | ✅ | — |
| API Gateway (Fastify, 4 воркера) | ✅ | — |
| Traefik (reverse proxy, TLS) | ✅ | — |
| Фронтенд (nginx, SPA-билды) | ✅ | — |
| Prometheus + Grafana | ✅ | — |
| LiveKit Server | — | ✅ |
| coturn (TURN/STUN) | — | ✅ |
| LiveKit Egress (Post-MVP) | — | ✅ |

### Что отложено на Post-MVP (не влияет на запуск)

| Компонент | Почему отложен |
|-----------|---------------|
| LiveKit Egress (запись сессий) | Требует дополнительной нагрузки на VPS #2 и хранилища. Не блокирует основной функционал |
| E2E шифрование чатов (Signal Protocol) | Сложная реализация (5 дней). Базовый TLS обеспечивает достаточную защиту на старте |
| AI-сервис (GigaChat / YandexGPT) | Отдельный Python-сервис (FastAPI). Потребует ресурсов на VPS #1 или третий VPS |

### Что нельзя упрощать (критично для безопасности и стабильности)

- **RLS (Row Level Security)** — без этого данные не защищены
- **Мультитенантная изоляция** — утечка данных между школами = катастрофа
- **TLS (HTTPS)** — без шифрования перехватят пароли и платёжные данные
- **pgBouncer** — при 300 пользователях без пула соединений PostgreSQL захлебнётся
- **Бэкапы PostgreSQL** — потеря данных = потеря бизнеса
- **Фискализация 54-ФЗ** — требование закона
- **Выделенный медиасервер (VPS #2)** — видеонагрузка не должна конкурировать с БД и API

### Конфигурация серверов для 300 пользователей

```
VPS #1 — Приложение (Selectel Cloud Server):
- 8 vCPU
- 32 GB RAM
- 500 GB NVMe SSD
- Ubuntu 22.04 LTS, 1 Gbps
- Стоимость: ~8000–12000 ₽/мес

Распределение ресурсов VPS #1:
- PostgreSQL: 8 GB RAM (shared_buffers)
- pgBouncer: ~200 MB
- Supabase (GoTrue, Realtime, PostgREST): 4 GB
- Redis: 1 GB
- Fastify (API Gateway, 4 воркера): 2 GB
- React SPA (nginx): ~200 MB
- MinIO: 1 GB
- Traefik: ~200 MB
- Prometheus + Grafana: 1–2 GB
- OS + Docker: 3 GB

VPS #2 — Медиасервер (Selectel Cloud Server):
- 8 vCPU
- 16 GB RAM
- 200 GB NVMe SSD
- Ubuntu 22.04 LTS, 1 Gbps
- Стоимость: ~5000–7000 ₽/мес

Распределение ресурсов VPS #2:
- LiveKit Server: 8–12 GB RAM (основной потребитель)
- coturn: 1–2 GB RAM
- node_exporter (мониторинг): ~50 MB
- OS + Docker: 2 GB

Итого: ~13000–19000 ₽/мес за оба сервера
```

### Сетевая схема (как серверы связаны)

```
Пользователь (браузер)
    │
    ├── HTTPS ──→ VPS #1 (Traefik :443)
    │              ├── score-coaching.ru → Platform SPA (nginx)
    │              ├── academy-coaching.ru → Academy SPA
    │              ├── *.academy-coaching.ru → School SPA
    │              ├── api.score-coaching.ru → Supabase / API Gateway
    │              └── Supabase Realtime (WebSocket) → PostgreSQL
    │
    └── WSS ───→ VPS #2 (LiveKit :7880)
                   ├── Видеосессии (WebRTC SFU)
                   ├── coturn (TURN relay для NAT/VPN)
                   └── Egress → MinIO на VPS #1 (Post-MVP)

VPS #1 ←──→ VPS #2 (внутренняя связь):
  - API Gateway генерирует LiveKit-токены (HTTP → VPS #2:7880)
  - LiveKit Egress записывает видео → MinIO (HTTP → VPS #1:9000)
  - Prometheus собирает метрики с node_exporter на VPS #2
```

---

## Рекомендации по бэкапам

```bash
# Автоматический бэкап PostgreSQL — запускать ежедневно через cron
#!/bin/bash
# /home/deploy/scripts/backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/home/deploy/backups

# Создать дамп
docker exec supabase-db pg_dump -U postgres > "$BACKUP_DIR/db_$DATE.sql"

# Сжать
gzip "$BACKUP_DIR/db_$DATE.sql"

# Загрузить в MinIO (или внешнее хранилище)
mc cp "$BACKUP_DIR/db_$DATE.sql.gz" minio/backups/

# Удалить старые бэкапы (старше 30 дней)
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
```

```bash
# Добавить в crontab:
crontab -e
0 3 * * * /home/deploy/scripts/backup.sh
```

---

## Сводная таблица шагов

| Шаг | Фаза | Описание | Дней | Зависит от |
|-----|------|----------|------|------------|
| 0.1 | 0 | 2× VPS + безопасность | 2 | — |
| 0.2 | 0 | Docker на обоих VPS | 1.5 | 0.1 |
| 0.3 | 0 | Supabase + pgBouncer (VPS #1) | 3 | 0.2 |
| 0.4 | 0 | Redis + BullMQ (VPS #1) | 1 | 0.2 |
| 0.5 | 0 | MinIO (VPS #1) | 0.5 | 0.2 |
| 0.6 | 0 | Traefik (VPS #1) | 2 | 0.2, 0.8 |
| 0.7 | 0 | LiveKit + coturn (VPS #2) | 3 | 0.2 |
| 0.8 | 0 | Домены + DNS (оба VPS) | 1 | — |
| 0.9 | 0 | Монорепозиторий | 3 | — |
| 0.10 | 0 | Генерация UI (lovable.dev) | 3 | 0.9 |
| 0.11 | 0 | App Shell (каркас) | 2 | 0.10 |
| 0.12 | 0 | Авторизация (Email + VK) | 5 | 0.3, 0.11 |
| 0.13 | 0 | RBAC (роли и доступы) | 3 | 0.12 |
| 0.14 | 0 | API Gateway (Fastify) | 3 | 0.3, 0.4 |
| 0.15 | 0 | Схема БД: общие таблицы | 2 | 0.3 |
| 0.16 | 0 | Email-сервис | 1 | 0.4, 0.14 |
| 0.17 | 0 | CI/CD | 2 | 0.9 |
| 0.18 | 0 | Мониторинг (Grafana + Prometheus) | 1.5 | 0.1 |
| 1.1 | 1 | Схема БД платформы | 3 | Фаза 0 |
| 1.2 | 1 | Профиль + каталог коучей | 6 | 1.1 |
| 1.3 | 1 | Расписание + бронирование | 7.5 | 1.1, 1.2 |
| 1.4 | 1 | Видеосессии (LiveKit) | 9.5 | 0.7, 1.3 |
| 1.5 | 1 | Мессенджер | 9 | 0.3 (параллельно с 1.4) |
| 1.6 | 1 | Документооборот | 4 | 1.1 |
| 1.7 | 1 | Оплата (ЮKassa) | 9.5 | 1.3 |
| 1.8 | 1 | Контент + библиотека | 5.5 | 1.1 |
| 1.9 | 1 | Личные кабинеты | 12 | 1.2–1.8 |
| 1.10 | 1 | Лендинг + тестирование | 12 | 1.9 |
| 2.1 | 2 | Мультитенантная инфраструктура | 12.5 | Фаза 0 |
| 2.2 | 2 | Academy SPA + Wizard | 8.5 | 2.1 |
| 2.3 | 2 | School SPA + бренд | 7 | 2.1, 2.2 |
| 2.4 | 2 | LMS (курсы, уроки, ДЗ...) | 28.5 | 2.3 |
| 2.5 | 2 | Оплата курсов | 3 | 1.7, 2.4 |
| 2.6 | 2 | School-Admin Dashboard | 11.5 | 2.3 |
| 2.7 | 2 | Тестирование + запуск | 13.5 | 2.4, 2.5, 2.6 |

**Общий срок MVP: ~202.5 дней (~6.5–7.5 месяцев)**
**С буфером 15%: ~7.5–8.5 месяцев**

---

## Типичные проблемы и их решения (Troubleshooting)

### 1. Docker-контейнер не запускается / перезапускается

**Симптом:** `docker compose up` падает, или контейнер в статусе `Restarting`.

```bash
# Посмотреть логи конкретного контейнера
docker compose logs supabase-db --tail 100

# Посмотреть статус всех контейнеров
docker compose ps

# Частые причины:
# - Порт уже занят → остановите другой контейнер или измените порт в .env
# - Недостаточно памяти → проверьте `free -h`, увеличьте swap
# - Неправильный .env → сравните с эталоном из Шага 0.20
```

**Решение — порт занят:**
```bash
# Найти процесс, занимающий порт (например, 5432)
sudo lsof -i :5432
# Убить процесс или поменять порт в docker-compose.yml
```

**Решение — недостаточно памяти:**
```bash
# Добавить swap (2 ГБ)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
```

---

### 2. Supabase Auth: «Invalid JWT» или «JWT expired»

**Симптом:** Все запросы к API возвращают 401.

```bash
# Проверьте, что JWT_SECRET одинаковый во всех сервисах:
grep JWT_SECRET .env

# Убедитесь, что время на сервере корректное:
date
timedatectl

# Если время отстаёт — JWT будет «из будущего» и Auth его отклонит
sudo timedatectl set-ntp true
```

**Частая ошибка:** Скопировали `.env` на другой VPS с другим `JWT_SECRET`. Он должен быть **одинаковым** на VPS #1 и VPS #2 (если VPS #2 проверяет токены).

---

### 3. RLS: «new row violates row-level security policy»

**Симптом:** INSERT/UPDATE возвращают ошибку, хотя данные корректные.

```sql
-- Проверить, какие политики действуют на таблицу:
SELECT * FROM pg_policies WHERE tablename = 'courses';

-- Проверить текущий user и tenant:
SELECT auth.uid();
SELECT current_tenant_id();

-- Частая причина: забыли передать tenant_id в JWT.
-- Проверьте middleware в API Gateway (Шаг 2.1):
-- request.jwt.claims должен содержать tenant_id
```

**Отладка:** Временно отключите RLS для одной таблицы (только для отладки!):
```sql
ALTER TABLE academy.courses DISABLE ROW LEVEL SECURITY;
-- Проверьте запрос
-- Потом ОБЯЗАТЕЛЬНО включите обратно:
ALTER TABLE academy.courses ENABLE ROW LEVEL SECURITY;
```

---

### 4. pgBouncer: «too many clients» или «connection refused»

**Симптом:** Приложение не может подключиться к БД при нагрузке.

```bash
# Проверьте текущие подключения к PostgreSQL:
docker exec supabase-db psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Проверьте статус pgBouncer:
docker exec pgbouncer pgbouncer -R  # reload config

# Проверьте лимиты в pgbouncer.ini:
# max_client_conn = 600   (клиентские подключения)
# default_pool_size = 60  (реальные подключения к PG)
```

**Решение:** Убедитесь, что приложение подключается к pgBouncer (порт 6432), а НЕ напрямую к PostgreSQL (порт 5432).

---

### 5. LiveKit: видео не работает / «ICE failed»

**Симптом:** Участники не видят/не слышат друг друга.

```bash
# На VPS #2 проверить, что LiveKit запущен:
docker compose logs livekit --tail 50

# Проверить, что coturn работает:
docker exec coturn turnutils_uclient -T -u turn_user -w turn_password VPS2_IP

# Проверить порты на VPS #2:
sudo ufw status
# Должны быть открыты: 7880, 7881, 7882 (LiveKit), 3478 (TURN), 443 (TURNS), 50000-60000/udp (media)
```

**Частые причины:**
- Файрвол блокирует UDP-порты 50000-60000 → откройте: `sudo ufw allow 50000:60000/udp`
- coturn не видит внешний IP → проверьте `external-ip` в turnserver.conf
- TURN-сервер недоступен → убедитесь, что DNS для `turn.score-coaching.ru` указывает на VPS #2

---

### 6. Traefik: сертификат не выдаётся / «TLS handshake error»

**Симптом:** Сайт показывает предупреждение о безопасности, или сертификат самоподписанный.

```bash
# Логи Traefik:
docker compose logs traefik --tail 100

# Проверить, что DNS-записи существуют:
dig score-coaching.ru A
dig *.academy-coaching.ru A

# Проверить ACME-хранилище:
cat /opt/traefik/acme.json | jq '.[] | .Certificates | length'
```

**Частые причины:**
- DNS ещё не прописан → подождите 5–10 минут после добавления записи
- Wildcard-сертификат требует DNS-01 challenge → убедитесь, что API-ключ Selectel в `.env` правильный
- Порт 80 закрыт → Let's Encrypt нужен порт 80 для HTTP-01 challenge: `sudo ufw allow 80`

---

### 7. MinIO: «Access Denied» при загрузке файлов

**Симптом:** Upload файлов (аватары, ДЗ, материалы) возвращает 403.

```bash
# Проверить, что бакеты созданы:
docker exec minio mc ls local/

# Создать бакет, если его нет:
docker exec minio mc mb local/avatars
docker exec minio mc mb local/academy

# Установить политику (публичный для аватаров):
docker exec minio mc anonymous set download local/avatars
```

**Частая ошибка:** `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` в `.env` не совпадают с тем, что указано в `STORAGE_BACKEND` конфиге Supabase.

---

### 8. BullMQ: задачи не обрабатываются (email не отправляются)

**Симптом:** Email-уведомления не приходят, задачи висят в очереди.

```bash
# Проверить подключение к Redis:
docker exec redis redis-cli ping  # Должен ответить PONG

# Посмотреть очередь:
docker exec redis redis-cli LLEN bull:email:wait

# Проверить worker (email-worker):
docker compose logs email-worker --tail 50
```

**Решение:** Убедитесь, что `REDIS_URL` в `.env` email-worker указывает на правильный хост (обычно `redis://redis:6379` внутри Docker-сети).

---

### 9. Мультитенантность: данные одной школы видны в другой

**Это критическая ошибка безопасности!**

```sql
-- Проверьте, что RLS включён на ВСЕХ academy-таблицах:
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname IN ('academy', 'tenant', 'content', 'chat')
ORDER BY schemaname, tablename;
-- rowsecurity должен быть TRUE для всех таблиц

-- Тестирование изоляции: залогиньтесь как пользователь школы A
-- и попытайтесь получить данные школы B:
SET app.current_tenant_id = 'school-B-uuid';
SELECT * FROM academy.courses;
-- Должно вернуть ПУСТОЙ результат (или только курсы школы B)
```

**Частая причина:** Забыли добавить `tenant_id` в WHERE-условие RLS-политики, или забыли включить RLS на новой таблице.

---

### 10. Ошибки при деплое через GitHub Actions

**Симптом:** CI/CD-пайплайн красный.

```bash
# Частые причины:
# 1. SSH-ключ не добавлен в GitHub Secrets
# 2. Docker image не собирается — ошибка в Dockerfile
# 3. VPS недоступен — проверьте SSH-подключение

# Тестирование SSH с локальной машины:
ssh -i ~/.ssh/id_rsa deploy@VPS1_IP "docker compose ps"

# Если ошибка "Permission denied" — убедитесь, что:
# - Публичный ключ добавлен в ~/.ssh/authorized_keys на VPS
# - Приватный ключ добавлен в GitHub → Settings → Secrets → SSH_PRIVATE_KEY
```

---

### 11. PostgreSQL: «disk full» или медленные запросы

```bash
# Проверить место на диске:
df -h

# Очистить старые Docker-образы (может освободить гигабайты):
docker system prune -a --volumes

# Проверить размер БД:
docker exec supabase-db psql -U postgres -c "
SELECT pg_size_pretty(pg_database_size('postgres'));
"

# Медленные запросы — включить логирование:
docker exec supabase-db psql -U postgres -c "
ALTER SYSTEM SET log_min_duration_statement = 500;  -- логировать запросы > 500ms
SELECT pg_reload_conf();
"
# Потом смотреть: docker compose logs supabase-db | grep duration
```

---

### 12. Ошибка «CORS» в браузере

**Симптом:** Запросы с фронтенда блокируются, в консоли `Access-Control-Allow-Origin` ошибка.

```ts
// В Fastify API Gateway добавьте CORS:
// services/api-gateway/src/index.ts
import cors from '@fastify/cors';

app.register(cors, {
  origin: [
    'https://score-coaching.ru',
    'https://academy-coaching.ru',
    /\.academy-coaching\.ru$/,  // Все поддомены школ
    ...(process.env.NODE_ENV === 'development' ? ['http://localhost:5173'] : []),
  ],
  credentials: true,
});
```

---

### 13. Шпаргалка: полезные команды для отладки

```bash
# === Статус всех сервисов ===
docker compose ps                           # На каждом VPS

# === Логи конкретного сервиса ===
docker compose logs -f api-gateway          # Follow-режим (реалтайм)
docker compose logs supabase-db --since 1h  # Логи за последний час

# === Подключение к БД напрямую ===
docker exec -it supabase-db psql -U postgres

# === Мониторинг нагрузки ===
htop                                        # CPU/RAM
iotop                                       # Диск
docker stats                                # Ресурсы каждого контейнера

# === Перезапуск одного сервиса (без остановки остальных) ===
docker compose restart api-gateway

# === Полный перезапуск (осторожно!) ===
docker compose down && docker compose up -d

# === Бэкап БД вручную ===
docker exec supabase-db pg_dump -U postgres -Fc postgres > backup_$(date +%F).dump

# === Восстановление из бэкапа ===
docker exec -i supabase-db pg_restore -U postgres -d postgres --clean < backup_2026-03-21.dump
```

---

## Чеклист перед запуском MVP

### Безопасность
- [ ] Все таблицы имеют RLS-политики
- [ ] JWT secret — уникальный и длинный (64+ символов)
- [ ] SSH только по ключам, root отключён (на ОБОИХ VPS)
- [ ] Файрвол настроен (ufw) на ОБОИХ VPS
- [ ] Fail2ban работает на ОБОИХ VPS
- [ ] HTTPS на всех доменах
- [ ] Пароли БД, Redis, MinIO — сложные и разные
- [ ] .env файлы не в Git
- [ ] Мультитенантная изоляция протестирована
- [ ] Порты MinIO/Redis на VPS #1 закрыты из интернета (только с VPS #2)
- [ ] pgBouncer настроен и работает

### Функциональность
- [ ] Регистрация + логин (email + VK) работают
- [ ] Каталог коучей с поиском и фильтрами
- [ ] Бронирование + оплата полный flow
- [ ] Видеосессии LiveKit стабильны
- [ ] Мессенджер работает в realtime
- [ ] Документооборот (intake, согласия)
- [ ] Кабинеты коуча и клиента полные
- [ ] Создание школы → настройка → курс → покупка → прохождение
- [ ] Сертификаты генерируются в PDF
- [ ] Email-уведомления отправляются
- [ ] iCal-экспорт календарей

### Инфраструктура
- [ ] Бэкапы PostgreSQL ежедневно (на VPS #1)
- [ ] CI/CD работает (деплой на оба VPS)
- [ ] Мониторинг (Grafana + Prometheus) настроен для обоих VPS
- [ ] UptimeRobot проверяет доступность score-coaching.ru
- [ ] Нагрузочный тест на 300 пользователей пройден
- [ ] DNS + TLS для всех доменов (включая wildcard)
- [ ] VPS #1 ↔ VPS #2 связь работает (LiveKit токены, метрики)
- [ ] coturn работает (проверить через turnutils_uclient)

---

## Что дальше (Post-MVP)

После запуска MVP приоритизируйте по обратной связи от пользователей:

1. **Фаза 3 — Post-MVP (~77.5 дней)**: игровой движок (МАК-карты, кубики), виртуальная приёмная, запись сессий, кастомные домены школ, полный Theme Engine, квизы, Split Payments, аналитика
2. **Фаза 4 — Ассоциация (~50.5 дней)**: членство, сертификация, учёт часов, события
3. **Фаза 5 — Расширенные функции (~43 дня)**: AI-помощник, E2E-шифрование, CRM, магазин материалов

Полный roadmap — в файле [roadmap.md](./roadmap.md).
