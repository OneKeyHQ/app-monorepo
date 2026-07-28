import { OneKeyError, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  type IUnifoldDepositExecution,
  type IUnifoldSupportedAsset,
  UNIFOLD_ERROR_CODE_LOCAL_ACTIVATION_UNAVAILABLE,
  UNIFOLD_ERROR_CODE_LOCAL_RECIPIENT_MISMATCH,
  UNIFOLD_ERROR_CODE_LOCAL_RECIPIENT_SANCTIONED,
} from '@onekeyhq/shared/types/unifoldDeposit';

import ServiceUnifoldDeposit from './ServiceUnifoldDeposit';

import type {
  IPerpsUnifoldDepositTrackingState,
  IPerpsUnifoldRecipientWatch,
  IPerpsUnifoldTrackedExecution,
} from '../states/jotai/atoms';

type ITrackingUpdate =
  | IPerpsUnifoldDepositTrackingState
  | ((
      prev: IPerpsUnifoldDepositTrackingState,
    ) => IPerpsUnifoldDepositTrackingState);

const mockEventEmit = jest.fn<void, unknown[]>();
const mockErrorLog = jest.fn<void, [string]>();
const mockActiveAccountGet = jest.fn<
  Promise<{ accountAddress: string | null }>,
  []
>();
let mockTrackingState: IPerpsUnifoldDepositTrackingState;
let mockFailPendingDeliveryWrite = false;
let mockFailNextTrackingWrite = false;

const mockTrackingGet = jest.fn(async () => mockTrackingState);
const mockTrackingSet = jest.fn(async (update: ITrackingUpdate) => {
  const previous = mockTrackingState;
  const next = typeof update === 'function' ? update(previous) : update;
  mockTrackingState = next;
  if (mockFailNextTrackingWrite) {
    mockFailNextTrackingWrite = false;
    throw new OneKeyLocalError('persist failed');
  }
  if (
    mockFailPendingDeliveryWrite &&
    (next.pendingDeliveries?.length ?? 0) >
      (previous.pendingDeliveries?.length ?? 0)
  ) {
    throw new OneKeyLocalError('persist failed');
  }
});

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    PerpsUnifoldDepositTerminalDelivery: 'PerpsUnifoldDepositTerminalDelivery',
  },
  appEventBus: {
    emit: (...args: unknown[]) => {
      mockEventEmit(...args);
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      error: {
        log: (message: string) => mockErrorLog(message),
      },
    },
  },
}));

jest.mock('../states/jotai/atoms', () => ({
  perpsUnifoldActiveRecipientAtom: {
    get: () => mockActiveAccountGet(),
  },
  perpsUnifoldDepositTrackingAtom: {
    get: () => mockTrackingGet(),
    set: (update: ITrackingUpdate) => mockTrackingSet(update),
  },
}));

const RECIPIENT = '0x1111111111111111111111111111111111111111';

function buildWatch(): IPerpsUnifoldRecipientWatch {
  return {
    recipientAddress: RECIPIENT,
    sessionId: 'session-1',
    sessionStart: 100,
    knownExecutionIds: [],
    watchedAt: Date.now(),
    mutedAt: null,
  };
}

function buildTrackedExecution(): IPerpsUnifoldTrackedExecution {
  return {
    executionId: 'execution-1',
    recipientAddress: RECIPIENT,
    sessionId: 'session-1',
    lastStatus: 'pending',
    trackedAt: Date.now(),
    mutedAt: null,
  };
}

function buildTerminalExecution(): IUnifoldDepositExecution {
  return {
    executionId: 'execution-1',
    status: 'succeeded',
    terminal: true,
    recipientAddress: RECIPIENT,
    destinationAmountUsd: '12.34',
    sourceAmountUsd: '12.34',
  } as IUnifoldDepositExecution;
}

function createService() {
  return new ServiceUnifoldDeposit({
    backgroundApi: {
      serviceHyperliquidSubscription: {
        enableLedgerUpdatesSubscription: jest.fn(),
      },
    },
  });
}

const SUPPORTED_ASSETS_DESTINATION = {
  destinationChainType: 'ethereum',
  destinationChainId: '1337',
  destinationTokenAddress: '0x00000000000000000000000000000000',
};

