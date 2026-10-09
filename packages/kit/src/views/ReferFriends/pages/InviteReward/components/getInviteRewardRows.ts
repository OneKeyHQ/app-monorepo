import BigNumber from 'bignumber.js';

import type { IKeyOfIcons } from '@onekeyhq/components';

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
}

const EMPTY_REWARDS: readonly IRewardSummaryItem[] = [];

function hasPositiveAmount(value: string | undefined) {
  if (!value) {
    return false;
  }
  const amount = new BigNumber(value);
  return amount.isFinite() && amount.isGreaterThan(0);
}

function summarize(rewards: readonly IRewardSummaryItem[] | undefined) {
  return getRewardSummary(rewards ?? EMPTY_REWARDS);
}

function buildHardwareRow(
  hardware: IInviteRewardRowsInput['HardwareSales'],
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
  };
}

function buildAmountRow(
  subject: Exclude<IInviteRewardSubject, 'hardware'>,
  rewards: readonly IRewardSummaryItem[] | undefined,
): IInviteRewardRow {
  const available = summarize(rewards);
  return {
    subject,
    hasData: available.hasReward,
    available,
    pending: null,
    monthlySalesFiatValue: null,
  };
}

// Backend rate subjects behind each reward row; DeFi rates may arrive under
// either name.
export const INVITE_REWARD_RATE_SUBJECTS: Record<
  IInviteRewardSubject,
  readonly string[]
> = {
  hardware: ['HardwareSales'],
  perps: ['Perp'],
  swap: ['Swap'],
  defi: ['Earn', 'Onchain'],
};

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

export function getInviteRewardRows(
  summary?: IInviteRewardRowsInput | null,
  configs?: Record<string, { enabled?: boolean }>,
): {
  visibleRows: IInviteRewardRow[];
  foldedRows: IInviteRewardRow[];
} {
  const rows: IInviteRewardRow[] = [
    buildHardwareRow(summary?.HardwareSales),
    buildAmountRow('perps', summary?.Perp?.available),
    buildAmountRow('swap', summary?.Onchain?.swap),
    buildAmountRow('defi', summary?.Onchain?.available),
    // Money already earned stays listed even once its product is off.
  ].filter(
    (row) => row.hasData || isInviteRewardSubjectEnabled(row.subject, configs),
  );

  return {
    visibleRows: rows.filter((row) => row.hasData),
    foldedRows: rows.filter((row) => !row.hasData),
  };
}
