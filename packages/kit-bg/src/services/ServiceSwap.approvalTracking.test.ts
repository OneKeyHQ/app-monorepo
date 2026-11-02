import type { ISwapApproveTransaction } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapApproveTransactionStatus,
  ESwapTabSwitchType,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { inAppNotificationAtom } from '../states/jotai/atoms';
import { globalJotaiStorageReadyHandler } from '../states/jotai/jotaiStorage';

import ServiceSwap from './ServiceSwap';

function createApproval(): ISwapApproveTransaction {
  const token = {
    networkId: 'evm--1',
    contractAddress: '0xtoken',
    symbol: 'TOKEN',
    decimals: 18,
  };
  return {
    approvalRequestId: 'approval-A',
    txId: 'tx-A',
    fromToken: token,
    toToken: token,
    protocol: EProtocolOfExchange.SWAP,
    swapType: ESwapTabSwitchType.SWAP,
    provider: 'test',
    providerName: 'Test',
    useAddress: '0xowner',
    spenderAddress: '0xspender',
    amount: '1',
    status: ESwapApproveTransactionStatus.PENDING,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('swap approval polling ownership', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;
  let initialState: Awaited<ReturnType<typeof inAppNotificationAtom.get>>;

  beforeAll(async () => {
    globalThis.$onekeyIsInBackground = true;
    globalJotaiStorageReadyHandler.resolveReady(true);
    initialState = await inAppNotificationAtom.get();
  });

  beforeEach(async () => {
    jest.useFakeTimers();
    await inAppNotificationAtom.set(initialState);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await inAppNotificationAtom.set(initialState);
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it.each(['request', 'transaction', 'network', 'cleared'])(
    'ignores an old receipt after the approval changes by %s',
    async (change) => {
      const service = new ServiceSwap({ backgroundApi: {} });
      const receipt =
        deferred<Awaited<ReturnType<ServiceSwap['fetchTxState']>>>();
      jest.spyOn(service, 'fetchTxState').mockReturnValue(receipt.promise);
      const original = createApproval();
      await service.setApprovingTransaction(original);
      const pending = service.approvingStateRunSync(
        original.fromToken.networkId,
        original.txId as string,
        original.approvalRequestId,
      );
      const replacement =
        change === 'cleared'
          ? undefined
          : {
              ...original,
              ...(change === 'request'
                ? { approvalRequestId: 'approval-B' }
                : {}),
              ...(change === 'transaction' ? { txId: 'tx-B' } : {}),
              ...(change === 'network'
                ? { fromToken: { ...original.fromToken, networkId: 'evm--56' } }
                : {}),
            };
      await service.setApprovingTransaction(replacement);
      const clean = jest.spyOn(service, 'cleanApprovingInterval');
      const schedule = jest.spyOn(service, 'approvingStateAction');
      receipt.resolve({ state: ESwapTxHistoryStatus.SUCCESS });
      await pending;
      expect(await service.getApprovingTransaction()).toEqual(replacement);
      expect(clean).not.toHaveBeenCalled();
      expect(schedule).not.toHaveBeenCalled();
    },
  );

  it.each([ESwapTxHistoryStatus.SUCCESS, ESwapTxHistoryStatus.PENDING])(
    'keeps the newer polling timer when an obsolete request returns %s',
    async (state) => {
      const service = new ServiceSwap({ backgroundApi: {} });
      const receipt =
        deferred<Awaited<ReturnType<ServiceSwap['fetchTxState']>>>();
      const fetch = jest
        .spyOn(service, 'fetchTxState')
        .mockReturnValue(receipt.promise);
      const original = createApproval();
      await service.setApprovingTransaction(original);
      const pending = service.approvingStateRunSync(
        original.fromToken.networkId,
        original.txId as string,
        original.approvalRequestId,
      );
      await service.approvingStateAction();
      const clean = jest.spyOn(service, 'cleanApprovingInterval');
      const schedule = jest.spyOn(service, 'approvingStateAction');
      receipt.resolve({ state });
      await pending;
      expect(await service.getApprovingTransaction()).toEqual(original);
      expect(clean).not.toHaveBeenCalled();
      expect(schedule).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(1);
      const nextPoll = jest.spyOn(service, 'approvingStateRunSync');
      jest.runOnlyPendingTimers();
      await nextPoll.mock.results[0].value;
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );

  it.each([ESwapTxHistoryStatus.SUCCESS, ESwapTxHistoryStatus.FAILED])(
    'completes the matching approval with %s',
    async (state) => {
      const service = new ServiceSwap({ backgroundApi: {} });
      jest.spyOn(service, 'fetchTxState').mockResolvedValue({ state });
      const original = createApproval();
      await service.setApprovingTransaction(original);
      const clean = jest.spyOn(service, 'cleanApprovingInterval');
      await service.approvingStateRunSync(
        original.fromToken.networkId,
        original.txId as string,
        original.approvalRequestId,
      );
      expect(await service.getApprovingTransaction()).toEqual({
        ...original,
        txId: state === ESwapTxHistoryStatus.FAILED ? undefined : original.txId,
        ...(state === ESwapTxHistoryStatus.SUCCESS
          ? { blockNumber: undefined }
          : {}),
        status:
          state === ESwapTxHistoryStatus.FAILED
            ? ESwapApproveTransactionStatus.FAILED
            : ESwapApproveTransactionStatus.SUCCESS,
      });
      expect(clean).toHaveBeenCalledTimes(1);
    },
  );

  it('continues polling a matching pending approval', async () => {
    const service = new ServiceSwap({ backgroundApi: {} });
    jest
      .spyOn(service, 'fetchTxState')
      .mockResolvedValue({ state: ESwapTxHistoryStatus.PENDING });
    const original = createApproval();
    await service.setApprovingTransaction(original);
    const schedule = jest.spyOn(service, 'approvingStateAction');
    await service.approvingStateRunSync(
      original.fromToken.networkId,
      original.txId as string,
      original.approvalRequestId,
    );
    expect(await service.getApprovingTransaction()).toEqual(original);
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(1);
  });
});
