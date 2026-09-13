/**
 * Типы ответов серверного API.
 * Повторяют записи ru.stoloto.balloon.web.dto.GameDtos один в один, поэтому
 * расхождение контракта ловится компилятором TypeScript, а не в рантайме.
 */

export type ThemeKey = 'green' | 'red';

export type RoundStatus = 'FLYING' | 'CASHED_OUT' | 'WON' | 'LOST';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'flight' | 'collection' | 'progression' | 'milestone';
  unlocked: boolean;
  unlockedAt: string | null;
}

export type AccountKind = 'demo' | 'judge' | 'admin' | 'player';

export interface Player {
  id: number;
  nickname: string;
  accountKind: AccountKind;
  bonusBalance: number;
  gamePoints: number;
  lotteryTickets: number;
  roundsPlayed: number;
  roundsWon: number;
  roundsLost: number;
  totalBonusEarned: number;
  onboardingSeen: boolean;
  tournamentPosition: number;
  collectionLevel: number;
  playerLevel: number;
  playerXp: number;
  xpToNextLevel: number;
  displayProfitBonus: number;
  achievements: Achievement[];
}

export interface AuthResponse {
  token: string;
  player: Player;
}

export interface BetOption {
  id: number;
  cost: number;
  boostTier: number;
  boostValue: number;
  affordable: boolean;
}

export interface PointsRules {
  perLine: number;
  cashoutBonus: number;
  boostBonusPerTier: number[];
}

export interface ThemeSetup {
  key: ThemeKey;
  gameId: string;
  gameName: string;
  active: boolean;
  levelCount: number;
  levelMultipliers: number[];
  /** Вероятность встретить бустер на каждом уровне; одинакова для всех раундов темы. */
  boostLevelChances: number[];
  betOptions: BetOption[];
  points: PointsRules;
  growthRate: number;
  maxMultiplier: number;
  delta: number;
  fps: number;
}

export interface SessionRules {
  resultIdleTimeoutSeconds: number;
  onboardingHintSeconds: number;
  historySize: number;
}

export interface RewardSetup {
  enabled: boolean;
  collectionName: string | null;
  collectionSize: number;
  collectionLevel: number;
  ownedFragments: number[];
  completionBonusPoints: number;
  completionBonusBalance: number;
}

export interface UpsellSetup {
  enabled: boolean;
  minWinAmount: number;
  popupTimeoutSeconds: number;
  ticketPriceBonus: number;
  maxTickets: number;
}

export interface TournamentHeader {
  enabled: boolean;
  active: boolean;
  name: string;
  endsAt: string | null;
  secondsLeft: number;
  participants: number;
}

export interface GameSetup {
  configRevision: number;
  themes: ThemeSetup[];
  session: SessionRules;
  reward: RewardSetup;
  upsell: UpsellSetup;
  tournament: TournamentHeader;
}

export interface StartedRound {
  roundId: number;
  theme: ThemeKey;
  betAmount: number;
  boostTier: number;
  boostValue: number;
  /**
   * Вероятность встретить бустер на каждом уровне. Точная позиция в раунде не
   * передаётся — она раскрывается только в момент срабатывания.
   */
  boostLevelChances: number[];
  levelCount: number;
  levelMultipliers: number[];
  growthRate: number;
  delta: number;
  maxMultiplier: number;
  cashoutUnlockMultiplier: number;
  startedAtMillis: number;
  serverTimeMillis: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  balance: number;
  showOnboarding: boolean;
  points: PointsRules;
}

export interface RoundState {
  roundId: number;
  status: RoundStatus;
  theme: ThemeKey;
  betAmount: number;
  baseMultiplier: number;
  multiplier: number;
  levelsPassed: number;
  levelCount: number;
  /** Заполняется только после срабатывания бустера. */
  boostLevel: number | null;
  boostLevelChances: number[];
  boostTier: number;
  boostValue: number;
  boostApplied: boolean;
  cashoutMultiplier: number | null;
  payout: number;
  points: number;
  elapsedSeconds: number;
  serverTimeMillis: number;
  startedAtMillis: number;
  growthRate: number;
  delta: number;
  maxMultiplier: number;
  levelMultipliers: number[];
}

export interface CashoutResult {
  roundId: number;
  multiplier: number;
  payout: number;
  balance: number;
  pointsAwarded: number;
  totalPoints: number;
  message: string;
  playerLevel: number;
  playerXp: number;
  xpToNextLevel: number;
  displayProfitBonus: number;
  xpGained: number;
  levelUp: boolean;
  newAchievements: Achievement[];
}

export interface PointsBreakdown {
  total: number;
  fromLevels: number;
  fromCashout: number;
  fromBoost: number;
  fromReward: number;
}

export interface RewardGrant {
  enabled: boolean;
  collectionName: string | null;
  collectionLevel: number;
  fragmentIndex: number | null;
  duplicate: boolean;
  collectionCompleted: boolean;
  pointsAwarded: number;
  bonusAwarded: number;
  ownedAfter: number;
  collectionSize: number;
}

export interface FairnessProof {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  alpha: number;
  houseEdge: number;
  minCrashMultiplier: number;
  maxMultiplier: number;
  verifyUrl: string;
}

export interface UpsellOffer {
  available: boolean;
  tickets: number;
  price: number;
  minWinAmount: number;
  popupTimeoutSeconds: number;
  reason: string | null;
}

