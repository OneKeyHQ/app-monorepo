import {
  type IBorrowAction,
  buildBorrowTag,
} from '@onekeyhq/kit/src/views/Staking/utils/utils';
import type {
  IBorrowEModeAsset,
  IBorrowEModeBlockerAsset,
  IBorrowEModeStatus,
  IBorrowEModeSwitchCheck,
  IEarnText,
} from '@onekeyhq/shared/types/staking';

export type IEModeBorrowAction = Extract<
  IBorrowAction,
  'repay' | 'setCollateral' | 'setEMode'
>;

export function isEModeBorrowActionTag({
  tag,
  provider,
  actions,
}: {
  tag: string;
  provider: string;
  actions: IEModeBorrowAction[];
}): boolean {
  return actions.some((action) => tag === buildBorrowTag({ provider, action }));
}

export function isEModePendingGuardActive({
  pendingHistoryLoading,
  pendingCount,
  focusRevalidating = false,
}: {
  pendingHistoryLoading: boolean | undefined;
  pendingCount: number;
  focusRevalidating?: boolean;
}): boolean {
  return (
    pendingHistoryLoading !== false || pendingCount > 0 || focusRevalidating
  );
}

export function isEModeFocusActivationPending({
  isFocused,
  previousIsFocused,
}: {
  isFocused: boolean;
  previousIsFocused: boolean | undefined;
}): boolean {
  return isFocused && previousIsFocused === false;
}

export interface IEModeRow {
  eModeId: number; // 0 = off
  label: string; // raw backend label, kept stable as the row key
  displayLabel: string; // humanized label for display
  ltv?: string;
  liquidationThreshold?: string;
  canSwitch?: boolean;
  assets?: IBorrowEModeAsset[]; // category coverage; absent on the synthetic Off row
  selected: boolean;
  isOff: boolean;
}

export function buildEModeRows(
  status: IBorrowEModeStatus | null | undefined,
  offLabel: string,
): IEModeRow[] {
  if (!status) {
    return [];
  }
  const currentId = status.eModeId ?? 0;
  const offRow: IEModeRow = {
    eModeId: 0,
    label: offLabel,
    displayLabel: offLabel,
    // Off = the base market LTV (e-mode boosts on top of it). Seeds the hero's
    // "current" value when e-mode is off so it reads the real LTV, not "—".
    ltv: status.originalLtv,
    selected: currentId === 0,
    isOff: true,
  };
  const categoryRows: IEModeRow[] = (status.categories ?? []).map((c) => ({
    eModeId: c.eModeId,
    label: c.label,
    displayLabel: normalizeEModeLabel(c.label),
    ltv: c.ltv,
    liquidationThreshold: c.liquidationThreshold,
    canSwitch: c.canSwitch,
    assets: c.assets,
    selected: currentId === c.eModeId,
    isOff: false,
  }));
  return [offRow, ...categoryRows];
}

export function buildEModeSelectDescription({
  row,
  currentEModeId,
  currentText,
  offText,
  formatMaxLtv,
  needsActionText,
}: {
  row: IEModeRow;
  currentEModeId: number;
  currentText: string;
  offText: string;
  formatMaxLtv: (ltv: string) => string;
  needsActionText: string;
}): string {
  if (row.eModeId === currentEModeId) {
    return currentText;
  }
  if (row.isOff) {
    return offText;
  }
  const parts = row.ltv ? [formatMaxLtv(row.ltv)] : [];
  if (row.canSwitch === false) {
    parts.push(needsActionText);
  }
  return parts.join(' · ');
}

export interface IEModeSelectionResolution {
  effectiveSelection: number | null;
  userSelection: number | null;
  resetTarget: boolean;
}

export function reconcileEModeSelection({
  statusCurrentId,
  userSelection,
  availableIds,
}: {
  statusCurrentId: number | null;
  userSelection: number | null;
  availableIds: number[];
}): IEModeSelectionResolution {
  if (statusCurrentId === null) {
    return { effectiveSelection: null, userSelection, resetTarget: false };
  }
  if (userSelection === null) {
    return {
      effectiveSelection: statusCurrentId,
      userSelection: null,
      resetTarget: false,
    };
  }
  if (
    userSelection === statusCurrentId ||
    !availableIds.includes(userSelection)
  ) {
    return {
      effectiveSelection: statusCurrentId,
      userSelection: null,
      resetTarget: true,
    };
  }
  return {
    effectiveSelection: userSelection,
    userSelection,
    resetTarget: false,
  };
}

