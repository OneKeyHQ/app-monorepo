/** @jest-environment jsdom */
import { act, render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { CloudSyncReconciliationEffect } from './CloudSyncReconciliationEffect';

let mockLocked = true;
let mockReachable: boolean | null = null;
let mockForeground: (() => void) | undefined;
const mockNetwork = jest.fn(async (_reachable: boolean | null) => undefined);
const mockResume = jest.fn<Promise<void>, [unknown]>(async () => undefined);

jest.mock('@onekeyhq/components', () => ({
  useNetInfo: () => ({ isInternetReachable: mockReachable }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useAppIsLockedAtom: () => [mockLocked],
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrimeCloudSync: {
      resumeCloudSyncReconciliation: (params: unknown) => mockResume(params),
      setCloudSyncNetworkReachable: (reachable: boolean | null) =>
        mockNetwork(reachable),
    },
  },
}));
jest.mock('../../../hooks/useHandleAppStateActive', () => ({
  useHandleAppStateActive: (callback: () => void) => {
    mockForeground = callback;
  },
}));

afterEach(() => {
  mockLocked = true;
  mockReachable = null;
  mockForeground = undefined;
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

test('startup, unlock, network recovery and foreground only wake an unlocked online background', async () => {
  const { rerender } = render(<CloudSyncReconciliationEffect />);
  expect(mockResume).not.toHaveBeenCalled();
  expect(mockNetwork).toHaveBeenLastCalledWith(null);
  mockLocked = false;
  mockReachable = true;
  await act(async () => rerender(<CloudSyncReconciliationEffect />));
  expect(mockResume).toHaveBeenLastCalledWith({ reason: 'startup' });
  await act(async () => rerender(<CloudSyncReconciliationEffect />));
  expect(mockResume).toHaveBeenCalledTimes(1);
  mockLocked = true;
  await act(async () => rerender(<CloudSyncReconciliationEffect />));
  await act(async () => mockForeground?.());
  expect(mockResume).toHaveBeenCalledTimes(1);
  mockLocked = false;
  await act(async () => rerender(<CloudSyncReconciliationEffect />));
  expect(mockResume).toHaveBeenLastCalledWith({ reason: 'unlock' });
  mockReachable = false;
  await act(async () => rerender(<CloudSyncReconciliationEffect />));
  expect(mockNetwork).toHaveBeenLastCalledWith(false);
  await act(async () => mockForeground?.());
  expect(mockResume).toHaveBeenCalledTimes(2);
  mockReachable = true;
  await act(async () => rerender(<CloudSyncReconciliationEffect />));
  expect(mockResume).toHaveBeenLastCalledWith({ reason: 'network' });
  await act(async () => mockForeground?.());
  expect(mockResume).toHaveBeenLastCalledWith({ reason: 'foreground' });
});

test('offline Desktop never issues an archive wake on the shared schema', () => {
  jest.replaceProperty(platformEnv, 'isDesktop', true);
  jest.replaceProperty(platformEnv, 'isMas', false);
  jest.replaceProperty(platformEnv, 'isDev', false);
  mockReachable = false;
  mockLocked = false;
  render(<CloudSyncReconciliationEffect />);
  expect(mockResume).not.toHaveBeenCalled();
});
