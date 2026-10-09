import { sortCommissionRateItems } from '@onekeyhq/kit/src/views/ReferFriends/utils';

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

// One row per backend rate subject: the short name read inside the sentence
// and the long name labelling the breakdown. `Earn` and `Onchain` are both
// DeFi, so they collapse into one row.
const SUBJECT_NAMES: Record<string, { short: string; long: string }> = {
  HardwareSales: { short: 'hardware', long: 'Hardware sales' },
  Perp: { short: 'Perps', long: 'Perps fees' },
  Swap: { short: 'Swap', long: 'Swap fees' },
  Earn: { short: 'DeFi', long: 'DeFi fees' },
  Onchain: { short: 'DeFi', long: 'DeFi fees' },
};

function isKnownSubject(subject: string) {
  return Object.prototype.hasOwnProperty.call(SUBJECT_NAMES, subject);
}

function formatRate(value: number) {
  return `${Math.round(value * 100) / 100}%`;
}

function joinNames(names: string[]) {
  if (names.length <= 1) {
    return names.join('');
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
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
  // Null when the friend gets nothing for this product.
  friend: string | null;
}

export interface IInviteValueSummary {
  // "Earn 10%" or "Earn up to 18%"; the rate is the hover/tap target.
  lead: string;
  rate: string;
  // Highest invitee rate across products, or null when invitees get none;
  // compact layouts show "you / invitee" as one pair.
  friendRate: string | null;
  isUniform: boolean;
  products: string;
  rows: IInviteValueRow[];
}

// One sentence names every product that pays, so none looks unpaid; the
// per-product split lives in the breakdown.
export function getInviteValueSummary(
  items: readonly IInviteValueLineItem[],
): IInviteValueSummary | null {
  const seen = new Set<string>();
  const rows = sortCommissionRateItems([...items]).flatMap((item) => {
    const names = SUBJECT_NAMES[item.subject];
    // A disabled or 0% product is not something to advertise.
    if (!names || !item.enabled || !(item.you > 0) || seen.has(names.long)) {
      return [];
    }
    seen.add(names.long);
    return [
      {
        subject: item.subject,
        label: names.long,
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
    lead: isUniform ? 'Earn' : 'Earn up to',
    rate: formatRate(maxRate),
    friendRate: maxFriendRate > 0 ? formatRate(maxFriendRate) : null,
    isUniform,
    products: `on ${joinNames(
      rows.map((row) => SUBJECT_NAMES[row.subject].short),
    )}`,
    rows: rows.map(
      ({ youValue: _youValue, friendValue: _friendValue, ...row }) => row,
    ),
  };
}
