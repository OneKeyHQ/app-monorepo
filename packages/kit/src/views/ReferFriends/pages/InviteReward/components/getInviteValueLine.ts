import { sortCommissionRateItems } from '@onekeyhq/kit/src/views/ReferFriends/utils';

export interface IInviteValueLineItem {
  subject: string;
  you: number;
  enabled: boolean;
}

export interface IInviteValueLineConfig {
  rebate: number;
  enabled?: boolean;
}

const VALUE_LINE_LABELS: Record<string, string> = {
  HardwareSales: 'hardware sales',
  Perp: 'Perps fees',
  Swap: 'Swap fees',
  Earn: 'DeFi fees',
  Onchain: 'DeFi fees',
};

function isKnownSubject(subject: string) {
  return Object.prototype.hasOwnProperty.call(VALUE_LINE_LABELS, subject);
}

function formatRate(value: number): string | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

function labelFor(subject: string) {
  return VALUE_LINE_LABELS[subject] ?? subject;
}

export function selectInviteValueLineItems({
  commissionRates,
  configs,
}: {
  commissionRates: readonly IInviteValueLineItem[];
  configs?: Record<string, IInviteValueLineConfig>;
}): IInviteValueLineItem[] {
  const hasKnownSubject = commissionRates.some((item) =>
    isKnownSubject(item.subject),
  );
  if ((commissionRates.length > 0 && hasKnownSubject) || !configs) {
    return [...commissionRates];
  }
  return Object.entries(configs).map(([subject, rate]) => ({
    subject,
    you: rate.rebate,
    enabled: rate.enabled === true,
  }));
}

// Keep the hero line to one row; the level page lists every rate.
const MAX_VALUE_LINE_ITEMS = 2;

export function getInviteValueLine(
  commissionRates: readonly IInviteValueLineItem[],
): string | null {
  const parts = sortCommissionRateItems([...commissionRates])
    .flatMap((item) => {
      if (!item.enabled) {
        return [];
      }
      // A 0% rate is not something to advertise in the hero line.
      const rate = formatRate(item.you);
      if (rate === null || item.you <= 0) {
        return [];
      }
      return [`${rate}% on ${labelFor(item.subject)}`];
    })
    .slice(0, MAX_VALUE_LINE_ITEMS);

  return parts.length > 0 ? parts.join(' · ') : null;
}