const VALID_SUPPORTED_ASSET: IUnifoldSupportedAsset = {
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
};

describe('ServiceUnifoldDeposit tracking delivery', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockFailPendingDeliveryWrite = false;
    mockFailNextTrackingWrite = false;
    mockTrackingState = {
      items: [],
      watches: [],
      pendingDeliveries: [],
    };
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('filters malformed supported asset catalog entries at the bg boundary', async () => {
    const service = createService();
    jest
      .spyOn(
        service as unknown as {
          requestUnifold: (request: unknown) => Promise<unknown>;
        },
        'requestUnifold',
      )
      .mockResolvedValue({
        data: [
          {
            ...VALID_SUPPORTED_ASSET,
            chains: [
              VALID_SUPPORTED_ASSET.chains[0],
              {
                ...VALID_SUPPORTED_ASSET.chains[0],
                chain_id: 'missing-chain-type',
                chain_type: undefined,
              },
              {
                ...VALID_SUPPORTED_ASSET.chains[0],
                chain_id: 'invalid-decimals',
                decimals: '6',
              },
            ],
          },
          {
            ...VALID_SUPPORTED_ASSET,
            symbol: '',
          },
        ],
      });

    await expect(
      service.getSupportedAssets(SUPPORTED_ASSETS_DESTINATION),
    ).resolves.toEqual([VALID_SUPPORTED_ASSET]);
  });

  it('returns an unavailable empty catalog when no valid source chain remains', async () => {
    const service = createService();
    jest
      .spyOn(
        service as unknown as {
          requestUnifold: (request: unknown) => Promise<unknown>;
        },
        'requestUnifold',
      )
      .mockResolvedValue([
        {
          ...VALID_SUPPORTED_ASSET,
          chains: [
            {
              ...VALID_SUPPORTED_ASSET.chains[0],
              max_slippage_percent: Number.POSITIVE_INFINITY,
            },
          ],
        },
      ]);

    await expect(
      service.getSupportedAssets(SUPPORTED_ASSETS_DESTINATION),
    ).resolves.toEqual([]);
  });

  it('sanitizes malformed execution fields at the bg boundary', async () => {
    const service = createService();
    jest
      .spyOn(
        service as unknown as {
          requestUnifold: (request: unknown) => Promise<unknown>;
        },
        'requestUnifold',
      )
      .mockResolvedValue([
        {
          ...buildTerminalExecution(),
          destinationTransactionHashes: null,
          vendorStatus: 123,
          transactionHash: {},
          sourceTokenDecimals: 6.5,
          destinationTokenDecimals: Number.MAX_SAFE_INTEGER + 1,
          createdAt: 1_700_000_000,
        },
        {
          ...buildTerminalExecution(),
          executionId: 'invalid-status',
          status: 'complete',
        },
        {
          ...buildTerminalExecution(),
          executionId: 'inconsistent-terminal',
          status: 'pending',
        },
        {
          ...buildTerminalExecution(),
          executionId: 'invalid-terminal-shape',
          status: 'failed',
          terminal: 'yes',
        },
      ]);

    await expect(
      service.listDepositExecutions({
        recipientAddress: RECIPIENT,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        executionId: 'execution-1',
        destinationTransactionHashes: [],
        vendorStatus: null,
        transactionHash: null,
        sourceTokenDecimals: null,
        destinationTokenDecimals: null,
        createdAt: '1700000000',
      }),
      expect.objectContaining({
        executionId: 'invalid-status',
        status: 'pending',
        terminal: false,
      }),
      expect.objectContaining({
        executionId: 'inconsistent-terminal',
        status: 'pending',
        terminal: false,
      }),
      expect.objectContaining({
        executionId: 'invalid-terminal-shape',
        status: 'failed',
        terminal: true,
      }),
    ]);
    expect(mockErrorLog).toHaveBeenCalledTimes(3);
  });

  it('unwraps execution arrays from nested data', async () => {
    const service = createService();
    jest
      .spyOn(
        service as unknown as {
          requestUnifold: (request: unknown) => Promise<unknown>;
        },
        'requestUnifold',
      )
      .mockResolvedValue({ data: [buildTerminalExecution()] });

    await expect(
      service.listDepositExecutions({
        recipientAddress: RECIPIENT,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        executionId: 'execution-1',
        status: 'succeeded',
        terminal: true,
      }),
    ]);
  });

  it('fails closed when bg cannot restore the active perps account', async () => {
    mockActiveAccountGet.mockResolvedValue({
      accountAddress: null,
    });
    const service = createService();

    await expect(
      service.createDepositAddress({
        recipientAddress: RECIPIENT,
        destinationChainType: 'evm',
        destinationChainId: '1337',
        destinationTokenAddress: '0x2222222222222222222222222222222222222222',
      }),
    ).rejects.toMatchObject({
      code: UNIFOLD_ERROR_CODE_LOCAL_RECIPIENT_MISMATCH,
    });
  });

  it('discards an address response when the active account changes in flight', async () => {
    const nextRecipient = '0x3333333333333333333333333333333333333333';
    mockActiveAccountGet
      .mockResolvedValueOnce({
        accountAddress: RECIPIENT,
      })
      .mockResolvedValueOnce({
        accountAddress: RECIPIENT,
      })
      .mockResolvedValueOnce({
        accountAddress: nextRecipient,
      });
    const service = createService();
    jest.spyOn(service, 'getActivationStatus').mockResolvedValue({
      userExists: true,
      activationFee: '0',
      isSanctioned: false,
      sponsored: false,
    });
    const params = {
      recipientAddress: RECIPIENT,
      destinationChainType: 'ethereum',
      destinationChainId: '1337',
      destinationTokenAddress: '0x00000000000000000000000000000000',
    };
    const addressRequestSpy = jest
      .spyOn(
        service as unknown as {
          requestUnifold: (request: unknown) => Promise<unknown>;
        },
        'requestUnifold',
      )
      .mockResolvedValue({
        sessionId: 'session-1',
        depositAddress: '0x2222222222222222222222222222222222222222',
        depositWalletId: 'wallet-1',
        sourceChainType: 'ethereum',
        wallets: [],
        echo: params,
      });

    await expect(service.createDepositAddress(params)).rejects.toMatchObject({
      code: UNIFOLD_ERROR_CODE_LOCAL_RECIPIENT_MISMATCH,
      autoToast: false,
    });
    expect(addressRequestSpy).toHaveBeenCalledTimes(1);
    expect(mockActiveAccountGet).toHaveBeenCalledTimes(3);
  });

  it.each([
    {
      label: 'a missing deposit address',
      patch: { depositAddress: '' },
    },
    {
      label: 'a non-array wallet collection',
      patch: { wallets: null },
    },
    {
      label: 'an invalid wallet entry',
      patch: {
        wallets: [
          {
            chainType: 'bitcoin',
            address: '',
            isPrimary: true,
          },
        ],
      },
    },
  ])('quietly rejects an address response with $label', async ({ patch }) => {
    mockActiveAccountGet.mockResolvedValue({
      accountAddress: RECIPIENT,
    });
    const service = createService();
    const params = {
      recipientAddress: RECIPIENT,
      destinationChainType: 'ethereum',
      destinationChainId: '1',
      destinationTokenAddress: '0x00000000000000000000000000000000',
    };
    jest
      .spyOn(
        service as unknown as {
          requestUnifold: (request: unknown) => Promise<unknown>;
        },
        'requestUnifold',
      )
      .mockResolvedValue({
        sessionId: 'session-1',
        depositAddress: '0x2222222222222222222222222222222222222222',
        depositWalletId: 'wallet-1',
        sourceChainType: 'ethereum',
        wallets: [],
        echo: params,
        ...patch,
      });

    await expect(service.createDepositAddress(params)).rejects.toMatchObject({
      message: 'Invalid Unifold deposit-address response',
      autoToast: false,
    });
  });

  it('fails closed before requesting an address for a sanctioned recipient', async () => {
    mockActiveAccountGet.mockResolvedValue({
      accountAddress: RECIPIENT,
    });
    const service = createService();
    const activationStatusSpy = jest
      .spyOn(service, 'getActivationStatus')
      .mockResolvedValue({
        userExists: true,
        activationFee: '0',
        isSanctioned: true,
        sponsored: false,
      });
    const addressRequestSpy = jest.spyOn(
      service as unknown as {
        requestUnifold: (params: unknown) => Promise<unknown>;
      },
      'requestUnifold',
    );

    await expect(
      service.createDepositAddress({
        recipientAddress: RECIPIENT,
        destinationChainType: 'ethereum',
        destinationChainId: '1337',
        destinationTokenAddress: '0x00000000000000000000000000000000',
      }),
    ).rejects.toMatchObject({
      code: UNIFOLD_ERROR_CODE_LOCAL_RECIPIENT_SANCTIONED,
      autoToast: false,
    });
    expect(activationStatusSpy).toHaveBeenCalledWith({
      recipientAddress: RECIPIENT,
    });
    expect(addressRequestSpy).not.toHaveBeenCalled();
  });

  it('fails closed before requesting an address when sanction lookup fails', async () => {
    mockActiveAccountGet.mockResolvedValue({
      accountAddress: RECIPIENT,
    });
    const service = createService();
    const lookupError = new Error('activation unavailable');
    jest.spyOn(service, 'getActivationStatus').mockRejectedValue(lookupError);
    const addressRequestSpy = jest.spyOn(
      service as unknown as {
        requestUnifold: (params: unknown) => Promise<unknown>;
      },
      'requestUnifold',
    );

    await expect(
      service.createDepositAddress({
        recipientAddress: RECIPIENT,
        destinationChainType: 'ethereum',
        destinationChainId: '1337',
        destinationTokenAddress: '0x00000000000000000000000000000000',
      }),
    ).rejects.toMatchObject({
      code: UNIFOLD_ERROR_CODE_LOCAL_ACTIVATION_UNAVAILABLE,
      autoToast: false,
    });
    expect(addressRequestSpy).not.toHaveBeenCalled();
  });

  it('keeps typed activation errors quiet and blocks the address request', async () => {
    mockActiveAccountGet.mockResolvedValue({
      accountAddress: RECIPIENT,
    });
    const service = createService();
    const lookupError = new OneKeyError({
      message: 'geo blocked',
      code: 14_102,
      autoToast: true,
    });
    jest.spyOn(service, 'getActivationStatus').mockRejectedValue(lookupError);
    const addressRequestSpy = jest.spyOn(
      service as unknown as {
        requestUnifold: (params: unknown) => Promise<unknown>;
      },
      'requestUnifold',
    );

    await expect(
      service.createDepositAddress({
        recipientAddress: RECIPIENT,
        destinationChainType: 'ethereum',
        destinationChainId: '1337',
        destinationTokenAddress: '0x00000000000000000000000000000000',
      }),
    ).rejects.toMatchObject({
      code: 14_102,
      autoToast: false,
    });
    expect(addressRequestSpy).not.toHaveBeenCalled();
  });

  it('returns the earliest persisted watch start to a reopened session', async () => {
    mockTrackingState = {
      items: [],
      watches: [buildWatch()],
      pendingDeliveries: [],
    };
    const service = createService();
    jest
      .spyOn(service, 'unifoldDepositTrackingLoop')
      .mockResolvedValue(undefined);

    await expect(
      service.claimDepositSessionTracking({
        recipientAddress: RECIPIENT,
        claimId: 'claim-2',
        sessionId: 'session-2',
        sessionStart: 200,
      }),
    ).resolves.toEqual({ sessionStart: 100 });
  });

  it('discovers an execution with a numeric createdAt in an unbounded query', async () => {
    const now = Date.now();
    mockTrackingState = {
      items: [buildTrackedExecution()],
      watches: [
        {
          ...buildWatch(),
          sessionStart: now - 1000,
          watchedAt: now,
        },
      ],
      pendingDeliveries: [],
    };
    const service = createService();
    jest
      .spyOn(
        service as unknown as {
          requestUnifold: (request: unknown) => Promise<unknown>;
        },
        'requestUnifold',
      )
      .mockResolvedValue([
        {
          ...buildTrackedExecution(),
          status: 'pending',
          terminal: false,
          createdAt: now - 2000,
        },
        {
          ...buildTerminalExecution(),
          executionId: 'execution-2',
          createdAt: now,
        },
      ]);

    const runTrackingIteration = (
      service as unknown as { runTrackingIteration: () => Promise<void> }
    ).runTrackingIteration.bind(service);
    await runTrackingIteration();

    expect(mockTrackingState.pendingDeliveries).toEqual([
      expect.objectContaining({
        execution: expect.objectContaining({
          executionId: 'execution-2',
          createdAt: String(now),
        }),
      }),
    ]);
  });

  it('keeps tracking muted until every foreground claim is released', async () => {
    mockTrackingState = {
      items: [buildTrackedExecution()],
      watches: [buildWatch()],
      pendingDeliveries: [],
    };
    const service = createService();
    jest
      .spyOn(service, 'unifoldDepositTrackingLoop')
      .mockResolvedValue(undefined);

    await service.claimDepositSessionTracking({
      recipientAddress: RECIPIENT,
      claimId: 'claim-1',
      sessionId: 'session-1',
      sessionStart: 100,
    });
    await service.claimDepositSessionTracking({
      recipientAddress: RECIPIENT,
      claimId: 'claim-2',
      sessionId: 'session-2',
      sessionStart: 200,
    });

    await service.finalizeDepositSessionTracking({
      recipientAddress: RECIPIENT,
      claimId: 'claim-1',
      sessionId: 'session-1',
      sessionStart: 100,
      announcedExecutionIds: [],
      executions: [],
    });
    expect(mockTrackingState.watches?.[0].claims).toEqual([
      expect.objectContaining({ claimId: 'claim-2' }),
    ]);
    expect(mockTrackingState.watches?.[0].mutedAt).not.toBeNull();
    expect(mockTrackingState.items[0].mutedAt).not.toBeNull();

    await service.finalizeDepositSessionTracking({
      recipientAddress: RECIPIENT,
      claimId: 'claim-2',
      sessionId: 'session-2',
      sessionStart: 200,
      announcedExecutionIds: [],
      executions: [],
    });
    expect(mockTrackingState.watches?.[0].claims).toEqual([]);
    expect(mockTrackingState.watches?.[0].mutedAt).toBeNull();
    expect(mockTrackingState.items[0].mutedAt).toBeNull();
  });

  it('drops announced entries during finalize after settle persistence fails', async () => {
    const claimedAt = Date.now();
    mockTrackingState = {
      items: [{ ...buildTrackedExecution(), mutedAt: claimedAt }],
      watches: [
        {
          ...buildWatch(),
          mutedAt: claimedAt,
          claims: [{ claimId: 'claim-1', claimedAt }],
        },
      ],
      pendingDeliveries: [],
    };
    const service = createService();
    jest
      .spyOn(service, 'unifoldDepositTrackingLoop')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service, 'listDepositExecutions')
      .mockResolvedValue([buildTerminalExecution()]);

    mockFailNextTrackingWrite = true;
    await expect(
      service.settleAnnouncedExecution({
        recipientAddress: RECIPIENT,
        executionId: 'execution-1',
      }),
    ).rejects.toThrow('persist failed');
    expect(mockTrackingState.items).toHaveLength(1);
    expect(mockTrackingState.watches?.[0].knownExecutionIds).toEqual([]);

    await service.finalizeDepositSessionTracking({
      recipientAddress: RECIPIENT,
      claimId: 'claim-1',
      sessionId: 'session-1',
      sessionStart: 100,
      announcedExecutionIds: ['execution-1'],
      executions: [],
    });
    expect(mockTrackingState.items).toEqual([]);
    expect(mockTrackingState.watches?.[0].knownExecutionIds).toEqual([
      'execution-1',
    ]);

    const runTrackingIteration = (
      service as unknown as { runTrackingIteration: () => Promise<void> }
    ).runTrackingIteration.bind(service);
    await runTrackingIteration();
    expect(mockTrackingState.pendingDeliveries).toEqual([]);
    expect(mockEventEmit).not.toHaveBeenCalled();
  });

  it('rolls back a failed delivery write and settles only after foreground ACK', async () => {
    mockTrackingState = {
      items: [buildTrackedExecution()],
      watches: [buildWatch()],
      pendingDeliveries: [],
    };
    const service = createService();
    jest
      .spyOn(service, 'listDepositExecutions')
      .mockResolvedValue([buildTerminalExecution()]);
    const runTrackingIteration = (
      service as unknown as { runTrackingIteration: () => Promise<void> }
    ).runTrackingIteration.bind(service);

    mockFailPendingDeliveryWrite = true;
    await expect(runTrackingIteration()).rejects.toThrow('persist failed');
    expect(mockTrackingState.items).toHaveLength(1);
    expect(mockTrackingState.pendingDeliveries).toEqual([]);
    expect(mockTrackingState.watches?.[0].knownExecutionIds).toEqual([]);
    expect(mockEventEmit).not.toHaveBeenCalled();

    mockFailPendingDeliveryWrite = false;
    await runTrackingIteration();
    expect(mockTrackingState.items).toHaveLength(1);
    expect(mockTrackingState.pendingDeliveries).toHaveLength(1);
    expect(mockTrackingState.watches?.[0].knownExecutionIds).toEqual([]);
    expect(mockEventEmit).toHaveBeenCalledWith(
      'PerpsUnifoldDepositTerminalDelivery',
      expect.objectContaining({
        deliveryId: expect.stringContaining('execution-1'),
      }),
    );

    const deliveryId = mockTrackingState.pendingDeliveries?.[0].deliveryId;
    expect(deliveryId).toBeTruthy();
    const claim = await service.tryClaimTerminalDelivery({
      deliveryId: deliveryId || '',
      claimId: 'claim-1',
    });
    expect(claim.status).toBe('claimed');
    await expect(
      service.acknowledgeTerminalDelivery({
        deliveryId: deliveryId || '',
        claimId: 'claim-2',
      }),
    ).resolves.toEqual({ updated: false, reason: 'claimLost' });
    expect(mockTrackingState.pendingDeliveries).toHaveLength(1);
    await expect(
      service.acknowledgeTerminalDelivery({
        deliveryId: deliveryId || '',
        claimId: 'claim-1',
      }),
    ).resolves.toEqual({ updated: true });
    expect(mockTrackingState.items).toEqual([]);
    expect(mockTrackingState.pendingDeliveries).toEqual([]);
    expect(mockTrackingState.watches?.[0].knownExecutionIds).toEqual([
      'execution-1',
    ]);
    await expect(
      service.acknowledgeTerminalDelivery({
        deliveryId: deliveryId || '',
        claimId: 'claim-1',
      }),
    ).resolves.toEqual({ updated: false, reason: 'gone' });
  });

  it('claims a delivery when Array.prototype.with is unavailable', async () => {
    const firstExecution = buildTerminalExecution();
    const secondExecution = {
      ...buildTerminalExecution(),
      executionId: 'execution-2',
    };
    mockTrackingState = {
      items: [],
      watches: [],
      pendingDeliveries: [
        {
          deliveryId: 'delivery-1',
          execution: firstExecution,
          recipientAddress: RECIPIENT,
          sessionId: null,
          createdAt: 1,
        },
        {
          deliveryId: 'delivery-2',
          execution: secondExecution,
          recipientAddress: RECIPIENT,
          sessionId: null,
          createdAt: 2,
        },
      ],
    };
    const service = createService();
    const withDescriptor = Object.getOwnPropertyDescriptor(
      Array.prototype,
      'with',
    );
    Object.defineProperty(Array.prototype, 'with', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    try {
      await expect(
        service.tryClaimTerminalDelivery({
          deliveryId: 'delivery-2',
          claimId: 'claim-2',
        }),
      ).resolves.toMatchObject({
        status: 'claimed',
      });
    } finally {
      if (withDescriptor) {
        Object.defineProperty(Array.prototype, 'with', withDescriptor);
      } else {
        delete (Array.prototype as { with?: unknown }).with;
      }
    }
    expect(mockTrackingState.pendingDeliveries?.[0].claim).toBeUndefined();
    expect(mockTrackingState.pendingDeliveries?.[1].claim?.claimId).toBe(
      'claim-2',
    );
  });
});
