/** @jest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EEarnLabels,
  type IStakeTxResponse,
  type IStakingInfo,
  type IWithdrawBaseParams,
} from '@onekeyhq/shared/types/staking';
import {
  EDecodedTxStatus,
  type ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

import { useUniversalWithdraw } from './useUniversalHooks';

const mockNavigate = jest.fn<
  Promise<void>,
  [
    {
      encodedTx?: IEncodedTx;
      stakingInfo?: IStakingInfo;
      onBeforeSend?: () => void | Promise<void>;
      onSuccess?: (data: ISendTxOnSuccessData[]) => void | Promise<void>;
    },
  ]
>();
const mockBuildUnstake = jest.fn<
  Promise<IStakeTxResponse>,
  [IWithdrawBaseParams]
>();
const mockBuildInternal = jest.fn<Promise<IEncodedTx>, [unknown]>();
const mockRiskAccepted = jest.fn<Promise<boolean>, [unknown]>();
const mockAddEarnOrder = jest.fn<Promise<void>, [unknown]>();
const mockShowToastOfError = jest.fn<void, [unknown]>();

jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({ navigationToTxConfirm: mockNavigate }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccountAddressForApi: jest.fn(
        async () => '0x1111111111111111111111111111111111111111',
      ),
    },
    serviceStaking: {
      getStakingConfigs: jest.fn(async () => ({})),
      buildUnstakeTransaction: (params: IWithdrawBaseParams) =>
        mockBuildUnstake(params),
      buildInternalDappTx: (params: unknown) => mockBuildInternal(params),
      addEarnOrder: (params: unknown) => mockAddEarnOrder(params),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {
    showToastOfError: (error: unknown) => mockShowToastOfError(error),
    toastIfError: jest.fn(),
  },
}));

jest.mock('../components/EarnRiskWarningDialog', () => ({
  useEarnRiskWarningGate: () => mockRiskAccepted,
}));

jest.mock('../components/EstimateNetworkFee', () => ({
  useShowClaimEstimateGasAlert: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => ({
  waitForTxFinalStatus: jest.fn(),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const account = { accountId: 'account-1', networkId: 'evm--1' };
const protocolVault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
const identity = `0x${'12'.repeat(32)}`;
const tx = {
  from: '0x1111111111111111111111111111111111111111',
  to: '0x0d2df071207e18ca8638b4f04e98c53155ec2ce0',
  value: '0x0',
  data: '0x1234',
};
const params = {
  amount: '0',
  symbol: 'eETH',
  provider: 'etherfi',
  protocolVault,
  identity,
  withdrawType: 'cancel' as const,
  withdrawAll: false,
  stakingInfo: { label: EEarnLabels.Withdraw, protocol: 'EtherFi', tags: [] },
};

function submittedData(): ISendTxOnSuccessData[] {
  return [
    {
      signedTx: { txid: 'withdraw-tx', rawTx: '0x', encodedTx: null },
      decodedTx: {
        ...account,
        txid: 'withdraw-tx',
        status: EDecodedTxStatus.Pending,
        owner: tx.from,
        signer: tx.from,
        nonce: 0,
        actions: [],
        extraInfo: null,
      },
    },
  ];
}

describe('useUniversalWithdraw 取消请求', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRiskAccepted.mockResolvedValue(true);
    mockBuildUnstake.mockResolvedValue({ tx, orderId: 'cancel-order' });
    mockBuildInternal.mockResolvedValue(tx);
    mockNavigate.mockResolvedValue(undefined);
    mockAddEarnOrder.mockResolvedValue(undefined);
  });

  it('保留请求 ID 并打开对应取消交易的签名确认页', async () => {
    const { result } = renderHook(() => useUniversalWithdraw(account));

    await expect(result.current(params)).resolves.toBe(true);

    expect(mockBuildUnstake).toHaveBeenCalledWith(
      expect.objectContaining({
        ...account,
        amount: '0',
        symbol: 'eETH',
        provider: 'etherfi',
        protocolVault,
        identity,
        withdrawType: 'cancel',
        withdrawAll: false,
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        encodedTx: tx,
        stakingInfo: { ...params.stakingInfo, orderId: 'cancel-order' },
      }),
    );
  });

  it.each(['cancel', 'queued'] as const)(
    'rechecks the %s action scope immediately before sending',
    async (withdrawType) => {
      let current = true;
      const { result } = renderHook(() => useUniversalWithdraw(account));
      await expect(
        result.current({
          ...params,
          withdrawType,
          isActionCurrent: () => current,
          isSendCurrent: () => current,
        }),
      ).resolves.toBe(true);
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      const beforeSend = mockNavigate.mock.calls[0][0].onBeforeSend;
      expect(beforeSend).toEqual(expect.any(Function));
      await expect(
        Promise.resolve().then(() => beforeSend?.()),
      ).resolves.toBeUndefined();

      current = false;
      await expect(
        Promise.resolve().then(() => beforeSend?.()),
      ).rejects.toThrow();
    },
  );

  it.each(['cancel', 'queued'] as const)(
    'records a submitted %s order after the send scope becomes stale without calling the old page',
    async (withdrawType) => {
      let sendCurrent = true;
      const onSuccess = jest.fn();
      const { result } = renderHook(() => useUniversalWithdraw(account));
      await expect(
        result.current({
          ...params,
          withdrawType,
          isSendCurrent: () => sendCurrent,
          onSuccess,
        }),
      ).resolves.toBe(true);
      const confirmation = mockNavigate.mock.calls[0][0];
      await confirmation.onBeforeSend?.();
      sendCurrent = false;
      const data: ISendTxOnSuccessData[] = [
        {
          signedTx: { txid: 'withdraw-tx', rawTx: '0x', encodedTx: null },
          decodedTx: {
            ...account,
            txid: 'withdraw-tx',
            status: EDecodedTxStatus.Pending,
            owner: tx.from,
            signer: tx.from,
            nonce: 0,
            actions: [],
            extraInfo: null,
          },
        },
      ];
      await confirmation.onSuccess?.(data);
      expect(mockAddEarnOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'cancel-order',
          networkId: account.networkId,
          txId: 'withdraw-tx',
          status: EDecodedTxStatus.Pending,
        }),
      );
      expect(onSuccess).not.toHaveBeenCalled();
    },
  );

  it('records a submitted withdrawal order and calls the current page', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({ ...params, isSendCurrent: () => true, onSuccess }),
    ).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    await confirmation.onBeforeSend?.();
    const data: ISendTxOnSuccessData[] = [
      {
        signedTx: { txid: 'withdraw-tx', rawTx: '0x', encodedTx: null },
        decodedTx: {
          ...account,
          txid: 'withdraw-tx',
          status: EDecodedTxStatus.Pending,
          owner: tx.from,
          signer: tx.from,
          nonce: 0,
          actions: [],
          extraInfo: null,
        },
      },
    ];
    await confirmation.onSuccess?.(data);
    expect(mockAddEarnOrder).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(data);
  });

  it('refreshes the current page after submission even when the send guard becomes blocked', async () => {
    let sendAllowed = true;
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({
        ...params,
        isSendCurrent: () => sendAllowed,
        isResultCurrent: () => true,
        onSuccess,
      }),
    ).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    await confirmation.onBeforeSend?.();
    sendAllowed = false;
    const data = submittedData();
    await confirmation.onSuccess?.(data);
    expect(mockAddEarnOrder).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(data);
  });

  it('reports a recording error without retrying the submitted transaction and refreshes the current page', async () => {
    const error = new OneKeyLocalError('Order recording failed');
    mockAddEarnOrder.mockRejectedValueOnce(error);
    const onSuccess = jest.fn();
    const onFail = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({
        ...params,
        isSendCurrent: () => true,
        isResultCurrent: () => true,
        onSuccess,
        onFail,
      }),
    ).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    await confirmation.onBeforeSend?.();
    const data = submittedData();
    await expect(
      Promise.resolve().then(() => confirmation.onSuccess?.(data)),
    ).resolves.toBeUndefined();
    expect(mockAddEarnOrder).toHaveBeenCalledTimes(1);
    expect(mockShowToastOfError).toHaveBeenCalledWith(error);
    expect(onFail).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(data);
    expect(mockBuildUnstake).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('preserves the old order-recording failure behavior when no send or result guard is supplied', async () => {
    const error = new OneKeyLocalError('Order recording failed');
    mockAddEarnOrder.mockRejectedValueOnce(error);
    const onSuccess = jest.fn();
    const onFail = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({ ...params, provider: 'lido', onSuccess, onFail }),
    ).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    await expect(confirmation.onBeforeSend?.()).resolves.toBeUndefined();
    await expect(
      Promise.resolve().then(() => confirmation.onSuccess?.(submittedData())),
    ).rejects.toBe(error);
    expect(mockAddEarnOrder).toHaveBeenCalledTimes(1);
    expect(mockShowToastOfError).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFail).not.toHaveBeenCalled();
  });

  it('does not call the old page when the send scope changes while the order is being recorded', async () => {
    let sendCurrent = true;
    let finishOrder: () => void = () => undefined;
    mockAddEarnOrder.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishOrder = resolve)),
    );
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({
        ...params,
        isSendCurrent: () => sendCurrent,
        onSuccess,
      }),
    ).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    await confirmation.onBeforeSend?.();
    const data: ISendTxOnSuccessData[] = [
      {
        signedTx: { txid: 'withdraw-tx', rawTx: '0x', encodedTx: null },
        decodedTx: {
          ...account,
          txid: 'withdraw-tx',
          status: EDecodedTxStatus.Pending,
          owner: tx.from,
          signer: tx.from,
          nonce: 0,
          actions: [],
          extraInfo: null,
        },
      },
    ];
    const pending = confirmation.onSuccess?.(data);
    expect(mockAddEarnOrder).toHaveBeenCalledTimes(1);
    sendCurrent = false;
    finishOrder();
    await pending;
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('keeps the send scope independent of the form scope after opening confirmation', async () => {
    let formCurrent = true;
    let sendCurrent = true;
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({
        ...params,
        isActionCurrent: () => formCurrent,
        isSendCurrent: () => sendCurrent,
      }),
    ).resolves.toBe(true);
    const beforeSend = mockNavigate.mock.calls[0][0].onBeforeSend;
    expect(beforeSend).toEqual(expect.any(Function));

    formCurrent = false;
    await expect(
      Promise.resolve().then(() => beforeSend?.()),
    ).resolves.toBeUndefined();
    sendCurrent = false;
    await expect(
      Promise.resolve().then(() => beforeSend?.()),
    ).rejects.toThrow();
  });

  it('checks the account independently of the form scope after confirmation opens', async () => {
    let formCurrent = true;
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({ ...params, isActionCurrent: () => formCurrent }),
    ).resolves.toBe(true);
    formCurrent = false;
    await expect(
      mockNavigate.mock.calls[0][0].onBeforeSend?.(),
    ).resolves.toBeUndefined();
  });

  it('用户拒绝风险提示时不构造取消交易', async () => {
    mockRiskAccepted.mockResolvedValue(false);
    const { result } = renderHook(() => useUniversalWithdraw(account));

    await expect(result.current(params)).resolves.toBe(false);

    expect(mockBuildUnstake).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('请求已被兑付导致构造失败时不打开签名确认页', async () => {
    const error = new Error('Withdrawal request no longer active');
    mockBuildUnstake.mockRejectedValueOnce(error);
    const { result } = renderHook(() => useUniversalWithdraw(account));

    await expect(result.current(params)).rejects.toThrow(error);

    expect(mockBuildInternal).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not build a withdrawal after the action scope changes during the risk prompt', async () => {
    let finishRisk: (accepted: boolean) => void = () => undefined;
    mockRiskAccepted.mockImplementationOnce(
      () => new Promise((resolve) => (finishRisk = resolve)),
    );
    let current = true;
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current({
      ...params,
      withdrawType: 'queued',
      isActionCurrent: () => current,
    });
    current = false;
    finishRisk(true);

    await expect(operation).resolves.toBe(false);
    expect(mockBuildUnstake).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not open confirmation when the action scope changes during transaction construction', async () => {
    let finishBuild: (value: IStakeTxResponse) => void = () => undefined;
    mockBuildUnstake.mockImplementationOnce(
      () => new Promise((resolve) => (finishBuild = resolve)),
    );
    let current = true;
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current({
      ...params,
      withdrawType: 'queued',
      isActionCurrent: () => current,
    });
    await waitFor(() => expect(mockBuildUnstake).toHaveBeenCalledTimes(1));
    current = false;
    finishBuild({ tx, orderId: 'order' });

    await expect(operation).resolves.toBe(false);
    expect(mockBuildInternal).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
