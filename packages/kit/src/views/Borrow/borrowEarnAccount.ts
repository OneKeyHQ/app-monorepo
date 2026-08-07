export function getBorrowEarnAccountId(
  earnAccount:
    | { accountId?: string; account?: { id: string } }
    | null
    | undefined,
): string | undefined {
  return earnAccount?.accountId ?? earnAccount?.account?.id;
}

export function getBorrowEarnAccountForNetwork<
  T extends { networkId?: string },
>(earnAccount: T | null | undefined, networkId?: string): T | null | undefined {
  if (!networkId || earnAccount === undefined) {
    return undefined;
  }
  if (earnAccount === null) {
    return null;
  }
  if (earnAccount.networkId !== networkId) {
    return undefined;
  }
  return earnAccount;
}
