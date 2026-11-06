/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import {
  EStakingActionType,
  type IProtocolInfo,
} from '@onekeyhq/shared/types/staking';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';
import type {
  IBroadcastAcceptedFact,
  ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

import { useHandleWithdraw } from './useHandleActions';

const mockPushModal = jest.fn();
const mockPush = jest.fn();
const mockGetConfig = jest.fn<Promise<unknown>, unknown[]>();
const mockBuildUnstake = jest.fn<Promise<unknown>, unknown[]>();
const mockBuildInternal = jest.fn<Promise<unknown>, unknown[]>();
const mockPrepare = jest.fn<Promise<unknown>, unknown[]>();
const mockAddOrder = jest.fn<Promise<unknown>, unknown[]>();
const mockAccountAddress = jest.fn<Promise<string>, [unknown]>();

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal, push: mockPush }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getStakingConfigs: (...args: unknown[]) => mockGetConfig(...args),
      buildUnstakeTransaction: (...args: unknown[]) =>
        mockBuildUnstake(...args),
      buildInternalDappTx: (...args: unknown[]) => mockBuildInternal(...args),
      addEarnOrder: (...args: unknown[]) => mockAddOrder(...args),
    },
    serviceAccount: {
      getAccountAddressForApi: (params: unknown) => mockAccountAddress(params),
    },
    serviceSend: {
      prepareSendConfirmUnsignedTx: (...args: unknown[]) =>
        mockPrepare(...args),
    },
  },
}));

type IConfirmationParams = {
  onSuccess: (data: ISendTxOnSuccessData[]) => Promise<void>;
  onCancel?: () => void;
  onFail?: (error: Error) => void;
  onSafePreSendFail?: (error: Error) => void;
  onBeforeSend?: () => void | Promise<void>;
  onLateBroadcastAccepted?: (fact: IBroadcastAcceptedFact) => Promise<void>;
};
const request = {
  withdrawType: EStakingActionType.CancelWithdrawal,
  accountId: 'account-1',
  networkId: 'evm--1',
  provider: 'etherfi',
  symbol: 'ETH',
};

