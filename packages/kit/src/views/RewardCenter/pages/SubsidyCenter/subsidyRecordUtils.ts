import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  ESubsidyGaAmountStatus,
  ESubsidyRecordKind,
  ESubsidyTronOperation,
  ESubsidyTronState,
} from '@onekeyhq/shared/types/subsidy';
import type {
  ISubsidyGaRecord,
  ISubsidyRecord,
  ISubsidySummary,
  ISubsidyTronRecord,
} from '@onekeyhq/shared/types/subsidy';

// Records shown on the overview.
export const SUBSIDY_RECENT_RECORD_LIMIT = 6;
// The server accepts 1-50 records per page.
export const SUBSIDY_PAGE_SIZE_MAX = 50;

// How many rows of `rowHeight` fit a list area of `height`: the page size of
// the full list, so a page never needs to scroll.
export function getSubsidyPageSize(height: number, rowHeight: number): number {
  const rows = Math.floor(height / rowHeight);
  return Math.min(SUBSIDY_PAGE_SIZE_MAX, Math.max(1, rows));
}

// Undefined when the total is unknown, in which case only previous / next
// can be offered.
export function getSubsidyPageCount(
  total: number | null | undefined,
  pageSize: number | undefined,
): number | undefined {
  if (typeof total !== 'number' || !pageSize) {
    return undefined;
  }
  return Math.max(1, Math.ceil(total / pageSize));
}

// TODO(OK-67058): move to i18n keys once the copy is final.
export const subsidyRecordCopy = {
  gaTitleDefault: 'Gas 赞助交易',
  gaTitleSend: '转账',
  gaTitleSwap: '兑换',
  tronTitleFreeClaim: '免费领取能量',
  tronTitleCodeRedeem: '兑换码兑换',
  otherTitle: '其他补贴',
  settling: '结算中',
  tronDispatching: '处理中',
  tronAccepted: '已受理',
  tronRejected: '未受理',
  tronUnknown: '结果待确认',
  otherState: '其他',
  noValue: '—',
};

export type ISubsidyRecordRow = {
  id: string;
  icon: IKeyOfIcons;
  title: string;
  networkId: string;
  createdAt: string;
  // A row shows either a USD amount or a status label, never both.
  amountUsd?: string;
  statusLabel?: string;
};

// The server names scenarios after the Gas Account scenario codes the App
// sends with estimate-fee. Only transfers and swaps have a dedicated title;
// every other or unknown scenario falls back to the generic one.
const gaScenarioTitles: Record<string, string> = {
  send: subsidyRecordCopy.gaTitleSend,
  swap: subsidyRecordCopy.gaTitleSwap,
};

const tronOperationTitles: Record<string, string> = {
  [ESubsidyTronOperation.FreeClaim]: subsidyRecordCopy.tronTitleFreeClaim,
  [ESubsidyTronOperation.CodeRedeem]: subsidyRecordCopy.tronTitleCodeRedeem,
};

const tronStateLabels: Record<string, string> = {
  [ESubsidyTronState.Dispatching]: subsidyRecordCopy.tronDispatching,
  [ESubsidyTronState.SupplierAccepted]: subsidyRecordCopy.tronAccepted,
  [ESubsidyTronState.SupplierRejected]: subsidyRecordCopy.tronRejected,
  [ESubsidyTronState.Unknown]: subsidyRecordCopy.tronUnknown,
};

function buildGaRow(record: ISubsidyGaRecord): ISubsidyRecordRow {
  const row: ISubsidyRecordRow = {
    id: record.id,
    icon: 'GasOutline',
    title:
      (record.ga?.scenario
        ? gaScenarioTitles[record.ga.scenario]
        : undefined) ?? subsidyRecordCopy.gaTitleDefault,
    networkId: record.networkId,
    createdAt: record.createdAt,
  };
  // A missing amount is "not evidenced", never 0: only a pending settlement
  // has a status of its own, anything else stays blank.
  const amountUsd = record.ga?.sponsorCostUsd?.value;
  if (amountUsd) {
    row.amountUsd = amountUsd;
  } else if (record.ga?.amountStatus === ESubsidyGaAmountStatus.Pending) {
    row.statusLabel = subsidyRecordCopy.settling;
  } else {
    row.statusLabel = subsidyRecordCopy.noValue;
  }
  return row;
}

// A TRON record is an issuance attempt and carries no amount, so the row
// reports how far the attempt got instead.
function buildTronRow(record: ISubsidyTronRecord): ISubsidyRecordRow {
  return {
    id: record.id,
    icon: 'FlashSolid',
    title:
      tronOperationTitles[record.operation] ?? subsidyRecordCopy.otherTitle,
    networkId: record.networkId,
    createdAt: record.createdAt,
    statusLabel: tronStateLabels[record.state] ?? subsidyRecordCopy.otherState,
  };
}

export function buildSubsidyRecordRow(
  record: ISubsidyRecord,
): ISubsidyRecordRow {
  // `kind` is read as a plain string: the server may add kinds without a
  // version bump, and such a record must render instead of failing the list.
  const kind: string = record.kind;
  if (kind === ESubsidyRecordKind.GaSponsorship) {
    return buildGaRow(record as ISubsidyGaRecord);
  }
  if (kind === ESubsidyRecordKind.TronEnergy) {
    return buildTronRow(record as ISubsidyTronRecord);
  }
  return {
    id: record.id,
    icon: 'GiftOutline',
    title: subsidyRecordCopy.otherTitle,
    networkId: record.networkId,
    createdAt: record.createdAt,
    statusLabel: subsidyRecordCopy.noValue,
  };
}

export type ISubsidySummaryView = {
  // Undefined when there is no evidenced amount; rendered blank, never as 0.
  sponsorCostUsd: string | undefined;
  gaSettledCount: number | undefined;
  tronAcceptedCount: number | undefined;
};

function toCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

export function buildSubsidySummaryView(
  summary: ISubsidySummary | undefined,
): ISubsidySummaryView {
  return {
    sponsorCostUsd: summary?.ga?.sponsorCostUsd?.value || undefined,
    gaSettledCount: toCount(summary?.ga?.sponsoredCount),
    tronAcceptedCount: toCount(
      summary?.tron?.byState?.[ESubsidyTronState.SupplierAccepted],
    ),
  };
}

export function formatSubsidyCount(
  count: number | undefined,
  unit: string,
): string {
  return count === undefined ? subsidyRecordCopy.noValue : `${count} ${unit}`;
}
