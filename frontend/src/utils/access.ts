/** Админ-панель и #admin открываются только для аккаунта expert. */
export function isExpertAccount(nickname: string | undefined | null): boolean {
  return nickname?.trim().toLowerCase() === 'expert';
}
