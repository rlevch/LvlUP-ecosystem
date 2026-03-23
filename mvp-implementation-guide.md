# LevelUP — Пошаговый гайд реализации MVP для новичка

**Аудитория:** начинающий fullstack-разработчик (junior/middle)
**Масштаб:** до 300 одновременных пользователей (2 VPS)
**Основа:** roadmap.md + architecture.md проекта LevelUP

---

## Глоссарий терминов

Если вы встретили незнакомый термин — ищите его здесь.

**VPS (Virtual Private Server)** — виртуальный сервер в облаке, арендуемый у Selectel (selectel.ru). По сути — удалённый компьютер с Linux, на котором работает ваше приложение. В панели Selectel называется «Облачный сервер» (Cloud Server).

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

**Wildcard-сертификат** — TLS-сертификат для всех поддоменов (`*.levelup-academy.ru`). Позволяет каждой школе иметь свой поддомен без ручной настройки.

**LiveKit** — open-source WebRTC-сервер для видеозвонков. SFU (Selective Forwarding Unit) — все участники отправляют видео на сервер, сервер рассылает остальным.

**WebRTC** — технология видеозвонков в браузере без плагинов. Работает через протоколы SRTP (видео) и ICE (установка соединения).

**TURN/STUN (coturn)** — серверы-помощники для WebRTC. STUN определяет ваш внешний IP. TURN — relay-сервер, который пробрасывает видеотрафик, если прямое соединение невозможно (корпоративный VPN, строгий NAT).

**Supavisor** — встроенный в Supabase v2 пул соединений для PostgreSQL. Мультиплексирует сотни клиентских подключений в десятки реальных соединений к БД. Заменяет ранее используемый pgBouncer.

**Fastify** — быстрый веб-фреймворк для Node.js (альтернатива Express). Используется для API Gateway.

**CORS** — Cross-Origin Resource Sharing. Механизм браузера, который запрещает запросы между разными доменами. Нужно настроить, чтобы фронтенд на `levelup-platform.ru` мог обращаться к API на `api.levelup-platform.ru`.

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

Экосистема LevelUP — это три связанных продукта на общем бэкенде:

1. **Платформа** (levelup-platform.ru) — маркетплейс коучей: каталог, бронирование, видеосессии, оплата
2. **Академия** (levelup-academy.ru) — SaaS-конструктор онлайн-школ (аналог GetCourse)
3. **Ассоциация** (levelup-association.ru) — профессиональное сообщество (Post-MVP, в этом гайде не рассматривается)

MVP включает Фазу 0 (фундамент), Фазу 1 (Платформа) и Фазу 2 (Академия). Общий срок — 6.5–8.5 месяцев для одного разработчика.

---

## ФАЗА 0 — Фундамент (~30–35 дней)

> Без этой фазы ничего не работает. Здесь мы поднимаем сервер, базу данных, авторизацию и базовый каркас приложения.

---

### Шаг 0.1 — Заказ и настройка двух VPS на Selectel (1.5–2 дня)

#### Что делать
Заказать два облачных сервера на Selectel (selectel.ru). VPS #1 — основной (приложение, БД, API). VPS #2 — медиасервер (LiveKit, coturn). Разделение нужно для 300 пользователей: видеосессии потребляют много CPU и трафика и не должны конкурировать с БД и API.

#### Почему именно Selectel

Selectel — крупнейший независимый провайдер инфраструктуры в России. Для нашего проекта важны:

- **Дата-центры в РФ** (Москва, Санкт-Петербург) — низкая задержка для российских пользователей, соответствие 152-ФЗ о персональных данных
- **Внутренняя сеть между серверами** — VPS #1 и VPS #2 в одном ДЦ общаются через приватную сеть бесплатно и с минимальной задержкой (<1 мс), что критично для LiveKit
- **Selectel DNS API** — нужен для автоматического получения wildcard SSL-сертификатов (*.levelup-academy.ru) через Traefik
- **NVMe SSD** — быстрые диски для PostgreSQL (важно для производительности запросов)
- **Гибкая тарификация** — почасовая оплата, можно начать с меньшей конфигурации и увеличить позже
- **Качественная техподдержка** на русском языке

#### Пошаговый процесс регистрации и заказа

**Этап 1: Регистрация на Selectel (10 минут)**

