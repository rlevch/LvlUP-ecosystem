#!/usr/bin/env bash
# =============================================================================
# SCORE Coaching — Начальная настройка VPS #2 (Медиасервер)
# =============================================================================
# Запуск: sudo bash setup-vps2-media.sh
# Дополнительно к стандартному hardening:
#   - Открывает порты для WebRTC
#   - Создаёт конфиги LiveKit и Egress
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

[[ $EUID -ne 0 ]] && err "Запусти с sudo"

# Переменные (заменить!)
PUBLIC_IP="${1:-CHANGE_ME}"
DOMAIN="${2:-score-coaching.ru}"
LIVEKIT_API_KEY="${3:-CHANGE_ME}"
LIVEKIT_API_SECRET="${4:-CHANGE_ME}"
TURN_USER="scorecoaching"
TURN_PASSWORD=$(openssl rand -base64 24)

[[ "$PUBLIC_IP" == "CHANGE_ME" ]] && err "Укажи публичный IP: sudo bash $0 <PUBLIC_IP> <DOMAIN> <API_KEY> <API_SECRET>"

echo "============================================="
echo " SCORE Coaching — Настройка VPS #2 (Media)"
echo "============================================="

# -----------------------------------------------------------------------
# Базовая настройка (аналогично VPS#1, сокращённо)
# -----------------------------------------------------------------------
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl wget git htop ufw fail2ban

# Firewall — WebRTC ports
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3478/tcp  comment "TURN TCP"
ufw allow 3478/udp  comment "TURN UDP"
ufw allow 5349/tcp  comment "TURNS TCP"
ufw allow 5349/udp  comment "TURNS UDP"
ufw allow 7880/tcp  comment "LiveKit HTTP"
ufw allow 7881/tcp  comment "LiveKit WebRTC TCP"
ufw allow 7882/udp  comment "LiveKit WebRTC UDP"
ufw allow 49152:50100/udp  comment "WebRTC + TURN media"
ufw --force enable

# Docker
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
fi

# -----------------------------------------------------------------------
# LiveKit config
# -----------------------------------------------------------------------
WORK_DIR="/opt/score-livekit"
mkdir -p "$WORK_DIR"

cat > "$WORK_DIR/livekit.yaml" << YAML
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 50100
  use_external_ip: true
  enable_loopback_candidate: false
keys:
  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}
turn:
  enabled: true
  domain: ${DOMAIN}
  tls_port: 5349
  udp_port: 3478
  external_tls: true
room:
  max_participants: 50
  empty_timeout: 300
  departure_timeout: 20
logging:
  level: info
YAML

cat > "$WORK_DIR/egress.yaml" << YAML
log_level: info
api_key: ${LIVEKIT_API_KEY}
api_secret: ${LIVEKIT_API_SECRET}
ws_url: ws://localhost:7880
s3:
  access_key: CHANGE_ME_MINIO_USER
  secret: CHANGE_ME_MINIO_PASSWORD
  region: us-east-1
  endpoint: https://storage.${DOMAIN}
  bucket: recordings
  force_path_style: true
YAML

log "Конфиги LiveKit созданы в $WORK_DIR"
log "TURN password: $TURN_PASSWORD (сохрани!)"

echo ""
echo "============================================="
echo -e "${GREEN} VPS #2 настроен!${NC}"
echo "============================================="
echo "Следующие шаги:"
echo "  1. Скопируй docker-compose.livekit.yml в $WORK_DIR"
echo "  2. Получи TLS-сертификат (certbot)"
echo "  3. Запусти: PUBLIC_IP=$PUBLIC_IP docker compose -f docker-compose.livekit.yml up -d"
