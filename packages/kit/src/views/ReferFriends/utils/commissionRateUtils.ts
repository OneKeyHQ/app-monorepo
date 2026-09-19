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

/**
 * Invitee fee rebate shown in invite copy when the post-config has no usable
 * value: the request failed or timed out, or the amount is missing or
 * malformed.
 */
export const DEFAULT_INVITEE_DISCOUNT_TEXT = '10%';

/**
 * Formats `IInvitePostConfig.inviteeDiscount` for invite copy.
 *
 * Renders whatever rate the server actually gave, zero included, and falls
 * back to `DEFAULT_INVITEE_DISCOUNT_TEXT` only when there is no usable value,
 * so the default never contradicts an answer the server did give. The payload
 * is cast rather than validated, hence the field-level checks.
 *
 * Unlike `formatInviteeDiscountText`, which renders a bare rate into the
 * commission table as "-" when unset, this always yields a rate.
 */
export function formatInviteeDiscountFromConfig(
  discount: { amount?: unknown; unit?: unknown } | undefined,
): string {
  const amount = discount?.amount;
  const unit = discount?.unit;
  if (
    typeof amount === 'number' &&
    Number.isFinite(amount) &&
    amount >= 0 &&
    typeof unit === 'string' &&
    unit
  ) {
    return `${amount}${unit}`;
  }
  return DEFAULT_INVITEE_DISCOUNT_TEXT;
}

/**
 * Whether the server explicitly grants no invitee rebate — an amount of zero,
 * as when a campaign is paused. Distinct from the amount being missing, which
 * means "unknown" and gets the default. Copy above an irreversible bind must
 * not promise a rebate in this case.
 */
export function isInviteeDiscountDeclined(
  discount: { amount?: unknown } | undefined,
): boolean {
  return discount?.amount === 0;
}

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
