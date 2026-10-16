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

const token = {
  networkId: 'evm--81457',
  contractAddress: '0xtest',
  symbol: 'TEST',
  decimals: 18,
};
const approval: ISwapApproveTransaction = {
  fromToken: token,
  toToken: token,
  protocol: EProtocolOfExchange.SWAP,
  swapType: ESwapTabSwitchType.SWAP,
  provider: 'OKX',
  providerName: 'OKX',
  useAddress: '0xowner',
  spenderAddress: '0xspender',
  amount: '1',
  status: ESwapApproveTransactionStatus.PENDING,
  txId: 'approval-a',
};

describe('swap approval receipt ownership', () => {
  const previousScope = globalThis.$onekeyIsInBackground;
  let initialState: Awaited<ReturnType<typeof inAppNotificationAtom.get>>;
  beforeAll(async () => {
    globalThis.$onekeyIsInBackground = true;
    globalJotaiStorageReadyHandler.resolveReady(true);
    initialState = await inAppNotificationAtom.get();
  });
  beforeEach(async () => {
    await inAppNotificationAtom.set({
      ...initialState,
      swapApprovingTransaction: { ...approval },
    });
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await inAppNotificationAtom.set(initialState);
    globalThis.$onekeyIsInBackground = previousScope;
  });
  function serviceWithReceipt(state = ESwapTxHistoryStatus.SUCCESS) {
    const service = new ServiceSwap({ backgroundApi: {} });
    jest
      .spyOn(service, 'fetchTxState')
      .mockResolvedValue({ state, blockNumber: 10 } as Awaited<
        ReturnType<ServiceSwap['fetchTxState']>
      >);
    jest.spyOn(service, 'approvingStateAction').mockResolvedValue(undefined);
    jest.spyOn(service, 'cleanApprovingInterval').mockResolvedValue(undefined);
    return service;
  }
  it.each([
    [ESwapTxHistoryStatus.SUCCESS, ESwapApproveTransactionStatus.SUCCESS],
    [ESwapTxHistoryStatus.FAILED, ESwapApproveTransactionStatus.FAILED],
  ])('applies %s only to its pending approval', async (state, expected) => {
    await serviceWithReceipt(state).approvingStateRunSync(
      token.networkId,
      'approval-a',
    );
    expect(
      (await inAppNotificationAtom.get()).swapApprovingTransaction,
    ).toEqual(
      expect.objectContaining({ status: expected, txId: 'approval-a' }),
    );
  });
  it('does not apply a late success receipt to a replacement hash', async () => {
    const service = serviceWithReceipt();
    let complete!: (
      value: Awaited<ReturnType<ServiceSwap['fetchTxState']>>,
    ) => void;
    jest.spyOn(service, 'fetchTxState').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const pending = service.approvingStateRunSync(
      token.networkId,
      'approval-a',
    );
    await inAppNotificationAtom.set((previous) => ({
      ...previous,
      swapApprovingTransaction: { ...approval, txId: 'approval-b' },
    }));
    complete({ state: ESwapTxHistoryStatus.SUCCESS } as Awaited<
      ReturnType<ServiceSwap['fetchTxState']>
    >);
    await pending;
    expect(
      (await inAppNotificationAtom.get()).swapApprovingTransaction,
    ).toEqual(
      expect.objectContaining({
        txId: 'approval-b',
        status: ESwapApproveTransactionStatus.PENDING,
      }),
    );
  });
  it.each([
    ESwapApproveTransactionStatus.CANCEL,
    ESwapApproveTransactionStatus.FAILED,
  ])('does not revive terminal %s', async (status) => {
    await inAppNotificationAtom.set((previous) => ({
      ...previous,
      swapApprovingTransaction: { ...approval, status },
    }));
    await serviceWithReceipt().approvingStateRunSync(
      token.networkId,
      'approval-a',
    );
    expect(
      (await inAppNotificationAtom.get()).swapApprovingTransaction?.status,
    ).toBe(status);
  });
  it('ignores a receipt from a different network', async () => {
    await serviceWithReceipt().approvingStateRunSync('evm--1', 'approval-a');
    expect(
      (await inAppNotificationAtom.get()).swapApprovingTransaction?.status,
    ).toBe(ESwapApproveTransactionStatus.PENDING);
  });
});
