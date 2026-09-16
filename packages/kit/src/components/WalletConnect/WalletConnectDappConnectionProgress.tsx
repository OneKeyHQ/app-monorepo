import { useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import {
  WALLET_CONNECT_PROGRESS_MAX_ATTEMPTS,
  WalletConnectConnectionProgressView,
} from './WalletConnectConnectionProgressView';

export function WalletConnectDappConnectionProgress({
  onExhausted,
}: {
  onExhausted: () => Promise<void>;
}) {
  const { result } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceWalletConnect
        .getDappSideConnectionProgress()
        .catch(() => undefined),
    [],
    {
      pollingInterval: 1000,
      checkIsFocused: false,
      revalidateOnReconnect: true,
    },
  );
  const dismissed = useRef(false);
  const exhausted = Boolean(
    result?.attemptId &&
    !result.snapshotFailed &&
    !result.connected &&
    !result.connectedDuringAttempt &&
    (result.lastFailedAttempt >= WALLET_CONNECT_PROGRESS_MAX_ATTEMPTS ||
      result.attempt > WALLET_CONNECT_PROGRESS_MAX_ATTEMPTS),
  );

  useEffect(() => {
    if (exhausted && !dismissed.current) {
      dismissed.current = true;
      // End only this progress display, without cancelling the SDK or pairing.
      void onExhausted().catch(() => undefined);
    }
  }, [exhausted, onExhausted]);

  return (
    <WalletConnectConnectionProgressView
      progress={
        result?.attemptId &&
        result.attempt > 0 &&
        !result.snapshotFailed &&
        result.connected === false &&
        !result.connectedDuringAttempt &&
        !exhausted
          ? result
          : undefined
      }
    />
  );
}
