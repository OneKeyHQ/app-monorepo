// Canonical rebate module order: Hardware -> Perps -> Swap -> DeFi.
// `Earn` and `Onchain` are both DeFi subjects (the backend uses either key),
// so they stay adjacent at the tail with distinct ranks: equal ranks would make
// their relative order depend on the API response order, which is exactly the
// per-surface inconsistency this order table exists to remove.
const COMMISSION_RATE_SUBJECT_ORDER: Record<string, number> = {
  HardwareSales: 0,
  Perp: 1,
  Swap: 2,
  Earn: 3,
  Onchain: 4,
};

export function shouldShowInviteeDiscount(discount?: number) {
  return (discount ?? 0) > 0;
}

export function formatInviteeDiscountText(discount?: number) {
  return shouldShowInviteeDiscount(discount) ? `${discount}%` : '-';
}

export function formatCommissionRateText({
  rebate,
  discount,
}: {
  rebate: number;
  discount?: number;
}) {
  return `${rebate}% / ${formatInviteeDiscountText(discount)}`;
}

export function sortCommissionRateItems<T extends { subject: string }>(
  items: T[],
): T[] {
  return items.toSorted(
    (a, b) =>
      (COMMISSION_RATE_SUBJECT_ORDER[a.subject] ?? 99) -
      (COMMISSION_RATE_SUBJECT_ORDER[b.subject] ?? 99),
  );
}
