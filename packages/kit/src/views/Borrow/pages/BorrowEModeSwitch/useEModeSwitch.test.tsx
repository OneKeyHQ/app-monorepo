/* eslint-disable import/first */

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock(
  '@onekeyhq/kit/src/views/Borrow/hooks/useUniversalBorrowHooks',
  () => {
    const setEMode = jest.fn();
    (
      globalThis as unknown as {
        __eModeSwitchSetEModeMock: jest.Mock;
      }
    ).__eModeSwitchSetEModeMock = setEMode;
    return {
      useUniversalBorrowSetEMode: () => setEMode,
    };
  },
);

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const borrowSwitchCheckEMode = jest.fn();
  (
    globalThis as unknown as {
      __eModeSwitchBackgroundMock: {
        borrowSwitchCheckEMode: jest.Mock;
      };
    }
  ).__eModeSwitchBackgroundMock = { borrowSwitchCheckEMode };
  return {
    __esModule: true,
    default: {
      serviceStaking: { borrowSwitchCheckEMode },
    },
  };
});

import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { IBorrowEModeSwitchCheck } from '@onekeyhq/shared/types/staking';

import { useEModeSwitch } from './useEModeSwitch';

const backgroundMock = (
  globalThis as unknown as {
    __eModeSwitchBackgroundMock: {
      borrowSwitchCheckEMode: jest.Mock;
    };
  }
).__eModeSwitchBackgroundMock;
const setEModeMock = (
  globalThis as unknown as {
    __eModeSwitchSetEModeMock: jest.Mock;
  }
).__eModeSwitchSetEModeMock;

function createCheck(reason: string): IBorrowEModeSwitchCheck {
  return {
    canSwitch: false,
    reasons: [reason],
    disableCollateralAssets: [],
    repayAssets: [],
    additionalRepayAssets: [],
    collateral: {},
    debt: {},
    maxLtv: {},
    healthFactor: {},
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function renderUseEModeSwitch() {
  return renderHook(() =>
    useEModeSwitch({
      networkId: 'evm--1',
      accountId: 'account-id',
      provider: 'aave',
      marketAddress: '0xMarket',
      onSwitched: jest.fn(),
    }),
  );
}

describe('useEModeSwitch runCheck result', () => {
  beforeEach(() => {
    backgroundMock.borrowSwitchCheckEMode.mockReset();
    setEModeMock.mockReset();
  });

  it('returns the same authoritative check that it commits', async () => {
    const check = createCheck('latest');
    backgroundMock.borrowSwitchCheckEMode.mockResolvedValue({
      code: 0,
      data: check,
    });
    const { result } = renderUseEModeSwitch();

    let returned: IBorrowEModeSwitchCheck | null = null;
    await act(async () => {
      returned = await result.current.runCheck(2);
    });

    expect(returned).toBe(check);
    expect(result.current.check).toBe(check);
  });

  it('returns null for a superseded response instead of exposing stale data', async () => {
    const first = createDeferred<{
      code: number;
      data: IBorrowEModeSwitchCheck;
    }>();
    const second = createDeferred<{
      code: number;
      data: IBorrowEModeSwitchCheck;
    }>();
    backgroundMock.borrowSwitchCheckEMode
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderUseEModeSwitch();

    let firstResultPromise!: Promise<IBorrowEModeSwitchCheck | null>;
    act(() => {
      firstResultPromise = result.current.runCheck(1);
    });
    await waitFor(() => {
      expect(backgroundMock.borrowSwitchCheckEMode).toHaveBeenCalledTimes(1);
    });

    let secondResultPromise!: Promise<IBorrowEModeSwitchCheck | null>;
    act(() => {
      secondResultPromise = result.current.runCheck(2);
    });
    const latestCheck = createCheck('latest');
    let secondResult: IBorrowEModeSwitchCheck | null = null;
    await act(async () => {
      second.resolve({ code: 0, data: latestCheck });
      secondResult = await secondResultPromise;
    });

    const staleCheck = createCheck('stale');
    let firstResult: IBorrowEModeSwitchCheck | null = staleCheck;
    await act(async () => {
      first.resolve({ code: 0, data: staleCheck });
      firstResult = await firstResultPromise;
    });

    expect(secondResult).toBe(latestCheck);
    expect(firstResult).toBeNull();
    expect(result.current.check).toBe(latestCheck);
  });

  it('replaces an allowed preview with blockers returned by the final guard', async () => {
    const allowedCheck = {
      ...createCheck(''),
      canSwitch: true,
      reasons: [],
    };
    const latestBlockedCheck = createCheck('new blocker');
    backgroundMock.borrowSwitchCheckEMode.mockResolvedValue({
      code: 0,
      data: allowedCheck,
    });
    setEModeMock.mockResolvedValue(latestBlockedCheck);
    const { result } = renderUseEModeSwitch();

    await act(async () => {
      await result.current.runCheck(2);
    });
    await act(async () => {
      await result.current.confirmSwitch();
    });

    expect(setEModeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'aave',
        marketAddress: '0xMarket',
        eModeId: 2,
      }),
    );
    expect(result.current.check).toBe(latestBlockedCheck);
    expect(backgroundMock.borrowSwitchCheckEMode).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite a newer same-target check with blocked guard results', async () => {
    const allowedPreview = {
      ...createCheck(''),
      canSwitch: true,
      reasons: [],
    };
    const staleBlockedGuard = createCheck('stale final blocker');
    const newerBlockedCheck = createCheck('newer blocker');
    const guardDeferred = createDeferred<IBorrowEModeSwitchCheck>();
    backgroundMock.borrowSwitchCheckEMode
      .mockResolvedValueOnce({
        code: 0,
        data: allowedPreview,
      })
      .mockResolvedValueOnce({
        code: 0,
        data: newerBlockedCheck,
      });
    setEModeMock.mockReturnValueOnce(guardDeferred.promise);
    const { result } = renderUseEModeSwitch();

    await act(async () => {
      await result.current.runCheck(2);
    });

    let confirmPromise!: Promise<void>;
    act(() => {
      confirmPromise = result.current.confirmSwitch();
    });
    await waitFor(() => {
      expect(setEModeMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.runCheck(2);
    });
    expect(result.current.check).toBe(newerBlockedCheck);

    await act(async () => {
      guardDeferred.resolve(staleBlockedGuard);
      await confirmPromise;
    });

    expect(result.current.check).toBe(newerBlockedCheck);
  });
});
