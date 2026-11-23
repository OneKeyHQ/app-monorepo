import type { IKeyOfIcons } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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

// Whether the requested page lies beyond the last one, in which case the
// list returns to page 1 (records can leave the 90-day window between two
// requests). Only a settled answer for that very page counts: a cached copy
// is still being refreshed, and an empty page that is partial (a source
// failed) or has a successor is not the end, so it keeps its place and its
// retry.
export function isSubsidyPagePastEnd({
  page,
  isSettled,
  itemCount,
  isPartial,
  hasMore,
}: {
  page: number;
  // The response for this page has arrived and nothing is in flight.
  isSettled: boolean;
  itemCount: number | undefined;
  isPartial: boolean | undefined;
  hasMore: boolean | undefined;
}): boolean {
  return page > 1 && isSettled && itemCount === 0 && !isPartial && !hasMore;
}

// Cache message IDs, not translated text, so existing records follow locale changes.
export const subsidyRecordCopy = {
  gaTitleDefault: ETranslations.subsidy_network_fee__title,
  gaTitleSend: ETranslations.subsidy_transfer_fee__title,
  gaTitleSwap: ETranslations.subsidy_swap_fee__title,
  tronTitleFreeClaim: ETranslations.subsidy_free_claim__title,
  tronTitleCodeRedeem: ETranslations.subsidy_code_energy__title,
  otherTitle: ETranslations.subsidy_other__title,
  settling: ETranslations.subsidy_settling__title,
  tronDispatching: ETranslations.global_processing,
  tronAccepted: ETranslations.subsidy_claimed__title,
  tronRejected: ETranslations.subsidy_not_accepted__title,
  tronUnknown: ETranslations.subsidy_unconfirmed__title,
  otherState: ETranslations.global_others,
  noValue: '--',
};

export type ISubsidyRecordRow = {
  id: string;
  icon: IKeyOfIcons;
  titleId: ETranslations;
  networkId: string;
  createdAt: string;
  // A row shows either a USD amount or a status label, never both.
  amountUsd?: string;
  statusId?: ETranslations;
};

// The server names scenarios after the Gas Account scenario codes the App
// sends with estimate-fee. Only transfers and swaps have a dedicated title;
// every other or unknown scenario falls back to the generic one.
const gaScenarioTitles: Record<string, ETranslations> = {
  send: subsidyRecordCopy.gaTitleSend,
  swap: subsidyRecordCopy.gaTitleSwap,
};

const tronOperationTitles: Record<string, ETranslations> = {
  [ESubsidyTronOperation.FreeClaim]: subsidyRecordCopy.tronTitleFreeClaim,
  [ESubsidyTronOperation.CodeRedeem]: subsidyRecordCopy.tronTitleCodeRedeem,
};

const tronStateLabels: Record<string, ETranslations> = {
  [ESubsidyTronState.Dispatching]: subsidyRecordCopy.tronDispatching,
  [ESubsidyTronState.SupplierAccepted]: subsidyRecordCopy.tronAccepted,
  [ESubsidyTronState.SupplierRejected]: subsidyRecordCopy.tronRejected,
  [ESubsidyTronState.Unknown]: subsidyRecordCopy.tronUnknown,
};

function buildGaRow(record: ISubsidyGaRecord): ISubsidyRecordRow {
  const row: ISubsidyRecordRow = {
    id: record.id,
    icon: 'GasOutline',
    titleId:
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
    row.statusId = subsidyRecordCopy.settling;
  }
  return row;
}

// A TRON record is an issuance attempt and carries no amount, so the row
// reports how far the attempt got instead.
function buildTronRow(record: ISubsidyTronRecord): ISubsidyRecordRow {
  return {
    id: record.id,
    icon: 'FlashSolid',
    titleId:
      tronOperationTitles[record.operation] ?? subsidyRecordCopy.otherTitle,
    networkId: record.networkId,
    createdAt: record.createdAt,
    statusId: tronStateLabels[record.state] ?? subsidyRecordCopy.otherState,
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
    titleId: subsidyRecordCopy.otherTitle,
    networkId: record.networkId,
    createdAt: record.createdAt,
  };
}

export type ISubsidySummaryView = {
  // A null total is displayed as zero; a missing source stays unknown.
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
    sponsorCostUsd:
      summary?.ga?.sponsorCostUsd === null
        ? '0'
        : summary?.ga?.sponsorCostUsd?.value || undefined,
    gaSettledCount: toCount(summary?.ga?.sponsoredCount),
    tronAcceptedCount: toCount(
      summary?.tron?.byState?.[ESubsidyTronState.SupplierAccepted],
    ),
  };
}

export function formatSubsidyCount(count: number | undefined): string {
  return count === undefined ? subsidyRecordCopy.noValue : String(count);
}
