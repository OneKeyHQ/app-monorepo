export function getBorrowEarnAccountId(
  earnAccount:
    | { accountId?: string; account?: { id: string } }
    | null
    | undefined,
): string | undefined {
  return earnAccount?.accountId ?? earnAccount?.account?.id;
}
