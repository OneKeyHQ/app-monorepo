import { useCallback, useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDeviceStageBurstBeginParams } from '@onekeyhq/kit-bg/src/services/ServiceHardwareUI/DeviceStageBurst';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';

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
  const isMountedRef = useRef(true);
  // Every begin and end claims a new request id. The token only exists once
  // the background answers, so a request that lost the race — the holder
  // unmounted, or a newer begin/end superseded it — must close its own token
  // instead of parking it in a ref nothing will ever read again, which would
  // strand an explicit hold in the background for good.
  const requestSeqRef = useRef(0);

  const endBurst = useCallback(async (params?: { error?: unknown }) => {
    requestSeqRef.current += 1;
    const token = tokenRef.current;
    if (token === undefined) {
      return;
    }
    tokenRef.current = undefined;
    await backgroundApiProxy.serviceHardwareUI.deviceStageEndBurst({
      token,
      error: params?.error ? toPlainErrorObject(params.error) : undefined,
    });
  }, []);

  const beginBurst = useCallback(
    async (params: IDeviceStageBurstBeginParams = {}) => {
      // One holder at a time: a restarted flow supersedes its own burst
      // rather than stacking a second hold nothing would ever release.
      await endBurst();
      requestSeqRef.current += 1;
      const seq = requestSeqRef.current;
      const token =
        await backgroundApiProxy.serviceHardwareUI.deviceStageBeginBurst(
          params,
        );
      if (!isMountedRef.current || seq !== requestSeqRef.current) {
        await backgroundApiProxy.serviceHardwareUI.deviceStageEndBurst({
          token,
        });
        return;
      }
      tokenRef.current = token;
    },
    [endBurst],
  );

  /** Opens a hold only if this holder has none that is still live. The
   * token is presented to the background, which is the authority: a hold
   * the person already dismissed (the stage's own close ends it there)
   * is reopened rather than silently assumed. */
  const ensureBurst = useCallback(
    async (params: IDeviceStageBurstBeginParams = {}) => {
      requestSeqRef.current += 1;
      const seq = requestSeqRef.current;
      const reuseToken = tokenRef.current;
      const token =
        await backgroundApiProxy.serviceHardwareUI.deviceStageBeginBurst({
          ...params,
          reuseToken,
        });
      if (!isMountedRef.current || seq !== requestSeqRef.current) {
        // Getting the presented token back means the background kept the
        // live hold rather than opening a second one: it belongs to whoever
        // superseded this request, so there is nothing here to close.
        if (token !== reuseToken) {
          await backgroundApiProxy.serviceHardwareUI.deviceStageEndBurst({
            token,
          });
        }
        return;
      }
      tokenRef.current = token;
    },
    [],
  );

  const endBurstRef = useRef(endBurst);
  endBurstRef.current = endBurst;
  useEffect(() => {
    // Raise the flag on every (re)mount, not only lower it on cleanup:
    // StrictMode's dev double-invoke runs mount -> cleanup -> mount, and a
    // flag that is only ever cleared would make every later burst in
    // development release itself the moment it opens.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      void endBurstRef.current();
    };
  }, []);

  return { beginBurst, ensureBurst, endBurst };
}