export type IEModeViewState =
  | 'loading'
  | 'current'
  | 'checking'
  | 'error'
  | 'blocked'
  | 'switchable';

export function resolveEModeViewState({
  effectiveSelection,
  currentEModeId,
  isChecking,
  requiresRevalidation,
  check,
}: {
  effectiveSelection: number | null;
  currentEModeId: number | null;
  isChecking: boolean;
  requiresRevalidation: boolean;
  check: IBorrowEModeSwitchCheck | null;
}): IEModeViewState {
  if (effectiveSelection === null || currentEModeId === null) {
    return 'loading';
  }
  if (effectiveSelection === currentEModeId) {
    return 'current';
  }
  if (isChecking || requiresRevalidation) {
    return 'checking';
  }
  if (!check) {
    return 'error';
  }
  return check.canSwitch ? 'switchable' : 'blocked';
}

// Turn a raw backend category label into something readable by replacing
// machine delimiters and collapsing surrounding whitespace.
export function normalizeEModeLabel(raw: string): string {
  const normalized = raw.replace(/_+|\//g, ' ').replace(/\s+/g, ' ').trim();
  return normalized || raw;
}

// The mockup reads a rising Max LTV in $textSuccess, but the server sends a
// plain "$text" color on maxLtv (see the switch-check response sample doc).
// Accent locally, and only when both sides parse as percentages and the value
// rises; falls, ties, and non-numeric values return undefined so the caller
// keeps the server color.
export function resolveLtvAccentColor(
  current?: IEarnText,
  latest?: IEarnText,
): string | undefined {
  const parse = (t?: IEarnText) => {
    const n = Number.parseFloat(t?.text ?? '');
    return Number.isFinite(n) ? n : undefined;
  };
  const before = parse(current);
  const after = parse(latest);
  if (before !== undefined && after !== undefined && after > before) {
    return '$textSuccess';
  }
  return undefined;
}

export function shouldShowCurrentHealthFactorSkeleton({
  isCurrent,
  currentHealthFactorLoading,
  currentHealthFactor,
}: {
  isCurrent: boolean;
  currentHealthFactorLoading: boolean;
  currentHealthFactor?: IEarnText;
}): boolean {
  return isCurrent && currentHealthFactorLoading && !currentHealthFactor;
}

export interface IEModeNeedActionItem {
  kind: 'repay' | 'removeCollateral';
  reserveAddress: string;
  symbol: string;
  logoURI?: string;
  amount?: IEarnText; // server-formatted token amount, e.g. "0.002107"
  amountFiat?: IEarnText; // server-formatted fiat value, e.g. "< $0.01"
  amountValue?: string; // raw amount for the tx (borrowed.number on repay)
  hfSafety?: boolean; // true iff sourced from additionalRepayAssets → "keeps HF safe"
}

export function buildNeedActionItems(
  check: IBorrowEModeSwitchCheck | null | undefined,
): IEModeNeedActionItem[] {
  if (!check) {
    return [];
  }
  // Server only guarantees `reasons`; the blocker arrays may be absent, so
  // default every one with `?? []`. When absent this returns [] and the
  // Need Action screen falls back to the reasons[] prose.
  const toRepay = (
    a: IBorrowEModeBlockerAsset,
    hfSafety: boolean,
  ): IEModeNeedActionItem => ({
    kind: 'repay',
    reserveAddress: a.reserveAddress,
    symbol: a.token.symbol,
    logoURI: a.token.logoURI,
    amount: a.borrowed?.title,
    amountFiat: a.borrowed?.description,
    amountValue: a.borrowed?.number,
    hfSafety,
  });
  const toRemoveCollateral = (
    a: IBorrowEModeBlockerAsset,
  ): IEModeNeedActionItem => ({
    kind: 'removeCollateral',
    reserveAddress: a.reserveAddress,
    symbol: a.token.symbol,
    logoURI: a.token.logoURI,
    amount: a.supplied?.title,
    amountFiat: a.supplied?.description,
  });
  return [
    ...(check.repayAssets ?? []).map((a) => toRepay(a, false)),
    ...(check.additionalRepayAssets ?? []).map((a) => toRepay(a, true)),
    ...(check.disableCollateralAssets ?? []).map(toRemoveCollateral),
  ];
}
