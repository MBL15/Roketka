# syntax=docker/dockerfile:1
#
# Сборка SPA и отдача через nginx.
# Контекст сборки — папка frontend/.

# ---------------------------------------------------------------- сборка ---
FROM node:20-alpine AS build

WORKDIR /app

# Зависимости ставятся отдельным слоем: пересобираются только при изменении
# package.json, а не при каждой правке кода.
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund --loglevel=error

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src

# tsc --noEmit внутри build-скрипта: сборка падает на ошибке типов,
# а не выкатывает сломанный интерфейс.
RUN npm run build

# ---------------------------------------------------------------- отдача ---
FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/ > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
