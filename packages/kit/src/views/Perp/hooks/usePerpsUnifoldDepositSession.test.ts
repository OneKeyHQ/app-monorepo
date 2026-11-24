import { act, renderHook, waitFor } from '@testing-library/react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EHyperLiquidAbstractionMode } from '@onekeyhq/shared/types/hyperliquid/types';
import type {
  IUnifoldActivationStatus,
  IUnifoldDepositAddressResult,
} from '@onekeyhq/shared/types/unifoldDeposit';
import {
  UNIFOLD_ERROR_CODE_LOCAL_INVALID_DEPOSIT_ADDRESS_RESPONSE,
  UNIFOLD_ERROR_CODE_LOCAL_UNRECOGNIZED_ACCOUNT_MODE,
} from '@onekeyhq/shared/types/unifoldDeposit';

import {
  UNIFOLD_HYPERCORE_PERP_DESTINATION,
  UNIFOLD_HYPERCORE_SPOT_DESTINATION,
  getUnifoldHyperCoreDestination,
  getUnifoldHyperCoreTokenSymbol,
  isSameUnifoldDestination,
  resolveUnifoldExecutionDestination,
  usePerpsUnifoldDepositSession,
} from './usePerpsUnifoldDepositSession';

const SPOT_USDC = '0x6d1e7cde53ba9467b783cb7c530ce054';
const PERP_USDC = '0x00000000000000000000000000000000';

const RECIPIENT = '0x1111111111111111111111111111111111111111';
const DEPOSIT_ADDRESS = '0x2222222222222222222222222222222222222222';
const RECONNECTED_DEPOSIT_ADDRESS =
  '0x3333333333333333333333333333333333333333';

let mockLiveAccountAddress: string | null = RECIPIENT;
let mockAbstractionMode:
  | { accountAddress?: string; mode?: string; source?: 'live' | 'cache' }
  | undefined;

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  perpsActiveAccountAtom: {
    atom: () => 'perpsActiveAccountAtom',
  },
  useDevSettingsPersistAtom: () => [undefined],
  usePerpsAbstractionModeAtom: () => [mockAbstractionMode],
  usePerpsActiveAccountAtom: () => [{ accountAddress: mockLiveAccountAddress }],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore', () => ({
  jotaiDefaultStore: {
    get: () => ({ accountAddress: mockLiveAccountAddress }),
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDev: false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/miscUtils', () => ({
  generateUUID: () => 'claim-1',
}));

jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: {
    get: jest.fn(() => null),
    set: jest.fn(),
  },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquidSubscription: {
      enableLedgerUpdatesSubscription: jest.fn(),
    },
    serviceUnifoldDeposit: {
      claimDepositSessionTracking: jest.fn(),
      createDepositAddress: jest.fn(),
      fetchRecipientAccountMode: jest.fn(),
      finalizeDepositSessionTracking: jest.fn(),
      getActivationStatus: jest.fn(),
      getSupportedAssets: jest.fn(),
      listDepositExecutions: jest.fn(),
      settleAnnouncedExecution: jest.fn(),
      trackLiveSessionExecutions: jest.fn(),
    },
  },
}));

const mockService = backgroundApiProxy.serviceUnifoldDeposit as unknown as {
  claimDepositSessionTracking: jest.Mock;
  createDepositAddress: jest.Mock;
  fetchRecipientAccountMode: jest.Mock;
  finalizeDepositSessionTracking: jest.Mock;
  getActivationStatus: jest.Mock;
  getSupportedAssets: jest.Mock;
  listDepositExecutions: jest.Mock;
  settleAnnouncedExecution: jest.Mock;
  trackLiveSessionExecutions: jest.Mock;
};

