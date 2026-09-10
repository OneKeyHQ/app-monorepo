import { useCallback, useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrivacyChainAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IPrivacyChainBoostTrigger } from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';

import { useRouteIsFocused } from './useRouteIsFocused';

// Asks for the foreground pace EARLY on behalf of one surface.
//
// The pace itself is owned by the scheduler, which turns it on whenever the
// wallet has real history left to rebuild and off when it does not. All this
// hook buys is latency: a user who opens the chain's own page gets the fast
// pace now instead of after the next background pass.
//
// It therefore never stops anything. Ending the pace belongs to the always-on
// light (pause) and to the scheduler (backfill finished) -- a page that could
// stop it would be able to leave the app in a state its own UI has left.
export function usePrivacyChainBoost({
  networkId,
  accountId,
  trigger,
  enabled,
}: {
  networkId: string;
  accountId: string;
  trigger: IPrivacyChainBoostTrigger;
  // "The user is on this surface." NOT "the arrears are big enough" -- that
  // is the service's call, and the service refuses the ones it should.
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

  // Starts a boost sooner than the next scan pass would have. Deliberately
  // registers NO cleanup: the pace belongs to how far behind the wallet is,
  // not to this page. Stopping on route blur is what used to make the pace
  // page-bound -- and it silently contradicted the always-on light, whose
  // entire reason to exist is being the control for a pace that outlives the
  // page that started it.
  //
  // The pace still ends on its own: the scheduler drops it when the backfill
  // finishes, and the light's pause button ends it on demand.
  useEffect(() => {
    if (!isPresent) {
      return;
    }
    start();
  }, [isPresent, start]);

  // The first attempt above usually lands before any scan pass has published
  // a position, and the service refuses an automatic boost whose size it
  // cannot see. So ask again on each publish until one is running.
  //
  // Deliberately registers no cleanup: this effect re-runs on every pass, and
  // a cleanup here would stop and restart the very session it is watching.
  const isBoosting = boostingNetworkIds.includes(networkId);
  const publishedPosition = progress[`${networkId}:${accountId}`];
  useEffect(() => {
    if (!isPresent || isBoosting) {
      return;
    }
    start();
  }, [isPresent, isBoosting, publishedPosition, start]);
}

export default usePrivacyChainBoost;
