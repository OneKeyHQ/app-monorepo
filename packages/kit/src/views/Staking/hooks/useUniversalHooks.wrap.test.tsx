/** @jest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  EtherFiLiquidReferContract,
  EthereumWETH,
} from '@onekeyhq/shared/src/consts/addresses';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import {
  EEarnLabels,
  type IEarnStakeType,
  type IStakeTxResponse,
  type IStakingInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';
import {
  EDecodedTxStatus,
  type ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

import { useUniversalStake } from './useUniversalHooks';

type IConfirmParams = {
  encodedTx?: IEncodedTx;
  stakingInfo?: IStakingInfo;
  approvesInfo?: IApproveInfo[];
  onSuccess?: (data: ISendTxOnSuccessData[]) => void | Promise<void>;
  onFail?: (error: Error) => void;
  onCancel?: () => void;
};
type IAllowance = { allowance: string; allowanceParsed: string };

const mockNavigate = jest.fn<Promise<void>, [IConfirmParams]>();
const mockBuildStake = jest.fn<
  Promise<IStakeTxResponse>,
  [{ stakeType?: IEarnStakeType }]
>();
const mockBuildInternal = jest.fn<Promise<IEncodedTx>, [unknown]>();
const mockAllowance = jest.fn<Promise<IAllowance>, [unknown]>();
const mockGetAccount = jest.fn<Promise<{ address: string }>, [unknown]>();
const mockTrackOrder = jest.fn<Promise<void>, [unknown]>();
const mockWaitForFinal = jest.fn<
  Promise<EOnChainHistoryTxStatus | undefined>,
  [unknown]
>();
const mockRiskAccepted = jest.fn<Promise<boolean>, [unknown]>();
const mockToastError = jest.fn<void, [unknown]>();

jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({ navigationToTxConfirm: mockNavigate }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      buildStakeTransaction: (input: { stakeType?: IEarnStakeType }) =>
        mockBuildStake(input),
      buildInternalDappTx: (input: unknown) => mockBuildInternal(input),
      fetchTokenAllowance: (input: unknown) => mockAllowance(input),
      addEarnOrder: (input: unknown) => mockTrackOrder(input),
    },
    serviceAccount: {
      getAccount: (input: unknown) => mockGetAccount(input),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => ({
  waitForTxFinalStatus: (input: unknown) => mockWaitForFinal(input),
}));

jest.mock('../components/EarnRiskWarningDialog', () => ({
  showEarnRiskWarningDialog: (input: unknown) => mockRiskAccepted(input),
  useEarnRiskWarningGate: () => mockRiskAccepted,
}));

jest.mock('../components/EstimateNetworkFee', () => ({
  useShowClaimEstimateGasAlert: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/timerUtils')
  >('@onekeyhq/shared/src/utils/timerUtils');
  return {
    __esModule: true,
    default: { ...actual.default, wait: jest.fn(async () => undefined) },
  };
});

jest.mock('@onekeyhq/components', () => ({
  Toast: { error: (input: unknown) => mockToastError(input) },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const account = {
  accountId: 'account-1',
  networkId: 'evm--1',
};
const owner = '0x1111111111111111111111111111111111111111';
const vault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
const weth: IToken = {
  address: EthereumWETH,
  symbol: 'WETH',
  name: 'Wrapped Ether',
  decimals: 18,
  isNative: false,
};
const eth: IToken = {
  address: '',
  symbol: 'ETH',
  name: 'Ether',
  decimals: 18,
  isNative: true,
};
const stakingInfo: IStakingInfo = {
  protocol: 'EtherFi',
  label: EEarnLabels.Stake,
  tags: [EEarnLabels.Stake],
  send: { amount: '1', token: eth },
};
const params: Parameters<ReturnType<typeof useUniversalStake>>[0] = {
  amount: '1',
  symbol: 'ETH',
  provider: 'etherfi',
  protocolVault: vault,
  inputTokenAddress: '',
  stakeType: 'wrap',
  postWrapStakeToken: weth,
  postWrapApproveSpenderAddress: EtherFiLiquidReferContract,
  stakingInfo,
};
const wrapTx = {
  from: owner,
  to: EthereumWETH,
  value: '0xde0b6b3a7640000',
  data: '0xd0e30db0',
};
const depositTx = {
  from: owner,
  to: EtherFiLiquidReferContract,
  value: '0x0',
  data: '0x1234',
};

function successData(txid: string): ISendTxOnSuccessData[] {
  return [
    {
      signedTx: { txid, rawTx: '0x', encodedTx: null },
      decodedTx: {
        ...account,
        txid,
        status: EDecodedTxStatus.Pending,
        owner,
        signer: owner,
        nonce: 0,
        actions: [],
        extraInfo: null,
      },
    },
  ];
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function allowance(amount: string): IAllowance {
  return { allowance: amount, allowanceParsed: amount };
}

describe('useUniversalStake EtherFi ETH wrapping', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRiskAccepted.mockResolvedValue(true);
    mockBuildStake.mockImplementation(async ({ stakeType }) => ({
      tx: stakeType === 'wrap' ? wrapTx : depositTx,
      orderId: stakeType === 'wrap' ? undefined : 'deposit-order',
    }));
    mockBuildInternal
      .mockResolvedValueOnce(wrapTx)
      .mockResolvedValue(depositTx);
    mockAllowance.mockResolvedValue(allowance('1'));
    mockGetAccount.mockResolvedValue({ address: owner });
    mockWaitForFinal.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    mockTrackOrder.mockResolvedValue(undefined);
    mockNavigate.mockImplementation(async ({ encodedTx, onSuccess }) => {
      await onSuccess?.(
        successData(encodedTx === wrapTx ? 'wrap-tx' : 'deposit-tx'),
      );
    });
  });

  it('waits for wrap finality and WETH approval before depositing into the original vault', async () => {
    const wrapFinality = deferred<EOnChainHistoryTxStatus>();
    const approvedAllowance = deferred<IAllowance>();
    const onSuccess = jest.fn();
    const onStepChange = jest.fn();
    mockNavigate.mockResolvedValue(undefined);
    mockWaitForFinal.mockReturnValue(wrapFinality.promise);
    mockAllowance
      .mockResolvedValueOnce(allowance('0'))
      .mockReturnValueOnce(approvedAllowance.promise);
    const { result } = renderHook(() => useUniversalStake(account));

    const submit = result.current({ ...params, onSuccess, onStepChange });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    expect(mockNavigate.mock.calls[0][0].stakingInfo).toBeUndefined();
    expect(mockWaitForFinal).not.toHaveBeenCalled();
    expect(mockAllowance).not.toHaveBeenCalled();

    await mockNavigate.mock.calls[0][0].onSuccess?.(successData('wrap-tx'));
    await waitFor(() =>
      expect(mockWaitForFinal).toHaveBeenCalledWith({
        ...account,
        txid: 'wrap-tx',
      }),
    );
    expect(mockAllowance).not.toHaveBeenCalled();
    expect(mockBuildStake).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();

    wrapFinality.resolve(EOnChainHistoryTxStatus.Success);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));
    expect(mockAllowance).toHaveBeenCalledWith({
      ...account,
      tokenAddress: EthereumWETH,
      spenderAddress: EtherFiLiquidReferContract,
    });
    expect(mockNavigate.mock.calls[1][0].approvesInfo).toEqual([
      {
        owner,
        spender: EtherFiLiquidReferContract,
        amount: '1',
        tokenInfo: weth,
      },
    ]);
    expect(mockBuildStake).toHaveBeenCalledTimes(1);

    await mockNavigate.mock.calls[1][0].onSuccess?.(successData('approve-tx'));
    await waitFor(() => expect(mockAllowance).toHaveBeenCalledTimes(2));
    expect(mockBuildStake).toHaveBeenCalledTimes(1);
    approvedAllowance.resolve(allowance('1'));
    await expect(submit).resolves.toBe(true);

    expect(mockBuildStake).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        ...account,
        provider: 'etherfi',
        symbol: 'ETH',
        amount: '1',
        protocolVault: vault,
        stakeType: 'normal',
        inputTokenAddress: EthereumWETH,
      }),
    );
    expect(mockNavigate.mock.calls[2][0].stakingInfo).toEqual({
      ...stakingInfo,
      send: { amount: '1', token: weth },
      orderId: 'deposit-order',
    });
    expect(onStepChange.mock.calls).toEqual([
      [2, { shouldShowPostWrapApproveStep: true }],
      [3],
    ]);
    expect(mockTrackOrder).not.toHaveBeenCalled();
    await mockNavigate.mock.calls[2][0].onSuccess?.(successData('deposit-tx'));
    expect(mockTrackOrder).toHaveBeenCalledTimes(1);
    expect(mockTrackOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'deposit-order',
        txId: 'deposit-tx',
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith(successData('deposit-tx'));
    expect(stakingInfo.send?.token).toBe(eth);
  });

  it.each(['1', '2'])(
    'skips approval when WETH allowance is %s',
    async (amount) => {
      mockAllowance.mockResolvedValue(allowance(amount));
      const onStepChange = jest.fn();
      const { result } = renderHook(() => useUniversalStake(account));

      await expect(result.current({ ...params, onStepChange })).resolves.toBe(
        true,
      );

      expect(mockNavigate).toHaveBeenCalledTimes(2);
      expect(
        mockNavigate.mock.calls.every(([call]) => !call.approvesInfo),
      ).toBe(true);
      expect(mockGetAccount).not.toHaveBeenCalled();
      expect(mockAllowance).toHaveBeenCalledTimes(1);
      expect(onStepChange).toHaveBeenCalledWith(2, {
        shouldShowPostWrapApproveStep: false,
      });
      expect(mockBuildStake.mock.calls[1][0]).toMatchObject({
        stakeType: 'normal',
        inputTokenAddress: EthereumWETH,
        protocolVault: vault,
      });
    },
  );

  it.each(['wrap', 'approve'] as const)(
    'stops when the user cancels %s',
    async (step) => {
      mockAllowance.mockResolvedValueOnce(allowance('0'));
      if (step === 'wrap') {
        mockNavigate.mockImplementationOnce(async ({ onCancel }) =>
          onCancel?.(),
        );
      } else {
        mockNavigate.mockImplementationOnce(async ({ onSuccess }) => {
          await onSuccess?.(successData('wrap-tx'));
        });
        mockNavigate.mockImplementationOnce(async ({ onCancel }) =>
          onCancel?.(),
        );
      }
      const { result } = renderHook(() => useUniversalStake(account));

      await expect(result.current(params)).resolves.toBe(false);

      expect(mockBuildStake).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledTimes(step === 'wrap' ? 1 : 2);
      expect(mockAllowance).toHaveBeenCalledTimes(step === 'wrap' ? 0 : 1);
      expect(mockTrackOrder).not.toHaveBeenCalled();
    },
  );

  it.each(['wrap', 'approve'] as const)(
    'stops and reports a failed %s confirmation',
    async (step) => {
      const error = new Error('Transaction failed');
      const onFail = jest.fn();
      mockAllowance.mockResolvedValueOnce(allowance('0'));
      if (step === 'approve') {
        mockNavigate.mockImplementationOnce(async ({ onSuccess }) => {
          await onSuccess?.(successData('wrap-tx'));
        });
      }
      mockNavigate.mockImplementationOnce(async ({ onFail: fail }) =>
        fail?.(error),
      );
      const { result } = renderHook(() => useUniversalStake(account));

      await expect(result.current({ ...params, onFail })).resolves.toBe(false);

      expect(onFail).toHaveBeenCalledWith(error);
      expect(mockBuildStake).toHaveBeenCalledTimes(1);
      expect(mockTrackOrder).not.toHaveBeenCalled();
    },
  );

  it.each([EOnChainHistoryTxStatus.Failed, undefined])(
    'does not check allowance after unsuccessful wrap finality %s',
    async (status) => {
      mockWaitForFinal.mockResolvedValue(status);
      const { result } = renderHook(() => useUniversalStake(account));

      await expect(result.current(params)).resolves.toBe(false);

      expect(mockAllowance).not.toHaveBeenCalled();
      expect(mockBuildStake).toHaveBeenCalledTimes(1);
      expect(mockToastError).toHaveBeenCalledTimes(1);
    },
  );

  it('does not deposit when approval never becomes sufficient', async () => {
    mockAllowance.mockResolvedValue(allowance('0'));
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(result.current(params)).resolves.toBe(false);

    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockBuildStake).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledTimes(1);
  });

  it.each(['invalid', 'NaN', 'Infinity', '-1'])(
    'does not approve or deposit after an invalid WETH allowance %s',
    async (value) => {
      mockAllowance.mockResolvedValue(allowance(value));
      const { result } = renderHook(() => useUniversalStake(account));

      await expect(result.current(params)).rejects.toThrow(
        'Invalid wrapped token allowance',
      );

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockBuildStake).toHaveBeenCalledTimes(1);
      expect(mockTrackOrder).not.toHaveBeenCalled();
    },
  );

  it('does not continue after a failed allowance query', async () => {
    const error = new Error('Allowance RPC unavailable');
    mockAllowance.mockRejectedValue(error);
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(result.current(params)).rejects.toBe(error);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockBuildStake).toHaveBeenCalledTimes(1);
    expect(mockTrackOrder).not.toHaveBeenCalled();
  });

  it('does not submit any transaction when the risk disclaimer is canceled', async () => {
    mockRiskAccepted.mockResolvedValue(false);
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(result.current(params)).resolves.toBe(false);

    expect(mockBuildStake).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('submits an existing WETH balance directly without wrapping', async () => {
    mockBuildInternal.mockReset().mockResolvedValue(depositTx);
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(
      result.current({
        ...params,
        symbol: 'WETH',
        stakeType: 'normal',
        inputTokenAddress: EthereumWETH,
        stakingInfo: { ...stakingInfo, send: { amount: '1', token: weth } },
      }),
    ).resolves.toBe(true);

    expect(mockBuildStake).toHaveBeenCalledTimes(1);
    expect(mockBuildStake).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'WETH',
        stakeType: 'normal',
        inputTokenAddress: EthereumWETH,
        protocolVault: vault,
      }),
    );
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockWaitForFinal).not.toHaveBeenCalled();
    expect(mockAllowance).not.toHaveBeenCalled();
  });
});