describe('cancel withdrawal confirmation', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockGetConfig.mockResolvedValue({});
    mockAccountAddress.mockResolvedValue('0xowner');
    mockBuildUnstake.mockResolvedValue({
      tx: { value: '0x0' },
      orderId: 'order-1',
    });
    mockBuildInternal.mockResolvedValue({ value: '0x0' });
    mockPrepare.mockResolvedValue({ tx: { value: '0x0' } });
    mockAddOrder.mockResolvedValue({
      localStatus: 'saved',
      remoteStatus: 'synced',
    });
  });

  it('binds a cancellation to the displayed account through the send boundary', async () => {
    const protocolInfo: IProtocolInfo = {
      provider: 'etherfi',
      networkId: request.networkId,
      symbol: 'ETH',
      vault: 'vault',
      stakeTag: '',
      providerDetail: { name: 'EtherFi', logoURI: '' },
      earnAccount: {
        accountId: request.accountId,
        networkId: request.networkId,
        accountAddress: '0xowner',
        account: {
          id: request.accountId,
          name: 'Account',
          type: undefined,
          path: '',
          coinType: '60',
          impl: 'evm',
          pub: '',
          address: '0xowner',
          addressDetail: {
            isValid: true,
            networkId: request.networkId,
            address: '0xowner',
            baseAddress: '0xowner',
            normalizedAddress: '0xowner',
            displayAddress: '0xowner',
            allowEmptyAddress: false,
          },
        },
      },
    };
    const { result } = renderHook(() => useHandleWithdraw());
    await result.current({ ...request, protocolInfo });
    expect(mockBuildUnstake).toHaveBeenCalledWith(
      expect.objectContaining({ expectedAccountAddress: '0xowner' }),
    );
    const { params } = mockPushModal.mock.calls[0][1] as {
      params: IConfirmationParams;
    };
    mockAccountAddress.mockResolvedValueOnce('0xother');
    await expect(
      Promise.resolve().then(() => params.onBeforeSend?.()),
    ).rejects.toThrow('Withdrawal account changed');
    params.onSafePreSendFail?.(new Error('Withdrawal account changed'));
    await expect(params.onBeforeSend?.()).resolves.toBeUndefined();
  });

  it('accepts cancellation after a retryable confirmation precheck failure', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useHandleWithdraw());
    await result.current({ ...request, onSuccess });
    const { params } = mockPushModal.mock.calls[0][1] as {
      params: IConfirmationParams;
    };
    params.onSafePreSendFail?.(new Error('precheck unavailable'));
    await params.onBeforeSend?.();
    const data: ISendTxOnSuccessData[] = [
      {
        signedTx: { txid: 'retry-tx', rawTx: '0x', encodedTx: null },
        decodedTx: {
          ...request,
          txid: 'retry-tx',
          status: EDecodedTxStatus.Pending,
          owner: 'owner',
          signer: 'owner',
          nonce: 0,
          actions: [],
          extraInfo: null,
        },
      },
    ];
    await params.onSuccess(data);
    expect(mockAddOrder).toHaveBeenCalledWith(
      expect.objectContaining({ txId: 'retry-tx' }),
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('records a late cancellation success without notifying its closed owner', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useHandleWithdraw());
    await result.current({ ...request, onSuccess });
    const { params } = mockPushModal.mock.calls[0][1] as {
      params: IConfirmationParams;
    };
    params.onCancel?.();
    const data: ISendTxOnSuccessData[] = [
      {
        signedTx: { txid: 'late-tx', rawTx: '0x', encodedTx: null },
        decodedTx: {
          ...request,
          txid: 'late-tx',
          status: EDecodedTxStatus.Pending,
          owner: 'owner',
          signer: 'owner',
          nonce: 0,
          actions: [],
          extraInfo: null,
        },
      },
    ];
    await params.onSuccess(data);
    expect(mockAddOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', txId: 'late-tx' }),
      { remoteSync: 'once', preserveExistingTx: true },
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('does not notify an earlier cancellation after a new cancellation starts', async () => {
    let resolveOrder: () => void = () => undefined;
    mockAddOrder.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOrder = () => resolve(undefined);
      }),
    );
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useHandleWithdraw());
    await result.current({ ...request, onSuccess });
    const { params } = mockPushModal.mock.calls[0][1] as {
      params: IConfirmationParams;
    };
    const data: ISendTxOnSuccessData[] = [
      {
        signedTx: { txid: 'first-tx', rawTx: '0x', encodedTx: null },
        decodedTx: {
          ...request,
          txid: 'first-tx',
          status: EDecodedTxStatus.Pending,
          owner: 'owner',
          signer: 'owner',
          nonce: 0,
          actions: [],
          extraInfo: null,
        },
      },
    ];
    const pending = params.onSuccess(data);
    await result.current(request);
    resolveOrder();
    await pending;
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('records a verified late broadcast after cancellation without the original success callback', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useHandleWithdraw());
    await result.current({ ...request, onSuccess });
    const { params } = mockPushModal.mock.calls[0][1] as {
      params: IConfirmationParams;
    };
    params.onCancel?.();
    expect(params.onLateBroadcastAccepted).toBeDefined();
    await params.onLateBroadcastAccepted?.({
      uuid: 'request',
      accountId: request.accountId,
      networkId: request.networkId,
      txid: 'late-tx',
    });
    expect(mockAddOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        networkId: request.networkId,
        txId: 'late-tx',
      }),
      expect.objectContaining({ remoteSync: 'once' }),
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('preserves the cancel request and records the successful transaction before notifying the caller', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useHandleWithdraw());
    await result.current({ ...request, onSuccess });
    expect(mockBuildUnstake).toHaveBeenCalledWith(
      expect.objectContaining({
        ...request,
        amount: '0',
        withdrawAll: false,
        withdrawType: 'cancel',
      }),
    );
    const { params } = mockPushModal.mock.calls[0][1] as {
      params: IConfirmationParams;
    };
    const data: ISendTxOnSuccessData[] = [
      {
        signedTx: { txid: 'tx-1', rawTx: '0x', encodedTx: null },
        decodedTx: {
          accountId: request.accountId,
          networkId: request.networkId,
          txid: 'tx-1',
          status: EDecodedTxStatus.Pending,
          owner: 'owner',
          signer: 'owner',
          nonce: 0,
          actions: [],
          extraInfo: null,
        },
      },
    ];
    await params.onSuccess(data);
    expect(mockAddOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        txId: 'tx-1',
        status: EDecodedTxStatus.Pending,
      }),
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(mockAddOrder.mock.invocationCallOrder[0]).toBeLessThan(
      onSuccess.mock.invocationCallOrder[0],
    );
  });

  it('propagates build failures without opening confirmation', async () => {
    const error = new Error('cannot build');
    mockBuildUnstake.mockRejectedValue(error);
    const { result } = renderHook(() => useHandleWithdraw());
    await expect(result.current(request)).rejects.toBe(error);
    expect(mockPrepare).not.toHaveBeenCalled();
    expect(mockPushModal).not.toHaveBeenCalled();
  });

  it('leaves the success callback untouched when order recording fails', async () => {
    const onSuccess = jest.fn();
    const error = new Error('order recording failed');
    mockAddOrder.mockRejectedValue(error);
    const { result } = renderHook(() => useHandleWithdraw());
    await result.current({ ...request, onSuccess });
    const { params } = mockPushModal.mock.calls[0][1] as {
      params: IConfirmationParams;
    };
    const data: ISendTxOnSuccessData[] = [
      {
        signedTx: { txid: 'tx-1', rawTx: '0x', encodedTx: null },
        decodedTx: {
          accountId: request.accountId,
          networkId: request.networkId,
          txid: 'tx-1',
          status: EDecodedTxStatus.Pending,
          owner: 'owner',
          signer: 'owner',
          nonce: 0,
          actions: [],
          extraInfo: null,
        },
      },
    ];
    await expect(params.onSuccess(data)).rejects.toBe(error);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('ignores a late fact belonging to another account', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useHandleWithdraw());
    await result.current({ ...request, onSuccess });
    const { params } = mockPushModal.mock.calls[0][1] as {
      params: IConfirmationParams;
    };
    params.onCancel?.();
    await params.onLateBroadcastAccepted?.({
      uuid: 'request',
      accountId: 'other-account',
      networkId: request.networkId,
      txid: 'late-tx',
    });
    expect(mockAddOrder).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
