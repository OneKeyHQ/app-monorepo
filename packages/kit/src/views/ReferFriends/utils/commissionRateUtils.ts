const COMMISSION_RATE_SUBJECT_ORDER: Record<string, number> = {
  HardwareSales: 0,
  Perp: 1,
  Onchain: 2,
  Earn: 3,
};

export function sortCommissionRateItems<T extends { subject: string }>(
  items: T[],
): T[] {
  return items.toSorted(
    (a, b) =>
      (COMMISSION_RATE_SUBJECT_ORDER[a.subject] ?? 99) -
      (COMMISSION_RATE_SUBJECT_ORDER[b.subject] ?? 99),
  );
}
