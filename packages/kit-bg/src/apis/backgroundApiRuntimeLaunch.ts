import { waitForTravelModeRuntimeLaunchGate } from '@onekeyhq/shared/src/travelMode/runtimeLaunchGate';

export async function initializeBackgroundApiAfterRuntimeLaunchGate(
  getBootstrapService: () => { init(): Promise<void> },
): Promise<void> {
  if (await waitForTravelModeRuntimeLaunchGate()) {
    await getBootstrapService().init();
  }
}
