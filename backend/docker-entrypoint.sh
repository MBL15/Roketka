#!/bin/sh
set -e

# Bind mount ./config с хоста часто приходит root:root (особенно после git clone под sudo).
# Backend работает от balloon и должен записывать game-config.yaml из админки.
if [ -d /app/config ]; then
  chown -R balloon:balloon /app/config 2>/dev/null || true
  chmod -R u+rwX,g+rwX /app/config 2>/dev/null || true
fi
if [ -d /app/data ]; then
  chown -R balloon:balloon /app/data 2>/dev/null || true
  chmod -R u+rwX,g+rwX /app/data 2>/dev/null || true
fi

exec su-exec balloon:balloon sh -c 'exec java $JAVA_OPTS -jar /app/balloon-backend.jar'
