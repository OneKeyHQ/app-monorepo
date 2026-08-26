import { useCallback, useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDeviceStageBurstBeginParams } from '@onekeyhq/kit-bg/src/services/ServiceHardwareUI/DeviceStageBurst';

/**
 * Holds one DeviceStage burst across a whole UI flow (OK-59934).
 *
 * Wrapper-scoped bursts cover a single hardware call tree; flows like
 * onboarding run several of those with network calls and human decisions
 * in between, and the stage must not leave at those seams. The holder
 * opens the burst when the flow commits to a device and closes it when
 * the flow settles; unmount is the safety net, so a flow abandoned by
 * navigation can never strand the stage.
 */
export function useDeviceStageBurst() {
  const tokenRef = useRef<number | undefined>(undefined);

  const endBurst = useCallback(async (params?: { error?: unknown }) => {
    const token = tokenRef.current;
    if (token === undefined) {
      return;
    }
    tokenRef.current = undefined;
    await backgroundApiProxy.serviceHardwareUI.deviceStageEndBurst({
      token,
      error: params?.error,
    });
  }, []);

  const beginBurst = useCallback(
    async (params: IDeviceStageBurstBeginParams = {}) => {
      // One holder at a time: a restarted flow supersedes its own burst
      // rather than stacking a second hold nothing would ever release.
      await endBurst();
      tokenRef.current =
        await backgroundApiProxy.serviceHardwareUI.deviceStageBeginBurst(
          params,
        );
    },
    [endBurst],
  );

  /** Opens a hold only if this holder has none that is still live. The
   * token is presented to the background, which is the authority: a hold
   * the person already dismissed (the stage's own close ends it there)
   * is reopened rather than silently assumed. */
  const ensureBurst = useCallback(
    async (params: IDeviceStageBurstBeginParams = {}) => {
      tokenRef.current =
        await backgroundApiProxy.serviceHardwareUI.deviceStageBeginBurst({
          ...params,
          reuseToken: tokenRef.current,
        });
    },
    [],
  );

  const endBurstRef = useRef(endBurst);
  endBurstRef.current = endBurst;
  useEffect(
    () => () => {
      void endBurstRef.current();
    },
    [],
  );

  return { beginBurst, ensureBurst, endBurst };
}