describe('usePerpsUnifoldDepositSession account alignment', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockLiveAccountAddress = RECIPIENT;
    mockAbstractionMode = undefined;
    mockService.fetchRecipientAccountMode.mockResolvedValue(
      EHyperLiquidAbstractionMode.DISABLED,
    );
    mockService.getSupportedAssets.mockResolvedValue([
      {
        symbol: 'USDC',
        name: 'USD Coin',
        icon_url: '',
        is_newly_added: false,
        is_stablecoin: true,
        chains: [
          {
            chain_id: '42161',
            chain_name: 'Arbitrum One',
            chain_type: 'ethereum',
            icon_url: '',
            token_address: '0x1234',
            decimals: 6,
            estimated_price_impact_percent: 0,
            max_slippage_percent: 0.25,
            estimated_processing_time: 60,
            minimum_deposit_amount_usd: 3,
          },
        ],
      },
    ]);
    mockService.createDepositAddress.mockResolvedValue({
      sessionId: 'session-1',
      depositAddress: DEPOSIT_ADDRESS,
      depositWalletId: 'wallet-1',
      sourceChainType: 'ethereum',
      wallets: [
        {
          chainType: 'ethereum',
          address: DEPOSIT_ADDRESS,
          isPrimary: true,
        },
      ],
      echo: {
        recipientAddress: RECIPIENT,
        destinationChainType: 'hypercore',
        destinationChainId: '1337',
        destinationTokenAddress: '0x0000000000000000000000000000000000000000',
      },
    });
    mockService.getActivationStatus.mockResolvedValue({
      userExists: true,
      activationFee: '0',
      isSanctioned: false,
      sponsored: false,
    });
    mockService.claimDepositSessionTracking.mockResolvedValue({
      sessionStart: Date.now() - 60_000,
    });
    mockService.listDepositExecutions.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('requires fresh address and activation checks after the same account reconnects', async () => {
    const { result, rerender, unmount } = renderHook(() =>
      usePerpsUnifoldDepositSession({
        enabled: true,
        expectedRecipient: RECIPIENT,
      }),
    );

    await waitFor(() => {
      expect(result.current.qrAddress).toBe(DEPOSIT_ADDRESS);
      expect(mockService.listDepositExecutions).toHaveBeenCalled();
    });
    const queryCountBeforeDisconnect =
      mockService.listDepositExecutions.mock.calls.length;

    mockLiveAccountAddress = null;
    rerender({});

    expect(result.current.qrAddress).toBeNull();
    expect(result.current.addressState).toEqual({ status: 'loading' });
    expect(result.current.sessionExecutions).toEqual([]);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(6000);
    });
    expect(mockService.listDepositExecutions).toHaveBeenCalledTimes(
      queryCountBeforeDisconnect,
    );

    let resolveReconnectedAddress:
      | ((value: IUnifoldDepositAddressResult) => void)
      | undefined;
    let resolveReconnectedActivation:
      | ((value: IUnifoldActivationStatus) => void)
      | undefined;
    mockService.createDepositAddress.mockImplementationOnce(
      () =>
        new Promise<IUnifoldDepositAddressResult>((resolve) => {
          resolveReconnectedAddress = resolve;
        }),
    );
    mockService.getActivationStatus.mockImplementationOnce(
      () =>
        new Promise<IUnifoldActivationStatus>((resolve) => {
          resolveReconnectedActivation = resolve;
        }),
    );

    mockLiveAccountAddress = RECIPIENT;
    rerender({});
    await waitFor(() => {
      expect(mockService.createDepositAddress).toHaveBeenCalledTimes(2);
      expect(mockService.getActivationStatus).toHaveBeenCalledTimes(2);
    });
    expect(result.current.qrAddress).toBeNull();
    expect(result.current.addressState).toEqual({ status: 'loading' });

    await act(async () => {
      resolveReconnectedAddress?.({
        sessionId: 'session-2',
        depositAddress: RECONNECTED_DEPOSIT_ADDRESS,
        depositWalletId: 'wallet-2',
        sourceChainType: 'ethereum',
        wallets: [
          {
            chainType: 'ethereum',
            address: RECONNECTED_DEPOSIT_ADDRESS,
            isPrimary: true,
          },
        ],
        echo: {
          recipientAddress: RECIPIENT,
          destinationChainType: 'hypercore',
          destinationChainId: '1337',
          destinationTokenAddress: '0x0000000000000000000000000000000000000000',
        },
      });
    });
    expect(result.current.qrAddress).toBeNull();
    expect(result.current.addressState).toEqual({ status: 'loading' });

    await act(async () => {
      resolveReconnectedActivation?.({
        userExists: true,
        activationFee: '0',
        isSanctioned: false,
        sponsored: false,
      });
    });
    await waitFor(() => {
      expect(result.current.qrAddress).toBe(RECONNECTED_DEPOSIT_ADDRESS);
      expect(
        mockService.listDepositExecutions.mock.calls.length,
      ).toBeGreaterThan(queryCountBeforeDisconnect);
    });

    unmount();
  });

  it('keeps the previous activation verdict invalid while reconnect checks retry', async () => {
    const { result, rerender, unmount } = renderHook(() =>
      usePerpsUnifoldDepositSession({
        enabled: true,
        expectedRecipient: RECIPIENT,
      }),
    );

    await waitFor(() => {
      expect(result.current.qrAddress).toBe(DEPOSIT_ADDRESS);
    });

    mockLiveAccountAddress = null;
    rerender({});
    expect(result.current.qrAddress).toBeNull();

    mockService.getActivationStatus.mockRejectedValue(
      new Error('network unavailable'),
    );
    mockLiveAccountAddress = RECIPIENT;
    rerender({});

    await waitFor(() => {
      expect(mockService.createDepositAddress).toHaveBeenCalledTimes(2);
      expect(mockService.getActivationStatus).toHaveBeenCalledTimes(2);
      expect(result.current.activationRetrying).toBe(true);
    });
    expect(result.current.qrAddress).toBeNull();
    expect(result.current.addressState).toEqual({ status: 'loading' });
    expect(result.current.activationFee).toBeNull();
    expect(result.current.showActivationWarning).toBe(false);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });
    await waitFor(() => {
      expect(mockService.getActivationStatus).toHaveBeenCalledTimes(3);
    });
    expect(result.current.qrAddress).toBeNull();
    expect(result.current.addressState).toEqual({ status: 'loading' });

    unmount();
  });

  it('does not retry a deterministic invalid address response', async () => {
    mockService.createDepositAddress.mockRejectedValue({
      code: UNIFOLD_ERROR_CODE_LOCAL_INVALID_DEPOSIT_ADDRESS_RESPONSE,
      message: 'Invalid Unifold deposit-address response',
    });
    const { result, unmount } = renderHook(() =>
      usePerpsUnifoldDepositSession({
        enabled: true,
        expectedRecipient: RECIPIENT,
      }),
    );

    await waitFor(() => {
      expect(result.current.addressState).toEqual({
        status: 'error',
        errorType: 'unavailable',
        message: undefined,
      });
    });
    expect(mockService.createDepositAddress).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(15_000);
    });
    expect(mockService.createDepositAddress).toHaveBeenCalledTimes(1);

    unmount();
  });

  describe('destination by account mode (OK-67767)', () => {
    it('requests HyperCore Spot USDC for a unified account', async () => {
      mockService.fetchRecipientAccountMode.mockResolvedValue(
        EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
      );
      const { result, unmount } = renderHook(() =>
        usePerpsUnifoldDepositSession({
          enabled: true,
          expectedRecipient: RECIPIENT,
        }),
      );

      await waitFor(() => {
        expect(result.current.qrAddress).toBe(DEPOSIT_ADDRESS);
      });
      expect(result.current.destination).toEqual(
        UNIFOLD_HYPERCORE_SPOT_DESTINATION,
      );
      expect(mockService.fetchRecipientAccountMode).toHaveBeenCalledWith({
        recipientAddress: RECIPIENT,
      });
      expect(mockService.getSupportedAssets).toHaveBeenCalledWith(
        UNIFOLD_HYPERCORE_SPOT_DESTINATION,
      );
      expect(mockService.createDepositAddress).toHaveBeenCalledWith({
        recipientAddress: RECIPIENT,
        ...UNIFOLD_HYPERCORE_SPOT_DESTINATION,
      });

      unmount();
    });

    it.each([
      EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN,
      EHyperLiquidAbstractionMode.DISABLED,
      EHyperLiquidAbstractionMode.DEFAULT,
      EHyperLiquidAbstractionMode.DEX_ABSTRACTION,
    ])('keeps HyperCore Perp USDC for %s', async (mode) => {
      mockService.fetchRecipientAccountMode.mockResolvedValue(mode);
      const { result, unmount } = renderHook(() =>
        usePerpsUnifoldDepositSession({
          enabled: true,
          expectedRecipient: RECIPIENT,
        }),
      );

      await waitFor(() => {
        expect(result.current.qrAddress).toBe(DEPOSIT_ADDRESS);
      });
      expect(mockService.createDepositAddress).toHaveBeenCalledWith({
        recipientAddress: RECIPIENT,
        ...UNIFOLD_HYPERCORE_PERP_DESTINATION,
      });

      unmount();
    });

    it('withholds the address while the mode lookup fails, then retries', async () => {
      mockService.fetchRecipientAccountMode
        .mockRejectedValueOnce(
          new Error('Hyperliquid account mode unavailable'),
        )
        .mockResolvedValue(EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT);
      const { result, unmount } = renderHook(() =>
        usePerpsUnifoldDepositSession({
          enabled: true,
          expectedRecipient: RECIPIENT,
        }),
      );

      await waitFor(() => {
        expect(result.current.addressState).toMatchObject({
          status: 'error',
          errorType: 'network',
        });
      });
      expect(result.current.destination).toBeNull();
      expect(result.current.qrAddress).toBeNull();
      expect(mockService.getSupportedAssets).not.toHaveBeenCalled();
      expect(mockService.createDepositAddress).not.toHaveBeenCalled();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(5000);
      });
      await waitFor(() => {
        expect(result.current.qrAddress).toBe(DEPOSIT_ADDRESS);
      });
      expect(mockService.fetchRecipientAccountMode).toHaveBeenCalledTimes(2);
      expect(mockService.createDepositAddress).toHaveBeenCalledWith({
        recipientAddress: RECIPIENT,
        ...UNIFOLD_HYPERCORE_SPOT_DESTINATION,
      });

      unmount();
    });

    it('fails closed on an unrecognized mode instead of picking Perp', async () => {
      mockService.fetchRecipientAccountMode.mockRejectedValue({
        code: UNIFOLD_ERROR_CODE_LOCAL_UNRECOGNIZED_ACCOUNT_MODE,
        message: 'Unrecognized Hyperliquid account mode: futureMode',
      });
      const { result, unmount } = renderHook(() =>
        usePerpsUnifoldDepositSession({
          enabled: true,
          expectedRecipient: RECIPIENT,
        }),
      );

      await waitFor(() => {
        expect(result.current.addressState).toEqual({
          status: 'error',
          errorType: 'unavailable',
          message: undefined,
        });
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(15_000);
      });
      expect(mockService.fetchRecipientAccountMode).toHaveBeenCalledTimes(1);
      expect(mockService.getSupportedAssets).not.toHaveBeenCalled();
      expect(mockService.createDepositAddress).not.toHaveBeenCalled();
      expect(result.current.destination).toBeNull();

      unmount();
    });

    it('withdraws a Spot address once the live mode routes elsewhere, and keeps tracking', async () => {
      mockService.fetchRecipientAccountMode.mockResolvedValue(
        EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
      );
      mockAbstractionMode = {
        accountAddress: RECIPIENT,
        mode: EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
        source: 'live',
      };
      const { result, rerender, unmount } = renderHook(() =>
        usePerpsUnifoldDepositSession({
          enabled: true,
          expectedRecipient: RECIPIENT,
        }),
      );
      await waitFor(() => {
        expect(result.current.qrAddress).toBe(DEPOSIT_ADDRESS);
      });

      // Another Hyperliquid client switches the account back to standard.
      mockAbstractionMode = {
        accountAddress: RECIPIENT,
        mode: EHyperLiquidAbstractionMode.DISABLED,
        source: 'live',
      };
      rerender({});
      expect(result.current.qrAddress).toBeNull();
      expect(result.current.addressState).toEqual({
        status: 'error',
        errorType: 'accountModeChanged',
      });

      // Sticky, and money already sent is still tracked.
      const pollsBefore = mockService.listDepositExecutions.mock.calls.length;
      mockAbstractionMode = {
        accountAddress: RECIPIENT,
        mode: EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
        source: 'live',
      };
      rerender({});
      await act(async () => {
        await jest.advanceTimersByTimeAsync(6000);
      });
      expect(result.current.qrAddress).toBeNull();
      expect(result.current.addressState).toMatchObject({
        errorType: 'accountModeChanged',
      });
      expect(
        mockService.listDepositExecutions.mock.calls.length,
      ).toBeGreaterThan(pollsBefore);
      expect(mockService.createDepositAddress).toHaveBeenCalledTimes(1);

      unmount();
    });

    it.each([
      {
        name: 'a cached mode',
        sessionMode: EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
        state: {
          accountAddress: RECIPIENT,
          mode: EHyperLiquidAbstractionMode.DISABLED,
          source: 'cache' as const,
        },
      },
      {
        name: 'another account',
        sessionMode: EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
        state: {
          accountAddress: RECONNECTED_DEPOSIT_ADDRESS,
          mode: EHyperLiquidAbstractionMode.DISABLED,
          source: 'live' as const,
        },
      },
      {
        name: 'a new mode with the same destination',
        sessionMode: EHyperLiquidAbstractionMode.DISABLED,
        state: {
          accountAddress: RECIPIENT,
          mode: EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN,
          source: 'live' as const,
        },
      },
    ])('keeps the address for $name', async ({ sessionMode, state }) => {
      mockService.fetchRecipientAccountMode.mockResolvedValue(sessionMode);
      mockAbstractionMode = state;
      const { result, unmount } = renderHook(() =>
        usePerpsUnifoldDepositSession({
          enabled: true,
          expectedRecipient: RECIPIENT,
        }),
      );

      await waitFor(() => {
        expect(result.current.qrAddress).toBe(DEPOSIT_ADDRESS);
      });
      expect(result.current.addressState.status).toBe('ready');

      unmount();
    });
  });
});

