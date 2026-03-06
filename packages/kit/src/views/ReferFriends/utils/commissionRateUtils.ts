export function getCommissionRateSortPriority(
  ...labels: (string | undefined)[]
): number {
  const normalized = labels
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  const matches = (keywords: string[]) =>
    normalized.some((value) => keywords.some((kw) => value.includes(kw)));

  if (matches(['hardware', 'sale', '硬件', 'referred_type_3'])) {
    return 0;
  }
  if (matches(['perp', 'contract', '合约'])) {
    return 1;
  }
  if (matches(['defi', 'onchain', 'on-chain', 'on_chain', 'referred_type_2'])) {
    return 2;
  }

  return 99;
}
