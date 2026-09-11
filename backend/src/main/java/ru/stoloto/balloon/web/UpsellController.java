package ru.stoloto.balloon.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.stoloto.balloon.service.UpsellService;
import ru.stoloto.balloon.web.dto.GameDtos;

@RestController
@RequestMapping("/api/upsell")
@Tag(name = "5. Апсейл", description = "Окно «Закрепи успех»: покупка лотерейных билетов (имитация)")
public class UpsellController {

    private final UpsellService upsellService;

    public UpsellController(UpsellService upsellService) {
        this.upsellService = upsellService;
    }

    @PostMapping("/purchase")
    @Operation(summary = "Купить лотерейные билеты за бонусные баллы",
            description = "Покупка в один клик: списывает бонусные баллы и начисляет билеты")
    public GameDtos.PurchaseTicketsResponse purchase(AuthContext context,
                                                     @RequestBody GameDtos.PurchaseTicketsRequest request) {
        if (request.tickets() == null || request.tickets() < 1) {
            throw new IllegalArgumentException("Количество билетов должно быть не меньше 1");
        }
        return upsellService.purchase(context.user(), request.tickets());
    }
}
