const STORAGE_PREFIX = 'balloon.loginRules.dismissed.';

export function isLoginRulesDismissed(playerId: number): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${playerId}`) === '1';
  } catch {
    return false;
  }
}

export function persistLoginRulesDismissed(playerId: number): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${playerId}`, '1');
  } catch {
    /* ignore */
  }
}
