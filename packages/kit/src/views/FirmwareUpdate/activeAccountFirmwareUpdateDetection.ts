import type { IDetectActiveAccountFirmwareUpdatesResult } from '@onekeyhq/kit-bg/src/services/ServiceFirmwareUpdate/ServiceFirmwareUpdate';

export function createActiveAccountFirmwareUpdateDetector({
  detect,
}: {
  detect: () => Promise<IDetectActiveAccountFirmwareUpdatesResult>;
}) {
  let active = true;
  let started = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const runDetection = async (hasScheduledThrottle: boolean) => {
    let result: IDetectActiveAccountFirmwareUpdatesResult;
    try {
      result = await detect();
    } catch {
      return;
    }

    if (!active) {
      return;
    }

    if (
      result.status !== 'busy' &&
      (result.status !== 'throttled' || hasScheduledThrottle)
    ) {
      return;
    }

    const nextHasScheduledThrottle =
      hasScheduledThrottle || result.status === 'throttled';

    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void runDetection(nextHasScheduledThrottle);
    }, result.retryAfterMs);
  };

  return {
    start: () => {
      if (!active || started) {
        return;
      }
      started = true;
      void runDetection(false);
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
