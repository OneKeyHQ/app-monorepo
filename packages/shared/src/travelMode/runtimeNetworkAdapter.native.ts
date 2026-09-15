import { isTravelModeNetworkRequestAllowed } from './runtimeNetworkAllowlist';
import { runRuntimeWalletEffect } from './runtimeWalletEffect';

import type { IApiAvailabilityTiming } from '../request/availabilityMetrics';
import type { AxiosAdapter } from 'axios';

// Travel mode is not an availability dimension. A request the travel-mode
// gate rejects (or that is aborted during the gate delay) never reached the
// transport, so its timing is closed here and can never become an API outcome.
function excludeFromApiAvailability(
  timing: IApiAvailabilityTiming | undefined,
) {
  if (timing) {
    timing.reported = true;
  }
}

export function createRuntimeNetworkAdapter(
  adapter: AxiosAdapter,
): AxiosAdapter {
  return (config) => {
    let operationStarted = false;
    const excludeIfBlocked = () => {
      if (!operationStarted) {
        excludeFromApiAvailability(config.$oneKeyAvailabilityTiming);
      }
    };
    const operation = () => {
      operationStarted = true;
      return Promise.resolve().then(() => adapter(config));
    };
    let result: ReturnType<AxiosAdapter>;
    try {
      const allowInTravelMode = isTravelModeNetworkRequestAllowed(config);
      result = runRuntimeWalletEffect(
        operation,
        allowInTravelMode ? { allowInTravelMode: true } : undefined,
      );
    } catch (error) {
      excludeIfBlocked();
      throw error;
    }
    // Observe the rejection without re-wrapping: the caller keeps the same
    // promise (same error, same settle tick), and this handler is registered
    // before axios attaches its own, so it runs first.
    void result.catch(excludeIfBlocked);
    return result;
  };
}
