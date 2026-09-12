package ru.stoloto.balloon.service;

import org.junit.jupiter.api.Test;
import ru.stoloto.balloon.domain.UserAccount;

import static org.assertj.core.api.Assertions.assertThat;

class AccountProfilesTest {

    @Test
    void recognizesServiceAccounts() {
        assertThat(AccountProfiles.kindOf("demo")).isEqualTo(AccountProfiles.Kind.DEMO);
        assertThat(AccountProfiles.kindOf("judge")).isEqualTo(AccountProfiles.Kind.JUDGE);
        assertThat(AccountProfiles.kindOf("expert")).isEqualTo(AccountProfiles.Kind.ADMIN);
        assertThat(AccountProfiles.kindOf("player")).isEqualTo(AccountProfiles.Kind.PLAYER);
    }

    @Test
    void judgeHasFixedStartingBalanceAndNoTopUp() {
        assertThat(AccountProfiles.startingBonus(AccountProfiles.Kind.JUDGE, 5000)).isEqualTo(500);
        assertThat(AccountProfiles.autoRefillOnBootstrap(AccountProfiles.Kind.JUDGE)).isFalse();
        assertThat(AccountProfiles.manualTopUpAllowed(AccountProfiles.Kind.JUDGE)).isFalse();
    }

    @Test
    void demoAndAdminCanRefill() {
        UserAccount demo = new UserAccount("demo", "hash", 100, false);
        assertThat(AccountProfiles.autoRefillOnBootstrap(AccountProfiles.kindOf(demo))).isTrue();
        assertThat(AccountProfiles.manualTopUpAllowed(AccountProfiles.kindOf(demo))).isTrue();

        UserAccount expert = new UserAccount("expert", "hash", 100, false);
        assertThat(AccountProfiles.autoRefillOnBootstrap(AccountProfiles.kindOf(expert))).isTrue();
    }
}
