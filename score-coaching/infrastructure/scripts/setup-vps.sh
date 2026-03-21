#!/usr/bin/env bash
# =============================================================================
# SCORE Coaching — Начальная настройка VPS #1 (Ubuntu 22.04 LTS)
# =============================================================================
# Запуск: sudo bash setup-vps.sh
# Что делает:
#   1. Обновляет систему
#   2. Создаёт пользователя deploy
#   3. Настраивает SSH (ключи, отключает парольный вход)
#   4. Устанавливает UFW (firewall), fail2ban
#   5. Устанавливает Docker + Docker Compose
#   6. Настраивает системные лимиты и swap
# =============================================================================

set -euo pipefail

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Проверка root
[[ $EUID -ne 0 ]] && err "Запусти с sudo: sudo bash $0"

DEPLOY_USER="deploy"
SSH_PORT=22  # Сменить на нестандартный при желании

echo "============================================="
echo " SCORE Coaching — Настройка VPS"
echo "============================================="

# -----------------------------------------------------------------------
# 1. Обновление системы
# -----------------------------------------------------------------------
log "Обновление системы..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget git htop iotop unzip jq \
  apt-transport-https ca-certificates \
  gnupg lsb-release software-properties-common \
  fail2ban ufw

# -----------------------------------------------------------------------
# 2. Создание пользователя deploy
# -----------------------------------------------------------------------
if id "$DEPLOY_USER" &>/dev/null; then
    warn "Пользователь $DEPLOY_USER уже существует"
else
    log "Создание пользователя $DEPLOY_USER..."
    adduser --disabled-password --gecos "" "$DEPLOY_USER"
    usermod -aG sudo "$DEPLOY_USER"
    echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/90-deploy
    chmod 440 /etc/sudoers.d/90-deploy

    # Копируем SSH-ключи root → deploy
    mkdir -p /home/$DEPLOY_USER/.ssh
    if [[ -f /root/.ssh/authorized_keys ]]; then
        cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/
    fi
    chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
    chmod 700 /home/$DEPLOY_USER/.ssh
    chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys 2>/dev/null || true
fi

# -----------------------------------------------------------------------
# 3. SSH hardening
# -----------------------------------------------------------------------
log "Настройка SSH..."
SSHD_CONFIG="/etc/ssh/sshd_config"
cp "$SSHD_CONFIG" "${SSHD_CONFIG}.bak"

sed -i "s/^#\?Port .*/Port $SSH_PORT/" "$SSHD_CONFIG"
sed -i "s/^#\?PermitRootLogin .*/PermitRootLogin no/" "$SSHD_CONFIG"
sed -i "s/^#\?PasswordAuthentication .*/PasswordAuthentication no/" "$SSHD_CONFIG"
sed -i "s/^#\?PubkeyAuthentication .*/PubkeyAuthentication yes/" "$SSHD_CONFIG"
sed -i "s/^#\?MaxAuthTries .*/MaxAuthTries 3/" "$SSHD_CONFIG"
sed -i "s/^#\?ClientAliveInterval .*/ClientAliveInterval 300/" "$SSHD_CONFIG"
sed -i "s/^#\?ClientAliveCountMax .*/ClientAliveCountMax 2/" "$SSHD_CONFIG"

systemctl restart sshd

# -----------------------------------------------------------------------
# 4. Firewall (UFW)
# -----------------------------------------------------------------------
log "Настройка UFW..."
ufw default deny incoming
ufw default allow outgoing
ufw allow "$SSH_PORT/tcp" comment "SSH"
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"
# Не открываем порты БД/Redis наружу — только через Docker network
ufw --force enable

# -----------------------------------------------------------------------
# 5. Fail2ban
# -----------------------------------------------------------------------
log "Настройка fail2ban..."
cat > /etc/fail2ban/jail.local << 'JAIL'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port    = ssh
filter  = sshd
logpath = /var/log/auth.log

[nginx-limit-req]
enabled  = true
port     = http,https
filter   = nginx-limit-req
logpath  = /var/log/nginx/error.log
maxretry = 10
JAIL

systemctl enable fail2ban
systemctl restart fail2ban

# -----------------------------------------------------------------------
# 6. Docker
# -----------------------------------------------------------------------
if command -v docker &>/dev/null; then
    warn "Docker уже установлен: $(docker --version)"
else
    log "Установка Docker..."
    curl -fsSL https://get.docker.com | sh
fi

usermod -aG docker "$DEPLOY_USER"

# Docker Compose plugin (v2)
if docker compose version &>/dev/null; then
    warn "Docker Compose уже установлен: $(docker compose version)"
else
    log "Установка Docker Compose plugin..."
    apt-get install -y -qq docker-compose-plugin
fi

# Docker daemon config
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'DAEMON'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "default-address-pools": [
    {"base": "172.20.0.0/16", "size": 24}
  ],
  "live-restore": true,
  "userland-proxy": false
}
DAEMON

systemctl restart docker
systemctl enable docker

# -----------------------------------------------------------------------
# 7. Системные лимиты и sysctl
# -----------------------------------------------------------------------
log "Настройка системных лимитов..."
cat >> /etc/sysctl.conf << 'SYSCTL'

# --- SCORE Coaching: сетевые оптимизации ---
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.core.netdev_max_backlog = 65535
vm.overcommit_memory = 1
vm.swappiness = 10
fs.file-max = 2097152
SYSCTL
sysctl -p

cat >> /etc/security/limits.conf << 'LIMITS'

# --- SCORE Coaching ---
*    soft    nofile    65535
*    hard    nofile    65535
root soft    nofile    65535
root hard    nofile    65535
LIMITS

# -----------------------------------------------------------------------
# 8. Swap (если нет)
# -----------------------------------------------------------------------
if [[ ! -f /swapfile ]]; then
    log "Создание swap 4GB..."
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# -----------------------------------------------------------------------
# 9. Автоматические обновления безопасности
# -----------------------------------------------------------------------
log "Настройка автообновлений безопасности..."
apt-get install -y -qq unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# -----------------------------------------------------------------------
# 10. Создание рабочей директории
# -----------------------------------------------------------------------
WORK_DIR="/opt/score-coaching"
mkdir -p "$WORK_DIR"
chown "$DEPLOY_USER:$DEPLOY_USER" "$WORK_DIR"
log "Рабочая директория: $WORK_DIR"

# -----------------------------------------------------------------------
# Готово
# -----------------------------------------------------------------------
echo ""
echo "============================================="
echo -e "${GREEN} VPS настроен!${NC}"
echo "============================================="
echo ""
echo "Следующие шаги:"
echo "  1. Залогинься как $DEPLOY_USER: ssh $DEPLOY_USER@$(hostname -I | awk '{print $1}') -p $SSH_PORT"
echo "  2. Склонируй репозиторий: cd /opt/score-coaching && git clone <repo-url> ."
echo "  3. Скопируй .env: cp .env.example .env && nano .env"
echo "  4. Запусти: docker compose up -d"
echo ""
echo "Важно: root-логин через SSH теперь ОТКЛЮЧЁН!"
