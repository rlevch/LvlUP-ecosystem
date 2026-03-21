# =============================================================================
# SCORE Coaching — Makefile
# =============================================================================
# Быстрые команды для управления проектом
# =============================================================================

.PHONY: help up down restart logs ps build clean db-backup db-restore \
        setup-env generate-keys cert-init cert-renew

# Цвета
GREEN  := \033[0;32m
YELLOW := \033[1;33m
NC     := \033[0m

help: ## Показать справку
	@echo ""
	@echo "$(GREEN)SCORE Coaching — Управление$(NC)"
	@echo "=========================================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

# ---------------------------------------------------------------------------
# Docker Compose
# ---------------------------------------------------------------------------
up: ## Запустить все сервисы
	docker compose up -d
	@echo "$(GREEN)Сервисы запущены. Логи: make logs$(NC)"

down: ## Остановить все сервисы
	docker compose down

restart: ## Перезапустить все сервисы
	docker compose restart

logs: ## Показать логи всех сервисов (Ctrl+C для выхода)
	docker compose logs -f --tail=100

logs-service: ## Логи конкретного сервиса: make logs-service S=postgres
	docker compose logs -f --tail=100 $(S)

ps: ## Статус сервисов
	docker compose ps

build: ## Пересобрать контейнеры
	docker compose build --no-cache

clean: ## Удалить всё (контейнеры, volumes, сети) ⚠️ ОПАСНО
	@echo "$(YELLOW)Удалить ВСЕ данные? [y/N]$(NC)" && read ans && [ $${ans:-N} = y ]
	docker compose down -v --remove-orphans

# ---------------------------------------------------------------------------
# Первоначальная настройка
# ---------------------------------------------------------------------------
setup-env: ## Создать .env из .env.example
	@if [ -f .env ]; then \
		echo "$(YELLOW).env уже существует. Удали вручную для пересоздания.$(NC)"; \
	else \
		cp .env.example .env; \
		echo "$(GREEN).env создан. Заполни переменные: nano .env$(NC)"; \
	fi

generate-keys: ## Сгенерировать JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY
	@echo "JWT_SECRET:"
	@openssl rand -base64 64 | tr -d '\n' && echo ""
	@echo ""
	@echo "REALTIME_ENC_KEY:"
	@openssl rand -base64 48 | tr -d '\n' && echo ""
	@echo ""
	@echo "REALTIME_SECRET_KEY_BASE:"
	@openssl rand -base64 64 | tr -d '\n' && echo ""
	@echo ""
	@echo "$(YELLOW)Для ANON_KEY и SERVICE_ROLE_KEY используй:$(NC)"
	@echo "  https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys"
	@echo "  или node infrastructure/scripts/generate-keys.js"

# ---------------------------------------------------------------------------
# SSL / Let's Encrypt
# ---------------------------------------------------------------------------
cert-init: ## Получить TLS-сертификат (первый раз)
	@echo "$(YELLOW)Убедись, что DNS уже указывает на этот сервер!$(NC)"
	docker compose run --rm certbot certonly --webroot \
		-w /var/www/certbot \
		-d $${DOMAIN:-score-coaching.ru} \
		-d api.$${DOMAIN:-score-coaching.ru} \
		-d storage.$${DOMAIN:-score-coaching.ru} \
		-d monitoring.$${DOMAIN:-score-coaching.ru} \
		--email admin@$${DOMAIN:-score-coaching.ru} \
		--agree-tos --no-eff-email
	docker compose exec nginx nginx -s reload
	@echo "$(GREEN)Сертификат получен! Раскомментируй HTTPS-блоки в nginx/conf.d/default.conf$(NC)"

cert-renew: ## Обновить TLS-сертификат
	docker compose run --rm certbot renew
	docker compose exec nginx nginx -s reload

# ---------------------------------------------------------------------------
# База данных
# ---------------------------------------------------------------------------
db-shell: ## Подключиться к PostgreSQL
	docker compose exec postgres psql -U $${POSTGRES_USER:-postgres} -d $${POSTGRES_DB:-postgres}

db-backup: ## Создать бэкап БД → backups/
	@mkdir -p backups
	docker compose exec -T postgres pg_dump \
		-U $${POSTGRES_USER:-postgres} \
		-d $${POSTGRES_DB:-postgres} \
		--format=custom \
		--compress=9 \
		> backups/score_backup_$$(date +%Y%m%d_%H%M%S).dump
	@echo "$(GREEN)Бэкап создан в backups/$(NC)"

db-restore: ## Восстановить бэкап: make db-restore F=backups/file.dump
	@[ -f "$(F)" ] || (echo "$(YELLOW)Укажи файл: make db-restore F=backups/file.dump$(NC)" && exit 1)
	docker compose exec -T postgres pg_restore \
		-U $${POSTGRES_USER:-postgres} \
		-d $${POSTGRES_DB:-postgres} \
		--clean --if-exists \
		< $(F)
	@echo "$(GREEN)Бэкап восстановлен$(NC)"

db-migrate: ## Применить миграции из packages/supabase/migrations/
	@for f in packages/supabase/migrations/*.sql; do \
		echo "Applying $$f..."; \
		docker compose exec -T postgres psql \
			-U $${POSTGRES_USER:-postgres} \
			-d $${POSTGRES_DB:-postgres} \
			-f /dev/stdin < "$$f"; \
	done
	@echo "$(GREEN)Миграции применены$(NC)"

# ---------------------------------------------------------------------------
# Мониторинг
# ---------------------------------------------------------------------------
status: ## Проверить здоровье сервисов
	@echo "--- PostgreSQL ---"
	@docker compose exec -T postgres pg_isready -U postgres 2>&1 || echo "DOWN"
	@echo "--- Redis ---"
	@docker compose exec -T redis redis-cli -a $${REDIS_PASSWORD} ping 2>&1 || echo "DOWN"
	@echo "--- GoTrue ---"
	@curl -sf http://localhost:9999/health 2>&1 || echo "DOWN"
	@echo "--- PostgREST ---"
	@curl -sf http://localhost:3000/ 2>&1 | head -1 || echo "DOWN"
	@echo "--- Nginx ---"
	@curl -sf http://localhost/health 2>&1 || echo "DOWN"
