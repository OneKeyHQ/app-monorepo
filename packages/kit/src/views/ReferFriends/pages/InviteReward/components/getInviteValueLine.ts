import { sortCommissionRateItems } from '@onekeyhq/kit/src/views/ReferFriends/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
const SUBJECT_NAME_IDS: Record<string, ETranslations> = {
  HardwareSales: ETranslations.referral_referred_type_3,
  Perp: ETranslations.referral_rate_perps__title,
  Swap: ETranslations.referral_rate_swap__title,
  Earn: ETranslations.referral_rate_defi__title,
  Onchain: ETranslations.referral_rate_defi__title,
};

function isKnownSubject(subject: string) {
  return Object.prototype.hasOwnProperty.call(SUBJECT_NAME_IDS, subject);
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
  labelId: ETranslations;
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
  // Every product pays the referrer the same rate.
  isUniform: boolean;
  // Every product gives invitees the same discount, a 0% product included.
  isFriendUniform: boolean;
  rows: IInviteValueRow[];
}

// The rate line's figures across every product that pays; the per-product
// split lives in the breakdown.
export function getInviteValueSummary(
  items: readonly IInviteValueLineItem[],
): IInviteValueSummary | null {
  const seen = new Set<string>();
  const rows = sortCommissionRateItems([...items]).flatMap((item) => {
    const labelId = SUBJECT_NAME_IDS[item.subject];
    // A disabled or 0% product is not something to advertise, so a product
    // the backend turns off drops out of every rate line on its own.
    if (!labelId || !item.enabled || !(item.you > 0) || seen.has(labelId)) {
      return [];
    }
    seen.add(labelId);
    return [
      {
        subject: item.subject,
        labelId,
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
  const isFriendUniform = rows.every(
    (row) => row.friendValue === maxFriendRate,
  );
  return {
    rate: formatRate(maxRate),
    friendRate: maxFriendRate > 0 ? formatRate(maxFriendRate) : null,
    isUniform,
    isFriendUniform,
    rows: rows.map(
      ({ youValue: _youValue, friendValue: _friendValue, ...row }) => row,
    ),
  };
}

// The rate line's sentence: each side reads "up to" only when its own rates
// differ across products, and the invitee part drops out without a discount.
export function getRateLineMessageId(
  summary: Pick<
    IInviteValueSummary,
    'friendRate' | 'isUniform' | 'isFriendUniform'
  >,
): ETranslations {
  if (!summary.friendRate) {
    return summary.isUniform
      ? ETranslations.referral_you_earn__desc
      : ETranslations.referral_you_earn_up_to__desc;
  }
  if (summary.isUniform) {
    return summary.isFriendUniform
      ? ETranslations.referral_rate_line__desc
      : ETranslations.referral_rate_line_invitee_up_to__desc;
  }
  return summary.isFriendUniform
    ? ETranslations.referral_rate_line_you_up_to__desc
    : ETranslations.referral_rate_line_up_to__desc;
}
