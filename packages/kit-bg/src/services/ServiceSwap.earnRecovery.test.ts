import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { buildRecoveredEarnSwapHistory } from '@onekeyhq/shared/src/utils/earnSwapRecovery';
import type {
  IEarnFundingState,
  IEarnSwapRecovery,
} from '@onekeyhq/shared/types/earn/funding';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import { inAppNotificationAtom } from '../states/jotai/atoms';
import { globalJotaiStorageReadyHandler } from '../states/jotai/jotaiStorage';

import ServiceSwap from './ServiceSwap';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    ...jest.requireActual<typeof import('@onekeyhq/shared/src/platformEnv')>(
      '@onekeyhq/shared/src/platformEnv',
    ).default,
    isWeb: false,
  },
}));

const recovery: IEarnSwapRecovery = {
  sender: {
    accountId: 'account',
    networkId: 'evm--1',
    address: '0xabc',
    amount: '1',
    token: {
      networkId: 'evm--1',
      contractAddress: '0x1',
      symbol: 'A',
      decimals: 18,
    },
  },
  receiver: {
    accountId: 'account',
    networkId: 'evm--1',
    address: '0xabc',
    amount: '2',
    token: {
      networkId: 'evm--1',
      contractAddress: '0x2',
      symbol: 'B',
      decimals: 6,
    },
  },
  provider: { provider: 'provider', providerName: 'Provider' },
  useOrderId: false,
  currency: { id: 'usd', symbol: '$' },
  createdAt: 1,
};
const scope = JSON.stringify([
  'account',
  'evm--1',
  '0xabc',
  'account',
  'evm--1',
  '0xabc',
  '0x1',
  '0x2',
  'target',
]);
const initial: IEarnFundingState = {
  status: 'submitted',
  txId: 'tx',
  intentAmount: '1',
  swapRecovery: recovery,
};

function setup() {
  let funding: IEarnFundingState | null = initial;
  let histories: ISwapTxHistory[] = [];
  const getEarnFunding = jest.fn(async () => funding);
  const getAccountAddressForApi = jest.fn(async () => '0xabc');
  const getSwapHistoryList = jest.fn(async () => histories);
  const stagePendingSwapHistoryItem = jest.fn(
    async (history: ISwapTxHistory) => {
      histories = [...histories, history];
    },
  );
  const commitPendingSwapHistoryItem = jest.fn(async () => undefined);
  const updateSwapHistoryItem = jest.fn(
    async (history: ISwapTxHistory) => history,
  );
  const showToast = jest.fn();
  const markEarnSwapSourceFailed = jest.fn(async (previous: ISwapTxHistory) => {
    const history = {
      ...previous,
      status: ESwapTxHistoryStatus.FAILED,
      sourceTxFailed: true as const,
    };
    histories = histories.map((item) =>
      item.txInfo.txId === history.txInfo.txId ? history : item,
    );
    return history;
  });
  const service = new ServiceSwap({
    backgroundApi: {
      serviceStaking: { getEarnFunding },
      serviceAccount: { getAccountAddressForApi },
      serviceNetwork: {
        getNetworksByIds: jest.fn(async () => ({ networks: [] })),
      },
      serviceApp: { showToast },
      simpleDb: {
        swapHistory: {
          recoverPendingSwapHistoryItems: jest.fn(async () => 0),
          getSwapHistoryList,
          repairSwapHistoryNetworkInfo: jest.fn(async () => ({
            histories,
            changed: false,
          })),
          stagePendingSwapHistoryItem,
          commitPendingSwapHistoryItem,
          markEarnSwapSourceFailed,
          updateSwapHistoryItem,
        },
      },
    },
  });
  return {
    service,
    getEarnFunding,
    getAccountAddressForApi,
    stagePendingSwapHistoryItem,
    markEarnSwapSourceFailed,
    updateSwapHistoryItem,
    showToast,
    setFunding: (value: IEarnFundingState | null) => {
      funding = value;
    },
    setHistories: (value: ISwapTxHistory[]) => {
      histories = value;
    },
  };
}

