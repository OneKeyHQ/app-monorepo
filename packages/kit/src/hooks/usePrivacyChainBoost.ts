import { useCallback, useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrivacyChainAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IPrivacyChainBoostTrigger } from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';

import { useRouteIsFocused } from './useRouteIsFocused';

// Asks for the foreground pace early on behalf of one surface; never stops it (that's the light/scheduler's job).
export function usePrivacyChainBoost({
  networkId,
  accountId,
  trigger,
  enabled,
}: {
  networkId: string;
  accountId: string;
  trigger: IPrivacyChainBoostTrigger;
  // Whether the user is on this surface; the service decides if a boost is needed.
  enabled: boolean;
}) {
  const isRouteFocused = useRouteIsFocused();
  const [{ progress, boostingNetworkIds }] = usePrivacyChainAtom();

  const isPresent = enabled && isRouteFocused && !!networkId && !!accountId;

  const start = useCallback(() => {
    void backgroundApiProxy.servicePrivacyChain.startForegroundBoost({
      networkId,
      accountId,
      trigger,
    });
  }, [networkId, accountId, trigger]);

  // No cleanup: the pace depends on how far behind the wallet is, not on this page.
  useEffect(() => {
    if (!isPresent) {
      return;
    }
    start();
  }, [isPresent, start]);

  // Re-asks once a position exists, since the first attempt usually lands before the service can size the boost.
  const isBoosting = boostingNetworkIds.includes(networkId);
  const hasPublishedPosition = !!progress[`${networkId}:${accountId}`];
  useEffect(() => {
    if (!isPresent || isBoosting || !hasPublishedPosition) {
      return;
    }
    start();
  }, [isPresent, isBoosting, hasPublishedPosition, start]);
}

export default usePrivacyChainBoost;
