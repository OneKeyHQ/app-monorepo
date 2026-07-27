import { act, renderHook, waitFor } from '@testing-library/react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IUnifoldActivationStatus,
  IUnifoldDepositAddressResult,
} from '@onekeyhq/shared/types/unifoldDeposit';

import { usePerpsUnifoldDepositSession } from './usePerpsUnifoldDepositSession';

const RECIPIENT = '0x1111111111111111111111111111111111111111';
const DEPOSIT_ADDRESS = '0x2222222222222222222222222222222222222222';
const RECONNECTED_DEPOSIT_ADDRESS =
  '0x3333333333333333333333333333333333333333';

let mockLiveAccountAddress: string | null = RECIPIENT;

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  perpsActiveAccountAtom: {
    atom: () => 'perpsActiveAccountAtom',
  },
  useDevSettingsPersistAtom: () => [undefined],
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
});
