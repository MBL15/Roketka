package ru.stoloto.balloon.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.stoloto.balloon.domain.GameRound;
import ru.stoloto.balloon.domain.RoundParameters;
import ru.stoloto.balloon.game.CrashMath;
import ru.stoloto.balloon.game.FairnessService;
import ru.stoloto.balloon.repo.GameRoundRepository;
import ru.stoloto.balloon.service.RoundService;
import ru.stoloto.balloon.web.dto.GameDtos;

@RestController
@RequestMapping("/api/fairness")
@Tag(name = "6. Честность", description = "Проверка неизменности исхода раунда по раскрытому зерну")
public class FairnessController {

    private final GameRoundRepository rounds;
    private final FairnessService fairness;

    public FairnessController(GameRoundRepository rounds, FairnessService fairness) {
        this.rounds = rounds;
        this.fairness = fairness;
    }

    @GetMapping("/verify")
    @Operation(summary = "Пересчитать исход завершённого раунда",
            description = """
                    Берёт из базы раскрытое серверное зерно, клиентское зерно и nonce, заново
                    выводит равномерные величины и пересчитывает точку краха и уровень бустера
                    по сохранённым параметрам раунда. Совпадение означает, что исход был определён
                    до полёта и не переписывался.

                    Проверить хеш обязательства можно независимо:
                    `SHA-256(serverSeed)` должен совпасть с `serverSeedHash`, который клиент
                    получил ещё до начала полёта.
                    """)
    public GameDtos.FairnessVerificationDto verify(@RequestParam long roundId) {
        GameRound round = rounds.findById(roundId)
                .orElseThrow(() -> new RoundService.RoundRejectedException("Раунд не найден"));
        if (!round.getStatus().isTerminal()) {
            throw new RoundService.RoundNotFinishedException(round.getStatus());
        }
        RoundParameters parameters = round.getParameters();

        double crashUniform = fairness.uniform(round.getServerSeed(), round.getClientSeed(),
                round.getNonce(), FairnessService.NAMESPACE_CRASH);
        double expectedCrash = CrashMath.sampleCrashPoint(crashUniform, parameters.alpha(),
                parameters.houseEdge(), parameters.minCrashMultiplier(),
                parameters.maxMultiplier(), parameters.delta());

        Integer expectedBoostLevel = null;
        if (round.getBoostTier() > 1) {
            double lootUniform = fairness.uniform(round.getServerSeed(), round.getClientSeed(),
                    round.getNonce(), FairnessService.NAMESPACE_LOOT);
            expectedBoostLevel = CrashMath.pickBoostLevel(lootUniform, parameters.lootProbabilities());
        }

        boolean crashMatches = Math.abs(expectedCrash - round.getCrashMultiplier()) < 1e-6;
        boolean boostMatches = java.util.Objects.equals(expectedBoostLevel, round.getBoostLevel());
        boolean hashMatches = fairness.sha256(round.getServerSeed()).equals(round.getServerSeedHash());

        return new GameDtos.FairnessVerificationDto(
                crashMatches && boostMatches && hashMatches,
                expectedCrash, round.getCrashMultiplier(),
                expectedBoostLevel, round.getBoostLevel(),
                "crash = quantize(pow((u - edge)/(1 - edge), -1/alpha)), "
                        + "u = HMAC-SHA256(serverSeed, \"crash:\" + clientSeed + \":\" + nonce) / 2^53");
    }
}