describe('Earn swap history recovery', () => {
  const previous = globalThis.$onekeyIsInBackground;
  let initialNotificationState: Awaited<
    ReturnType<typeof inAppNotificationAtom.get>
  >;
  beforeAll(async () => {
    globalThis.$onekeyIsInBackground = true;
    globalJotaiStorageReadyHandler.resolveReady(true);
    initialNotificationState = await inAppNotificationAtom.get();
  });
  beforeEach(async () => {
    await inAppNotificationAtom.set((previousState) => ({
      ...previousState,
      swapHistoryPendingList: [],
    }));
  });
  afterAll(async () => {
    await inAppNotificationAtom.set(initialNotificationState);
    globalThis.$onekeyIsInBackground = previous;
  });

  it('does not restore on Web without a cross-tab lock', async () => {
    const previousNavigator = Object.getOwnPropertyDescriptor(
      globalThis,
      'navigator',
    );
    const platform = jest.replaceProperty(platformEnv, 'isWeb', true);
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {},
    });
    try {
      const { service, stagePendingSwapHistoryItem } = setup();
      await expect(
        service.restoreEarnSwapHistory({ scope, txId: 'tx' }),
      ).resolves.toBe(false);
      expect(stagePendingSwapHistoryItem).not.toHaveBeenCalled();
    } finally {
      platform.restore();
      if (previousNavigator)
        Object.defineProperty(globalThis, 'navigator', previousNavigator);
      else Reflect.deleteProperty(globalThis, 'navigator');
    }
  });

  it('restores on Web when the cross-tab lock is available', async () => {
    const previousNavigator = Object.getOwnPropertyDescriptor(
      globalThis,
      'navigator',
    );
    const platform = jest.replaceProperty(platformEnv, 'isWeb', true);
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        locks: {
          request: async (_key: string, run: () => Promise<unknown>) => run(),
        },
      },
    });
    try {
      const { service, stagePendingSwapHistoryItem } = setup();
      await expect(
        service.restoreEarnSwapHistory({ scope, txId: 'tx' }),
      ).resolves.toBe(true);
      expect(stagePendingSwapHistoryItem).toHaveBeenCalledTimes(1);
    } finally {
      platform.restore();
      if (previousNavigator)
        Object.defineProperty(globalThis, 'navigator', previousNavigator);
      else Reflect.deleteProperty(globalThis, 'navigator');
    }
  });

  it('restores exactly once and preserves an existing history row', async () => {
    const { service, stagePendingSwapHistoryItem } = setup();
    await expect(
      service.restoreEarnSwapHistory({ scope, txId: 'tx' }),
    ).resolves.toBe(true);
    await expect(
      service.restoreEarnSwapHistory({ scope, txId: 'tx' }),
    ).resolves.toBe(true);
    expect(stagePendingSwapHistoryItem).toHaveBeenCalledTimes(1);
    expect(stagePendingSwapHistoryItem).toHaveBeenCalledWith(
      expect.objectContaining({
        txInfo: expect.objectContaining({ txId: 'tx' }),
      }),
    );
  });

  it('persists the chain-proven failure for an existing history before releasing funding', async () => {
    const { service, setFunding, setHistories, markEarnSwapSourceFailed } =
      setup();
    setFunding({
      ...initial,
      status: 'submitted',
      txId: 'tx',
      sourceTxFailed: true,
    });
    setHistories([buildRecoveredEarnSwapHistory(recovery, 'tx')]);
    await expect(
      service.restoreEarnSwapHistory({ scope, txId: 'tx' }),
    ).resolves.toBe(true);
    expect(markEarnSwapSourceFailed).toHaveBeenCalledWith(
      expect.objectContaining({ status: ESwapTxHistoryStatus.PENDING }),
    );
  });

  it('does not show a stale success toast when storage retains a proven source failure', async () => {
    const { service, updateSwapHistoryItem, showToast } = setup();
    const pending = buildRecoveredEarnSwapHistory(recovery, 'tx');
    await inAppNotificationAtom.set((previousState) => ({
      ...previousState,
      swapHistoryPendingList: [pending],
    }));
    updateSwapHistoryItem.mockResolvedValueOnce({
      ...pending,
      status: ESwapTxHistoryStatus.FAILED,
      sourceTxFailed: true,
    });
    const result = await service.updateSwapHistoryItem({
      ...pending,
      status: ESwapTxHistoryStatus.SUCCESS,
    });
    expect(result).toMatchObject({
      status: ESwapTxHistoryStatus.FAILED,
      sourceTxFailed: true,
    });
    expect(showToast).not.toHaveBeenCalled();
  });

  it('does not write after account change or a changed submitted transaction', async () => {
    const {
      service,
      getAccountAddressForApi,
      getEarnFunding,
      stagePendingSwapHistoryItem,
    } = setup();
    getAccountAddressForApi.mockResolvedValueOnce('0xother');
    await expect(
      service.restoreEarnSwapHistory({ scope, txId: 'tx' }),
    ).resolves.toBe(false);
    getEarnFunding
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce({ ...initial, txId: 'other' });
    await expect(
      service.restoreEarnSwapHistory({ scope, txId: 'tx' }),
    ).resolves.toBe(false);
    expect(stagePendingSwapHistoryItem).not.toHaveBeenCalled();
  });

  it.each([null, false])(
    'accepts the loan key with absent or false non-native flags: %s',
    async (flag) => {
      const { service, stagePendingSwapHistoryItem } = setup();
      const loanScope = JSON.stringify([
        'loan',
        'account',
        'evm--1',
        '0xabc',
        'account',
        'evm--1',
        '0xabc',
        '0x1',
        flag,
        '0x2',
        flag,
        'target',
        'market',
        'collateral',
        'borrow',
      ]);
      await expect(
        service.restoreEarnSwapHistory({ scope: loanScope, txId: 'tx' }),
      ).resolves.toBe(true);
      expect(stagePendingSwapHistoryItem).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects a loan key that claims a different native token identity', async () => {
    const { service, stagePendingSwapHistoryItem } = setup();
    const loanScope = JSON.stringify([
      'loan',
      'account',
      'evm--1',
      '0xabc',
      'account',
      'evm--1',
      '0xabc',
      '0x1',
      true,
      '0x2',
      false,
      'target',
      'market',
      'collateral',
      'borrow',
    ]);
    await expect(
      service.restoreEarnSwapHistory({ scope: loanScope, txId: 'tx' }),
    ).resolves.toBe(false);
    expect(stagePendingSwapHistoryItem).not.toHaveBeenCalled();
  });

  it('never changes the funding lock if the receipt becomes conflicted while history is written', async () => {
    const { service, getEarnFunding, setFunding, stagePendingSwapHistoryItem } =
      setup();
    let started = () => {};
    let release = () => {};
    const stageStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    stagePendingSwapHistoryItem.mockImplementationOnce(async () => {
      started();
      await delayed;
    });
    const restoring = service.restoreEarnSwapHistory({ scope, txId: 'tx' });
    await stageStarted;
    setFunding({
      status: 'unknown',
      txIdConflict: true,
      swapRecovery: recovery,
    });
    release();
    await expect(restoring).resolves.toBe(true);
    expect(await getEarnFunding()).toEqual(
      expect.objectContaining({ status: 'unknown', txIdConflict: true }),
    );
    expect(stagePendingSwapHistoryItem).toHaveBeenCalledWith(
      expect.objectContaining({
        txInfo: expect.objectContaining({ txId: 'tx', sender: '0xabc' }),
      }),
    );
  });

  it('publishes a missing pending item without overwriting an existing richer projection', async () => {
    const { service } = setup();
    const emit = jest.spyOn(appEventBus, 'emit');
    const existing = buildRecoveredEarnSwapHistory(recovery, 'tx');
    existing.swapInfo.instantRate = '9.5';
    await inAppNotificationAtom.set((previousState) => ({
      ...previousState,
      swapHistoryPendingList: [existing],
    }));
    await expect(
      service.restoreEarnSwapHistory({ scope, txId: 'tx' }),
    ).resolves.toBe(true);
    const pending = (await inAppNotificationAtom.get()).swapHistoryPendingList;
    expect(pending).toContainEqual(existing);
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.RefreshSwapHistoryList,
      undefined,
    );
    emit.mockRestore();
  });
});
