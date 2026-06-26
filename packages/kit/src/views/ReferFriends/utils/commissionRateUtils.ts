const COMMISSION_RATE_SUBJECT_ORDER: Record<string, number> = {
  HardwareSales: 0,
  Perp: 1,
  Onchain: 2,
  Earn: 3,
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
