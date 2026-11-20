import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { buildRecoveredEarnSwapHistory } from '@onekeyhq/shared/src/utils/earnSwapRecovery';
import type {
  IEarnFundingState,
  IEarnSwapRecovery,
} from '@onekeyhq/shared/types/earn/funding';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';

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
  const service = new ServiceSwap({
    backgroundApi: {
      serviceStaking: { getEarnFunding },
      serviceAccount: { getAccountAddressForApi },
      serviceNetwork: {
        getNetworksByIds: jest.fn(async () => ({ networks: [] })),
      },
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
        },
      },
    },
  });
  return {
    service,
    getEarnFunding,
    getAccountAddressForApi,
    stagePendingSwapHistoryItem,
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