1. Перейдите на [selectel.ru](https://selectel.ru) → кнопка «Регистрация» (правый верхний угол)
2. Укажите email, придумайте пароль, подтвердите email
3. Заполните профиль: ФИО, телефон. Для ИП/ООО — укажите реквизиты (для актов и счетов-фактур). Для физлица — достаточно ФИО
4. Пополните баланс (минимум 1000 ₽ для старта). Способы: банковская карта, СБП, расчётный счёт

**Этап 2: Выбор типа сервера**

В Selectel есть несколько типов серверов. Вам нужны **Облачные серверы** (Cloud Servers), а НЕ выделенные (Dedicated). Вот почему:

| Параметр | Облачный сервер (Cloud) | Выделенный (Dedicated) |
|---|---|---|
| Цена | от ~5000 ₽/мес | от ~15000 ₽/мес |
| Запуск | 1–2 минуты | 1–2 дня |
| Масштабирование | Увеличить CPU/RAM на лету | Физическая замена |
| Для MVP | ✅ Идеально | ❌ Избыточно |

Путь в панели: **Панель управления → Облачная платформа → Серверы → Создать сервер**

**Этап 3: Настройка VPS #1 (приложение)**

В форме создания сервера выберите:

```
Имя:              levelup-app-01
Регион:           ru-1 (Санкт-Петербург) или ru-3 (Москва)
                  ⚠️ Оба VPS ДОЛЖНЫ быть в одном регионе!
Зона доступности: ru-1a (любая в выбранном регионе)

Источник:         Образ → Ubuntu 22.04 LTS
                  ⚠️ Именно 22.04 LTS, не 24.04 — для совместимости с Docker и Supabase

Конфигурация:     Произвольная (Custom)
  vCPU:           8 (линейка «Стандарт», не «Базовые» — они имеют ограничения CPU)
  RAM:            32 ГБ
  Локальный диск: NVMe SSD, 500 ГБ
                  ⚠️ Выбирайте «Локальный диск», а не «Сетевой диск» —
                  локальный NVMe в 3-5 раз быстрее, что критично для PostgreSQL

Сеть:             Публичная подсеть (авто) — вы получите внешний IP
                  + Приватная подсеть — создайте «levelup-internal» (10.0.0.0/24)
                  ⚠️ Приватная сеть обязательна для связи между VPS!

SSH-ключ:         Загрузите публичный ключ (если нет — сгенерируем на следующем шаге)
```

Итого VPS #1: **~8 000–12 000 ₽/мес** (зависит от региона и текущих цен)

> **Почему 32 ГБ RAM?** PostgreSQL один потребует 8 ГБ (shared_buffers). Supabase-сервисы (GoTrue, Realtime, PostgREST, Studio) — ещё 4 ГБ. Redis — 1 ГБ. MinIO — 1 ГБ. Fastify (4 воркера) — 2 ГБ. Prometheus+Grafana — 2 ГБ. Docker+OS — 3 ГБ. Итого: ~21 ГБ, оставляя запас для пиковых нагрузок и кэшей ОС.

**Этап 4: Настройка VPS #2 (медиасервер)**

Создайте второй сервер:

```
Имя:              levelup-media-01
Регион:           тот же, что VPS #1!
Зона доступности: та же, что VPS #1 (для минимальной задержки)

Источник:         Образ → Ubuntu 22.04 LTS

Конфигурация:     Произвольная (Custom)
  vCPU:           8 (линейка «Стандарт»)
                  ⚠️ Для LiveKit важны именно vCPU — видеомаршрутизация CPU-bound
  RAM:            16 ГБ
  Локальный диск: NVMe SSD, 200 ГБ

Сеть:             Публичная подсеть (авто)
                  + Приватная подсеть → та же «levelup-internal» (10.0.0.0/24)
                  ⚠️ Обязательно та же приватная сеть, что и VPS #1!

SSH-ключ:         Тот же, что для VPS #1
```

Итого VPS #2: **~5 000–7 000 ₽/мес**

> **Почему 16 ГБ RAM, а не 32?** LiveKit — SFU (Selective Forwarding Unit), он не перекодирует видео, а маршрутизирует. Основное потребление — CPU (обработка WebRTC) и сеть (трафик). 16 ГБ хватит для 50+ одновременных видеосессий.

**Этап 5: Настройка приватной сети**

После создания обоих серверов убедитесь, что они видят друг друга по приватной сети:

```bash
# На VPS #1 — посмотреть приватный IP:
ip addr show | grep 10.0.0
# Должно показать что-то вроде: inet 10.0.0.240/24

# На VPS #2:
ip addr show | grep 10.0.0
# Должно показать: inet 10.0.0.2/24

# Проверить связь:
# С VPS #1:
ping 10.0.0.2    # → должен отвечать (VPS #2)
# С VPS #2:
ping 10.0.0.240  # → должен отвечать (VPS #1)
```

> **Важно:** Публичные IP (`111.88.113.107` — VPS #1, `111.88.113.71` — VPS #2) используются для DNS-записей и доступа из интернета. Для связи между серверами всегда используйте **приватные IP** (`10.0.0.240` — VPS #1, `10.0.0.2` — VPS #2). Приватная сеть бесплатна и быстрее.

**Этап 6: Настройка Selectel DNS**

DNS от Selectel нужен для двух вещей: обычные записи (A-записи) и автоматическое получение wildcard SSL-сертификатов через DNS API.

1. В панели Selectel: **Сеть и CDN → DNS-хостинг → Добавить зону**
2. Добавьте зоны: `levelup-platform.ru`, `levelup-academy.ru`
3. У вашего регистратора доменов (reg.ru, nic.ru) смените NS-сёрверы на Selectel:
   ```
   ns1.selectel.org
   ns2.selectel.org
   ns3.selectel.org
   ns4.selectel.org
   ```
4. Получите **API-ключ Selectel** для DNS challenge (Traefik будет использовать его для wildcard-сертификатов):
   - Панель Selectel → Профиль → API-ключи → Создать ключ
   - Скопируйте ключ и сохраните — он понадобится в `.env` (переменная `SELECTEL_API_TOKEN`)

> ⚠️ Смена NS-серверов может занять до 24–48 часов. Начните этот шаг в первую очередь, пока настраиваете серверы.

**Этап 7: Чек-лист после заказа**

Прежде чем переходить к следующему шагу, убедитесь:

- [x] Оба VPS созданы и запущены (статус «Активен» в панели)
- [x] Оба VPS в **одном регионе и одной приватной подсети**
- [x] Вы записали: публичный IP VPS #1, публичный IP VPS #2, приватный IP VPS #1, приватный IP VPS #2
- [x] SSH-подключение работает: `ssh root@111.88.113.107`
- [x] Приватная сеть работает: ping между серверами проходит
- [x] DNS-зоны добавлены в Selectel DNS
- [x] API-ключ Selectel получен и сохранён
- [x] NS-серверы у регистратора сменены на Selectel

#### Как сэкономить на старте

Если бюджет ограничен, можно начать с меньшей конфигурации и увеличить позже (Selectel позволяет менять конфигурацию без пересоздания сервера):

```
Начальная конфигурация (до 100 пользователей):
  VPS #1: 4 vCPU, 16 GB RAM, 250 GB NVMe → ~4000-6000 ₽/мес
  VPS #2: 4 vCPU, 8 GB RAM, 100 GB NVMe  → ~2500-4000 ₽/мес
  Итого: ~6500-10000 ₽/мес

Целевая конфигурация (300 пользователей):
  VPS #1: 8 vCPU, 32 GB RAM, 500 GB NVMe → ~8000-12000 ₽/мес
  VPS #2: 8 vCPU, 16 GB RAM, 200 GB NVMe → ~5000-7000 ₽/мес
  Итого: ~13000-19000 ₽/мес
```

> **Когда масштабировать?** Когда мониторинг (Grafana, Шаг 0.17) покажет, что CPU > 70% или RAM > 80% в течение суток. Не увеличивайте заранее — деньги лучше потратить на разработку.

#### Почему два сервера, а не один

При 300 пользователях одновременно могут проходить 30–50 видеосессий. Каждая сессия потребляет 2–5 Мбит/с и значительную долю CPU на маршрутизацию видео. Если всё на одном VPS — видеонагрузка «душит» БД и API, пользователи получают тормоза. Выделенный медиасервер решает эту проблему.

2. **Настроить безопасность на ОБОИХ серверах** — подключиться по SSH и выполнить:

> В примерах ниже используйте реальные IP. Приватные IP (10.0.0.x) — из Selectel приватной подсети, настроенной выше.

**На VPS #1 (приложение, levelup-app-01):**
```bash
# Обновить систему и установить базовые пакеты
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget nano

# Создать пользователя (не работать от root!)
adduser deploy
usermod -aG sudo deploy

# Настроить SSH-ключи (на своём компьютере, если ещё не сделали в панели Selectel)
ssh-keygen -t ed25519 -C "levelup-platform"
ssh-copy-id deploy@111.88.113.107

# Отключить вход по паролю и root-доступ
sudo nano /etc/ssh/sshd_config
# Найдите и измените:
#   PasswordAuthentication no
#   PermitRootLogin no
sudo systemctl restart sshd

# Установить файрвол — VPS #1 (приложение)
sudo apt install ufw -y
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp                              # HTTP (→ redirect HTTPS)
sudo ufw allow 443/tcp                             # HTTPS (Traefik)
# Разрешить доступ к MinIO и Redis ТОЛЬКО из приватной сети Selectel (VPS #2):
sudo ufw allow from 10.0.0.0/24 to any port 9000   # MinIO API (для LiveKit Egress)
sudo ufw allow from 10.0.0.0/24 to any port 6379   # Redis
sudo ufw enable

# Установить fail2ban (защита от брутфорса SSH)
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
```

**На VPS #2 (медиасервер, levelup-media-01):**
```bash
# Базовая настройка — такая же, как VPS #1:
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget nano
adduser deploy
usermod -aG sudo deploy
ssh-copy-id deploy@111.88.113.71
# Отключить пароль и root (аналогично VPS #1)

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
# Разрешить метрики только из приватной сети (для Prometheus на VPS #1):
sudo ufw allow from 10.0.0.0/24 to any port 9100  # node_exporter
sudo ufw allow from 10.0.0.0/24 to any port 6789  # LiveKit metrics
sudo ufw enable

# Fail2ban
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
```

3. **Проверить связь между серверами через приватную сеть Selectel:**

Серверы общаются через приватную сеть Selectel (подсеть `levelup-internal`, 10.0.0.0/24). Трафик по приватной сети бесплатный и быстрый (<1 мс задержки). LiveKit Egress (VPS #2) записывает видео и отправляет на MinIO (VPS #1). API Gateway (VPS #1) генерирует LiveKit-токены, обращаясь к LiveKit API (VPS #2).

```bash
# Проверить связь через ПРИВАТНУЮ сеть:
# С VPS #1 (levelup-app-01):
ping 10.0.0.2    # Приватный IP VPS #2

# С VPS #2 (levelup-media-01):
ping 10.0.0.240  # Приватный IP VPS #1
curl http://10.0.0.240:9000/minio/health/live  # Проверка доступности MinIO по приватной сети
# ⚠️ Выполнять ТОЛЬКО после завершения Шага 0.5 (запуск MinIO на VPS #1)

# Если не работает — проверьте в панели Selectel:
# Облачная платформа → Сети → levelup-internal
# Оба сервера должны быть подключены к этой подсети
```

> **Правило:** Везде в конфигурации, где нужна связь VPS #1 ↔ VPS #2, используйте приватные IP (10.0.0.x). Публичные IP используйте только для DNS-записей и доступа из интернета.

#### Зачем это нужно
Два VPS — это архитектура из roadmap, оптимальная для 300 пользователей. VPS #1 обслуживает весь веб-трафик (страницы, API, БД). VPS #2 обрабатывает тяжёлую медиа-нагрузку (видеосессии). Они не мешают друг другу: даже если все 50 видеосессий загрузят VPS #2 на 100%, сайт на VPS #1 продолжит работать быстро.

#### Почему пул соединений нужен при 300 пользователях
При 300 одновременных пользователях каждый держит открытое соединение с PostgreSQL. С учётом Supabase Realtime, PostgREST и API Gateway — реальное число соединений может достигать 400–500. PostgreSQL по умолчанию выдерживает max_connections = 100. Supavisor (встроенный в Supabase v2 пул соединений) решает это: 500 клиентских соединений мультиплексируются в 50–100 реальных соединений к PostgreSQL. Supavisor запускается автоматически вместе с Supabase — отдельная настройка не нужна.

#### Типичные ошибки новичков
- Работать от root — создайте отдельного пользователя `deploy` на каждом VPS.
- Забыть про файрвол — без него сервер будет атакован в первые часы.
- Не настроить SSH-ключи — пароли небезопасны. В панели Selectel можно загрузить ключ при создании сервера.
- Открыть порты MinIO/Redis в интернет — они должны быть доступны только через приватную сеть Selectel (через `ufw allow from 10.0.0.0/24`).
- Забыть настроить второй VPS — оба сервера должны быть одинаково защищены.
- Создать VPS в разных регионах Selectel — тогда приватная сеть между ними НЕ работает. Оба сервера обязательно в одном регионе!
- Выбрать «Базовые» вместо «Стандарт» vCPU — базовые имеют ограничение производительности CPU, не подходят для PostgreSQL и LiveKit.

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
mkdir -p /home/deploy/levelup-platform
cd /home/deploy/levelup-platform
mkdir -p volumes/postgres volumes/redis volumes/minio
```

3. **Создать структуру проекта на VPS #2 (медиасервер):**

```bash
mkdir -p /home/deploy/levelup-platform
cd /home/deploy/levelup-platform
mkdir -p volumes/livekit volumes/coturn
```

4. **Создать `docker-compose.yml` на VPS #1 (приложение):**

```bash
# На VPS #1 — перейти в папку проекта и создать файл:
cd /home/deploy/levelup-platform
nano docker-compose.yml
```

Вставить следующее содержимое (Ctrl+Shift+V в nano), затем сохранить (Ctrl+O → Enter → Ctrl+X):

```yaml
# VPS #1: docker-compose.yml — приложение, БД, кэш, файлы
version: "3.8"

services:
  # --- Сервисы добавляются по одному ---
  # 1. PostgreSQL + Supavisor (шаг 0.3)
  # 2. Supabase (шаг 0.3)
  # 3. Redis (шаг 0.4)
  # 4. MinIO (шаг 0.5)
  # 5. Traefik (шаг 0.6)
  # 6. API Gateway (шаг 0.14)

networks:
  levelup-net:
    driver: bridge

volumes:
  postgres-data:
  redis-data:
  minio-data:
```

Проверить, что файл создан корректно:

```bash
cat docker-compose.yml
# Должен показать содержимое выше без ошибок
```

> **Ожидаемая ошибка:** если сейчас выполнить `docker compose config`, вы увидите `services must be a mapping` — это нормально. Ошибка возникает потому, что блок `services:` пока содержит только комментарии. Она исчезнет, когда вы добавите первый реальный сервис на шаге 0.3 (Supabase).

> **Альтернативный способ** (без nano — одной командой):
>
> ```bash
> cat > /home/deploy/levelup-platform/docker-compose.yml << 'EOF'
> # VPS #1: docker-compose.yml — приложение, БД, кэш, файлы
> version: "3.8"
>
> services:
>   # --- Сервисы добавляются по одному ---
>   # 1. PostgreSQL + Supavisor (шаг 0.3)
>   # 2. Supabase (шаг 0.3)
>   # 3. Redis (шаг 0.4)
>   # 4. MinIO (шаг 0.5)
>   # 5. Traefik (шаг 0.6)
>   # 6. API Gateway (шаг 0.14)
>
> networks:
>   levelup-net:
>     driver: bridge
>
> volumes:
>   postgres-data:
>   redis-data:
>   minio-data:
> EOF
> ```

5. **Создать `docker-compose.yml` на VPS #2 (медиасервер):**

```bash
# На VPS #2 — перейти в папку проекта и создать файл:
cd /home/deploy/levelup-platform
nano docker-compose.yml
```

Вставить следующее содержимое, сохранить (Ctrl+O → Enter → Ctrl+X):

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

Проверить:

```bash
cat docker-compose.yml
```

> **Ожидаемая ошибка:** `docker compose config` покажет `services must be a mapping` — это нормально, пока нет реальных сервисов. Исчезнет после шага 0.7 (LiveKit).

> **Альтернативный способ** (одной командой):
>
> ```bash
> cat > /home/deploy/levelup-platform/docker-compose.yml << 'EOF'
> # VPS #2: docker-compose.yml — медиасервер
> version: "3.8"
>
> services:
>   # --- Сервисы добавляются по одному ---
>   # 1. LiveKit Server (шаг 0.7)
>   # 2. coturn (шаг 0.7)
>
> networks:
>   media-net:
>     driver: bridge
> EOF
> ```

#### Зачем два docker-compose.yml
Каждый VPS управляется отдельно. VPS #1 можно перезапустить (обновление API) — видеосессии на VPS #2 не пострадают. И наоборот: перезапуск LiveKit не затронет БД и API.

#### Что такое Docker (для новичка)
Представьте, что каждый сервис (база данных, кэш, файловое хранилище) живёт в своей «коробке». Коробки не мешают друг другу, но могут общаться через внутреннюю сеть. `docker-compose.yml` — это файл-рецепт, описывающий все коробки и как они связаны.

#### Типичные ошибки новичков
- Забыть добавить пользователя в группу docker (придётся писать sudo перед каждой командой).
- Не создать volumes для данных — при перезапуске контейнера данные пропадут.

#### Как добавлять сервисы в docker-compose.yml (инструкция для новичка)

В следующих шагах вы будете многократно добавлять новые сервисы (Redis, MinIO, Traefik и т.д.) в файл `docker-compose.yml`. Вот как это делать:

**Шаг 1 — Открыть файл:**

```bash
cd /home/deploy/levelup-platform
nano docker-compose.yml
```

**Шаг 2 — Найти нужное место.** Новые сервисы добавляются внутри блока `services:`, **перед** блоком `networks:`. Используйте Ctrl+W в nano для поиска слова `networks:`.

**Шаг 3 — Вставить блок.** Поставьте курсор на пустую строку перед `networks:` и вставьте новый блок (Ctrl+Shift+V).

**Шаг 4 — Сохранить:** Ctrl+O → Enter → Ctrl+X.

**Шаг 5 — Проверить и запустить:**

```bash
docker compose config   # Проверить что файл валидный (нет ошибок синтаксиса)
docker compose up -d    # Запустить все сервисы (включая новый)
```

> **⚠️ Отступы критически важны!** YAML использует пробелы (НЕ табы) для структуры. Имя сервиса (например `redis:`) должно быть с отступом 2 пробела от начала строки, а его параметры (image, restart и т.д.) — с отступом 4 пробела. Если nano показывает ошибку при `docker compose config` — скорее всего проблема в отступах.

Пример структуры файла после добавления Redis:

```yaml
version: "3.8"

services:
  # ... существующие сервисы (Supabase и т.д.) ...

  redis:                          # ← 2 пробела от начала строки
    image: redis:7-alpine         # ← 4 пробела от начала строки
    restart: unless-stopped
    command: redis-server --maxmemory 1gb
    networks:
      - levelup-net               # ← 6 пробелов (вложенный список)

networks:                         # ← networks: всегда В КОНЦЕ файла
  levelup-net:
    driver: bridge

volumes:                          # ← volumes: самый последний блок
  postgres-data:
  redis-data:
  minio-data:
```

> **Совет:** если вам удобнее — можно редактировать файл на своём компьютере в VS Code (подключившись по SSH через расширение Remote-SSH), а не в nano на сервере. В VS Code подсветка YAML сразу покажет ошибки отступов.

---

### Шаг 0.3 — Supabase (self-hosted) (2–3 дня)

#### Что делать
Развернуть Supabase — это BaaS (Backend-as-a-Service), который из коробки даёт: PostgreSQL 15 (база данных), GoTrue (авторизация), Realtime (WebSocket-подписки), Storage (файловое хранилище), PostgREST (автоматический REST API для таблиц), Studio (веб-интерфейс для управления БД).

#### Конкретные действия

1. **Склонировать официальный репозиторий Supabase:**

```bash
cd /home/deploy/levelup-platform
git clone --depth 1 https://github.com/supabase/supabase
cp -r supabase/docker/* .
# ⚠️ Скрытые файлы (начинающиеся с точки) не копируются командой cp *, поэтому .env.example копируем отдельно:
cp supabase/docker/.env.example .env
```

2. **Настроить `.env` файл — ЭТО КРИТИЧЕСКИ ВАЖНО:**

```bash
nano .env
```

Обязательно изменить:
- `POSTGRES_PASSWORD` — сгенерировать: `openssl rand -hex 20`. ⚠️ **Используйте ТОЛЬКО буквы и цифры (hex)!** Спецсимволы (`&`, `%`, `#`, `@`, `+`, `=`) ломают URL подключения к PostgreSQL и приводят к ошибке `password authentication failed`. Также: если вы уже запускали `docker compose up` с одним паролем, а потом сменили его в `.env` — пароль внутри БД НЕ обновится автоматически. Нужно либо удалить тома (`docker compose down -v`) и пересоздать, либо вручную обновить пароли через `psql`.
- `JWT_SECRET` — случайная строка 64+ символов
- `ANON_KEY` и `SERVICE_ROLE_KEY` — JWT-токены (инструкция ниже)
- `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` — для доступа к Studio
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — для отправки email (пока можно оставить пустым)
- `SITE_URL` — `https://levelup-platform.ru`
- `API_EXTERNAL_URL` — `https://api.levelup-platform.ru`

**Как сгенерировать JWT_SECRET, ANON_KEY и SERVICE_ROLE_KEY:**

Выполните на сервере — скрипт сгенерирует все три ключа за один раз:

```bash
cat > /tmp/gen_keys.py << 'PYEOF'
import hmac, hashlib, base64, json, os

JWT_SECRET = os.popen("openssl rand -hex 40").read().strip()
print(f"JWT_SECRET={JWT_SECRET}")
print()

def make_jwt(payload, secret):
    header = base64.urlsafe_b64encode(json.dumps({"alg":"HS256","typ":"JWT"}).encode()).rstrip(b"=").decode()
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    sig_input = f"{header}.{body}".encode()
    sig = base64.urlsafe_b64encode(hmac.new(secret.encode(), sig_input, hashlib.sha256).digest()).rstrip(b"=").decode()
    return f"{header}.{body}.{sig}"

anon = make_jwt({"role":"anon","iss":"supabase","iat":1743292800,"exp":2058652800}, JWT_SECRET)
service = make_jwt({"role":"service_role","iss":"supabase","iat":1743292800,"exp":2058652800}, JWT_SECRET)

print(f"ANON_KEY={anon}")
print()
print(f"SERVICE_ROLE_KEY={service}")
PYEOF

python3 /tmp/gen_keys.py
```

Скрипт выведет три строки — скопируйте их и вставьте в `.env` через `nano .env`. Найдите строки `JWT_SECRET=`, `ANON_KEY=`, `SERVICE_ROLE_KEY=` и замените значения.

> **Что это такое (для новичка):** JWT_SECRET — секретный ключ, которым Supabase подписывает токены. ANON_KEY — токен с ролью «анонимный пользователь» (ограниченный доступ, используется на фронтенде). SERVICE_ROLE_KEY — токен с ролью «сервис» (полный доступ, используется только на бэкенде, НИКОГДА не передавать на фронтенд). Оба токена подписаны одним JWT_SECRET, поэтому Supabase может их проверить.
>
> **iat** (issued at) = 30 марта 2025, **exp** (expires) = 30 марта 2035 — токены действительны 10 лет.

3. **Запустить:**

```bash
docker compose up -d
```

4. **Проверить, что всё работает:**

```bash
# Все контейнеры должны быть в статусе "Up"
docker compose ps

# Открыть Studio в браузере: http://111.88.113.107:8000
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

6. **~~Установить pgBouncer~~ — ПРОПУСТИТЬ:**

> **⚠️ Этот шаг не нужен.** Начиная с Supabase v2, в комплекте идёт **Supavisor** (`supabase-pooler`) — встроенный пул соединений, который заменяет pgBouncer. Он уже запущен и работает автоматически. Добавлять отдельный pgBouncer не нужно — они будут конфликтовать.
>
> Проверить, что Supavisor работает: `docker compose ps | grep pooler` — должен показать статус `Up (healthy)`.

#### Зачем это нужно
Supabase заменяет огромное количество бэкенд-работы. Вместо того чтобы писать свой REST API, систему авторизации, real-time уведомления и файловое хранилище с нуля — вы получаете всё это из коробки. Для одного разработчика это критически важная экономия времени.

#### Как Supabase связан с архитектурой проекта
В архитектуре LevelUP Supabase — центральный элемент бэкенда. Фронтенд (React) подключается к Supabase напрямую через JavaScript SDK. RLS (Row Level Security) в PostgreSQL обеспечивает безопасность: каждый пользователь видит только свои данные.

#### Важно для 300 пользователей
- **Supavisor (пул соединений)** уже встроен в Supabase v2 и запускается автоматически — без пула соединений PostgreSQL захлебнётся от количества подключений.
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

```bash
# На VPS #1 (levelup-app-01):
cd /home/deploy/levelup-platform
nano docker-compose.yml
# Найдите блок volumes: (Ctrl+W → volumes) и ПЕРЕД ним вставьте блок ниже.
# ВАЖНО: блок redis должен быть ВНУТРИ секции services:, НЕ внутри volumes:!
# Он должен стоять на одном уровне с другими сервисами (kong, studio, db и т.д.)
```

```yaml
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --maxmemory 1gb --maxmemory-policy allkeys-lru --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    networks:
      - levelup-net
    ports:
      - "127.0.0.1:6379:6379"  # только localhost, не наружу!
```

2. **Добавить REDIS_PASSWORD в `.env`:**

```bash
# На VPS #1 (levelup-app-01):
# Сначала сгенерируйте пароль (только буквы и цифры, без спецсимволов):
openssl rand -hex 20
# Скопируйте результат

# Откройте .env:
nano /home/deploy/levelup-platform/.env

# Найдите конец файла (Ctrl+End) и добавьте новую строку:
# REDIS_PASSWORD=сюда_вставьте_сгенерированный_пароль
# Сохраните: Ctrl+O → Enter → Ctrl+X
```

Пример того, как должна выглядеть строка в `.env`:
```bash
REDIS_PASSWORD=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
```

3. **Запустить и проверить:**

```bash
# На VPS #1 (levelup-app-01):
docker compose up -d redis
docker exec -it levelup-platform-redis-1 redis-cli -a $REDIS_PASSWORD ping
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

```bash
# На VPS #1 (levelup-app-01):
cd /home/deploy/levelup-platform
nano docker-compose.yml
# Найдите блок volumes: (Ctrl+W → volumes) и ПЕРЕД ним вставьте блок ниже.
# ВАЖНО: блок minio должен быть ВНУТРИ секции services:, НЕ внутри volumes:!
# Он должен стоять на одном уровне с другими сервисами (kong, studio, redis и т.д.)
```

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
      - levelup-net
    ports:
      - "10.0.0.240:9000:9000"   # API — доступен по приватной сети для VPS #2
      - "127.0.0.1:9001:9001"    # Console (UI) — только локально, открывать через SSH-туннель
```

> **Важно:** порт `9000` привязан к приватному IP `10.0.0.240`, а не к `127.0.0.1`. Именно это позволяет VPS #2 (LiveKit) обращаться к MinIO по приватной сети. Если привязать к `127.0.0.1` — `curl http://10.0.0.240:9000` с VPS #2 будет завершаться ошибкой «Connection refused».

2. **Добавить том в конец `docker-compose.yml`** (в раздел `volumes`):

```yaml
volumes:
  minio-data:
```

3. **Добавить переменные MinIO в `.env`** на VPS #1:

```bash
# На VPS #1 (levelup-app-01):
# Сгенерируйте пароль:
openssl rand -hex 20
# Скопируйте результат

# Откройте .env:
nano /home/deploy/levelup-platform/.env

# Найдите конец файла (Ctrl+End) и добавьте две строки:
# MINIO_ROOT_USER=scoreadmin
# MINIO_ROOT_PASSWORD=сюда_вставьте_сгенерированный_пароль
# Сохраните: Ctrl+O → Enter → Ctrl+X
```

Пример того, как должны выглядеть строки в `.env`:
```bash
MINIO_ROOT_USER=scoreadmin
MINIO_ROOT_PASSWORD=7f3a9b2c4d1e8f6a5b0c7d2e9f4a1b3c8d5e6f7a
```

4. **Запустить MinIO:**

```bash
# На VPS #1 (levelup-app-01):
cd /home/deploy/levelup-platform
docker compose up -d minio

# Проверить, что контейнер запустился
docker compose ps minio

# Проверить логи (должно быть "API: http://..." без ошибок)
docker compose logs minio
```

5. **Проверить доступность:**

```bash
# С VPS #1 (локально):
curl http://10.0.0.240:9000/minio/health/live

# С VPS #2 (по приватной сети) — только после запуска MinIO на VPS #1:
curl http://10.0.0.240:9000/minio/health/live
# Ожидаемый ответ: HTTP 200 (пустое тело — это норма)
```

6. **Открыть MinIO Console через SSH-туннель:**

> **Важно:** MinIO Console привязан к `127.0.0.1:9001` — он НЕ доступен напрямую через браузер по внешнему IP. Нужно создать SSH-туннель.

На **своём компьютере** (Mac/Windows/Linux) откройте терминал и выполните:

```bash
# На СВОЁМ компьютере (не на сервере!):
ssh -L 9001:127.0.0.1:9001 root@111.88.113.107
```

Не закрывайте этот терминал — туннель работает пока он открыт.

Теперь откройте в браузере: **http://localhost:9001**

Логин и пароль — из `.env` файла (переменные `MINIO_ROOT_USER` и `MINIO_ROOT_PASSWORD`). Чтобы посмотреть их:

```bash
# На VPS #1 (levelup-app-01):
grep MINIO /home/deploy/levelup-platform/.env
```

7. **Создать бакеты (папки для файлов) через MinIO Console:**

После входа в MinIO Console (`http://localhost:9001`) создайте бакеты:
- `avatars` — аватарки пользователей
- `documents` — документы (контракты, согласия)
- `courses` — материалы курсов (видео, PDF)
- `materials` — библиотека платформы
- `tenants` — изолированные файлы школ (для Академии)

#### Зачем MinIO, если есть Supabase Storage?

> **Supabase Storage** — это API-слой (SDK, RLS-политики, трансформация изображений). Он НЕ хранит файлы сам — ему нужен бэкенд.
>
> **MinIO** — это S3-совместимый бэкенд, который физически хранит файлы на диске вашего VPS.
>
> **Как они связаны:** Фронтенд и API работают через Supabase Storage SDK (`supabase.storage.from('avatars').upload(...)`). Supabase Storage под капотом сохраняет файлы в MinIO. Вы НЕ обращаетесь к MinIO напрямую из кода приложения.
>
> **Зачем тогда отдельный MinIO-контейнер?**
> 1. Supabase Storage в self-hosted версии может использовать локальный диск или S3-бэкенд. MinIO — это S3-бэкенд на вашем сервере.
> 2. **LiveKit Egress** (запись видеосессий на VPS #2) записывает видео напрямую в MinIO по S3 API через приватную сеть (10.0.0.240:9000). Это единственный сервис, который обращается к MinIO напрямую.
> 3. Бакеты MinIO = бакеты Supabase Storage. Они общие.

#### Что такое MinIO (для новичка)
Это «облачное хранилище файлов» на вашем собственном сервере — локальный аналог Amazon S3. Бакет (bucket) — аналог папки верхнего уровня. Внутри бакета файлы организованы по путям. Supabase Storage использует MinIO как «склад» для файлов, а сам выступает «витриной» с контролем доступа.

---

### Шаг 0.6 — Traefik (reverse proxy + TLS) (1.5–2 дня)

#### Что делать
Настроить Traefik — reverse proxy, который: принимает все входящие запросы; автоматически получает TLS-сертификаты (HTTPS); маршрутизирует запросы к нужным сервисам по домену.

#### Конкретные действия

1. **Создать конфигурацию Traefik:**

```bash
# На VPS #1 (levelup-app-01):
mkdir -p /home/deploy/levelup-platform/traefik/dynamic
nano /home/deploy/levelup-platform/traefik/traefik.yml
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
  # Для wildcard *.levelup-academy.ru нужен DNS challenge
  letsencrypt-dns:
    acme:
      email: rlevch@gmail.com
      storage: /letsencrypt/acme-dns.json
      dnsChallenge:
        provider: selectel  # Selectel DNS API
```

2. **Добавить Traefik в `docker-compose.yml`:**

```bash
# На VPS #1 (levelup-app-01):
cd /home/deploy/levelup-platform
nano docker-compose.yml
# Найдите блок networks: (Ctrl+W → networks) и ПЕРЕД ним вставьте блок ниже:
```

```yaml
  traefik:
  image: traefik:v3.0
  restart: unless-stopped
  ports:
    - "80:80"
    - "443:443"
  environment:
    - SELECTEL_API_TOKEN=${SELECTEL_API_TOKEN}  # Для DNS-01 challenge (wildcard SSL)
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - ./traefik/traefik.yml:/traefik.yml:ro
    - ./traefik/dynamic:/etc/traefik/dynamic:ro
    - ./traefik/letsencrypt:/letsencrypt
  networks:
    - levelup-net
```

3. **Создать динамическую конфигурацию маршрутов:**

```bash
# На VPS #1 (levelup-app-01):
# Папка уже создана на шаге 1 (mkdir -p traefik/dynamic)
nano /home/deploy/levelup-platform/traefik/dynamic/routes.yml
```

```yaml
http:
  routers:
    # Платформа
    platform:
      rule: "Host(`levelup-platform.ru`)"
      service: platform
      tls:
        certResolver: letsencrypt

    # Академия (каталог школ)
    academy:
      rule: "Host(`levelup-academy.ru`)"
      service: academy
      tls:
        certResolver: letsencrypt

    # Школы (поддомены)
    school:
      rule: "HostRegexp(`{subdomain:[a-z0-9-]+}.levelup-academy.ru`)"
      service: school
      tls:
        certResolver: letsencrypt-dns
        domains:
          - main: "levelup-academy.ru"
            sans:
              - "*.levelup-academy.ru"

    # Supabase API
    supabase-api:
      rule: "Host(`api.levelup-platform.ru`)"
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
Traefik — это «дверь» вашего сервера в интернет. Когда пользователь набирает `levelup-platform.ru`, запрос попадает в Traefik, который решает, куда его отправить: к фронтенду платформы, к API, к школе на поддомене и т.д. Traefik также автоматически получает HTTPS-сертификаты от Let's Encrypt.

#### Как работает маршрутизация (для новичка)
```
Пользователь → levelup-platform.ru → Traefik → Platform SPA
Пользователь → levelup-academy.ru → Traefik → Academy SPA
Пользователь → my-school.levelup-academy.ru → Traefik → School SPA
Пользователь → api.levelup-platform.ru → Traefik → Supabase/API Gateway
```

#### Что такое wildcard-сертификат
Обычный сертификат работает для одного домена (levelup-platform.ru). Wildcard-сертификат (`*.levelup-academy.ru`) работает для любого поддомена: `my-school.levelup-academy.ru`, `another-school.levelup-academy.ru` — без необходимости получать отдельный сертификат для каждого. Для этого нужен DNS challenge через Selectel DNS API.

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
# На VPS #2 (levelup-media-01):
# Генерируем API-ключ и секрет для LiveKit:
echo "LIVEKIT_API_KEY=API$(openssl rand -hex 8)"
echo "LIVEKIT_API_SECRET=$(openssl rand -base64 32)"
# Скопируйте оба значения — запишите их! Они нужны для конфигурации ниже и для .env на VPS #1.
```

Сохраните `LIVEKIT_API_KEY` и `LIVEKIT_API_SECRET` — они понадобятся для конфигурации LiveKit и для подключения из API Gateway на VPS #1.

2. **Создать конфигурацию LiveKit:**

```bash
# На VPS #2 (levelup-media-01):
mkdir -p /home/deploy/levelup-platform/livekit
nano /home/deploy/levelup-platform/livekit/config.yaml
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
  <ваш_LIVEKIT_API_KEY>: <ваш_LIVEKIT_API_SECRET>
  # Пример: API54a3ae4306b03070: 0C6qaQzoTnPsCw5V3lvJy1k5SYawx21Z0eJoD1Dd20E=
  # Ключ и секрет генерируются на шаге 1 выше

room:
  max_participants: 10      # макс. в одной комнате (коуч-сессии обычно 1:1)
  empty_timeout: 300        # закрыть комнату через 5 мин без участников

# Встроенный TURN отключён — используем внешний coturn (отдельный контейнер)
# Если включить enabled: true, LiveKit потребует TLS-сертификат (turn.domain + cert),
# что на этапе MVP без доменов приведёт к ошибке "TURN tls cert required"
turn:
  enabled: false

logging:
  level: info

# Для 300 пользователей: ~30-50 одновременных видеосессий
# Каждая сессия потребляет ~2-5 Мбит/с → пиковый трафик ~150-250 Мбит/с
# VPS #2 с 8 vCPU и 1 Gbps справится
```

3. **Создать конфигурацию coturn:**

```bash
# На VPS #2 (levelup-media-01):
# Сначала сгенерируйте секрет для coturn (используется для авторизации TURN-запросов от LiveKit):
openssl rand -hex 32
# Скопируйте результат — это будет ваш COTURN_SECRET
```

```bash
# На VPS #2 (levelup-media-01):
mkdir -p /home/deploy/levelup-platform/coturn
nano /home/deploy/levelup-platform/coturn/turnserver.conf
```

Вставьте конфигурацию ниже, заменив `<ваш_coturn_secret>` на сгенерированное значение:

```ini
# coturn — TURN/STUN сервер для пользователей за NAT/VPN/корп. файрволами
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=<ваш_coturn_secret>
realm=levelup-platform.ru
total-quota=300
stale-nonce=600
# Relay ports для медиа-трафика
min-port=49152
max-port=49252
# Логирование
log-file=/var/log/turnserver.log
simple-log
# Внешний IP (IP VPS #2)
external-ip=111.88.113.71
```

4. **Создать `docker-compose.yml` на VPS #2:**

```bash
# На VPS #2 (levelup-media-01):
mkdir -p /home/deploy/levelup-platform
nano /home/deploy/levelup-platform/docker-compose.yml
```

Вставьте следующее содержимое. **Важно:** замените `${VPS2_EXTERNAL_IP}` на реальный IP — `111.88.113.71`:

```yaml
# VPS #2: docker-compose.yml — медиасервер
version: "3.8"

services:
  livekit:
    image: livekit/livekit-server:latest
    restart: unless-stopped
    command: --config /etc/livekit.yaml --node-ip 111.88.113.71
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

Сохраните (Ctrl+O → Enter → Ctrl+X). Перед запуском убедитесь что конфиги на месте:

```bash
# На VPS #2 (levelup-media-01):
ls -la /home/deploy/levelup-platform/livekit/config.yaml
ls -la /home/deploy/levelup-platform/coturn/turnserver.conf
```

Если оба файла есть — запускайте:

```bash
# На VPS #2 (levelup-media-01):
cd /home/deploy/levelup-platform
docker compose up -d
```

5. **Запустить и проверить:**

```bash
# На VPS #2:
docker compose up -d
docker compose ps  # Оба контейнера должны быть Up

# Проверить LiveKit — открыть https://meet.livekit.io:
# URL: ws://111.88.113.71:7880
# API Key: devkey
# API Secret: <ваш секрет>
# Должно подключиться и показать видео

# Проверить coturn:
# Установить утилиту turnutils (если нужна проверка):
sudo apt install coturn-utils -y
turnutils_uclient -T -p 3478 111.88.113.71
```

6. **Настроить доступ API Gateway (VPS #1) к LiveKit (VPS #2):**

API Gateway на VPS #1 будет генерировать LiveKit-токены. Для этого ему нужно знать LiveKit API endpoint:

```bash
# На VPS #1 (levelup-app-01):
nano /home/deploy/levelup-platform/.env

# Найдите конец файла (Ctrl+End) и добавьте три строки:
LIVEKIT_HOST=ws://111.88.113.71:7880
LIVEKIT_API_KEY=<ваш_LIVEKIT_API_KEY_из_шага_1>
LIVEKIT_API_SECRET=<ваш_LIVEKIT_API_SECRET_из_шага_1>

# Сохраните: Ctrl+O → Enter → Ctrl+X
```

> **Где взять LIVEKIT_API_SECRET?** Это секрет, который вы сгенерировали в пункте 1 этого шага командой `livekit-server generate-keys`. Скопируйте значение `API Secret` оттуда.

#### Зачем это нужно
LiveKit — ключевой компонент для видеосессий коуч↔клиент. Он обеспечивает: видео и аудио в реальном времени; демонстрацию экрана; чат внутри сессии (Data Channel); поддержку TURN для пользователей за корпоративными VPN/NAT.

#### Что такое WebRTC и SFU (для новичка)
WebRTC — технология для видеозвонков в браузере без плагинов. SFU (Selective Forwarding Unit) — сервер-посредник: вместо того чтобы каждый участник отправлял видео каждому другому напрямую (что плохо масштабируется), все отправляют видео на сервер, а сервер рассылает его остальным.

#### Зачем coturn отдельно от LiveKit
LiveKit имеет встроенный TURN, но он базовый. Coturn — специализированный, проверенный временем TURN-сервер. При 300 пользователях часть из них будет за корпоративными VPN/NAT, где WebRTC напрямую не пройдёт. Coturn обеспечивает relay-соединение через TCP/TLS — это работает даже в самых жёстких сетевых окружениях. При 300 пользователях надёжность TURN критична.

#### Зачем выделенный VPS для медиа
Видеопотоки — самая тяжёлая нагрузка в проекте. При 30–50 одновременных сессиях LiveKit потребляет 4–6 vCPU и 150–250 Мбит/с трафика. Если это на одном VPS с PostgreSQL — БД начнёт тормозить, API станет медленным, пользователи на сайте получат задержки. Выделенный VPS #2 изолирует медиа-нагрузку: сайт и API работают стабильно, даже когда все 50 сессий идут одновременно.

---

### Шаг 0.8 — Настройка DNS для доменов (0.5 дня)

#### Что делать
Домены уже зарегистрированы в Selectel:
- ✅ `levelup-platform.ru` — Платформа (активен до 22.03.2027)
- ✅ `levelup-academy.ru` — Академия (активен до 22.03.2027)
- ✅ `levelup-association.ru` — Ассоциация (активен до 22.03.2027)

Осталось настроить DNS-записи, чтобы домены указывали на серверы.

#### Конкретные действия

1. **Создать DNS-зоны в Selectel** (если ещё не созданы):

Перейдите в Selectel → **DNS** → **Доменные зоны** → **Создать зону**. Создайте две зоны:
- `levelup-platform.ru`
- `levelup-academy.ru`

2. **Добавить DNS-записи для `levelup-platform.ru`:**

В Selectel → DNS → Доменные зоны → `levelup-platform.ru` → добавьте записи:

```
# Тип    Имя                          Значение           Пояснение
A        levelup-platform.ru          111.88.113.107     # Основной сайт → VPS #1
A        www                          111.88.113.107     # www-версия → VPS #1
A        api                          111.88.113.107     # API Gateway → VPS #1
A        livekit                      111.88.113.71      # LiveKit → VPS #2 (медиасервер!)
A        turn                         111.88.113.71      # TURN-сервер → VPS #2
```

3. **Добавить DNS-записи для `levelup-academy.ru`:**

В Selectel → DNS → Доменные зоны → `levelup-academy.ru` → добавьте записи:

```
# Тип    Имя                          Значение           Пояснение
A        levelup-academy.ru           111.88.113.107     # Каталог школ → VPS #1
A        www                          111.88.113.107     # www-версия → VPS #1
A        *                            111.88.113.107     # Wildcard для школ! → VPS #1
A        livekit                      111.88.113.71      # LiveKit для школ → VPS #2 (медиасервер!)
A        turn                         111.88.113.71      # TURN для школ → VPS #2
```

> **Важно:** Wildcard-запись `*` означает, что ЛЮБОЙ поддомен (my-school.levelup-academy.ru, best-coach.levelup-academy.ru) будет указывать на ваш VPS #1. Это ключевой элемент мультитенантности — каждая школа получает свой поддомен автоматически, без ручной настройки DNS.

> **Зачем `livekit.levelup-academy.ru`?** Преподаватели школ проводят видеозанятия со студентами (лекции, вебинары, супервизии) — точно так же, как коучи проводят сессии на Платформе. Физически это один и тот же LiveKit-сервер на VPS #2, но фронтенд школ подключается через "свой" домен. Изоляция данных обеспечивается на уровне API (tenant_id в имени комнаты: `tenant_{id}_session_{id}`), а не на уровне инфраструктуры.

4. **Добавить DNS-записи для `levelup-association.ru`:**

В Selectel → DNS → Доменные зоны → `levelup-association.ru` → добавьте записи:

```
# Тип    Имя                          Значение           Пояснение
A        levelup-association.ru       111.88.113.107     # Сайт ассоциации → VPS #1
A        www                          111.88.113.107     # www-версия → VPS #1
```

> **Обратите внимание:** все веб-домены указывают на VPS #1 (Traefik принимает весь веб-трафик). Поддомены `livekit.` и `turn.` для **обоих** доменов (platform и academy) указывают на VPS #2 (медиасервер). Фронтенд Платформы подключается через `wss://livekit.levelup-platform.ru`, фронтенд школ — через `wss://livekit.levelup-academy.ru`. Физически это один LiveKit-сервер.

5. **Проверить DNS** (подождать 5–30 минут после настройки):

```bash
# С любого компьютера:
dig levelup-platform.ru +short
# Ожидаемый ответ: 111.88.113.107

dig api.levelup-platform.ru +short
# Ожидаемый ответ: 111.88.113.107

dig livekit.levelup-platform.ru +short
# Ожидаемый ответ: 111.88.113.71 (VPS #2!)

dig levelup-academy.ru +short
# Ожидаемый ответ: 111.88.113.107

dig myschool.levelup-academy.ru +short
# Ожидаемый ответ: 111.88.113.107 (wildcard!)

dig livekit.levelup-academy.ru +short
# Ожидаемый ответ: 111.88.113.71 (VPS #2 — LiveKit для школ!)

dig levelup-association.ru +short
# Ожидаемый ответ: 111.88.113.107
```

> Если `dig` не установлен, используйте `nslookup levelup-platform.ru` или онлайн-сервис https://dnschecker.org

---

### Шаг 0.9 — Инициализация монорепозитория (2–3 дня)

#### Что делать
Создать структуру проекта: монорепозиторий с несколькими React-приложениями и общими пакетами.

#### Конкретные действия

1. **Создать монорепозиторий:**

> **Важно:** Все команды ниже выполняются **на своём компьютере (Mac/Windows/Linux)**, а не на сервере. Требуется Node.js >= 22. Проверьте: `node -v`. Если версия ниже — скачайте LTS с https://nodejs.org

```bash
# На своём компьютере (не на сервере!)
cd ~
mkdir levelup-platform && cd levelup-platform
git init

# Инициализировать package.json
npm init -y

# Установить Turborepo для управления монорепо
npm install turbo --save-dev
```

2. **Создать структуру папок:**

```bash
mkdir -p apps/platform/src          # Платформа (levelup-platform.ru)
mkdir -p apps/academy/src           # Академия (levelup-academy.ru)
mkdir -p apps/school/src            # SPA школы (*.levelup-academy.ru)
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
# В корне монорепозитория:
cd ~/levelup-platform/apps/platform
npm create vite@latest . -- --template react-ts
npm install react-router-dom @tanstack/react-query zustand
npm install -D tailwindcss @tailwindcss/vite
```

> **Tailwind CSS v4:** Команды `npx tailwindcss init -p`, `postcss` и `autoprefixer` больше НЕ нужны. В v4 используется плагин Vite.

Настройте Tailwind v4 — откройте `vite.config.ts` и замените содержимое:

```ts
// apps/platform/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

Откройте `src/index.css` и замените всё содержимое на:

```css
@import "tailwindcss";
```

Проверьте что всё работает:

```bash
npm run dev
# Должен запуститься на http://localhost:5173
```

4. **Настроить Turborepo (`turbo.json` в корне):**

```bash
# На своём компьютере, в корне монорепозитория:
cd ~/levelup-platform
npm install -D turbo
nano turbo.json
```

Вставьте:

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

Сохраните: Ctrl+O → Enter → Ctrl+X

5. **Настроить рабочие пространства (`package.json` в корне):**

Файл `~/levelup-platform/package.json` уже создан на шаге 1 (через `npm init -y`). Нужно добавить `workspaces` и скрипты. Откройте его:

```bash
# На своём компьютере, в корне монорепозитория:
cd ~/levelup-platform
nano package.json
```

Замените **всё содержимое** на:

```json
{
  "name": "levelup-platform",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*",
    "services/*"
  ],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "turbo": "^2.8.20"
  }
}
```

Сохраните: Ctrl+O → Enter → Ctrl+X

> **Важно:** `"private": true` обязателен для workspaces. Без него npm не будет линковать пакеты между собой.

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
Использовать lovable.dev (AI-генератор UI) для быстрого создания базовых экранов всех приложений экосистемы. Lovable генерирует React + Tailwind + shadcn/ui код, который потом адаптируется к монорепозиторию.

#### Важные правила работы с lovable.dev

- Генерируйте **по одному экрану за раз** — так качество кода выше
- В начале каждого промпта задайте **контекст проекта** (см. системный промпт ниже)
- Экспортированный код — **черновик**, не финал. Нужно будет подключить реальные данные, роутинг, авторизацию
- Не пытайтесь сгенерировать всё за один раз — сначала ключевые экраны, остальное доработаете вручную
- lovable.dev использует shadcn/ui — это совпадает с нашим стеком, код будет совместим

#### Как lovable поймёт структуру данных

Lovable не знает вашу БД. Если дать ему только визуальное описание, он нагенерит захардкоженные моки с выдуманными полями. Потом придётся всё переделывать.

**Решение:** в каждый промпт вставляйте TypeScript-интерфейсы, которые точно соответствуют таблицам вашей БД. Lovable сгенерирует компоненты с правильными типами, полями и моковыми данными нужной формы.

#### Конкретные действия

**1. Задать системный контекст проекта в lovable.dev:**

При создании нового проекта в lovable.dev используйте этот системный промпт (вставьте в начале первого запроса):

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

**2. Общие TypeScript-типы (вставьте в первый промпт каждого проекта lovable):**

```typescript
// === ОБЩИЕ ТИПЫ (из схемы БД) ===

// Профиль пользователя (public.profiles)
interface Profile {
  id: string;                    // UUID, ссылка на auth.users
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  specializations: string[];     // TEXT[]
  timezone: string;              // default 'Europe/Moscow'
  phone: string | null;
  created_at: string;            // ISO datetime
  updated_at: string;
}

// Роль пользователя (public.user_roles)
type UserRole = 'client' | 'coach' | 'school_owner' | 'instructor' | 'admin';

// Уведомление (public.notifications)
interface Notification {
  id: string;
  user_id: string;
  type: 'booking' | 'payment' | 'message' | 'system';
  title: string;
  body: string | null;
  read: boolean;
  data: Record<string, any> | null;  // JSONB
  created_at: string;
}
```

**3. Генерация экранов для Платформы (lovable-проект 1: levelup-platform.ru):**

Генерируйте каждый экран отдельным промптом:

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

Стиль: премиальный, доверительный. Цвета: тёмно-синий (#1e3a5f) для хедера/футера, белый фон основных секций, золотой (#c9a84c) для CTA-кнопок.
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

Layout:
- Сайдбар слева (сворачиваемый на мобильных): логотип, пункты меню с иконками:
  - Главная (LayoutDashboard)
  - Расписание (Calendar)
  - Клиенты (Users)
  - Сессии (Video)
  - Игры (Gamepad2)
  - Магазин (ShoppingBag)
  - Финансы (Wallet)
  - Библиотека (BookOpen)
  - Настройки (Settings)
- Хедер: поиск, иконка уведомлений (Notification[] с бейджем count where read=false), аватар с dropdown-меню

Основная область — 4 виджета:
1. "Ближайшие сессии" — Session[] (status='confirmed', ordered by scheduled_at ASC, limit 3). Карточка: client.first_name + last_name, scheduled_at, service.type, кнопка "Начать"
2. "Статистика за месяц" — CoachDashboardStats: sessions_completed, new_clients, revenue (₽), avg_rating
3. "Активные клиенты" — DataTable<ClientRow> с колонками: аватар+имя, last_session_at, next_session_at, progress_pct (progress bar). Сортировка по next_session_at
4. "Уведомления" — Notification[] (limit 5, ordered by created_at DESC). Иконка по type + title + relative time

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

Стиль: строгий, профессиональный. Цвета: тёмно-синий (#1e3a5f), золотой (#c9a84c) для акцентов.
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
  - Таб "Игры": кнопки запуска МАК-карт, кубиков (заглушки)
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
4. Кнопка "Выгрузить в Excel" (заглушка)

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

**11. Экспортировать и адаптировать код:**

После генерации всех экранов:

a) **Экспортировать код** из lovable.dev — нажмите кнопку "Export" → скачайте ZIP или подключите GitHub

b) **Создать файл общих типов в монорепозитории:**

```bash
cd ~/levelup-platform
mkdir -p packages/shared/src/types
```

```typescript
// packages/shared/src/types/database.ts
// Все типы из промптов lovable — одна точка правды для всех приложений.
// Этот файл генерируется из SQL-миграций (или supabase gen types typescript).

// === PUBLIC ===
export interface Profile {
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

export type UserRole = 'client' | 'coach' | 'school_owner' | 'instructor' | 'admin';

export interface Notification {
  id: string;
  user_id: string;
  type: 'booking' | 'payment' | 'message' | 'system';
  title: string;
  body: string | null;
  read: boolean;
  data: Record<string, any> | null;
  created_at: string;
}

// === PLATFORM ===
export interface CoachService {
  id: string;
  coach_id: string;
  title: string;
  description: string | null;
  type: 'individual_session' | 'group_session' | 'consultation' | 'package';
  price: number;
  duration_min: number;
  is_active: boolean;
  created_at: string;
}

export interface Session {
  id: string;
  service_id: string;
  coach_id: string;
  client_id: string;
  scheduled_at: string;
  duration_min: number;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  livekit_room_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  session_id: string;
  client_id: string;
  coach_id: string;
  rating: number;
  text: string | null;
  created_at: string;
}

// === ACADEMY ===
export interface Course {
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
}

export interface Enrollment {
  id: string;
  tenant_id: string;
  user_id: string;
  course_id: string;
  status: 'active' | 'completed' | 'canceled' | 'expired';
  progress_pct: number;
  enrolled_at: string;
  source: 'direct' | 'funnel' | 'promo_code' | 'import';
}

// ... остальные типы аналогично (Module, Lesson, School, Payment и т.д.)
// Полный файл будет сгенерирован командой: npx supabase gen types typescript
```

c) **Разложить компоненты по модульной структуре монорепозитория:**

> **ВАЖНО:** Архитектура проекта использует модульную структуру `src/modules/`, а не flat `src/pages/` + `src/components/`. Каждый модуль — это самостоятельная фича со своими компонентами, хуками и типами.

```bash
cd ~/levelup-platform

# === Шаг 1: Общие UI-компоненты (shadcn/ui) → packages/ui ===
# Берём из ПЕРВОГО экспортированного lovable-проекта
mkdir -p packages/ui/src/components
cp -r /tmp/lovable-platform/src/components/ui/* packages/ui/src/components/
# Button, Card, Dialog, Input, Select, Badge, Avatar, Tooltip, DataTable и т.д.

# === Шаг 2: Платформа (lovable-проект 1, промпты 1-5, 11-15) ===
# Раскладываем по модулям согласно architecture.md:

# Модуль auth (промпт 2):
mkdir -p apps/platform/src/modules/auth
cp /tmp/lovable-platform/src/pages/Auth.tsx apps/platform/src/modules/auth/
cp /tmp/lovable-platform/src/pages/ForgotPassword.tsx apps/platform/src/modules/auth/ 2>/dev/null

# Модуль marketplace (промпт 1 — лендинг, каталог коучей):
mkdir -p apps/platform/src/modules/marketplace
cp /tmp/lovable-platform/src/pages/Landing.tsx apps/platform/src/modules/marketplace/
cp /tmp/lovable-platform/src/pages/CoachCatalog.tsx apps/platform/src/modules/marketplace/ 2>/dev/null

# Модуль coach-profile (промпт 5 — публичный профиль, промпт 11 — настройки):
mkdir -p apps/platform/src/modules/coach-profile
cp /tmp/lovable-platform/src/pages/CoachProfile.tsx apps/platform/src/modules/coach-profile/
cp /tmp/lovable-platform/src/pages/ProfileSettings.tsx apps/platform/src/modules/coach-profile/
cp /tmp/lovable-platform/src/components/BookingModal.tsx apps/platform/src/modules/coach-profile/

# Модуль sessions (промпт 3 — дашборд коуча, промпт 12 — услуги, промпт 13 — расписание):
mkdir -p apps/platform/src/modules/sessions
cp /tmp/lovable-platform/src/pages/CoachDashboard.tsx apps/platform/src/modules/sessions/
cp /tmp/lovable-platform/src/pages/Services.tsx apps/platform/src/modules/sessions/
cp /tmp/lovable-platform/src/pages/Schedule.tsx apps/platform/src/modules/sessions/

# Модуль client-portal (промпт 4):
mkdir -p apps/platform/src/modules/client-portal
cp /tmp/lovable-platform/src/pages/ClientDashboard.tsx apps/platform/src/modules/client-portal/

# Модуль video (промпт 14):
mkdir -p apps/platform/src/modules/video
cp /tmp/lovable-platform/src/pages/VideoSession.tsx apps/platform/src/modules/video/

# Модуль billing (промпт 15):
mkdir -p apps/platform/src/modules/billing
cp /tmp/lovable-platform/src/pages/Finance.tsx apps/platform/src/modules/billing/

# Моки (временно, потом заменим на Supabase):
cp -r /tmp/lovable-platform/src/mocks apps/platform/src/mocks/

# === Шаг 3: Академия (lovable-проект 2, промпты 6-7) ===
mkdir -p apps/academy/src/modules/{auth,school-catalog}
cp /tmp/lovable-academy/src/pages/Landing.tsx apps/academy/src/modules/school-catalog/
cp /tmp/lovable-academy/src/pages/CreateSchool.tsx apps/academy/src/modules/school-catalog/
cp -r /tmp/lovable-academy/src/mocks apps/academy/src/mocks/

# === Шаг 4: SPA школы (lovable-проект 3, промпты 9, 19-20) ===
mkdir -p apps/school/src/modules/{home,courses,course,student-portal}
cp /tmp/lovable-school/src/pages/SchoolHome.tsx apps/school/src/modules/home/
cp /tmp/lovable-school/src/pages/CourseCatalog.tsx apps/school/src/modules/courses/
cp /tmp/lovable-school/src/pages/CourseLearning.tsx apps/school/src/modules/course/
cp /tmp/lovable-school/src/pages/StudentPortal.tsx apps/school/src/modules/student-portal/
cp -r /tmp/lovable-school/src/mocks apps/school/src/mocks/

# === Шаг 5: Админка школы (lovable-проект 4, промпты 8, 16-18, 21-22) ===
mkdir -p apps/school-admin/src/modules/{dashboard,courses,students,settings,sales,certificates}
cp /tmp/lovable-school-admin/src/pages/Dashboard.tsx apps/school-admin/src/modules/dashboard/
cp /tmp/lovable-school-admin/src/pages/CourseEditor.tsx apps/school-admin/src/modules/courses/
cp /tmp/lovable-school-admin/src/pages/Students.tsx apps/school-admin/src/modules/students/
cp /tmp/lovable-school-admin/src/pages/Settings.tsx apps/school-admin/src/modules/settings/
cp /tmp/lovable-school-admin/src/pages/PromoCodes.tsx apps/school-admin/src/modules/sales/
cp /tmp/lovable-school-admin/src/pages/Certificates.tsx apps/school-admin/src/modules/certificates/
cp -r /tmp/lovable-school-admin/src/mocks apps/school-admin/src/mocks/

# === Шаг 6: Ассоциация (lovable-проект 5, промпт 10) ===
mkdir -p apps/association/src/modules/{membership,registry,events}
cp /tmp/lovable-association/src/pages/Landing.tsx apps/association/src/modules/membership/
cp -r /tmp/lovable-association/src/mocks apps/association/src/mocks/
```

> **Примечание:** Имена файлов в lovable могут отличаться (Index.tsx, Home.tsx и т.д.). Переименуйте под вашу конвенцию. Каждый модуль потом получит index.ts с re-exports.

d) **Исправить импорты:**

```bash
# В apps/platform — заменить lovable-импорты на пакетные:
# ДО (lovable):  import { Button } from "@/components/ui/button"
# ПОСЛЕ:         import { Button } from "@levelup/ui"
#
# ДО (lovable):  import { Profile } from "../types"
# ПОСЛЕ:         import { Profile } from "@levelup/shared/types/database"
#
# Массовая замена:
cd apps/platform
find src -name "*.tsx" -exec sed -i 's|@/components/ui/|@levelup/ui/|g' {} +
find src -name "*.tsx" -exec sed -i 's|<a href=|<Link to=|g' {} +
```

e) **Подключить реальные данные (после деплоя Supabase):**

```typescript
// Замена моков на реальные запросы:
// ДО (мок):
import { mockSessions } from '@/mocks/data';
const sessions = mockSessions;

// ПОСЛЕ (Supabase):
import { supabase } from '@levelup/shared/lib/supabase';
const { data: sessions } = await supabase
  .from('sessions')
  .select('*, client:profiles!client_id(*), service:coach_services(*)')
  .eq('coach_id', userId)
  .eq('status', 'confirmed')
  .order('scheduled_at', { ascending: true })
  .limit(3);
```

f) **Проверить что всё работает:**

```bash
cd ~/levelup-platform

# Проверить типы:
npx turbo typecheck

# Запустить:
npx turbo dev --filter=platform
# Открыть http://localhost:5173

npx turbo dev --filter=academy
# Открыть http://localhost:5174
```

#### Зачем это нужно
lovable.dev экономит 40–60% времени на вёрстке. Благодаря TypeScript-типам из схемы БД, сгенерированный код уже будет содержать правильные поля и структуры данных. Замена моков на реальные Supabase-запросы — это замена одной строки, а не переписывание компонента.

#### Приоритет экранов (что генерировать первым)

Для MVP генерируйте в таком порядке:

**Волна 1 — Платформа, `apps/platform` (промпты 1-5, 11-15) — lovable-проект 1:**
Лендинг → Авторизация → Дашборд коуча → Дашборд клиента → Профиль коуча → Настройки профиля → CRUD услуг → Расписание → Видеосессия → Финансы

**Волна 2 — Академия + Школа, `apps/academy` + `apps/school` + `apps/school-admin` (промпты 6-9, 16-22) — lovable-проекты 2, 3, 4:**
Лендинг академии + каталог школ → Wizard создания школы → Админка школы (dashboard) → Создание курса → Управление студентами → Настройки школы → Промо-коды → Сертификаты → Главная школы (student-facing) → Личный кабинет студента → Страница курса

**Волна 3 — Ассоциация, `apps/association` (промпт 10) — lovable-проект 5:**
Лендинг → Реестр коучей

**Волна 4 — Отложенные модули (после MVP, не генерировать сейчас):**
- `apps/association` — дашборд члена, сертификация, мероприятия (заявки), tracking часов
- `apps/admin` — админка ПЛАТФОРМЫ (управление школами, пользователями, модерация)
- `apps/platform` — чат (мессенджер), gameboard (МАК-карты, кубики), магазин, контент/библиотека, AI-помощник, диагностика
- `apps/school` — блог школы, статические страницы, CRM/воронки

> **Карта lovable-проектов → apps монорепозитория:**
> | Lovable-проект | Промпты | → App в монорепо |
> |---|---|---|
> | Проект 1 (Платформа) | 1-5, 11-15 | `apps/platform/` |
> | Проект 2 (Академия) | 6-7 | `apps/academy/` |
> | Проект 3 (Школа/студент) | 9, 19-20 | `apps/school/` |
> | Проект 4 (Админка школы) | 8, 16-18, 21-22 | `apps/school-admin/` |
> | Проект 5 (Ассоциация) | 10 | `apps/association/` |

> **Совет:** На каждый промпт в lovable уходит ~15-20 минут. Все 22 промпта — ~6-8 часов чистого времени. За 2-3 дня спокойно успеете. Волна 1 — приоритет, это ядро MVP.

---

### Шаг 0.11 — App Shell платформы (2 дня)

#### Что делать
Создать «каркас» приложения: навигацию, роутинг, layout для авторизованных и неавторизованных пользователей.

#### Конкретные действия

1. **Настроить CORS для MinIO (загрузка файлов с фронтенда):**

> На этом этапе домены уже настроены (шаг 0.8), поэтому можно настроить CORS для MinIO.

```bash
# На VPS #1 (levelup-app-01):
source /home/deploy/levelup-platform/.env
mc alias set local http://10.0.0.240:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"

cat > /tmp/cors.json << 'EOF'
{
  "CORSRules": [{
    "AllowedOrigins": ["https://levelup-platform.ru", "https://*.levelup-academy.ru"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"]
  }]
}
EOF

# Разрешить публичное чтение для аватарок и материалов:
mc anonymous set download local/avatars
mc anonymous set download local/materials
```

> **Примечание:** `mc` (MinIO Client) был установлен на шаге 0.5. Если команда `mc` не найдена, установите: `curl -O https://dl.min.io/client/mc/release/linux-amd64/mc && chmod +x mc && mv mc /usr/local/bin/`

2. **Настроить React Router с ленивой загрузкой:**

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

Зарегистрировать приложение на `id.vk.com/about/business/go`. Получить `client_id` и `client_secret`. Добавить redirect URL: `https://api.levelup-platform.ru/auth/v1/callback`.

```tsx
// Вход через VK ID
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'vkontakte',    // Supabase поддерживает VK как провайдер
  options: {
    redirectTo: 'https://levelup-platform.ru/dashboard',
  }
});
```

Если Supabase GoTrue не поддерживает VK ID «из коробки», нужно реализовать custom OAuth flow через API Gateway.

3. **Создать хук `useAuth`:**

```tsx
// apps/platform/src/modules/auth/useAuth.ts
import { useEffect, useState } from 'react';
import { supabase } from '@levelup/supabase';
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
    'https://levelup-platform.ru',
    'https://levelup-academy.ru',
    /\.levelup-academy\.ru$/,   // Все поддомены школ
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

```bash
# На VPS #1 (levelup-app-01):
cd /home/deploy/levelup-platform
nano docker-compose.yml
# Найдите блок networks: (Ctrl+W → networks) и ПЕРЕД ним вставьте блок ниже.
# Сохраните: Ctrl+O → Enter → Ctrl+X
```

```yaml
  api-gateway:
  build: ./services/api-gateway
  restart: unless-stopped
  environment:
    - SUPABASE_URL=http://supabase-kong:8000
    - SUPABASE_SERVICE_KEY=${SERVICE_ROLE_KEY}
    - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
    - DATABASE_URL=postgres://postgres:${POSTGRES_PASSWORD}@supabase-pooler:6543/postgres  # Через Supavisor (пул соединений)
    - LIVEKIT_HOST=ws://${VPS2_EXTERNAL_IP}:7880      # LiveKit на VPS #2
    - LIVEKIT_API_KEY=${LIVEKIT_API_KEY}
    - LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}
    - NODE_CLUSTER_WORKERS=4                            # 4 воркера для 300 пользователей
  networks:
    - levelup-net
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
      sender_name: 'LevelUP',
      sender_email: 'noreply@levelup-platform.ru',
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
            cd /home/deploy/levelup-platform
            git pull origin main
            docker compose up -d --build

      - name: Deploy to VPS #2 (медиасервер)
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS2_HOST }}
          username: deploy
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /home/deploy/levelup-platform
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

```bash
# На VPS #1 (levelup-app-01):
cd /home/deploy/levelup-platform
nano docker-compose.yml
# Найдите блок networks: (Ctrl+W → networks) и ПЕРЕД ним вставьте блок ниже.
# Сохраните: Ctrl+O → Enter → Ctrl+X
```

```yaml
  prometheus:
  image: prom/prometheus:latest
  restart: unless-stopped
  volumes:
    - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    - prometheus-data:/prometheus
  networks:
    - levelup-net
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
    - levelup-net
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
      - targets: ['111.88.113.71:9100']

  - job_name: 'postgresql'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'livekit'
    static_configs:
      - targets: ['111.88.113.71:7880']
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
   - Проверяет `levelup-platform.ru` каждые 5 минут
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
# На VPS #1 (levelup-app-01):
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
docker run --rm --network levelup-net \
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
# На VPS #1 (levelup-app-01):
crontab -e
# Добавить строку:
0 3 * * * /home/deploy/scripts/backup.sh >> /home/deploy/logs/backup.log 2>&1
```

3. **Создать бакет backups в MinIO:**

В MinIO Console → Buckets → Create → `backups`

4. **Проверить вручную:**

```bash
# На VPS #1 (levelup-app-01):
/home/deploy/scripts/backup.sh
# Проверить, что файл появился:
ls -la /home/deploy/backups/
# И в MinIO Console → backups
```

#### Как восстановить из бэкапа

```bash
# На VPS #1 (levelup-app-01):
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
SITE_URL=https://levelup-platform.ru
API_EXTERNAL_URL=https://api.levelup-platform.ru
SUPABASE_PUBLIC_URL=https://api.levelup-platform.ru

# ─── Redis ─────────────────────────────────────
REDIS_PASSWORD=<сгенерировать: openssl rand -base64 32>

# ─── MinIO ─────────────────────────────────────
MINIO_ROOT_USER=scoreadmin
MINIO_ROOT_PASSWORD=<сгенерировать: openssl rand -base64 32>

# ─── LiveKit (VPS #2) ─────────────────────────
LIVEKIT_HOST=wss://livekit.levelup-platform.ru
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=<секрет из шага 0.7>
VPS2_EXTERNAL_IP=111.88.113.71

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

# ─── Selectel ─────────────────────────────────
SELECTEL_API_TOKEN=<API-ключ: Панель Selectel → Профиль → API-ключи>
# Используется Traefik для DNS-01 challenge (wildcard SSL *.levelup-academy.ru)

# ─── Общее ─────────────────────────────────────
NODE_ENV=production
VPS1_EXTERNAL_IP=111.88.113.107
VPS1_PRIVATE_IP=10.0.0.240
VPS2_PRIVATE_IP=10.0.0.2
```

#### .env для VPS #2 (медиасервер)

```bash
# === .env — VPS #2 (медиасервер) ===

# ─── LiveKit ───────────────────────────────────
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=<тот же секрет, что на VPS #1>
VPS2_EXTERNAL_IP=111.88.113.71
VPS2_PRIVATE_IP=10.0.0.2

# ─── coturn ────────────────────────────────────
TURN_SECRET=<сгенерировать: openssl rand -base64 32>
TURN_REALM=levelup-platform.ru

# ─── MinIO на VPS #1 (через приватную сеть Selectel) ───
MINIO_ENDPOINT=http://10.0.0.240:9000  # Приватный IP VPS #1!
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

  # ─── pgBouncer НЕ НУЖЕН ─────────────────────────────────────────────────
  # Supabase v2 включает Supavisor (supabase-pooler) — встроенный пул соединений.
  # Он запускается автоматически на портах 5432 и 6543. Отдельный pgBouncer не добавляйте.

  # ─── Redis ───────────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --maxmemory 1gb --maxmemory-policy allkeys-lru --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    networks:
      - levelup-net
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
      - levelup-net
    ports:
      - "10.0.0.240:9000:9000"   # API — доступен по приватной сети для VPS #2
      - "127.0.0.1:9001:9001"    # Console (UI) — только локально

  # ─── API Gateway (Fastify) ──────────────────────────────────────────────
  api-gateway:
    build: ./services/api-gateway
    restart: unless-stopped
    environment:
      SUPABASE_URL: http://supabase-kong:8000
      SUPABASE_SERVICE_KEY: ${SERVICE_ROLE_KEY}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD}@supabase-pooler:6543/postgres
      LIVEKIT_HOST: ${LIVEKIT_HOST}
      LIVEKIT_API_KEY: ${LIVEKIT_API_KEY}
      LIVEKIT_API_SECRET: ${LIVEKIT_API_SECRET}
      YOOKASSA_SHOP_ID: ${YOOKASSA_SHOP_ID}
      YOOKASSA_SECRET_KEY: ${YOOKASSA_SECRET_KEY}
      NODE_CLUSTER_WORKERS: "4"
    networks:
      - levelup-net
    depends_on:
      - redis
      - supabase-db

  # ─── Email Worker (BullMQ) ──────────────────────────────────────────────
  email-worker:
    build: ./services/email-worker
    restart: unless-stopped
    environment:
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      UNISENDER_API_KEY: ${UNISENDER_API_KEY}
    networks:
      - levelup-net
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
      - levelup-net

  # ─── Prometheus (метрики) ───────────────────────────────────────────────
  prometheus:
    image: prom/prometheus:latest
    restart: unless-stopped
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    networks:
      - levelup-net
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
      - levelup-net
    ports:
      - "127.0.0.1:3333:3000"

networks:
  levelup-net:
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
- **VPS #1** (приложение): Docker, Supabase (PostgreSQL + Supavisor + GoTrue + Realtime + Storage), Redis, MinIO, Traefik, API Gateway
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
      serverUrl={import.meta.env.VITE_LIVEKIT_URL}  // wss://livekit.levelup-platform.ru (VPS #2)
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
   - Настроить webhook URL: `https://api.levelup-platform.ru/api/payments/webhook`

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
      return_url: `https://levelup-platform.ru/dashboard/sessions/${sessionId}?paid=true`,
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

**Можно запускать levelup-platform.ru и начинать монетизацию.**

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
  slug TEXT UNIQUE NOT NULL,  -- Поддомен: my-school.levelup-academy.ru
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
  domain TEXT NOT NULL UNIQUE,            -- my-school.levelup-academy.ru или custom.com
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
  const match = host.match(/^([a-z0-9-]+)\.levelup-academy\.ru$/);
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

1. **Academy SPA** (levelup-academy.ru):
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

2. **School SPA** (для `*.levelup-academy.ru`):
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
      // Примеры: my-school.levelup-academy.ru → slug = "my-school"
      const hostname = window.location.hostname;
      const slug = hostname.split('.')[0]; // Первая часть поддомена

      if (!slug || slug === 'levelup-academy' || slug === 'www') {
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

**Можно запускать levelup-academy.ru и начинать монетизацию.**

---

## Архитектура для 300 одновременных пользователей (2 VPS)

### Распределение сервисов по серверам

| Сервис | VPS #1 (приложение) | VPS #2 (медиасервер) |
|--------|:---:|:---:|
| PostgreSQL + Supavisor | ✅ | — |
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
- **Supavisor (пул соединений)** — при 300 пользователях без пула соединений PostgreSQL захлебнётся (встроен в Supabase v2)
- **Бэкапы PostgreSQL** — потеря данных = потеря бизнеса
- **Фискализация 54-ФЗ** — требование закона
- **Выделенный медиасервер (VPS #2)** — видеонагрузка не должна конкурировать с БД и API

### Конфигурация серверов на Selectel для 300 пользователей

```
VPS #1 — levelup-app-01 (Selectel Cloud Server, линейка «Стандарт»):
- 8 vCPU
- 32 GB RAM
- 500 GB NVMe SSD (локальный диск)
- Ubuntu 22.04 LTS, 1 Gbps
- Регион: ru-1 (СПб) или ru-3 (МСК)
- Приватная сеть: levelup-internal (10.0.0.0/24)
- Стоимость: ~8 000–12 000 ₽/мес

Распределение ресурсов VPS #1:
- PostgreSQL: 8 GB RAM (shared_buffers)
- Supavisor: ~200 MB (встроен в Supabase)
- Supabase (GoTrue, Realtime, PostgREST): 4 GB
- Redis: 1 GB
- Fastify (API Gateway, 4 воркера): 2 GB
- React SPA (nginx): ~200 MB
- MinIO: 1 GB
- Traefik: ~200 MB
- Prometheus + Grafana: 1–2 GB
- OS + Docker: 3 GB

VPS #2 — levelup-media-01 (Selectel Cloud Server, линейка «Стандарт»):
- 8 vCPU
- 16 GB RAM
- 200 GB NVMe SSD (локальный диск)
- Ubuntu 22.04 LTS, 1 Gbps
- Регион: тот же, что VPS #1!
- Приватная сеть: levelup-internal (10.0.0.0/24)
- Стоимость: ~5 000–7 000 ₽/мес

Распределение ресурсов VPS #2:
- LiveKit Server: 8–12 GB RAM (основной потребитель)
- coturn: 1–2 GB RAM
- node_exporter (мониторинг): ~50 MB
- OS + Docker: 2 GB

Связь: приватная сеть Selectel (10.0.0.x), бесплатно, <1 мс
DNS: Selectel DNS (wildcard SSL через DNS-01 challenge)
Итого: ~13 000–19 000 ₽/мес за оба сервера
```

### Сетевая схема (как серверы связаны)

```
Пользователь (браузер)
    │
    ├── HTTPS ──→ VPS #1 (Traefik :443)
    │              ├── levelup-platform.ru → Platform SPA (nginx)
    │              ├── levelup-academy.ru → Academy SPA
    │              ├── *.levelup-academy.ru → School SPA
    │              ├── api.levelup-platform.ru → Supabase / API Gateway
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
| 0.3 | 0 | Supabase + Supavisor (VPS #1) | 3 | 0.2 |
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

### 4. Supavisor (пул соединений): «too many clients» или «connection refused»

**Симптом:** Приложение не может подключиться к БД при нагрузке.

```bash
# Проверьте текущие подключения к PostgreSQL:
docker compose exec db psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Проверьте статус Supavisor:
docker compose ps | grep pooler
docker compose logs pooler --tail 20
```

**Решение:** Убедитесь, что приложение подключается через Supavisor (`supabase-pooler`, порт 6543), а НЕ напрямую к PostgreSQL (порт 5432). Если Supavisor перезапускается — проверьте, что пароли в `.env` совпадают с паролями внутри БД.

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
- TURN-сервер недоступен → убедитесь, что DNS для `turn.levelup-platform.ru` указывает на VPS #2

---

### 6. Traefik: сертификат не выдаётся / «TLS handshake error»

**Симптом:** Сайт показывает предупреждение о безопасности, или сертификат самоподписанный.

```bash
# Логи Traefik:
docker compose logs traefik --tail 100

# Проверить, что DNS-записи существуют:
dig levelup-platform.ru A
dig *.levelup-academy.ru A

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
    'https://levelup-platform.ru',
    'https://levelup-academy.ru',
    /\.levelup-academy\.ru$/,  // Все поддомены школ
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
- [ ] Supavisor (supabase-pooler) работает: `docker compose ps | grep pooler` → Up (healthy)

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
- [ ] UptimeRobot проверяет доступность levelup-platform.ru
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
