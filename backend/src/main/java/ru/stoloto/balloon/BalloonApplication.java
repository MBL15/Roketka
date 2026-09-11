package ru.stoloto.balloon;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;
import ru.stoloto.balloon.config.BalloonProperties;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(BalloonProperties.class)
public class BalloonApplication {

    public static void main(String[] args) {
        SpringApplication.run(BalloonApplication.class, args);
    }
}
