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
>(earnAccount: T | null | undefined, networkId?: string): T | undefined {
  if (!networkId || earnAccount?.networkId !== networkId) {
    return undefined;
  }
  return earnAccount;
}
