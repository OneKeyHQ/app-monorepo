import { OneKeyError, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  type IUnifoldDepositExecution,
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
const mockActiveAccountGet = jest.fn<
  Promise<{ accountAddress: string | null }>,
  []
>();
let mockTrackingState: IPerpsUnifoldDepositTrackingState;
let mockFailPendingDeliveryWrite = false;

const mockTrackingGet = jest.fn(async () => mockTrackingState);
const mockTrackingSet = jest.fn(async (update: ITrackingUpdate) => {
  const previous = mockTrackingState;
  const next = typeof update === 'function' ? update(previous) : update;
  mockTrackingState = next;
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

describe('ServiceUnifoldDeposit tracking delivery', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockFailPendingDeliveryWrite = false;
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
        claimId: 'claim-1',
      }),
    ).resolves.toEqual({ updated: true });
    expect(mockTrackingState.items).toEqual([]);
    expect(mockTrackingState.pendingDeliveries).toEqual([]);
    expect(mockTrackingState.watches?.[0].knownExecutionIds).toEqual([
      'execution-1',
    ]);
  });
});
