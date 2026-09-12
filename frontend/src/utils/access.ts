/** Тип служебного или игрового аккаунта. */
export type AccountKind = 'demo' | 'judge' | 'admin' | 'player';

export function resolveAccountKind(nickname: string | undefined | null, accountKind?: AccountKind | null): AccountKind {
  if (accountKind) {
    return accountKind;
  }
  const name = nickname?.trim().toLowerCase();
  if (name === 'expert') {
    return 'admin';
  }
  if (name === 'judge') {
    return 'judge';
  }
  if (name === 'demo') {
    return 'demo';
  }
  return 'player';
}

/** Админ-панель и #admin открываются только для аккаунта expert. */
export function isExpertAccount(nickname: string | undefined | null): boolean {
  return resolveAccountKind(nickname) === 'admin';
}

/** Пополнение доступно только демо и админ-аккаунтам. */
export function canTopUpAccount(kind: AccountKind): boolean {
  return kind === 'demo' || kind === 'admin';
}
