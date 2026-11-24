import { useEffect, useState } from 'react';

import type { ILocalSecretEnvelopeCredentialIssue } from '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

const PREFLIGHT_DELAY_MS = 250;
const PREFLIGHT_TIMEOUT_MS = 1500;
const PREFLIGHT_RETRY_DELAY_MS = 1000;

export function getActiveWalletLocalSecretEnvelopeCredentialId({
  ready,
  wallet,
  dbAccount,
}: {
  ready: boolean;
  wallet?: { id: string };
  dbAccount?: { id: string };
}) {
  if (!ready) return undefined;

  const accountId = dbAccount?.id;
  if (accountId && accountUtils.isImportedAccount({ accountId })) {
    return accountId;
  }
  const walletId = wallet?.id;
  return accountUtils.isHdWallet({ walletId }) ? walletId : undefined;
}

export function useWalletLocalSecretEnvelopePreflight(
  credentialId: string | undefined,
  onIssue?: (issue: ILocalSecretEnvelopeCredentialIssue) => void,
) {
  const [keyRevision, setKeyRevision] = useState(0);

  useEffect(() => {
    const onKeysChanged = () => setKeyRevision((revision) => revision + 1);
    appEventBus.on(
      EAppEventBusNames.WalletLocalSecretEnvelopeKeysChanged,
      onKeysChanged,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.WalletLocalSecretEnvelopeKeysChanged,
        onKeysChanged,
      );
    };
  }, []);

  useEffect(() => {
    if (!credentialId) return;
    let cancelled = false;
    let canRetry = true;
    let timer: ReturnType<typeof setTimeout>;
    const preflight = () => {
      void (async () => {
        const expiresAt = Date.now() + PREFLIGHT_TIMEOUT_MS;
        let result: ILocalSecretEnvelopeCredentialIssue | null | undefined;
        try {
          result =
            await backgroundApiProxy.serviceAccount.preflightWalletLocalSecretEnvelope(
              { credentialId, expiresAt },
            );
        } catch {
          // An interrupted or unavailable background runtime is inconclusive.
        }
        if (cancelled) return;
        if (Date.now() < expiresAt && result !== undefined) {
          if (result) onIssue?.(result);
          return;
        }
        if (canRetry) {
          canRetry = false;
          timer = setTimeout(preflight, PREFLIGHT_RETRY_DELAY_MS);
        }
      })();
    };
    timer = setTimeout(preflight, PREFLIGHT_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [credentialId, keyRevision, onIssue]);
}
