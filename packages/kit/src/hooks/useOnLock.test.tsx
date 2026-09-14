/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useOnLock } from './useOnLock';

let mockTravelMode = false;
let mockIsPasswordSet = true;
const mockLockApp = jest.fn<Promise<void>, [options?: { manual: boolean }]>(
  async () => undefined,
);
const mockPromptPasswordVerify = jest.fn(async () => undefined);
const mockLockNow = jest.fn<void, []>();

jest.mock('../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePassword: {
      lockApp: (...args: [options?: { manual: boolean }]) =>
        mockLockApp(...args),
      promptPasswordVerify: () => mockPromptPasswordVerify(),
    },
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({
  usePasswordPersistAtom: () => [{ isPasswordSet: mockIsPasswordSet }],
}));

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({
      profile: { kind: mockTravelMode ? 'travel-mode' : 'standard' },
    }),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { setting: { page: { lockNow: () => mockLockNow() } } },
}));

describe('useOnLock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTravelMode = false;
    mockIsPasswordSet = true;
  });

  it.each([true, false])(
    'ignores manual locking in Travel Mode with isPasswordSet=%s',
    async (isPasswordSet) => {
      mockTravelMode = true;
      mockIsPasswordSet = isPasswordSet;
      const { result } = renderHook(() => useOnLock());

      await act(async () => result.current());

      expect(mockLockApp).not.toHaveBeenCalled();
      expect(mockPromptPasswordVerify).not.toHaveBeenCalled();
      expect(mockLockNow).not.toHaveBeenCalled();
    },
  );

  it('preserves manual locking in the standard runtime', async () => {
    const { result } = renderHook(() => useOnLock());

    await act(async () => result.current());

    expect(mockLockApp).toHaveBeenCalledWith({ manual: true });
    expect(mockPromptPasswordVerify).not.toHaveBeenCalled();
    expect(mockLockNow).toHaveBeenCalledTimes(1);
  });

  it('preserves password setup before locking in the standard runtime', async () => {
    mockIsPasswordSet = false;
    const { result } = renderHook(() => useOnLock());

    await act(async () => result.current());

    expect(mockPromptPasswordVerify).toHaveBeenCalledTimes(1);
    expect(mockLockApp).toHaveBeenCalledWith();
    expect(mockLockNow).toHaveBeenCalledTimes(1);
  });
});
