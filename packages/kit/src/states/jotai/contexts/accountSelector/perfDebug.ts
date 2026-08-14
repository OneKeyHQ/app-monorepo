import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { loggerConfig } from '@onekeyhq/shared/src/logger/loggerConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IAccountSelectorActiveAccountInfo } from './atoms';

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
};

export type IAccountSelectorActiveAccountPerfCommitMeta = {
  reloadId: number | undefined;
  scheduleId: number | undefined;
  stateUpdatedAt: number;
  changedFields: string[];
  trigger: string;
};

export function isAccountSelectorPerfDebugEnabled() {
  return Boolean(
    platformEnv.isE2E ||
    (platformEnv.isDev && loggerConfig.shouldLog('accountSelector', 'perf')),
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
}: {
  current: IAccountSelectorSelectedAccount | undefined;
  num: number;
  parentOperationId?: number;
  previous: IAccountSelectorSelectedAccount | undefined;
  reason: string;
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
    selection: buildSelectedAccountPerfSummary(current),
  });
  return meta;
}

export function getSelectedAccountPerfCommitMeta(
  selectedAccount: IAccountSelectorSelectedAccount | undefined,
) {
  return selectedAccount
    ? selectedAccountCommitMeta.get(selectedAccount)
    : undefined;
}
