/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import {
  EEarnLabels,
  type IStakeTxResponse,
  type IStakingInfo,
  type IWithdrawBaseParams,
} from '@onekeyhq/shared/types/staking';

import { useUniversalWithdraw } from './useUniversalHooks';

const mockNavigate = jest.fn<
  Promise<void>,
  [{ encodedTx?: IEncodedTx; stakingInfo?: IStakingInfo }]
>();
const mockBuildUnstake = jest.fn<
  Promise<IStakeTxResponse>,
  [IWithdrawBaseParams]
>();
const mockBuildInternal = jest.fn<Promise<IEncodedTx>, [unknown]>();
const mockRiskAccepted = jest.fn<Promise<boolean>, [unknown]>();

jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({ navigationToTxConfirm: mockNavigate }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getStakingConfigs: jest.fn(async () => ({})),
      buildUnstakeTransaction: (params: IWithdrawBaseParams) =>
        mockBuildUnstake(params),
      buildInternalDappTx: (params: unknown) => mockBuildInternal(params),
    },
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

describe('useUniversalWithdraw 取消请求', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRiskAccepted.mockResolvedValue(true);
    mockBuildUnstake.mockResolvedValue({ tx, orderId: 'cancel-order' });
    mockBuildInternal.mockResolvedValue(tx);
    mockNavigate.mockResolvedValue(undefined);
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
});
