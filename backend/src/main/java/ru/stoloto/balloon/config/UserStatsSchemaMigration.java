package ru.stoloto.balloon.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Добавляет счётчики побед/поражений в существующую файловую H2 до любых запросов к users.
 */
@Component
public class UserStatsSchemaMigration implements InitializingBean {

    private static final Logger log = LoggerFactory.getLogger(UserStatsSchemaMigration.class);

    private final JdbcTemplate jdbc;

    public UserStatsSchemaMigration(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void afterPropertiesSet() {
        ensureIntColumn("rounds_won");
        ensureIntColumn("rounds_lost");
        ensureLongColumn("total_bonus_earned");
    }

    private void ensureIntColumn(String column) {
        if (columnExists(column)) {
            jdbc.update("UPDATE users SET " + column + " = 0 WHERE " + column + " IS NULL");
            return;
        }
        try {
            jdbc.execute("ALTER TABLE users ADD COLUMN " + column + " INT NOT NULL DEFAULT 0");
            log.info("Добавлена колонка users.{}", column);
        } catch (DataAccessException ex) {
            log.warn("Не удалось добавить users.{}: {}", column, ex.getMostSpecificCause().getMessage());
        }
    }

    private void ensureLongColumn(String column) {
        if (columnExists(column)) {
            jdbc.update("UPDATE users SET " + column + " = 0 WHERE " + column + " IS NULL");
            return;
        }
        try {
            jdbc.execute("ALTER TABLE users ADD COLUMN " + column + " BIGINT NOT NULL DEFAULT 0");
            log.info("Добавлена колонка users.{}", column);
        } catch (DataAccessException ex) {
            log.warn("Не удалось добавить users.{}: {}", column, ex.getMostSpecificCause().getMessage());
        }
    }

    private boolean columnExists(String column) {
        Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = 'PUBLIC' AND UPPER(TABLE_NAME) = 'USERS'
                  AND UPPER(COLUMN_NAME) = ?
                """,
                Integer.class,
                column.toUpperCase());
        return count != null && count > 0;
    }
}
