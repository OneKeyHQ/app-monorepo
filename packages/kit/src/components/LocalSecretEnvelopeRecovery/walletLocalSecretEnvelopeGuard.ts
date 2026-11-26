import { AppState } from 'react-native';

import {
  useWalletLocalSecretEnvelopeStatusAtom,
  walletLocalSecretEnvelopeStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/walletLocalSecretEnvelopeStatus';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import { getLocalSecretEnvelopeCredentialKey } from '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData';
import type { ILocalSecretEnvelopeCredentialIssue } from '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

const ON_DEMAND_PREFLIGHT_TIMEOUT_MS = 1500;

const confirmedReadableCredentialIds = new Set<string>();
let cacheListenersRegistered = false;

export function clearWalletLocalSecretEnvelopeConfirmedReadableCache() {
  confirmedReadableCredentialIds.clear();
}

function ensureCacheInvalidationListeners() {
  if (cacheListenersRegistered) {
    return;
  }
  cacheListenersRegistered = true;
  appEventBus.on(
    EAppEventBusNames.WalletLocalSecretEnvelopeKeysChanged,
    clearWalletLocalSecretEnvelopeConfirmedReadableCache,
  );
  AppState?.addEventListener?.('change', (state) => {
    if (state !== 'active') {
      clearWalletLocalSecretEnvelopeConfirmedReadableCache();
    }
  });
}

export function markWalletLocalSecretEnvelopeConfirmedReadable(
  credentialId: string,
) {
  ensureCacheInvalidationListeners();
  confirmedReadableCredentialIds.add(credentialId);
}

export function getWalletLocalSecretEnvelopeCredentialId({
  walletId,
  accountId,
}: {
  walletId?: string;
  accountId?: string;
}): string | undefined {
  if (accountId && accountUtils.isImportedAccount?.({ accountId })) {
    return accountId;
  }
  const resolvedWalletId =
    walletId ||
    (accountId
      ? accountUtils.getWalletIdFromAccountId?.({ accountId })
      : undefined);
  return accountUtils.isHdWallet?.({ walletId: resolvedWalletId })
    ? resolvedWalletId
    : undefined;
}

export function getWalletLocalSecretEnvelopeIssueFromStatus(
  {
    issues,
    sessionId,
  }: {
    issues: Record<string, ILocalSecretEnvelopeCredentialIssue>;
    sessionId: string;
  },
  credentialId: string | undefined,
): ILocalSecretEnvelopeCredentialIssue | undefined {
  if (!credentialId || !sessionId) {
    return undefined;
  }
  return issues[getLocalSecretEnvelopeCredentialKey(sessionId, credentialId)];
}

export function useWalletLocalSecretEnvelopeIssue({
  walletId,
  accountId,
}: {
  walletId?: string;
  accountId?: string;
}): ILocalSecretEnvelopeCredentialIssue | undefined {
  const [status] = useWalletLocalSecretEnvelopeStatusAtom();
  const credentialId = getWalletLocalSecretEnvelopeCredentialId({
    walletId,
    accountId,
  });
  return getWalletLocalSecretEnvelopeIssueFromStatus(status, credentialId);
}

export function showWalletLocalSecretEnvelopeRecoveryDialog(
  issue: ILocalSecretEnvelopeCredentialIssue,
) {
  appEventBus.emit(EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog, issue);
}

export async function getWalletLocalSecretEnvelopeUnavailableIssue({
  walletId,
  accountId,
}: {
  walletId?: string;
  accountId?: string;
}): Promise<ILocalSecretEnvelopeCredentialIssue | undefined> {
  const credentialId = getWalletLocalSecretEnvelopeCredentialId({
    walletId,
    accountId,
  });
  if (!credentialId) {
    return undefined;
  }

  const status = jotaiDefaultStore.get(
    walletLocalSecretEnvelopeStatusAtom.atom(),
  );
  const existingIssue = getWalletLocalSecretEnvelopeIssueFromStatus(
    status,
    credentialId,
  );
  if (existingIssue) {
    return existingIssue;
  }

  if (confirmedReadableCredentialIds.has(credentialId)) {
    return undefined;
  }

  if (
    typeof backgroundApiProxy.serviceAccount
      ?.preflightWalletLocalSecretEnvelope !== 'function'
  ) {
    return undefined;
  }

  const expiresAt = Date.now() + ON_DEMAND_PREFLIGHT_TIMEOUT_MS;
  let result: ILocalSecretEnvelopeCredentialIssue | null | undefined;
  try {
    result =
      await backgroundApiProxy.serviceAccount.preflightWalletLocalSecretEnvelope(
        { credentialId, expiresAt },
      );
  } catch {
    // An interrupted or unavailable background runtime is inconclusive.
    return undefined;
  }

  if (result) {
    return result;
  }
  if (result === null && Date.now() < expiresAt) {
    markWalletLocalSecretEnvelopeConfirmedReadable(credentialId);
  }
  return undefined;
}

export async function blockIfWalletLocalSecretEnvelopeUnavailable({
  walletId,
  accountId,
  presentDialog,
}: {
  walletId?: string;
  accountId?: string;
  presentDialog?: (show: () => void) => void | Promise<void>;
}): Promise<boolean> {
  const issue = await getWalletLocalSecretEnvelopeUnavailableIssue({
    walletId,
    accountId,
  });
  if (!issue) {
    return false;
  }
  const show = () => {
    showWalletLocalSecretEnvelopeRecoveryDialog(issue);
  };
  if (presentDialog) {
    await presentDialog(show);
  } else {
    show();
  }
  return true;
}
