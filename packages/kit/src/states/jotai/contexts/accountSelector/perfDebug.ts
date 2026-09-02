import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { loggerConfig } from '@onekeyhq/shared/src/logger/loggerConfig';
import { isAccountSelectorPerfE2EAttributionEnabled } from '@onekeyhq/shared/src/logger/scopes/accountSelector/scenes/perf';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IAccountSelectorActiveAccountInfo } from './atoms';

// Diagnostics only — never branch on these entries.
//
// Both maps are keyed by object identity, so a lookup only succeeds for the exact
// object this module recorded. Any selection or active account that came back
// through backgroundApiProxy — storage init, a cross-runtime read — is a freshly
// deserialized object and has no entry, even though it is value-equal. That holds
// on every target, not just the split-runtime ones (iOS/Android/extension), since
// desktop and web reach the same data through the same proxy.
//
// Writes are additionally gated on isAccountSelectorPerfDebugEnabled(), so in
// production these maps stay empty and every lookup returns undefined. Callers
// therefore must treat a miss as normal and use the result for labelling only:
// making control flow depend on it would fail exactly where it is hardest to
// reproduce — after a cold start, and worst on split-runtime targets.
const selectedAccountCommitMeta = new WeakMap<
  IAccountSelectorSelectedAccount,
  IAccountSelectorPerfCommitMeta
>();
const activeAccountCommitMeta = new WeakMap<
  IAccountSelectorActiveAccountInfo,
  IAccountSelectorActiveAccountPerfCommitMeta
>();

let nextTransitionId = 0;
let nextOperationId = 0;

const selectedAccountFields: Array<keyof IAccountSelectorSelectedAccount> = [
  'walletId',
  'indexedAccountId',
  'othersWalletAccountId',
  'networkId',
  'deriveType',
  'focusedWallet',
];

export type IAccountSelectorPerfCommitMeta = {
  transitionId: number;
  stateUpdatedAt: number;
  changedFields: string[];
  num: number;
  parentOperationId?: number;
  reason: string;
  // Set once this commit has been used to attribute an active-account reload.
  // See takeSelectedAccountReloadAttribution.
  reloadAttributionConsumed?: boolean;
};

export type IAccountSelectorActiveAccountPerfCommitMeta = {
  reloadId: number | undefined;
  scheduleId: number | undefined;
  stateUpdatedAt: number;
  changedFields: string[];
  trigger: string;
};

export function isAccountSelectorPerfDebugEnabled() {
  if (platformEnv.isE2E) {
    // Defaults to true. E2E scenarios may disable attribution at runtime
    // (ServiceE2E.configureAccountSelectorPerfE2E) to exercise the production
    // perf-off wiring; the override is authoritative even on dev builds.
    return isAccountSelectorPerfE2EAttributionEnabled();
  }
  return Boolean(
    platformEnv.isDev && loggerConfig.shouldLog('accountSelector', 'perf'),
  );
}

export function getNextAccountSelectorPerfOperationId() {
  nextOperationId += 1;
  return nextOperationId;
}

export function getAccountSelectorPerfTimestamp() {
  return typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now();
}

export function getSelectedAccountChangedFields({
  previous,
  current,
}: {
  previous: IAccountSelectorSelectedAccount | undefined;
  current: IAccountSelectorSelectedAccount | undefined;
}) {
  return selectedAccountFields.filter(
    (field) => previous?.[field] !== current?.[field],
  );
}

export function buildSelectedAccountPerfSummary(
  selectedAccount: IAccountSelectorSelectedAccount | undefined,
) {
  let accountKind = 'none';
  if (selectedAccount?.indexedAccountId) {
    accountKind = 'indexed';
  } else if (selectedAccount?.othersWalletAccountId) {
    accountKind = 'others';
  }
  return {
    accountKind,
    deriveType: selectedAccount?.deriveType,
    hasFocusedWallet: Boolean(selectedAccount?.focusedWallet),
    hasWallet: Boolean(selectedAccount?.walletId),
    networkId: selectedAccount?.networkId,
  };
}

