/** @jest-environment jsdom */
import { act, render } from '@testing-library/react';

import { CloudSyncReconciliationEffect } from './CloudSyncReconciliationEffect';

let mockLocked = true;
let mockReachable: boolean | null = null;
let mockForeground: (() => void) | undefined;
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
    },
  },
}));
jest.mock('../../../hooks/useHandleAppStateActive', () => ({
  useHandleAppStateActive: (callback: () => void) => {
    mockForeground = callback;
  },
}));

test('startup, unlock, network recovery and foreground only wake an unlocked online background', async () => {
  const { rerender } = render(<CloudSyncReconciliationEffect />);
  expect(mockResume).not.toHaveBeenCalled();
  mockLocked = false;
  mockReachable = true;
  rerender(<CloudSyncReconciliationEffect />);
  expect(mockResume).toHaveBeenLastCalledWith({ reason: 'startup' });
  rerender(<CloudSyncReconciliationEffect />);
  expect(mockResume).toHaveBeenCalledTimes(1);
  mockLocked = true;
  rerender(<CloudSyncReconciliationEffect />);
  await act(async () => mockForeground?.());
  expect(mockResume).toHaveBeenCalledTimes(1);
  mockLocked = false;
  rerender(<CloudSyncReconciliationEffect />);
  expect(mockResume).toHaveBeenLastCalledWith({ reason: 'unlock' });
  mockReachable = false;
  rerender(<CloudSyncReconciliationEffect />);
  await act(async () => mockForeground?.());
  expect(mockResume).toHaveBeenCalledTimes(2);
  mockReachable = true;
  rerender(<CloudSyncReconciliationEffect />);
  expect(mockResume).toHaveBeenLastCalledWith({ reason: 'network' });
  await act(async () => mockForeground?.());
  expect(mockResume).toHaveBeenLastCalledWith({ reason: 'foreground' });
});
