# =============================================================================
#  Backend «Воздушный Шар» — многоступенчатая сборка
# =============================================================================
#  Контекст сборки — корень репозитория, чтобы в образ попала и заводская
#  конфигурация из config/.
#
#  Локально ставить JDK и Maven не требуется: и то и другое живёт только
#  в стадии сборки. Всё используемое ПО свободное:
#  Eclipse Temurin (GPLv2+CE), Maven (Apache-2.0), Spring Boot (Apache-2.0).
# =============================================================================

# ----------------------------------------------------------------- сборка
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Отдельный слой для зависимостей: пересобирается только при правке pom.xml.
COPY backend/pom.xml ./pom.xml
RUN mvn -B -ntp dependency:go-offline

COPY backend/src ./src
RUN mvn -B -ntp -DskipTests package

# ----------------------------------------------------------------- прогон
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app

# Приложение работает не от root.
RUN addgroup -S balloon && adduser -S balloon -G balloon \
    && mkdir -p /app/data /app/config \
    && chown -R balloon:balloon /app

COPY --from=build /build/target/balloon-backend.jar /app/balloon-backend.jar
# Конфигурация по умолчанию: подменяется монтированием каталога config/.
COPY --chown=balloon:balloon config/game-config.yaml /app/config/game-config.yaml

USER balloon

ENV BALLOON_CONFIG_PATH=/app/config/game-config.yaml \
    BALLOON_DATA_DIR=/app/data \
    JAVA_OPTS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC -Duser.timezone=Europe/Moscow"

EXPOSE 8081

HEALTHCHECK --interval=10s --timeout=3s --start-period=40s --retries=6 \
    CMD wget -qO- http://127.0.0.1:8081/actuator/health | grep -q '"status":"UP"'

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/balloon-backend.jar"]