export function buildActiveAccountPerfSummary(
  activeAccount: IAccountSelectorActiveAccountInfo | undefined,
) {
  return {
    deriveType: activeAccount?.deriveType,
    hasAccount: Boolean(activeAccount?.account),
    hasIndexedAccount: Boolean(activeAccount?.indexedAccount),
    hasWallet: Boolean(activeAccount?.wallet),
    isNetworkNotMatched: Boolean(activeAccount?.isNetworkNotMatched),
    networkId: activeAccount?.network?.id,
    ready: Boolean(activeAccount?.ready),
  };
}

export function recordActiveAccountPerfStateUpdate({
  current,
  previous,
  reloadId,
  scheduleId,
  trigger,
}: {
  current: IAccountSelectorActiveAccountInfo;
  previous: IAccountSelectorActiveAccountInfo | undefined;
  reloadId: number | undefined;
  scheduleId: number | undefined;
  trigger: string;
}) {
  if (!isAccountSelectorPerfDebugEnabled()) {
    return undefined;
  }
  const currentSummary = buildActiveAccountPerfSummary(current);
  const previousSummary = buildActiveAccountPerfSummary(previous);
  const changedFields = Object.keys(currentSummary).filter(
    (field) =>
      currentSummary[field as keyof typeof currentSummary] !==
      previousSummary[field as keyof typeof previousSummary],
  );
  const meta: IAccountSelectorActiveAccountPerfCommitMeta = {
    reloadId,
    scheduleId,
    stateUpdatedAt: getAccountSelectorPerfTimestamp(),
    changedFields,
    trigger,
  };
  activeAccountCommitMeta.set(current, meta);
  return meta;
}

export function getActiveAccountPerfCommitMeta(
  activeAccount: IAccountSelectorActiveAccountInfo | undefined,
) {
  return activeAccount ? activeAccountCommitMeta.get(activeAccount) : undefined;
}

export function recordSelectedAccountPerfStateUpdate({
  current,
  num,
  parentOperationId,
  previous,
  reason,
  revisionPolicy,
}: {
  current: IAccountSelectorSelectedAccount | undefined;
  num: number;
  parentOperationId?: number;
  previous: IAccountSelectorSelectedAccount | undefined;
  reason: string;
  // Surfaced in the trace so a selection change that never advanced the revision
  // is visible when diagnosing an update that was dropped as stale.
  revisionPolicy?: string;
}) {
  if (!isAccountSelectorPerfDebugEnabled()) {
    return undefined;
  }

  const meta: IAccountSelectorPerfCommitMeta = {
    transitionId: (nextTransitionId += 1),
    stateUpdatedAt: getAccountSelectorPerfTimestamp(),
    changedFields: getSelectedAccountChangedFields({ previous, current }),
    num,
    parentOperationId,
    reason,
  };
  if (current) {
    selectedAccountCommitMeta.set(current, meta);
  }
  defaultLogger.accountSelector.perf.trace('selectionStateUpdated', {
    ...meta,
    revisionPolicy,
    selection: buildSelectedAccountPerfSummary(current),
  });
  return meta;
}

// Claims this commit as the cause of one active-account reload.
//
// A reload is scheduled from an effect that can re-run while the selection object
// stays the same — a no-op re-selection, a host remount. Reading the commit meta
// directly would then attribute those extra schedules to the previous real
// selection, making a reload look like it belonged to a transition that had
// already been accounted for. Claiming it once, and only for the matching num,
// leaves later schedules unattributed, which is the honest answer.
export function takeSelectedAccountReloadAttribution({
  num,
  selectedAccount,
}: {
  num: number;
  selectedAccount: IAccountSelectorSelectedAccount | undefined;
}) {
  const meta = selectedAccount
    ? selectedAccountCommitMeta.get(selectedAccount)
    : undefined;
  if (!meta || meta.num !== num || meta.reloadAttributionConsumed) {
    return undefined;
  }
  meta.reloadAttributionConsumed = true;
  return meta;
}

// Returns undefined whenever perf debugging is off, or when the selection did not
// originate from this runtime's own commit. Both are expected — see the note on
// selectedAccountCommitMeta. Use for labelling, not for decisions.
export function getSelectedAccountPerfCommitMeta(
  selectedAccount: IAccountSelectorSelectedAccount | undefined,
) {
  return selectedAccount
    ? selectedAccountCommitMeta.get(selectedAccount)
    : undefined;
}
