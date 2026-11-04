import type { IKeyOfIcons } from '@onekeyhq/components';
import { toAmount } from '@onekeyhq/kit/src/views/ReferFriends/utils/amountUtils';
import type { IInviteRewardScope } from '@onekeyhq/shared/src/referralCode/type';

import {
  type IRewardSummary,
  type IRewardSummaryItem,
  getRewardSummary,
} from './shared/getRewardSummary';

export const INVITE_REWARD_SUBJECTS = [
  'hardware',
  'perps',
  'swap',
  'defi',
] as const;

export type IInviteRewardSubject = (typeof INVITE_REWARD_SUBJECTS)[number];

export const INVITE_REWARD_SUBJECT_ICON: Record<
  IInviteRewardSubject,
  IKeyOfIcons
> = {
  hardware: 'OnekeyLiteOutline',
  perps: 'TradeOutline',
  swap: 'SwitchHorOutline',
  defi: 'CoinsOutline',
};

export interface IInviteRewardRow {
  subject: IInviteRewardSubject;
  hasData: boolean;
  available: IRewardSummary;
  pending: IRewardSummary | null;
  monthlySalesFiatValue: string | null;
  // Null when the server sent no scope copy for this product.
  scopeDescription: string | null;
}

export interface IInviteRewardRowsInput {
  HardwareSales?: {
    monthlySales?: string;
    monthlySalesFiatValue?: string;
    available?: readonly IRewardSummaryItem[];
    pending?: readonly IRewardSummaryItem[];
  };
  Perp?: {
    available?: readonly IRewardSummaryItem[];
  };
  Onchain?: {
    available?: readonly IRewardSummaryItem[];
    swap?: readonly IRewardSummaryItem[];
  };
  // From the unauthenticated reward-scopes endpoint, not the invite summary.
  rewardScopes?: readonly IInviteRewardScope[];
}

export interface IInviteRewardScopeItem {
  subject: IInviteRewardSubject;
  description: string;
}

const EMPTY_REWARDS: readonly IRewardSummaryItem[] = [];

function hasPositiveAmount(value: string | undefined) {
  return toAmount(value).isGreaterThan(0);
}

function summarize(rewards: readonly IRewardSummaryItem[] | undefined) {
  return getRewardSummary(rewards ?? EMPTY_REWARDS);
}

// Backend subjects behind each reward row. DeFi rates and scope copy may
// arrive as Earn or Onchain.
const INVITE_REWARD_RATE_SUBJECTS: Record<
  IInviteRewardSubject,
  readonly string[]
> = {
  hardware: ['HardwareSales'],
  perps: ['Perp'],
  swap: ['Swap'],
  defi: ['Earn', 'Onchain'],
};

export function getInviteRewardScopeDescription(
  subject: IInviteRewardSubject,
  rewardScopes: readonly IInviteRewardScope[] | undefined,
): string | null {
  const accepted = INVITE_REWARD_RATE_SUBJECTS[subject];
  for (const scope of rewardScopes ?? []) {
    const description =
      typeof scope.description === 'string' ? scope.description.trim() : '';
    if (accepted.includes(scope.subject) && description) {
      return description;
    }
  }
  return null;
}

function buildHardwareRow(
  hardware: IInviteRewardRowsInput['HardwareSales'],
  rewardScopes: readonly IInviteRewardScope[] | undefined,
): IInviteRewardRow {
  const available = summarize(hardware?.available);
  const pending = summarize(hardware?.pending);
  const monthlySalesFiatValue = hasPositiveAmount(
    hardware?.monthlySalesFiatValue,
  )
    ? (hardware?.monthlySalesFiatValue ?? null)
    : null;
  const hasData =
    hasPositiveAmount(hardware?.monthlySales) ||
    monthlySalesFiatValue !== null ||
    available.hasReward ||
    pending.hasReward;

  return {
    subject: 'hardware',
    hasData,
    available,
    // Consumers only render pending rewards that exist.
    pending: pending.hasReward ? pending : null,
    monthlySalesFiatValue,
    scopeDescription: getInviteRewardScopeDescription('hardware', rewardScopes),
  };
}

function buildAmountRow(
  subject: Exclude<IInviteRewardSubject, 'hardware'>,
  rewards: readonly IRewardSummaryItem[] | undefined,
  rewardScopes: readonly IInviteRewardScope[] | undefined,
): IInviteRewardRow {
  const available = summarize(rewards);
  return {
    subject,
    hasData: available.hasReward,
    available,
    pending: null,
    monthlySalesFiatValue: null,
    scopeDescription: getInviteRewardScopeDescription(subject, rewardScopes),
  };
}

// A product is on unless the backend's rate config turns it off, so a product
// it hides drops out of the breakdown without a client change.
export function isInviteRewardSubjectEnabled(
  subject: IInviteRewardSubject,
  configs: Record<string, { enabled?: boolean }> | undefined,
) {
  const subjectConfigs = INVITE_REWARD_RATE_SUBJECTS[subject]
    .map((key) => configs?.[key])
    .filter(Boolean);
  return (
    subjectConfigs.length === 0 ||
    subjectConfigs.some((config) => config?.enabled !== false)
  );
}

// Products with rewards come first, then the ones without, each group in the
// canonical product order.
export function getInviteRewardRows(
  summary?: IInviteRewardRowsInput | null,
  configs?: Record<string, { enabled?: boolean }>,
): IInviteRewardRow[] {
  const rewardScopes = summary?.rewardScopes;
  const rows: IInviteRewardRow[] = [
    buildHardwareRow(summary?.HardwareSales, rewardScopes),
    buildAmountRow('perps', summary?.Perp?.available, rewardScopes),
    buildAmountRow('swap', summary?.Onchain?.swap, rewardScopes),
    buildAmountRow('defi', summary?.Onchain?.available, rewardScopes),
    // Money already earned stays listed even once its product is off.
  ].filter(
    (row) => row.hasData || isInviteRewardSubjectEnabled(row.subject, configs),
  );

  return [
    ...rows.filter((row) => row.hasData),
    ...rows.filter((row) => !row.hasData),
  ];
}

// Visible products only, in the same order as the breakdown rows.
export function getInviteRewardScopeItems(
  summary?: IInviteRewardRowsInput | null,
  configs?: Record<string, { enabled?: boolean }>,
): IInviteRewardScopeItem[] {
  return getInviteRewardRows(summary, configs).flatMap((row) =>
    row.scopeDescription
      ? [{ subject: row.subject, description: row.scopeDescription }]
      : [],
  );
}
