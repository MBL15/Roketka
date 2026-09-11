package ru.stoloto.balloon.domain;

/**
 * Состояния раунда.
 *
 * <p>Важная деталь механики: после {@code CASHED_OUT} шар продолжает лететь до
 * точки краха, и только тогда раунд становится терминальным ({@code WON}).
 * Сумма выигрыша при этом уже зафиксирована и не меняется.
 */
public enum RoundStatus {

    /** Шар летит, выигрыш не зафиксирован. */
    FLYING,

    /** Игрок нажал «Забрать»: сумма зафиксирована, шар ещё в полёте. */
    CASHED_OUT,

    /** Терминальное: шар лопнул после успешного cashout. */
    WON,

    /** Терминальное: шар лопнул, ставка потеряна. */
    LOST;

    public boolean isTerminal() {
        return this == WON || this == LOST;
    }

    public boolean isInFlight() {
        return this == FLYING || this == CASHED_OUT;
    }
}
