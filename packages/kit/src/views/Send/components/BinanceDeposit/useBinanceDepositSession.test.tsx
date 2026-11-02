/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { AppState } from 'react-native';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EBinanceDepositErrorCode,
  EBinanceDepositSessionStatus,
} from '@onekeyhq/shared/types/binanceDeposit';
import type {
  IBinanceDepositAsset,
  IBinanceDepositSnapshot,
} from '@onekeyhq/shared/types/binanceDeposit';

import { useBinanceDepositSession } from './useBinanceDepositSession';

const mockService = {
  hasResumableAddress: jest.fn<Promise<boolean>, unknown[]>(),
  startSession: jest.fn<Promise<IBinanceDepositSnapshot>, unknown[]>(),
  prepareOpenLink: jest.fn<Promise<{ link: string }>, unknown[]>(),
  getSnapshot: jest.fn<
    Promise<IBinanceDepositSnapshot | undefined>,
    unknown[]
  >(),
  discardSession: jest.fn<Promise<void>, unknown[]>(),
};
const mockOpenURL = jest.fn<Promise<void>, unknown[]>();
const mockToastError = jest.fn<void, unknown[]>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceBinanceDeposit: {
      hasResumableAddress: (...args: unknown[]) =>
        mockService.hasResumableAddress(...args),
      startSession: (...args: unknown[]) => mockService.startSession(...args),
      prepareOpenLink: (...args: unknown[]) =>
        mockService.prepareOpenLink(...args),
      getSnapshot: (...args: unknown[]) => mockService.getSnapshot(...args),
      discardSession: (...args: unknown[]) =>
        mockService.discardSession(...args),
    },
  },
}));

jest.mock('@onekeyhq/components', () => ({
  Toast: { error: (...args: unknown[]) => mockToastError(...args) },
}));

jest.mock('@onekeyhq/kit/src/hooks/useHandleAppStateActive', () => ({
  useHandleAppStateActive: () => undefined,
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  __esModule: true,
  default: {
    linkingOpenURL: (...args: unknown[]) => mockOpenURL(...args),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    transaction: {
      send: {
        binanceDepositStart: jest.fn(),
        binanceDepositOpen: jest.fn(),
        binanceDepositFail: jest.fn(),
        binanceDepositReturn: jest.fn(),
      },
    },
  },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const LINK = 'https://app.binance.com/deposit?x=1';
const ASSET: IBinanceDepositAsset = {
  networkId: 'evm--56',
  cryptoCurrency: 'USDT',
  requiresAddressTag: false,
};

function buildSnapshot(
  patch: Partial<IBinanceDepositSnapshot> = {},
): IBinanceDepositSnapshot {
  return {
    localId: 'local-1',
    phase: 'awaiting',
    status: EBinanceDepositSessionStatus.INIT,
    networkId: ASSET.networkId,
    cryptoCurrency: ASSET.cryptoCurrency,
    ...patch,
  };
}

function mountSession() {
  const onAssetStale = jest.fn();
  const onAssetDisabled = jest.fn();
  const hook = renderHook(() =>
    useBinanceDepositSession({ asset: ASSET, onAssetStale, onAssetDisabled }),
  );
  return { ...hook, onAssetStale, onAssetDisabled };
}

beforeEach(() => {
  Object.values(mockService).forEach((mock) => mock.mockReset());
  mockService.hasResumableAddress.mockResolvedValue(false);
  mockService.prepareOpenLink.mockResolvedValue({ link: LINK });
  mockService.discardSession.mockResolvedValue(undefined);
  // The card's polling has nothing to add in these tests.
  mockService.getSnapshot.mockReturnValue(new Promise(() => undefined));
  mockOpenURL.mockReset();
  mockOpenURL.mockResolvedValue(undefined);
  mockToastError.mockReset();
  // The system has already switched to Binance, so opening does not wait
  // for the switch.
  jest.replaceProperty(AppState, 'currentState', 'background');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useBinanceDepositSession', () => {
  it('opens Binance for a session waiting on the authorization', async () => {
    mockService.startSession.mockResolvedValue(buildSnapshot());
    const { result } = mountSession();

    await act(async () => {
      await result.current.start('entry');
    });

    expect(mockService.startSession).toHaveBeenCalledWith(ASSET);
    expect(mockOpenURL).toHaveBeenCalledWith(LINK);
    expect(result.current.snapshot).toEqual(buildSnapshot());
  });

  it('picks up a released address without opening Binance', async () => {
    mockService.hasResumableAddress.mockResolvedValue(true);
    mockService.startSession.mockResolvedValue(
      buildSnapshot({
        phase: 'authorized',
        status: EBinanceDepositSessionStatus.AUTHORIZED,
      }),
    );
    const { result } = mountSession();

    await act(async () => {
      await result.current.start('entry');
    });

    expect(result.current.isResuming).toBe(true);
    expect(result.current.snapshot?.phase).toBe('authorized');
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  it('shows the card before the server answers and lets go of it on exit', async () => {
    let answer: (snapshot: IBinanceDepositSnapshot) => void = () => undefined;
    mockService.startSession.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const { result } = mountSession();

    let started: Promise<void> = Promise.resolve();
    act(() => {
      started = result.current.start('entry');
    });
    await waitFor(() => expect(result.current.snapshot).toBeNull());

    await act(async () => {
      await result.current.exit();
    });
    await act(async () => {
      answer(buildSnapshot());
      await started;
    });

    expect(result.current.snapshot).toBeUndefined();
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  it('refreshes the asset when the list behind the entry was stale', async () => {
    mockService.startSession.mockRejectedValue({
      code: EBinanceDepositErrorCode.CapabilityStale,
    });
    const { result, onAssetStale, onAssetDisabled } = mountSession();

    await act(async () => {
      await result.current.start('entry');
    });

    expect(onAssetStale).toHaveBeenCalledTimes(1);
    expect(onAssetDisabled).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith({
      title: ETranslations.binance_deposit_asset_unavailable__msg,
    });
    expect(result.current.snapshot).toBeUndefined();
  });

  it.each([
    EBinanceDepositErrorCode.FeatureDisabled,
    EBinanceDepositErrorCode.DepositDisabled,
  ])('hides the entry when Binance refuses with %s', async (code) => {
    mockService.startSession.mockRejectedValue({ code });
    const { result, onAssetStale, onAssetDisabled } = mountSession();

    await act(async () => {
      await result.current.start('entry');
    });

    expect(onAssetDisabled).toHaveBeenCalledTimes(1);
    expect(onAssetStale).not.toHaveBeenCalled();
  });

  it('drops a failed session when the user leaves it', async () => {
    mockService.startSession.mockResolvedValue(
      buildSnapshot({
        phase: 'failed',
        status: EBinanceDepositSessionStatus.EXPIRED,
        failReason: 'expired',
      }),
    );
    const { result } = mountSession();
    await act(async () => {
      await result.current.start('entry');
    });

    await act(async () => {
      await result.current.exit();
    });

    expect(mockService.discardSession).toHaveBeenCalledWith('local-1');
    expect(result.current.snapshot).toBeUndefined();
  });

  it('keeps an unfinished session for the entry to pick up again', async () => {
    mockService.startSession.mockResolvedValue(buildSnapshot());
    const { result } = mountSession();
    await act(async () => {
      await result.current.start('entry');
    });

    await act(async () => {
      await result.current.exit();
    });

    expect(mockService.discardSession).not.toHaveBeenCalled();
    expect(result.current.snapshot).toBeUndefined();
  });
});