export interface RoundResult {
  roundId: number;
  status: RoundStatus;
  won: boolean;
  theme: ThemeKey;
  betAmount: number;
  payout: number;
  netResult: number;
  cashoutMultiplier: number | null;
  crashMultiplier: number;
  potentialMaxMultiplier: number;
  levelsPassed: number;
  levelCount: number;
  boostLevel: number | null;
  boostTier: number;
  boostValue: number;
  boostApplied: boolean;
  points: PointsBreakdown;
  reward: RewardGrant;
  fairness: FairnessProof;
  balance: number;
  gamePoints: number;
  tournamentPosition: number;
  playerLevel: number;
  playerXp: number;
  xpToNextLevel: number;
  displayProfitBonus: number;
  newAchievements: Achievement[];
  upsell: UpsellOffer;
  startedAt: string;
  finishedAt: string;
}

export interface HistoryEntry {
  roundId: number;
  nickname: string;
  theme: ThemeKey;
  betAmount: number;
  cashoutMultiplier: number | null;
  crashMultiplier: number;
  payout: number;
  won: boolean;
  levelsPassed: number;
  boostTier: number;
  boostApplied: boolean;
  points: number;
  finishedAt: string;
  mine: boolean;
}

export interface RatingEntry {
  userId: number;
  displayName: string;
  points: number;
  position: number;
  bot: boolean;
  current: boolean;
}

export interface TournamentTable {
  header: TournamentHeader;
  top: RatingEntry[];
  rest: RatingEntry[];
  current: RatingEntry | null;
}

export interface PurchaseResult {
  tickets: number;
  price: number;
  balance: number;
  totalTickets: number;
}

// --------------------------------------------------------- административное

export interface AdminMath {
  alpha: number;
  houseEdge: number;
  minCrashMultiplier: number;
  maxMultiplier: number;
  multiplierGrowthRate: number;
  fps: number;
  delta: number;
  maxFlightSeconds: number;
}

export interface AdminBetOption {
  id: number;
  cost: number;
  boostTier: number;
  alphaShift: number;
}

export interface AdminPoints {
  perLine: number;
  cashoutBonus: number;
  boostBonusPerTier: number[];
}

export interface AdminTheme {
  gameId: string;
  gameName: string;
  gameType: string;
  active: boolean;
  math: AdminMath;
  levelMultipliers: number[];
  lootProbabilities: number[];
  boostTierValues: number[];
  betOptions: AdminBetOption[];
  points: AdminPoints;
}

export interface AdminConfig {
  version: number;
  themes: Record<string, AdminTheme>;
  reward: {
    enabled: boolean;
    collectionName: string;
    collectionSize: number;
    guaranteedNewChanceOnWin: number;
    guaranteedNewChanceOnLoss: number;
    duplicateCompensationPoints: number;
    completionBonusPoints: number;
    completionBonusBalance: number;
  };
  upsell: {
    enabled: boolean;
    minWinAmount: number;
    popupTimeoutSeconds: number;
    ticketPriceBonus: number;
    maxTickets: number;
    winShare: number;
  };
  tournament: {
    enabled: boolean;
    name: string;
    durationDays: number;
    liveRatingSize: number;
    anonymizeNames: boolean;
    prizes?: number[];
    simulation: {
      enabled: boolean;
      botCount: number;
      tickSeconds: number;
      maxPointsPerTick: number;
    };
  };
  session: {
    resultIdleTimeoutSeconds: number;
    onboardingHintSeconds: number;
    historySize: number;
    demoBonusBalance: number;
    playerStartingBalance: number;
  };
}

export interface ConfigStatus {
  path: string;
  writable: boolean;
  loadedAt: string | null;
  appliedRevisions: number;
  valid: boolean;
  errors: string[];
  lastErrorAt: string | null;
}

export interface SimulationOption {
  optionId: number;
  cost: number;
  boostTier: number;
  boostValue: number;
  effectiveAlpha: number;
  alphaShift: number;
  empiricalRtp: number;
  theoreticalRtp: number;
  winRate: number;
  boostActivationRate: number;
  averageCashoutMultiplier: number;
  averageCrashMultiplier: number;
  medianCrashMultiplier: number;
  averagePointsPerRound: number;
}

export interface SimulationReport {
  theme: string;
  themeName: string;
  strategy: string;
  roundsPerOption: number;
  seed: number | null;
  alpha: number;
  houseEdge: number;
  theoreticalMedianCrash: number;
  options: SimulationOption[];
}

export interface RuntimeStats {
  activeRounds: number;
  totalRounds: number;
  totalUsers: number;
  simulatedOpponents: number;
  ratingParticipants: number;
  simulationTicks: number;
  configRevision: number;
  configPath: string;
}

export interface AdminTournamentLeader {
  userId: number;
  nickname: string;
  points: number;
  position: number;
}

export interface AdminTournamentStatus {
  enabled: boolean;
  active: boolean;
  name: string;
  tournamentId: number | null;
  endsAt: string | null;
  secondsLeft: number;
  participants: number;
  prizes: number[];
  leaders: AdminTournamentLeader[];
}

export interface TournamentPrizeAward {
  userId: number;
  nickname: string;
  position: number;
  points: number;
  bonusAwarded: number;
}

export interface TournamentFinishResult {
  finishedTournamentId: number;
  finishedTournamentName: string;
  finishedAt: string;
  awards: TournamentPrizeAward[];
  nextTournamentId: number;
  nextTournamentName: string;
  nextEndsAt: string;
}

export interface ApiErrorBody {
  error: string;
  message: string;
  details: string[] | null;
}
