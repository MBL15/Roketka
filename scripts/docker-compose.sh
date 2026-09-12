#!/usr/bin/env bash
# Обёртка над docker compose: на Linux без группы docker сокет недоступен.
# Скрипт пробует обычный вызов, sg docker (если пользователь уже в группе),
# затем sudo — чтобы `docker compose up --build` работал из коробки.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

quote_args() {
  printf '%q ' "$@"
}

docker_ready() {
  docker info >/dev/null 2>&1
}

if docker_ready; then
  exec docker compose "$@"
fi

if getent group docker >/dev/null 2>&1 && id -nG "$USER" 2>/dev/null | tr ' ' '\n' | grep -qx docker; then
  exec sg docker -c "cd $(quote_args "$ROOT") && docker compose $(quote_args "$@")"
fi

if sudo docker info >/dev/null 2>&1; then
  cat >&2 <<'EOF'
Docker: нет прав на /var/run/docker.sock.

Один раз выполните (Linux):
  sudo usermod -aG docker $USER
  newgrp docker

После этого команда `docker compose up --build` будет работать без sudo.
Сейчас запуск через sudo…
EOF
  exec sudo docker compose "$@"
fi

cat >&2 <<'EOF'
Docker daemon недоступен.

• Linux: sudo systemctl start docker
• macOS/Windows: запустите Docker Desktop
• Затем снова: ./scripts/docker-compose.sh up --build
EOF
exit 1
