import type { IDetectActiveAccountFirmwareUpdatesResult } from '@onekeyhq/kit-bg/src/services/ServiceFirmwareUpdate/ServiceFirmwareUpdate';

const FIRMWARE_UPDATE_DETECT_FAILED_RETRY_DELAY = 5000;

export function createActiveAccountFirmwareUpdateDetector({
  detect,
}: {
  detect: () => Promise<IDetectActiveAccountFirmwareUpdatesResult>;
}) {
  let active = true;
  let started = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const runDetection = async ({
    hasScheduledFailure,
    hasScheduledThrottle,
  }: {
    hasScheduledFailure: boolean;
    hasScheduledThrottle: boolean;
  }) => {
    let result: IDetectActiveAccountFirmwareUpdatesResult;
    try {
      result = await detect();
    } catch {
      if (active && !hasScheduledFailure) {
        retryTimer = setTimeout(() => {
          retryTimer = undefined;
          void runDetection({
            hasScheduledFailure: true,
            hasScheduledThrottle,
          });
        }, FIRMWARE_UPDATE_DETECT_FAILED_RETRY_DELAY);
      }
      return;
    }

    if (!active) {
      return;
    }

    if (!('retryAfterMs' in result)) {
      return;
    }

    const shouldRetry =
      result.status === 'busy' ||
      (result.status === 'failed' && !hasScheduledFailure) ||
      (result.status === 'throttled' && !hasScheduledThrottle);
    if (!shouldRetry) {
      return;
    }

    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void runDetection({
        hasScheduledFailure: hasScheduledFailure || result.status === 'failed',
        hasScheduledThrottle:
          hasScheduledThrottle || result.status === 'throttled',
      });
    }, result.retryAfterMs);
  };

  return {
    start: () => {
      if (!active || started) {
        return;
      }
      started = true;
      void runDetection({
        hasScheduledFailure: false,
        hasScheduledThrottle: false,
      });
    },
    cancel: () => {
      active = false;
      if (retryTimer !== undefined) {
        clearTimeout(retryTimer);
        retryTimer = undefined;
      }
    },
  };
}
