#!/usr/bin/env bash
# Добавляет текущего пользователя в группу docker (Linux).
set -euo pipefail

if ! getent group docker >/dev/null 2>&1; then
  echo "Группа docker не найдена. Установите Docker Engine или Docker Desktop." >&2
  exit 1
fi

if id -nG "$USER" | tr ' ' '\n' | grep -qx docker; then
  echo "Пользователь $USER уже в группе docker."
  exit 0
fi

if ! command -v sudo >/dev/null 2>&1; then
  echo "Нужен sudo для: usermod -aG docker $USER" >&2
  exit 1
fi

sudo usermod -aG docker "$USER"
echo "Готово: $USER добавлен в группу docker."
echo "Выполните newgrp docker (или перелогиньтесь), затем:"
echo "  docker compose up --build"
echo "или:"
echo "  ./scripts/docker-compose.sh up --build"
