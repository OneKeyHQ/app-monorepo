/** @jest-environment jsdom */
/* eslint-disable import/first */

import { act, render } from '@testing-library/react';

import type { IDeviceStageState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const mockDeviceStageUserClose = jest
  .fn<Promise<void>, [{ connectId?: string; skipDeviceCancel?: boolean }]>()
  .mockResolvedValue(undefined);
const mockToastError = jest.fn<void, [{ title: string }]>();
let mockStage: IDeviceStageState | undefined;
let mockLoadErrorMessage = 'mock DeviceStage chunk load failure';
let mockLoadAttempts = 0;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    error: (params: { title: string }) => mockToastError(params),
  },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHardwareUI: {
      deviceStageUserClose: (params: {
        connectId?: string;
        skipDeviceCancel?: boolean;
      }) => mockDeviceStageUserClose(params),
    },
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDeviceStageAtom: () => [mockStage],
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    hardware: {
      sdkLog: {
        log: jest.fn(),
      },
    },
  },
}));

jest.mock('./index', () => {
  mockLoadAttempts += 1;
  throw new OneKeyLocalError(mockLoadErrorMessage);
});

import { DeviceStageContainerLazy } from './Lazy';

/** Let the rejected dynamic import settle and the effect re-run on it. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('DeviceStageContainerLazy chunk load fallback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockLoadAttempts = 0;
    mockLoadErrorMessage = 'mock DeviceStage chunk load failure';
    mockStage = undefined;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cancels the stranded burst on a non-retryable failure', async () => {
    mockStage = {
      step: 'processing',
      connectId: 'connect-id-1',
    } as IDeviceStageState;
    render(<DeviceStageContainerLazy />);

    await flush();

    expect(mockLoadAttempts).toBe(1);
    expect(mockDeviceStageUserClose).toHaveBeenCalledTimes(1);
    expect(mockDeviceStageUserClose).toHaveBeenCalledWith({
      connectId: 'connect-id-1',
      skipDeviceCancel: false,
    });
    expect(mockToastError).toHaveBeenCalledTimes(1);
  });

  it('skips the device cancel on an outcome step, as the close button does', async () => {
    mockStage = {
      step: 'error',
      connectId: 'connect-id-2',
    } as IDeviceStageState;
    render(<DeviceStageContainerLazy />);

    await flush();

    expect(mockDeviceStageUserClose).toHaveBeenCalledWith({
      connectId: 'connect-id-2',
      skipDeviceCancel: true,
    });
  });

  it('retries a retryable failure a bounded number of times, then cancels', async () => {
    mockLoadErrorMessage = 'Loading chunk 42 failed.';
    mockStage = {
      step: 'processing',
      connectId: 'connect-id-3',
    } as IDeviceStageState;
    render(<DeviceStageContainerLazy />);

    await flush();
    expect(mockDeviceStageUserClose).not.toHaveBeenCalled();

    for (const backoff of [300, 1200]) {
      act(() => {
        jest.advanceTimersByTime(backoff);
      });
      // eslint-disable-next-line no-await-in-loop
      await flush();
    }

    expect(mockLoadAttempts).toBe(3);
    expect(mockDeviceStageUserClose).toHaveBeenCalledTimes(1);
    expect(mockDeviceStageUserClose).toHaveBeenCalledWith({
      connectId: 'connect-id-3',
      skipDeviceCancel: false,
    });
  });

  it('stays silent when the warm-up load fails with no burst waiting', async () => {
    mockStage = { step: 'off' } as IDeviceStageState;
    render(<DeviceStageContainerLazy />);

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    await flush();

    expect(mockLoadAttempts).toBe(1);
    // A connectId-less close would resolve to a GLOBAL sdk.cancel.
    expect(mockDeviceStageUserClose).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });
});
