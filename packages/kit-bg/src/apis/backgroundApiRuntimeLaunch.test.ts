import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { waitForTravelModeRuntimeLaunchGate } from '@onekeyhq/shared/src/travelMode/runtimeLaunchGate';

import { initializeBackgroundApiAfterRuntimeLaunchGate } from './backgroundApiRuntimeLaunch';

jest.mock('@onekeyhq/shared/src/travelMode/runtimeLaunchGate', () => ({
  waitForTravelModeRuntimeLaunchGate: jest.fn(),
}));

describe('initializeBackgroundApiAfterRuntimeLaunchGate', () => {
  it('does not initialize protected services while acknowledgement is pending', async () => {
    let resolveGate: ((acknowledged: boolean) => void) | undefined;
    jest.mocked(waitForTravelModeRuntimeLaunchGate).mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveGate = resolve;
        }),
    );
    const init = jest.fn(async () => undefined);

    const initialization = initializeBackgroundApiAfterRuntimeLaunchGate(
      () => ({ init }),
    );
    await Promise.resolve();

    expect(init).not.toHaveBeenCalled();
    resolveGate?.(true);
    await initialization;
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('does not initialize protected services when acknowledgement fails', async () => {
    jest
      .mocked(waitForTravelModeRuntimeLaunchGate)
      .mockResolvedValueOnce(false);
    const init = jest.fn(async () => undefined);

    await initializeBackgroundApiAfterRuntimeLaunchGate(() => ({ init }));

    expect(init).not.toHaveBeenCalled();
  });

  it('does not initialize protected services when acknowledgement rejects', async () => {
    jest
      .mocked(waitForTravelModeRuntimeLaunchGate)
      .mockRejectedValueOnce(new OneKeyLocalError('acknowledgement rejected'));
    const init = jest.fn(async () => undefined);

    await expect(
      initializeBackgroundApiAfterRuntimeLaunchGate(() => ({ init })),
    ).rejects.toThrow('acknowledgement rejected');

    expect(init).not.toHaveBeenCalled();
  });
});
