Modify documentation immediately if it becomes outdated.
Contextual Steps: Review previous changes before each step; refine the step if it conflicts with the current state.
Command Clarity: For every command, explicitly state the Server and User.

Full reference (env vars, deploy patterns, feature architecture, test accounts): [mvp-implementation-guide.md](./mvp-implementation-guide.md) → section "Операционная справка"

## Documentation Files

| File | Path (VPS #1) | Description |
|------|---------------|-------------|
| Implementation Guide | `~/levelup-monorepo/docs/mvp-implementation-guide.md` | Пошаговый гайд реализации MVP — основной документ, по которому идём |
| Roadmap | `~/levelup-monorepo/docs/roadmap.md` | Roadmap проекта — фазы, сроки, зависимости |
| Architecture | `~/levelup-monorepo/docs/architecture.md` | Архитектура системы |
| Academy Roles v2 Requirements | `~/levelup-monorepo/docs/academy-role-requirements-v2.md` | Требования к новой ролевой модели Академии |
| Academy Roles Implementation Plan | `~/levelup-monorepo/docs/academy-role-implementation-plan.md` | План реализации новой ролевой модели |

## SSH Access

Keys: `~/.ssh/id_ed25519` (auto-generated per session).
**If SSH fails** — generate new key and ask user to add it:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N "" -q && cat ~/.ssh/id_ed25519.pub
```
User runs on each VPS: `echo "<public_key>" >> ~/.ssh/authorized_keys`

## Servers

| Server | Host | User | Role |
|--------|------|------|------|
| VPS #1 score-app-01 | `111.88.113.107` | `deploy` | Supabase, Traefik, MinIO, Redis, PM2 |
| VPS #2 score-media-01 | `111.88.113.71` | `deploy` | LiveKit, coturn, Caddy |

## Key Commands (VPS #1)

```bash
# Frontend build
ssh deploy@111.88.113.107 'cd ~/levelup-monorepo/apps/platform && npm run build'

# API restart
ssh deploy@111.88.113.107 'cd ~/levelup-monorepo/services/api && set -a && source .env && set +a && pm2 restart api-gateway --update-env'

# DB migration
ssh deploy@111.88.113.107 'docker exec -i supabase-db psql -U supabase_admin -d postgres < path/to/migration.sql'
```

## Key Paths (VPS #1)

- Monorepo: `~/levelup-monorepo`
- API .env: `~/levelup-monorepo/services/api/.env`
- Frontend .env.production: `~/levelup-monorepo/apps/platform/.env.production`
- Traefik routes: `/home/deploy/levelup-platform/traefik/dynamic/routes.yml`
- Docker Supabase: `/home/deploy/levelup-platform/`

## UI Testing

При тестировании UI обязательно:
- **Сверяться с вёрсткой Lovable** — все компоненты должны соответствовать оригинальному дизайну из Lovable (цвета, отступы, шрифты, расположение элементов)
- **Проверять адаптивную вёрстку** на всех разрешениях: Desktop 1920×1080, Desktop 1440×900, Tablet 768×1024, Mobile 375×812 (iPhone), Mobile 360×640 (Android)
- **Сразу исправлять найденные баги** — при обнаружении бага в процессе тестирования немедленно исправлять его на сервере (код + билд + рестарт), затем продолжать тестирование


## GitHub

- **Repo**: `rlevch/levelup-platform`
- **PAT**: `<GITHUB_PAT_SECRET>`
