import { memo, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDeviceStageAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { isRetryableLazyError } from '@onekeyhq/shared/src/lazyLoad';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type IDeviceStageContainerComponent = ComponentType;

/**
 * How long after mount the stage implementation is warmed up when no burst
 * has asked for it yet. Long enough to stay clear of the cold-start window
 * the web perf gate measures (business-ready timeout 30s + 5s settle),
 * short enough that the chunk is almost always resident before the first
 * hardware call of a session; a call that comes sooner loads on demand.
 */
const WARM_UP_DELAY_MS = 60_000;

/**
 * A load that fails while a burst is waiting strands the interaction: the
 * stage is on, the legacy surfaces no longer own these actions, and every
 * forced exit (the close button, the error notice's timed close) lives in
 * the chunk that did not arrive. So a waiting burst gets a couple more
 * attempts before the shell cancels on its behalf.
 *
 * The realistic trigger is web / extension — a stale tab, or an extension
 * update racing a redeploy — where the fetch is genuinely worth repeating.
 * A failure that is not a transient fetch (an eval error, or a segment the
 * loader has already given up on) fails `isRetryableLazyError` and cancels
 * on the first try.
 *
 * Native keeps one attempt in reserve. This container is the sole async
 * root of its own split segment, and installProdBundleLoader grants a
 * segment only 3 retryable attempts PER PROCESS before it caches the
 * failure permanently — spending all three here would kill the stage for
 * the rest of the session over a NO_RUNTIME / TIMEOUT the loader exists to
 * ride out. Same budget, and the same reason, as MAX_LAZY_RETRIES in the
 * shared LazyLoad boundary.
 */
const MAX_LOAD_ATTEMPTS = platformEnv.isNative ? 2 : 3;
const LOAD_RETRY_BACKOFF_MS = [300, 1200];

/**
 * Lazy shell for the DeviceStage driver (OK-59934).
 *
 * The stage component tree — the replicas with their baked shells, the
 * card panels, MorphOverlay, the in-card QR scanner — is a few hundred KiB
 * that no cold start needs. This shell is what stays on the startup graph:
 * it only watches `deviceStageAtom` and pulls the real container in the
 * moment a burst puts the stage on (or after a warm-up delay). Once loaded
 * the container stays mounted for the life of the app, exactly as before.
 */
function DeviceStageContainerLazyCmp() {
  const [stage] = useDeviceStageAtom();
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const intl = useIntl();
  // Through a ref so a locale switch cannot restart an in-flight chunk load.
  const intlRef = useRef(intl);
  intlRef.current = intl;
  const [Impl, setImpl] = useState<IDeviceStageContainerComponent | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const stageIsOn = Boolean(stage && stage.step !== 'off');

  useEffect(() => {
    if (!stageIsOn) {
      setLoadAttempt(0);
    }
  }, [stageIsOn]);

  useEffect(() => {
    if (Impl) {
      return undefined;
    }
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    /**
     * Read the stage live, not from the render this effect closed over: the
     * burst may have walked on during the backoff, and the cancel has to
     * speak for the step that is actually up. Same decision the container's
     * close button makes — and it must carry a connectId, because a
     * connectId-less close resolves to a GLOBAL sdk.cancel that cold-boots
     * the SDK and interrupts every queued call on every connected device.
     */
    const cancelStrandedBurst = () => {
      const current = stageRef.current;
      if (!current || current.step === 'off') {
        return;
      }
      void backgroundApiProxy.serviceHardwareUI.deviceStageUserClose({
        connectId: current.connectId,
        skipDeviceCancel:
          Boolean(current.vendor) ||
          current.step === 'error' ||
          current.step === 'passphraseIntro' ||
          current.step === 'deviceNotFound',
      });
      Toast.error({
        title: intlRef.current.formatMessage({
          id: ETranslations.global_an_error_occurred,
        }),
      });
    };
    const load = () => {
      void import('./index')
        .then((module) => {
          if (!cancelled) {
            setImpl(() => module.DeviceStageContainer);
          }
        })
        .catch((error: Error) => {
          if (cancelled) {
            return;
          }
          defaultLogger.hardware.sdkLog.log(
            'DeviceStage container chunk load failed',
            `attempt ${loadAttempt + 1}/${MAX_LOAD_ATTEMPTS}: ${
              error?.message ?? ''
            }`,
          );
          // A warm-up failure costs nothing: nothing is waiting on it and the
          // next burst loads on demand.
          if (!stageIsOn) {
            return;
          }
          if (
            isRetryableLazyError(error) &&
            loadAttempt < MAX_LOAD_ATTEMPTS - 1
          ) {
            retryTimer = setTimeout(
              () => {
                if (!cancelled) {
                  setLoadAttempt((attempt) => attempt + 1);
                }
              },
              LOAD_RETRY_BACKOFF_MS[
                Math.min(loadAttempt, LOAD_RETRY_BACKOFF_MS.length - 1)
              ],
            );
            return;
          }
          cancelStrandedBurst();
        });
    };
    if (stageIsOn) {
      load();
      return () => {
        cancelled = true;
        clearTimeout(retryTimer);
      };
    }
    const timer = setTimeout(load, WARM_UP_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(retryTimer);
    };
  }, [Impl, loadAttempt, stageIsOn]);

  return Impl ? <Impl /> : null;
}

export const DeviceStageContainerLazy = memo(DeviceStageContainerLazyCmp);
