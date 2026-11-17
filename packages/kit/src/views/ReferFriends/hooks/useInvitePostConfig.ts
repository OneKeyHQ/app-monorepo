import { useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IInvitePostConfig } from '@onekeyhq/shared/src/referralCode/type';

const DISABLED_STATE: {
  postConfig: IInvitePostConfig | undefined;
  isSettled: boolean;
} = { postConfig: undefined, isSettled: false };

/**
 * The invite post-config: rebate rates and localized campaign copy.
 *
 * A thin read of `serviceReferralCode.getPostConfig()`, which is already
 * stale-while-revalidate — it returns the cached config immediately and
 * refreshes it in the background, or fetches when nothing is cached. Don't
 * layer a "cached, then `fetchPostConfig()`" pass on top: `getPostConfig()`
 * has already started that request, so it would go out twice. The refreshed
 * config reaches this hook through `ReferralPostConfigUpdated`, so a mounted
 * screen moves off the stale copy without issuing a request of its own.
 *
 * `postConfig` is `undefined` while loading, whenever `enabled` is false (also
 * after it was true), and if the request fails. `isSettled` turns true once the read has finished either
 * way, so a caller can tell "not answered yet" from "answered with nothing".
 *
 * Built on a plain effect rather than `usePromiseResult`, which reads route
 * focus unconditionally and so cannot run outside a navigator — the web
 * referral landing page is one such caller.
 */
export function useInvitePostConfig({
  enabled = true,
}: { enabled?: boolean } = {}): {
  postConfig: IInvitePostConfig | undefined;
  isSettled: boolean;
} {
  const [state, setState] = useState<{
    postConfig: IInvitePostConfig | undefined;
    isSettled: boolean;
  }>({ postConfig: undefined, isSettled: false });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let isActive = true;
    let hasRevalidatedConfig = false;
    const onRevalidated = (config: IInvitePostConfig) => {
      hasRevalidatedConfig = true;
      if (isActive) {
        setState({ postConfig: config, isSettled: true });
      }
    };
    // Subscribe before reading: the read itself starts the refresh whose
    // result arrives as this event.
    appEventBus.on(EAppEventBusNames.ReferralPostConfigUpdated, onRevalidated);
    void (async () => {
      let config: IInvitePostConfig | undefined;
      // `await` inside the `try` rather than chaining `.then`: a failure that
      // is thrown synchronously is caught the same as a rejection, so a
      // broken read can only ever degrade to `undefined`, never break render.
      try {
        config = await backgroundApiProxy.serviceReferralCode.getPostConfig();
      } catch {
        // Degrade to `undefined`; callers fall back to their defaults.
      }
      // Never let the initial (possibly stale) read overwrite a fresher
      // config that already arrived through the event.
      if (isActive && !hasRevalidatedConfig) {
        setState({ postConfig: config, isSettled: true });
      }
    })();
    return () => {
      isActive = false;
      appEventBus.off(
        EAppEventBusNames.ReferralPostConfigUpdated,
        onRevalidated,
      );
    };
  }, [enabled]);

  // A disabled caller must not keep showing a rebate read while it was
  // enabled.
  return enabled ? state : DISABLED_STATE;
}
