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

export function getInviteRewardRows(summary?: IInviteRewardRowsInput | null): {
  visibleRows: IInviteRewardRow[];
  foldedRows: IInviteRewardRow[];
} {
  const rows: IInviteRewardRow[] = [
    buildHardwareRow(summary?.HardwareSales),
    buildAmountRow('perps', summary?.Perp?.available),
    buildAmountRow('swap', summary?.Onchain?.swap),
    buildAmountRow('defi', summary?.Onchain?.available),
  ];

  return {
    visibleRows: rows.filter((row) => row.hasData),
    foldedRows: rows.filter((row) => !row.hasData),
  };
}
