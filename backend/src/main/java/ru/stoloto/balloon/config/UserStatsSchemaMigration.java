package ru.stoloto.balloon.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Добавляет счётчики побед/поражений в существующую файловую H2 без сброса данных.
 */
@Component
@Order(0)
public class UserStatsSchemaMigration implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(UserStatsSchemaMigration.class);

    private final JdbcTemplate jdbc;

    public UserStatsSchemaMigration(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        addColumnIfMissing("rounds_won", "INT NOT NULL DEFAULT 0");
        addColumnIfMissing("rounds_lost", "INT NOT NULL DEFAULT 0");
    }

    private void addColumnIfMissing(String column, String definition) {
        Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'USERS' AND COLUMN_NAME = ?
                """,
                Integer.class,
                column.toUpperCase());
        if (count != null && count > 0) {
            return;
        }
        jdbc.execute("ALTER TABLE users ADD COLUMN " + column + " " + definition);
        log.info("Добавлена колонка users.{}", column);
    }
}
