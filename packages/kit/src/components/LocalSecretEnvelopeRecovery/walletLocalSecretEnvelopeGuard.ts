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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { resolveBeforeTimeout } from '@onekeyhq/shared/src/utils/timerUtils';

const ON_DEMAND_PREFLIGHT_TIMEOUT_MS = 1500;

function getBackgroundApiProxy():
  | typeof import('../../background/instance/backgroundApiProxy').default
  | undefined {
  // Resolve lazily so importing read-only guard helpers never pulls the full
  // background proxy / connector graph into unrelated UI module evaluations.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (
    require('../../background/instance/backgroundApiProxy') as {
      default?: typeof import('../../background/instance/backgroundApiProxy').default;
    }
  )?.default;
}

const confirmedReadableCredentialIds = new Set<string>();
let cacheGeneration = 0;
let cacheListenersRegistered = false;

export function clearWalletLocalSecretEnvelopeConfirmedReadableCache() {
  cacheGeneration += 1;
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

export function getCurrentWalletLocalSecretEnvelopeIssue(
  credentialId: string | undefined,
): ILocalSecretEnvelopeCredentialIssue | undefined {
  if (!credentialId) return undefined;
  return getWalletLocalSecretEnvelopeIssueFromStatus(
    jotaiDefaultStore.get(walletLocalSecretEnvelopeStatusAtom.atom()),
    credentialId,
  );
}

export function shouldRecheckWalletLocalSecretEnvelopeIssue(
  issue: ILocalSecretEnvelopeCredentialIssue | undefined,
): boolean {
  return (
    platformEnv.isNativeAndroid === true &&
    issue?.reason === 'authentication-failed'
  );
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

  const existingIssue = getCurrentWalletLocalSecretEnvelopeIssue(credentialId);
  if (
    existingIssue &&
    !shouldRecheckWalletLocalSecretEnvelopeIssue(existingIssue)
  ) {
    return existingIssue;
  }

  if (!existingIssue && confirmedReadableCredentialIds.has(credentialId)) {
    return undefined;
  }

  const backgroundApiProxy = getBackgroundApiProxy();
  if (
    typeof backgroundApiProxy?.serviceAccount
      ?.preflightWalletLocalSecretEnvelope !== 'function'
  ) {
    return existingIssue;
  }

  ensureCacheInvalidationListeners();
  const requestCacheGeneration = cacheGeneration;
  const expiresAt = Date.now() + ON_DEMAND_PREFLIGHT_TIMEOUT_MS;
  let result: ILocalSecretEnvelopeCredentialIssue | null | undefined;
  try {
    result = await resolveBeforeTimeout(
      backgroundApiProxy.serviceAccount
        .preflightWalletLocalSecretEnvelope({ credentialId, expiresAt })
        .catch(() => undefined),
      ON_DEMAND_PREFLIGHT_TIMEOUT_MS,
    );
  } catch {
    // An interrupted or unavailable background runtime is inconclusive;
    // preserve a previously confirmed issue but never block healthy wallets.
    return getCurrentWalletLocalSecretEnvelopeIssue(credentialId);
  }

  if (result) {
    return result;
  }
  if (result === null && Date.now() < expiresAt) {
    if (cacheGeneration === requestCacheGeneration) {
      markWalletLocalSecretEnvelopeConfirmedReadable(credentialId);
    }
    return undefined;
  }
  return getCurrentWalletLocalSecretEnvelopeIssue(credentialId);
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
