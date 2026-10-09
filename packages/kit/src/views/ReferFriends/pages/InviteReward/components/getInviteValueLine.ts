import { sortCommissionRateItems } from '@onekeyhq/kit/src/views/ReferFriends/utils';

import { INVITE_COPY } from '../inviteCopy';

export interface IInviteValueLineItem {
  subject: string;
  you: number;
  invitee?: number;
  enabled: boolean;
}

export interface IInviteValueLineConfig {
  rebate: number;
  discount?: number;
  enabled?: boolean;
}

// One row per backend rate subject, named by what the rate applies to.
// `Earn` and `Onchain` are both DeFi, so they collapse into one row. A
// subject the client does not know is left out rather than shown raw.
const SUBJECT_NAMES: Record<string, string> = {
  HardwareSales: INVITE_COPY.hardwareSalesRate,
  Perp: INVITE_COPY.perpsFeesRate,
  Swap: INVITE_COPY.swapFeesRate,
  Earn: INVITE_COPY.defiFeesRate,
  Onchain: INVITE_COPY.defiFeesRate,
};

function isKnownSubject(subject: string) {
  return Object.prototype.hasOwnProperty.call(SUBJECT_NAMES, subject);
}

function formatRate(value: number) {
  return `${Math.round(value * 100) / 100}%`;
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
    invitee: rate.discount,
    enabled: rate.enabled === true,
  }));
}

export interface IInviteValueRow {
  subject: string;
  label: string;
  you: string;
  // Null when the invitee gets nothing for this product.
  friend: string | null;
}

export interface IInviteValueSummary {
  // The highest referrer rate; "up to" it when products differ.
  rate: string;
  // Highest invitee rate across products, or null when invitees get none;
  // the rate line's "Invitees save" and the share card headline use it.
  friendRate: string | null;
  isUniform: boolean;
  rows: IInviteValueRow[];
}

// The rate line's figures across every product that pays; the per-product
// split lives in the breakdown.
export function getInviteValueSummary(
  items: readonly IInviteValueLineItem[],
): IInviteValueSummary | null {
  const seen = new Set<string>();
  const rows = sortCommissionRateItems([...items]).flatMap((item) => {
    const name = SUBJECT_NAMES[item.subject];
    // A disabled or 0% product is not something to advertise, so a product
    // the backend turns off drops out of every rate line on its own.
    if (!name || !item.enabled || !(item.you > 0) || seen.has(name)) {
      return [];
    }
    seen.add(name);
    return [
      {
        subject: item.subject,
        label: name,
        you: formatRate(item.you),
        friend:
          item.invitee !== undefined && item.invitee > 0
            ? formatRate(item.invitee)
            : null,
        youValue: item.you,
        friendValue: item.invitee ?? 0,
      },
    ];
  });
  if (rows.length === 0) {
    return null;
  }

  const maxRate = Math.max(...rows.map((row) => row.youValue));
  const isUniform = rows.every((row) => row.youValue === maxRate);
  const maxFriendRate = Math.max(...rows.map((row) => row.friendValue));
  return {
    rate: formatRate(maxRate),
    friendRate: maxFriendRate > 0 ? formatRate(maxFriendRate) : null,
    isUniform,
    rows: rows.map(
      ({ youValue: _youValue, friendValue: _friendValue, ...row }) => row,
    ),
  };
}
