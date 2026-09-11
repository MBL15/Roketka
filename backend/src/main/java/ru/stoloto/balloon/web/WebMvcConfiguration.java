package ru.stoloto.balloon.web;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import ru.stoloto.balloon.config.BalloonProperties;

import java.util.List;

@Configuration
public class WebMvcConfiguration implements WebMvcConfigurer {

    private final AuthContextResolver authContextResolver;
    private final BalloonProperties properties;

    public WebMvcConfiguration(AuthContextResolver authContextResolver, BalloonProperties properties) {
        this.authContextResolver = authContextResolver;
        this.properties = properties;
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(authContextResolver);
    }

    /**
     * В рабочей сборке фронтенд и API отдаются с одного адреса через nginx,
     * поэтому CORS не нужен. Список источников существует для режима
     * разработки, когда Vite поднимает dev-сервер на другом порту.
     */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(properties.corsOrigins().toArray(String[]::new))
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .maxAge(3600);
    }

    @Bean
    public OpenAPI balloonOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Воздушный Шар — игровое API")
                        .version("1.0.0")
                        .description("""
                                Серверная часть бонусной crash-игры «Воздушный Шар».

                                **Как проверить вручную.**
                                1. `POST /api/auth/login` с телом `{"nickname":"expert","password":"expert"}` —
                                   в ответе поле `token`.
                                2. Нажмите «Authorize» и вставьте токен: он будет подставляться в
                                   заголовок `X-Session-Token` для всех запросов.
                                3. `GET /api/game/setup` — публичные параметры тем, уровней и вариантов ставки.
                                4. `POST /api/rounds` — списывает ставку и возвращает всё для анимации полёта:
                                   время старта, темп роста, границы уровней, уровень бустера и хеш зерна.
                                   Точки краха в ответе нет.
                                5. `GET /api/rounds/{id}/state` — авторитетное состояние полёта
                                   (то же, что приходит по WebSocket; годится как fallback без сокетов).
                                6. `POST /api/rounds/{id}/cashout` — фиксация выигрыша по серверному коэффициенту.
                                7. `GET /api/rounds/{id}/result` — доступен после краха: результат, очки,
                                   награда и раскрытое зерно.
                                8. `GET /api/fairness/verify?roundId={id}` — независимый пересчёт точки краха
                                   и положения бустера по раскрытому зерну.
                                9. `PUT /api/admin/config` — изменение игровых параметров без правки кода,
                                   `POST /api/admin/simulate` — Monte-Carlo проверка последствий.
                                """)
                        .license(new License().name("MIT")))
                .schemaRequirement("sessionToken", new SecurityScheme()
                        .type(SecurityScheme.Type.APIKEY)
                        .in(SecurityScheme.In.HEADER)
                        .name(AuthContextResolver.HEADER_SESSION_TOKEN)
                        .description("Токен из ответа POST /api/auth/login"));
    }
}
