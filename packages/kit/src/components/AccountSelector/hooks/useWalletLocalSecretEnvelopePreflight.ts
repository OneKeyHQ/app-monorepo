import { useEffect, useState } from 'react';

import type { ILocalSecretEnvelopeCredentialIssue } from '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

const PREFLIGHT_DELAY_MS = 250;
const PREFLIGHT_TIMEOUT_MS = 1500;

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
    const expiresAt = Date.now() + PREFLIGHT_DELAY_MS + PREFLIGHT_TIMEOUT_MS;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const issue =
            await backgroundApiProxy.serviceAccount.preflightWalletLocalSecretEnvelope(
              { credentialId, expiresAt },
            );
          if (issue && !cancelled && Date.now() < expiresAt) {
            onIssue?.(issue);
          }
        } catch {
          // An interrupted or unavailable background runtime is inconclusive.
        }
      })();
    }, PREFLIGHT_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [credentialId, keyRevision, onIssue]);
}