describe('Unifold destination helpers (OK-67767)', () => {
  it('maps only unifiedAccount to Spot USDC', () => {
    expect(
      getUnifoldHyperCoreDestination(
        EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
      ).destinationTokenAddress,
    ).toBe(SPOT_USDC);
    expect(
      getUnifoldHyperCoreDestination(
        EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN,
      ).destinationTokenAddress,
    ).toBe(PERP_USDC);
  });

  it('labels history by the destination each execution settled to', () => {
    const spotExecution = {
      destinationChainType: 'ethereum',
      destinationChainId: '1337',
      destinationTokenAddress: SPOT_USDC.toUpperCase().replace('0X', '0x'),
    };
    const destination = resolveUnifoldExecutionDestination({
      execution: spotExecution,
      devSettings: undefined,
    });
    expect(getUnifoldHyperCoreTokenSymbol(destination)).toBe('USDC');

    // Servers that predate the field only ever settled to Perp USDC.
    const legacy = resolveUnifoldExecutionDestination({
      execution: {
        destinationChainType: null,
        destinationChainId: null,
        destinationTokenAddress: null,
      },
      devSettings: undefined,
    });
    expect(legacy).toEqual(UNIFOLD_HYPERCORE_PERP_DESTINATION);
    expect(getUnifoldHyperCoreTokenSymbol(legacy)).toBe('USDC (Perp)');
  });

  it('compares destinations with the token case-insensitively', () => {
    expect(
      isSameUnifoldDestination(UNIFOLD_HYPERCORE_SPOT_DESTINATION, {
        ...UNIFOLD_HYPERCORE_SPOT_DESTINATION,
        destinationTokenAddress: SPOT_USDC.toUpperCase().replace('0X', '0x'),
      }),
    ).toBe(true);
    expect(
      isSameUnifoldDestination(
        UNIFOLD_HYPERCORE_SPOT_DESTINATION,
        UNIFOLD_HYPERCORE_PERP_DESTINATION,
      ),
    ).toBe(false);
  });

  it('leaves unknown HyperCore tokens to the vendor currency', () => {
    expect(
      getUnifoldHyperCoreTokenSymbol({
        destinationChainType: 'ethereum',
        destinationChainId: '1337',
        destinationTokenAddress: '0x0d01dc56dcaaca66ad901c959b4011ec',
      }),
    ).toBeNull();
  });
});
