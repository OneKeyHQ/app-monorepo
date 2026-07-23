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
  () => ({
    useUniversalBorrowSetEMode: () => jest.fn(),
  }),
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
});
