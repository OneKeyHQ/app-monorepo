/** @jest-environment jsdom */

import {
  StrictMode,
  Suspense,
  startTransition,
  useLayoutEffect,
  useState,
} from 'react';

import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from '@testing-library/react';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  EtherFiLiquidReferContract,
  EthereumWETH,
} from '@onekeyhq/shared/src/consts/addresses';
import { UserCancel } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import {
  EEarnLabels,
  type IEarnStakeType,
  type IStakeTxResponse,
  type IStakingInfo,
} from '@onekeyhq/shared/types/staking';
import type {
  IFetchTokenDetailItem,
  IToken,
} from '@onekeyhq/shared/types/token';
import {
  EDecodedTxStatus,
  type ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

import { useUniversalStake } from './useUniversalHooks';

import type { IDepositTaskHandle } from '../earnDepositTask/types';

type IConfirmParams = {
  encodedTx?: IEncodedTx;
  stakingInfo?: IStakingInfo;
  approvesInfo?: IApproveInfo[];
  onSuccess?: (data: ISendTxOnSuccessData[]) => void | Promise<void>;
  onFail?: (error: Error) => void;
  onCancel?: () => void;
  onBeforeSend?: () => void | Promise<void>;
  isNavigationCurrent?: () => boolean;
};
type IAllowance = { allowance: string; allowanceParsed: string };

const mockNavigate = jest.fn<Promise<void>, [IConfirmParams]>();
const mockBuildStake = jest.fn<
  Promise<IStakeTxResponse>,
  [{ stakeType?: IEarnStakeType }]
>();
const mockBuildInternal = jest.fn<Promise<IEncodedTx>, [unknown]>();
const mockAllowance = jest.fn<Promise<IAllowance>, [unknown]>();
const mockWrappedBalance = jest.fn<
  Promise<IFetchTokenDetailItem[]>,
  [unknown]
>();
const mockGetAccount = jest.fn<Promise<{ address: string }>, [unknown]>();
const mockGetAccountAddress = jest.fn<Promise<string>, [unknown]>();
const mockTrackOrder = jest.fn<
  Promise<
    | void
    | {
        localStatus: 'saved' | 'unavailable';
        remoteStatus: 'failed' | 'synced';
      }
    | { localStatus: 'superseded'; remoteStatus: 'skipped' }
    | { localStatus: 'superseded'; remoteStatus: 'notAttempted' }
    | { localStatus: 'saved'; remoteStatus: 'skipped' }
    | { localStatus: 'failed' | 'unavailable'; remoteStatus: 'notAttempted' }
  >,
  [unknown]
>();
const mockWaitForFinal = jest.fn<
  Promise<EOnChainHistoryTxStatus | undefined>,
  [unknown]
>();
const mockRiskAccepted = jest.fn<Promise<boolean>, [unknown]>();
const mockToastError = jest.fn<void, [unknown]>();
const mockToastMessage = jest.fn<void, [unknown]>();

jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({ navigationToTxConfirm: mockNavigate }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceToken: {
      fetchTokensDetails: (input: unknown) => mockWrappedBalance(input),
    },
    serviceStaking: {
      buildStakeTransaction: (input: { stakeType?: IEarnStakeType }) =>
        mockBuildStake(input),
      buildInternalDappTx: (input: unknown) => mockBuildInternal(input),
      fetchTokenAllowance: (input: unknown) => mockAllowance(input),
      addEarnOrder: (input: unknown) => mockTrackOrder(input),
    },
    serviceAccount: {
      getAccount: (input: unknown) => mockGetAccount(input),
      getAccountAddressForApi: (input: unknown) => mockGetAccountAddress(input),
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
  Toast: {
    error: (input: unknown) => mockToastError(input),
    message: (input: unknown) => mockToastMessage(input),
  },
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
  taskAccountAddress: owner,
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

function decodedOnlySuccessData(txid: string): ISendTxOnSuccessData[] {
  return successData(txid).map((data) => ({
    ...data,
    signedTx: { ...data.signedTx, txid: '' },
  }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function confirmationTxid(
  encodedTx: IEncodedTx | undefined,
  approvesInfo: IApproveInfo[] | undefined,
) {
  if (approvesInfo) return 'approve-tx';
  return encodedTx === wrapTx ? 'wrap-tx' : 'deposit-tx';
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
    mockWrappedBalance.mockResolvedValue([
      {
        info: weth,
        balance: '100000000000000000000',
        balanceParsed: '100',
        fiatValue: '0',
        price: 0,
      },
    ]);
    mockGetAccount.mockResolvedValue({ address: owner });
    mockGetAccountAddress.mockResolvedValue(owner);
    mockWaitForFinal.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    mockTrackOrder.mockResolvedValue({
      localStatus: 'saved',
      remoteStatus: 'synced',
    });
    mockNavigate.mockImplementation(async ({ encodedTx, onSuccess }) => {
      await onSuccess?.(
        successData(encodedTx === wrapTx ? 'wrap-tx' : 'deposit-tx'),
      );
    });
  });

  it.each(['wrap', 'direct'] as const)(
    'rejects %s confirmation if the account address changed without changing accountId',
    async (mode) => {
      const otherAddress = '0x2222222222222222222222222222222222222222';
      mockGetAccountAddress
        .mockResolvedValueOnce(owner)
        .mockResolvedValueOnce(otherAddress);
      const broadcast = jest.fn();
      mockNavigate.mockImplementation(
        async ({ onBeforeSend, onSuccess, onFail }) => {
          try {
            await onBeforeSend?.();
            broadcast();
            await onSuccess?.(successData('tx'));
          } catch (error) {
            onFail?.(error instanceof Error ? error : new Error(String(error)));
          }
        },
      );
      const { result } = renderHook(() => useUniversalStake(account));
      const directParams =
        mode === 'direct'
          ? {
              stakeType: 'normal' as const,
              inputTokenAddress: weth.address,
              directDepositTask: {
                token: weth,
                spenderAddress: EtherFiLiquidReferContract,
                requiresAllowanceReset: false,
                confirmReset: async () => true,
                prepareDeposit: async () => ({ type: 'confirm' as const }),
              },
            }
          : {};
      await expect(
        result.current({
          ...params,
          ...directParams,
          taskMode: 'deposit',
          onFail: jest.fn(),
        }),
      ).resolves.toBe(false);
      expect(mockGetAccountAddress).toHaveBeenCalledTimes(2);
      expect(broadcast).not.toHaveBeenCalled();
      expect(mockTrackOrder).not.toHaveBeenCalled();
    },
  );

  it('does not create a task when the visible account address is already stale', async () => {
    mockGetAccountAddress.mockResolvedValue(
      '0x2222222222222222222222222222222222222222',
    );
    const onDepositTaskReady = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        taskAccountAddress: owner,
        onDepositTaskReady,
        onFail: jest.fn(),
      }),
    ).rejects.toThrow();
    expect(onDepositTaskReady).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it.each(['wrap', 'direct'] as const)(
    'does not open %s confirmation when the built transaction belongs to another address',
    async (mode) => {
      mockBuildInternal.mockReset().mockResolvedValue({
        ...depositTx,
        from: '0x2222222222222222222222222222222222222222',
      });
      const { result } = renderHook(() => useUniversalStake(account));
      const directParams =
        mode === 'direct'
          ? {
              stakeType: 'normal' as const,
              inputTokenAddress: weth.address,
              directDepositTask: {
                token: weth,
                spenderAddress: EtherFiLiquidReferContract,
                requiresAllowanceReset: false,
                confirmReset: async () => true,
                prepareDeposit: async () => ({ type: 'confirm' as const }),
              },
            }
          : {};
      await expect(
        result.current({
          ...params,
          ...directParams,
          taskMode: 'deposit',
          onFail: jest.fn(),
        }),
      ).resolves.toBe(false);
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockTrackOrder).not.toHaveBeenCalled();
    },
  );

  it('does not open an approval for an account other than the frozen task owner', async () => {
    mockAllowance.mockResolvedValue(allowance('0'));
    mockGetAccount.mockResolvedValue({
      address: '0x2222222222222222222222222222222222222222',
    });
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        stakeType: 'normal',
        inputTokenAddress: weth.address,
        taskMode: 'deposit',
        directDepositTask: {
          token: weth,
          spenderAddress: EtherFiLiquidReferContract,
          requiresAllowanceReset: false,
          confirmReset: async () => true,
          prepareDeposit: async () => ({ type: 'confirm' }),
        },
        onFail: jest.fn(),
      }),
    ).resolves.toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockTrackOrder).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'continues a pending A task according to whether B commits: %s',
    async (commitSecondScope) => {
      const pendingBuild = deferred<IStakeTxResponse>();
      const onTaskReady = jest.fn<void, [IDepositTaskHandle]>();
      const renderSecondScope = jest.fn();
      const suspended = new Promise<void>(() => undefined);
      let running: Promise<boolean> | undefined;
      mockBuildStake.mockReturnValueOnce(pendingBuild.promise);
      mockNavigate.mockImplementation(
        async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
          await onBeforeSend?.();
          await onSuccess?.(
            successData(confirmationTxid(encodedTx, approvesInfo)),
          );
        },
      );

      function Form({ scopeKey }: { scopeKey: string }) {
        const stake = useUniversalStake({ ...account, scopeKey });
        if (scopeKey === 'second') {
          renderSecondScope();
          if (!commitSecondScope) throw suspended;
        }
        return (
          <div>
            <span data-testid="scope">{scopeKey}</span>
            <button
              type="button"
              onClick={() => {
                running = stake({
                  ...params,
                  taskMode: 'deposit',
                  onDepositTaskReady: onTaskReady,
                });
              }}
            >
              Start task
            </button>
          </div>
        );
      }

      function Harness() {
        const [scopeKey, setScopeKey] = useState('first');
        return (
          <>
            <button
              type="button"
              onClick={() => startTransition(() => setScopeKey('second'))}
            >
              Switch scope
            </button>
            <button type="button" onClick={() => setScopeKey('first')}>
              Abandon transition
            </button>
            <Suspense fallback={<span>loading</span>}>
              <Form scopeKey={scopeKey} />
            </Suspense>
          </>
        );
      }

      const screen = render(<Harness />);
      fireEvent.click(screen.getByText('Start task'));
      await waitFor(() => expect(mockBuildStake).toHaveBeenCalledTimes(1));
      expect(onTaskReady).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByText('Switch scope'));
      await waitFor(() => expect(renderSecondScope).toHaveBeenCalled());
      if (commitSecondScope) {
        await waitFor(() =>
          expect(screen.getByTestId('scope').textContent).toBe('second'),
        );
      } else {
        expect(screen.getByTestId('scope').textContent).toBe('first');
        fireEvent.click(screen.getByText('Abandon transition'));
        expect(screen.getByTestId('scope').textContent).toBe('first');
      }

      await act(async () => {
        pendingBuild.resolve({ tx: wrapTx });
        await expect(running).resolves.toBe(!commitSecondScope);
      });
      if (commitSecondScope) {
        expect(mockNavigate).not.toHaveBeenCalled();
        expect(mockTrackOrder).not.toHaveBeenCalled();
      } else {
        expect(mockNavigate).toHaveBeenCalledTimes(2);
        expect(mockTrackOrder).toHaveBeenCalledTimes(1);
      }
    },
  );

  it('does not abort a new scope task when the old scope effect cleans up', async () => {
    const pendingBuild = deferred<IStakeTxResponse>();
    const onTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    let currentStake: ReturnType<typeof useUniversalStake> | undefined;
    let changeScope: (scope: string) => void = () => undefined;
    let running: Promise<boolean> | undefined;
    mockBuildStake.mockReturnValueOnce(pendingBuild.promise);
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );

    function Owner({ scopeKey }: { scopeKey: string }) {
      const stake = useUniversalStake({ ...account, scopeKey });
      useLayoutEffect(() => {
        currentStake = stake;
      }, [stake]);
      return null;
    }
    function StartOnCommit({ scopeKey }: { scopeKey: string }) {
      useLayoutEffect(() => {
        if (scopeKey === 'second') {
          running = currentStake?.({
            ...params,
            taskMode: 'deposit',
            onDepositTaskReady: onTaskReady,
          });
        }
      }, [scopeKey]);
      return null;
    }
    function Harness() {
      const [scopeKey, setScopeKey] = useState('first');
      useLayoutEffect(() => {
        changeScope = setScopeKey;
      }, []);
      return (
        <>
          <Owner scopeKey={scopeKey} />
          <StartOnCommit scopeKey={scopeKey} />
        </>
      );
    }

    const screen = render(<Harness />);
    const previousActEnvironment = Reflect.get(
      globalThis,
      'IS_REACT_ACT_ENVIRONMENT',
    );
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', false);
    try {
      startTransition(() => changeScope('second'));
      await waitFor(() => expect(onTaskReady).toHaveBeenCalledTimes(1));
      expect(onTaskReady.mock.calls[0][0].getTask().steps[0].status.type).toBe(
        'preparing',
      );
      pendingBuild.resolve({ tx: wrapTx });
      await expect(running).resolves.toBe(true);
      expect(mockNavigate).toHaveBeenCalledTimes(2);
    } finally {
      screen.unmount();
      Reflect.set(
        globalThis,
        'IS_REACT_ACT_ENVIRONMENT',
        previousActEnvironment,
      );
    }
  });

  it('runs the EtherFi wrap, approval and deposit through the deposit task', async () => {
    mockAllowance
      .mockResolvedValueOnce(allowance('0'))
      .mockResolvedValue(allowance('1'));
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const onSuccess = jest.fn();
    const onStepChange = jest.fn();
    const onWrapStateChange = jest.fn();
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const beforeDepositTaskSend = jest.fn(
      async (_step: 'wrap' | 'resetApproval' | 'approve' | 'deposit') => true,
    );
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        onSuccess,
        onStepChange,
        onWrapStateChange,
        onDepositTaskReady,
        beforeDepositTaskSend,
      }),
    ).resolves.toBe(true);
    expect(mockNavigate).toHaveBeenCalledTimes(3);
    expect(mockWaitForFinal.mock.calls.map(([input]) => input)).toEqual([
      expect.objectContaining({ txid: 'wrap-tx' }),
      expect.objectContaining({ txid: 'approve-tx' }),
    ]);
    expect(mockBuildStake.mock.calls.map(([input]) => input.stakeType)).toEqual(
      ['wrap', 'normal'],
    );
    expect(
      onDepositTaskReady.mock.calls[0][0]
        .getTask()
        .steps.map((step) => step.status.type),
    ).toEqual(['succeeded', 'succeeded', 'handedOff']);
    expect(onWrapStateChange).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(beforeDepositTaskSend.mock.calls).toEqual([
      ['wrap'],
      ['wrap'],
      ['approve'],
      ['approve'],
      ['deposit'],
      ['deposit'],
    ]);
    expect(onStepChange).not.toHaveBeenCalled();
  });

  it('does not request approval or deposit when the wrapped balance is insufficient', async () => {
    mockWrappedBalance.mockResolvedValue([
      {
        info: weth,
        balance: '900000000000000000',
        balanceParsed: '0.9',
        fiatValue: '0',
        price: 0,
      },
    ]);
    const onFail = jest.fn();
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        onFail,
        onDepositTaskReady,
      }),
    ).resolves.toBe(false);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockBuildStake.mock.calls.map(([input]) => input.stakeType)).toEqual(
      ['wrap'],
    );
    expect(onFail).toHaveBeenCalled();
    expect(
      onDepositTaskReady.mock.calls[0][0].getTask().steps[1].status,
    ).toEqual({
      type: 'failed',
      stage: 'beforeSend',
    });
    expect(mockWrappedBalance).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: account.accountId,
        networkId: account.networkId,
        expectedAccountAddress: owner,
        contractList: [EthereumWETH],
      }),
    );
    mockWrappedBalance.mockResolvedValue([
      {
        info: weth,
        balance: '1000000000000000000',
        balanceParsed: '1',
        fiatValue: '0',
        price: 0,
      },
    ]);
    await onDepositTaskReady.mock.calls[0][0].retry();
    expect(mockBuildStake.mock.calls.map(([input]) => input.stakeType)).toEqual(
      ['wrap', 'normal'],
    );
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  it('reapproves without wrapping again when allowance decreases before a rejected deposit build', async () => {
    let currentAllowance = '0';
    let depositBuilds = 0;
    mockAllowance.mockImplementation(async () => allowance(currentAllowance));
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        if (approvesInfo) currentAllowance = '1';
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const rejectedBuild = new Error('Insufficient allowance');
    mockBuildStake.mockImplementation(async ({ stakeType }) => {
      if (stakeType === 'wrap') return { tx: wrapTx };
      depositBuilds += 1;
      if (depositBuilds === 1) currentAllowance = '0';
      if (currentAllowance !== '1') throw rejectedBuild;
      return { tx: depositTx, orderId: 'deposit-order' };
    });
    const prepareWrappedDeposit = jest
      .fn()
      .mockResolvedValue({ type: 'confirm' });
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const onFail = jest.fn();
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        prepareWrappedDeposit,
        onDepositTaskReady,
        onFail,
        onSuccess,
      }),
    ).resolves.toBe(false);
    expect(onFail).toHaveBeenCalledWith(rejectedBuild);
    expect(mockWaitForFinal).toHaveBeenCalledTimes(2);
    expect(mockNavigate).toHaveBeenCalledTimes(2);

    await onDepositTaskReady.mock.calls[0][0].retry();

    expect(
      mockNavigate.mock.calls.map(([confirmation]) =>
        confirmationTxid(confirmation.encodedTx, confirmation.approvesInfo),
      ),
    ).toEqual(['wrap-tx', 'approve-tx', 'approve-tx', 'deposit-tx']);
    expect(
      mockBuildStake.mock.calls.map(([request]) => request.stakeType),
    ).toEqual(['wrap', 'normal', 'normal']);
    expect(prepareWrappedDeposit).toHaveBeenCalledTimes(2);
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('blocks a deposit when allowance decreases in confirmation and reapproves on retry', async () => {
    let currentAllowance = '0';
    let depositConfirmations = 0;
    const submitted: string[] = [];
    mockAllowance.mockImplementation(async () => allowance(currentAllowance));
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        const txid = confirmationTxid(encodedTx, approvesInfo);
        if (txid === 'deposit-tx') {
          depositConfirmations += 1;
          if (depositConfirmations === 1) currentAllowance = '0';
        }
        await onBeforeSend?.();
        submitted.push(txid);
        if (approvesInfo) currentAllowance = '1';
        await onSuccess?.(successData(txid));
      },
    );
    const prepareWrappedDeposit = jest
      .fn()
      .mockResolvedValue({ type: 'confirm' });
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const onFail = jest.fn();
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        prepareWrappedDeposit,
        onDepositTaskReady,
        onFail,
        onSuccess,
      }),
    ).resolves.toBe(false);
    const task = onDepositTaskReady.mock.calls[0][0];
    expect(task.getTask().steps[task.getTask().currentStepIndex]).toEqual(
      expect.objectContaining({
        kind: 'deposit',
        status: { type: 'failed', stage: 'beforeSend' },
      }),
    );
    expect(onFail).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Token allowance changed before deposit',
      }),
    );
    expect(submitted).toEqual(['wrap-tx', 'approve-tx']);
    expect(onSuccess).not.toHaveBeenCalled();

    await task.retry();

    expect(submitted).toEqual([
      'wrap-tx',
      'approve-tx',
      'approve-tx',
      'deposit-tx',
    ]);
    expect(
      mockBuildStake.mock.calls.map(([request]) => request.stakeType),
    ).toEqual(['wrap', 'normal', 'normal']);
    expect(prepareWrappedDeposit).toHaveBeenCalledTimes(2);
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('does not report approval complete if its task is disposed while allowance is loading', async () => {
    const pending = deferred<IAllowance>();
    mockAllowance
      .mockResolvedValueOnce(allowance('0'))
      .mockImplementationOnce(() => pending.promise);
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const onStepChange = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));
    const running = result.current({
      ...params,
      taskMode: 'deposit',
      onDepositTaskReady,
      onStepChange,
    });
    await waitFor(() => expect(mockAllowance).toHaveBeenCalledTimes(2));
    onDepositTaskReady.mock.calls[0][0].dispose();
    pending.resolve(allowance('1'));
    await expect(running).resolves.toBe(false);
    expect(onStepChange.mock.calls.some(([step]) => step === 3)).toBe(false);
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  it.each(['cancelled', 'failed'] as const)(
    're-prepares a WETH deposit after preparation is %s',
    async (firstResult) => {
      mockAllowance
        .mockResolvedValueOnce(allowance('0'))
        .mockResolvedValue(allowance('1'));
      mockNavigate.mockImplementation(
        async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
          await onBeforeSend?.();
          await onSuccess?.(
            successData(confirmationTxid(encodedTx, approvesInfo)),
          );
        },
      );
      const prepareWrappedDeposit = jest
        .fn()
        .mockImplementationOnce(async (signal: AbortSignal) => {
          expect(signal.aborted).toBe(false);
          expect(mockWaitForFinal).toHaveBeenCalledTimes(2);
          if (firstResult === 'failed')
            return Promise.reject(new Error('quote unavailable'));
          return { type: 'cancelled' };
        })
        .mockResolvedValueOnce({ type: 'confirm', effectiveApy: '4.56' });
      const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
      const onFail = jest.fn();
      const { result } = renderHook(() => useUniversalStake(account));

      await expect(
        result.current({
          ...params,
          effectiveApy: 'stale',
          taskMode: 'deposit',
          prepareWrappedDeposit,
          onDepositTaskReady,
          onFail,
        }),
      ).resolves.toBe(false);
      expect(prepareWrappedDeposit).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledTimes(2);
      expect(
        mockBuildStake.mock.calls.map(([input]) => input.stakeType),
      ).toEqual(['wrap']);
      expect(onFail).toHaveBeenCalledTimes(firstResult === 'failed' ? 1 : 0);

      await onDepositTaskReady.mock.calls[0][0].retry();
      expect(prepareWrappedDeposit).toHaveBeenCalledTimes(2);
      expect(mockNavigate).toHaveBeenCalledTimes(3);
      expect(mockBuildStake.mock.calls[1][0]).toEqual(
        expect.objectContaining({
          ...account,
          amount: '1',
          provider: 'etherfi',
          protocolVault: vault,
          inputTokenAddress: EthereumWETH,
          stakeType: 'normal',
          effectiveApy: '4.56',
        }),
      );
      expect(mockNavigate.mock.calls[2][0].stakingInfo?.send).toEqual({
        amount: '1',
        token: weth,
      });
      expect(mockTrackOrder).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['wrap', ['wrap'], []],
    ['approve', ['wrap', 'wrap', 'approve'], ['wrap-tx']],
    [
      'deposit',
      ['wrap', 'wrap', 'approve', 'approve', 'deposit'],
      ['wrap-tx', 'approve-tx'],
    ],
  ] as const)(
    'does not submit %s or start a later step when its pre-send guard rejects it',
    async (blockedStep, checkedSteps, expectedSubmitted) => {
      mockAllowance
        .mockResolvedValueOnce(allowance('0'))
        .mockResolvedValue(allowance('1'));
      const beforeDepositTaskSend = jest.fn(
        async (step: 'wrap' | 'resetApproval' | 'approve' | 'deposit') =>
          step !== blockedStep,
      );
      const submitted: string[] = [];
      mockNavigate.mockImplementation(
        async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
          await onBeforeSend?.();
          const txid = confirmationTxid(encodedTx, approvesInfo);
          submitted.push(txid);
          await onSuccess?.(successData(txid));
        },
      );
      const onSuccess = jest.fn();
      const onFail = jest.fn();
      const { result } = renderHook(() => useUniversalStake(account));

      await expect(
        result.current({
          ...params,
          taskMode: 'deposit',
          beforeDepositTaskSend,
          onSuccess,
          onFail,
        }),
      ).resolves.toBe(false);

      expect(beforeDepositTaskSend.mock.calls.map(([step]) => step)).toEqual(
        checkedSteps,
      );
      expect(submitted).toEqual(expectedSubmitted);
      expect(mockNavigate).toHaveBeenCalledTimes(expectedSubmitted.length);
      expect(onSuccess).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['wrap', []],
    ['approve', ['wrap-tx']],
    ['deposit', ['wrap-tx', 'approve-tx']],
  ] as const)(
    'rechecks %s immediately before sending after its confirmation was opened',
    async (blockedStep, expectedSubmitted) => {
      mockAllowance
        .mockResolvedValueOnce(allowance('0'))
        .mockResolvedValue(allowance('1'));
      let targetChecks = 0;
      const beforeDepositTaskSend = jest.fn(
        async (step: 'wrap' | 'resetApproval' | 'approve' | 'deposit') => {
          if (step !== blockedStep) return true;
          targetChecks += 1;
          return targetChecks === 1;
        },
      );
      const submitted: string[] = [];
      mockNavigate.mockImplementation(
        async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
          await onBeforeSend?.();
          const txid = confirmationTxid(encodedTx, approvesInfo);
          submitted.push(txid);
          await onSuccess?.(successData(txid));
        },
      );
      const { result } = renderHook(() => useUniversalStake(account));
      await expect(
        result.current({
          ...params,
          taskMode: 'deposit',
          beforeDepositTaskSend,
          onFail: jest.fn(),
        }),
      ).resolves.toBe(false);
      expect(targetChecks).toBe(2);
      expect(mockNavigate).toHaveBeenCalledTimes(expectedSubmitted.length + 1);
      expect(submitted).toEqual(expectedSubmitted);
    },
  );

  it.each([false, true])(
    'builds direct deposits with fresh APY and the exact account and token after approval: %s',
    async (needsApproval) => {
      const usdc: IToken = {
        address: '0x2222222222222222222222222222222222222222',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        isNative: false,
      };
      const amount = '0.123456';
      const spenderAddress = '0x3333333333333333333333333333333333333333';
      const directStakingInfo: IStakingInfo = {
        ...stakingInfo,
        send: { amount, token: usdc },
      };
      if (needsApproval) {
        mockAllowance
          .mockResolvedValueOnce(allowance('0'))
          .mockResolvedValue(allowance('1'));
      }
      mockBuildInternal.mockReset().mockResolvedValue(depositTx);
      let cancelledDeposit = false;
      mockNavigate.mockImplementation(
        async ({ approvesInfo, onBeforeSend, onSuccess, onCancel }) => {
          if (!approvesInfo && !cancelledDeposit) {
            cancelledDeposit = true;
            onCancel?.();
            return;
          }
          await onBeforeSend?.();
          await onSuccess?.(
            successData(approvesInfo ? 'approve-tx' : 'deposit-tx'),
          );
        },
      );
      const prepareDeposit = jest
        .fn()
        .mockResolvedValueOnce({ type: 'confirm', effectiveApy: '1.23' })
        .mockResolvedValueOnce({ type: 'confirm', effectiveApy: '4.56' });
      const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
      const beforeDepositTaskSend = jest.fn(async () => true);
      const { result } = renderHook(() => useUniversalStake(account));

      await expect(
        result.current({
          ...params,
          amount,
          symbol: 'USDC',
          stakeType: 'normal',
          inputTokenAddress: usdc.address,
          stakingInfo: directStakingInfo,
          effectiveApy: 'stale',
          taskMode: 'deposit',
          beforeDepositTaskSend,
          onDepositTaskReady,
          directDepositTask: {
            token: usdc,
            spenderAddress,
            requiresAllowanceReset: false,
            confirmReset: async () => true,
            prepareDeposit,
          },
        }),
      ).resolves.toBe(false);

      expect(onDepositTaskReady).toHaveBeenCalledTimes(1);
      await onDepositTaskReady.mock.calls[0][0].retry();
      expect(prepareDeposit).toHaveBeenCalledTimes(2);
      expect(mockBuildStake.mock.calls.map(([request]) => request)).toEqual([
        expect.objectContaining({
          ...account,
          amount,
          symbol: 'USDC',
          provider: 'etherfi',
          protocolVault: vault,
          inputTokenAddress: usdc.address,
          stakeType: 'normal',
          effectiveApy: '1.23',
        }),
        expect.objectContaining({
          ...account,
          amount,
          symbol: 'USDC',
          provider: 'etherfi',
          protocolVault: vault,
          inputTokenAddress: usdc.address,
          stakeType: 'normal',
          effectiveApy: '4.56',
        }),
      ]);
      expect(mockBuildInternal).toHaveBeenCalledTimes(2);
      expect(mockBuildInternal).toHaveBeenCalledWith(
        expect.objectContaining({ ...account, tx: depositTx }),
      );
      const approvals = mockNavigate.mock.calls.filter(
        ([confirmation]) => confirmation.approvesInfo,
      );
      expect(approvals).toHaveLength(needsApproval ? 1 : 0);
      if (needsApproval) {
        expect(approvals[0][0].approvesInfo).toEqual([
          expect.objectContaining({
            owner,
            spender: spenderAddress,
            amount,
            tokenInfo: usdc,
          }),
        ]);
      }
      expect(beforeDepositTaskSend.mock.calls).toEqual(
        needsApproval
          ? [['approve'], ['approve'], ['deposit'], ['deposit'], ['deposit']]
          : [['deposit'], ['deposit'], ['deposit']],
      );
      expect(mockWaitForFinal).toHaveBeenCalledTimes(needsApproval ? 1 : 0);
      expect(mockTrackOrder).toHaveBeenCalledTimes(1);
    },
  );

  it('skips the task approval when the current WETH allowance is sufficient', async () => {
    const onStepChange = jest.fn();
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    mockNavigate.mockImplementation(
      async ({ encodedTx, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        void onSuccess?.(
          successData(encodedTx === wrapTx ? 'wrap-tx' : 'deposit-tx'),
        );
      },
    );
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        onStepChange,
        onDepositTaskReady,
      }),
    ).resolves.toBe(true);
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(
      onDepositTaskReady.mock.calls[0][0]
        .getTask()
        .steps.map((step) => step.status.type),
    ).toEqual(['succeeded', 'skipped', 'handedOff']);
    expect(onStepChange).not.toHaveBeenCalled();
  });

  it.each([EOnChainHistoryTxStatus.Failed, undefined])(
    'stops the task when wrap finality is %s',
    async (status) => {
      mockWaitForFinal.mockResolvedValue(status);
      mockNavigate.mockImplementation(async ({ onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        void onSuccess?.(successData('wrap-tx'));
      });
      const { result } = renderHook(() => useUniversalStake(account));
      await expect(
        result.current({ ...params, taskMode: 'deposit' }),
      ).resolves.toBe(false);
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockAllowance).not.toHaveBeenCalled();
    },
  );

  it('stops the task when the wrap confirmation has no transaction id', async () => {
    mockNavigate.mockImplementation(async ({ onBeforeSend, onSuccess }) => {
      await onBeforeSend?.();
      void onSuccess?.(successData(''));
    });
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({ ...params, taskMode: 'deposit' }),
    ).resolves.toBe(false);
    expect(mockWaitForFinal).not.toHaveBeenCalled();
    expect(mockAllowance).not.toHaveBeenCalled();
  });

  it('does not deposit if the task approval is cancelled', async () => {
    mockAllowance.mockResolvedValueOnce(allowance('0'));
    mockNavigate.mockImplementation(
      async ({ encodedTx, onBeforeSend, onSuccess, onCancel }) => {
        if (encodedTx === wrapTx) {
          await onBeforeSend?.();
          void onSuccess?.(successData('wrap-tx'));
        } else onCancel?.();
      },
    );
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({ ...params, taskMode: 'deposit', onSuccess }),
    ).resolves.toBe(false);
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockBuildStake).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it.each(['wrap', 'approve', 'deposit'] as const)(
    'allows the %s step to be retried after an explicit device rejection',
    async (rejectedStep) => {
      if (rejectedStep === 'wrap') {
        mockBuildInternal
          .mockReset()
          .mockResolvedValueOnce(wrapTx)
          .mockResolvedValueOnce(wrapTx)
          .mockResolvedValue(depositTx);
      }
      let rejected = false;
      let currentAllowance = '0';
      mockAllowance.mockImplementation(async () => allowance(currentAllowance));
      mockNavigate.mockImplementation(
        async ({
          encodedTx,
          approvesInfo,
          onBeforeSend,
          onSuccess,
          onFail,
        }) => {
          await onBeforeSend?.();
          let step: 'approve' | 'wrap' | 'deposit' = 'deposit';
          if (approvesInfo) step = 'approve';
          else if (encodedTx === wrapTx) step = 'wrap';
          if (step === rejectedStep && !rejected) {
            rejected = true;
            onFail?.(new UserCancel());
            return;
          }
          if (step === 'approve') currentAllowance = '1';
          await onSuccess?.(
            successData(confirmationTxid(encodedTx, approvesInfo)),
          );
        },
      );
      const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
      const { result } = renderHook(() => useUniversalStake(account));
      await expect(
        result.current({
          ...params,
          taskMode: 'deposit',
          onDepositTaskReady,
          onFail: jest.fn(),
        }),
      ).resolves.toBe(false);
      const handle = onDepositTaskReady.mock.calls[0][0];
      const step = handle.getTask().steps[handle.getTask().currentStepIndex];
      expect(step.kind).toBe(rejectedStep);
      expect(step.status).toEqual({ type: 'failed', stage: 'beforeSend' });
      await handle.retry();
      expect(handle.getTask().steps.at(-1)?.status.type).toBe('handedOff');
      expect(
        mockNavigate.mock.calls.filter(([input]) => input.encodedTx === wrapTx),
      ).toHaveLength(rejectedStep === 'wrap' ? 2 : 1);
    },
  );

  it('does not assume a device rejection is pre-broadcast for another provider', async () => {
    mockNavigate.mockImplementation(async ({ onBeforeSend, onFail }) => {
      await onBeforeSend?.();
      onFail?.(new UserCancel());
    });
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        provider: 'native',
        taskMode: 'deposit',
        onDepositTaskReady,
        onFail: jest.fn(),
      }),
    ).resolves.toBe(false);
    expect(
      onDepositTaskReady.mock.calls[0][0].getTask().steps[0].status,
    ).toEqual({
      type: 'unknown',
      chainConfirmed: false,
    });
  });

  it('does not deposit after a confirmed task approval until allowance is sufficient', async () => {
    mockAllowance.mockResolvedValue(allowance('0'));
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        void onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({ ...params, taskMode: 'deposit' }),
    ).resolves.toBe(false);
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockBuildStake).toHaveBeenCalledTimes(1);
  });

  it('does not publish approval progress after the task scope becomes stale during an allowance read', async () => {
    const pending = deferred<IAllowance>();
    let current = true;
    const onStepChange = jest.fn();
    mockAllowance.mockReturnValueOnce(pending.promise);
    mockNavigate.mockImplementation(async ({ onBeforeSend, onSuccess }) => {
      await onBeforeSend?.();
      await onSuccess?.(successData('wrap-tx'));
    });
    const { result } = renderHook(() => useUniversalStake(account));
    const running = result.current({
      ...params,
      taskMode: 'deposit',
      isActionCurrent: () => current,
      onStepChange,
    });
    await waitFor(() => expect(mockAllowance).toHaveBeenCalledTimes(1));
    current = false;
    pending.resolve(allowance('0'));
    await running;
    expect(onStepChange).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('does not run the old page success callback after the deposit scope changes', async () => {
    let current = true;
    const onSuccess = jest.fn();
    mockNavigate.mockImplementation(
      async ({ encodedTx, onBeforeSend, onSuccess: confirmSuccess }) => {
        await onBeforeSend?.();
        void confirmSuccess?.(
          successData(encodedTx === wrapTx ? 'wrap-tx' : 'deposit-tx'),
        );
        if (encodedTx === depositTx) current = false;
      },
    );
    const { result } = renderHook(() => useUniversalStake(account));
    await result.current({
      ...params,
      taskMode: 'deposit',
      isActionCurrent: () => current,
      onSuccess,
    });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(mockTrackOrder).toHaveBeenCalledTimes(1);
  });

  it('records a wrapped deposit using its decoded transaction id when the signed id is empty', async () => {
    mockNavigate.mockImplementation(
      async ({ encodedTx, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        void onSuccess?.(
          encodedTx === wrapTx
            ? successData('wrap-tx')
            : decodedOnlySuccessData('decoded-deposit-tx'),
        );
      },
    );
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({ ...params, taskMode: 'deposit', onSuccess }),
    ).resolves.toBe(true);
    expect(mockTrackOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'deposit-order',
        txId: 'decoded-deposit-tx',
      }),
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('records a late direct deposit by decoded transaction id after unmount without navigating', async () => {
    let depositConfirmation: IConfirmParams | undefined;
    mockBuildInternal.mockReset().mockResolvedValue(depositTx);
    mockNavigate.mockImplementation(async (confirmation) => {
      await confirmation.onBeforeSend?.();
      depositConfirmation = confirmation;
    });
    const onSuccess = jest.fn();
    const { result, unmount } = renderHook(() => useUniversalStake(account));
    const running = result.current({
      ...params,
      taskMode: 'deposit',
      stakeType: 'normal',
      inputTokenAddress: weth.address,
      directDepositTask: {
        token: weth,
        spenderAddress: EtherFiLiquidReferContract,
        requiresAllowanceReset: false,
        confirmReset: async () => true,
        prepareDeposit: async () => ({ type: 'confirm' }),
      },
      onSuccess,
    });
    await waitFor(() => expect(depositConfirmation).toBeDefined());
    unmount();
    await running;
    void depositConfirmation?.onSuccess?.(
      decodedOnlySuccessData('late-decoded-deposit-tx'),
    );
    await waitFor(() => expect(mockTrackOrder).toHaveBeenCalledTimes(1));
    expect(mockTrackOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'deposit-order',
        txId: 'late-decoded-deposit-tx',
      }),
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('does not record or navigate when both deposit transaction ids are empty', async () => {
    mockNavigate.mockImplementation(
      async ({ encodedTx, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        void onSuccess?.(
          encodedTx === wrapTx
            ? successData('wrap-tx')
            : decodedOnlySuccessData(''),
        );
      },
    );
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({ ...params, taskMode: 'deposit', onSuccess }),
    ).resolves.toBe(false);
    expect(mockTrackOrder).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('records a late submitted deposit after unmount without calling the old page', async () => {
    let depositConfirmation: IConfirmParams | undefined;
    const onSuccess = jest.fn();
    mockNavigate.mockImplementation(async (confirmation) => {
      await confirmation.onBeforeSend?.();
      if (confirmation.encodedTx === wrapTx)
        void confirmation.onSuccess?.(successData('wrap-tx'));
      else depositConfirmation = confirmation;
    });
    const { result, unmount } = renderHook(() => useUniversalStake(account));
    const running = result.current({
      ...params,
      taskMode: 'deposit',
      onSuccess,
    });
    await waitFor(() => expect(depositConfirmation).toBeDefined());
    unmount();
    await running;
    void depositConfirmation?.onSuccess?.(successData('deposit-tx'));
    await waitFor(() => expect(mockTrackOrder).toHaveBeenCalledTimes(1));
    expect(mockTrackOrder.mock.calls[0][0]).toEqual(
      expect.objectContaining({ orderId: 'deposit-order', txId: 'deposit-tx' }),
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it.each(['direct', 'wrap'] as const)(
    'does not show a stale %s order recording error after unmount',
    async (mode) => {
      let rejectRecording: (error: Error) => void = () => undefined;
      mockTrackOrder.mockReturnValue(
        new Promise<void>((_resolve, reject) => {
          rejectRecording = reject;
        }),
      );
      const toast = jest
        .spyOn(errorToastUtils, 'showToastOfError')
        .mockImplementation(() => undefined);
      if (mode === 'direct')
        mockBuildInternal.mockReset().mockResolvedValue(depositTx);
      mockNavigate.mockImplementation(
        async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
          await onBeforeSend?.();
          await onSuccess?.(
            successData(confirmationTxid(encodedTx, approvesInfo)),
          );
        },
      );
      const { result, unmount } = renderHook(() => useUniversalStake(account));
      const running = result.current({
        ...params,
        taskMode: 'deposit',
        ...(mode === 'direct'
          ? {
              stakeType: 'normal' as const,
              inputTokenAddress: weth.address,
              directDepositTask: {
                token: weth,
                spenderAddress: EtherFiLiquidReferContract,
                requiresAllowanceReset: false,
                confirmReset: async () => true,
                prepareDeposit: async () => ({ type: 'confirm' as const }),
              },
            }
          : {}),
      });
      await waitFor(() => expect(mockTrackOrder).toHaveBeenCalledTimes(1));
      unmount();
      rejectRecording(new Error('old account recording failed'));
      await running;
      expect(toast).not.toHaveBeenCalled();
      toast.mockRestore();
    },
  );

  it.each(['direct', 'wrap'] as const)(
    'only retries order recording after a submitted %s deposit fails to record',
    async (mode) => {
      const pending = deferred<{
        localStatus: 'saved';
        remoteStatus: 'synced';
      }>();
      mockTrackOrder
        .mockResolvedValueOnce({
          localStatus: 'failed',
          remoteStatus: 'notAttempted',
        })
        .mockReturnValueOnce(pending.promise);
      if (mode === 'direct')
        mockBuildInternal.mockReset().mockResolvedValue(depositTx);
      const onFail = jest.fn();
      const onSuccess = jest.fn();
      const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
      const onDepositTaskSettled = jest.fn();
      mockNavigate.mockImplementation(
        async ({ encodedTx, onBeforeSend, onSuccess: confirmSuccess }) => {
          await onBeforeSend?.();
          void confirmSuccess?.(
            successData(encodedTx === wrapTx ? 'wrap-tx' : 'deposit-tx'),
          );
          if (encodedTx === depositTx)
            void confirmSuccess?.(successData('deposit-tx'));
        },
      );
      const { result } = renderHook(() => useUniversalStake(account));
      await expect(
        result.current({
          ...params,
          taskMode: 'deposit',
          onFail,
          onSuccess,
          onDepositTaskReady,
          onDepositTaskSettled,
          ...(mode === 'direct'
            ? {
                stakeType: 'normal' as const,
                inputTokenAddress: weth.address,
                directDepositTask: {
                  token: weth,
                  spenderAddress: EtherFiLiquidReferContract,
                  requiresAllowanceReset: false,
                  confirmReset: async () => true,
                  prepareDeposit: async () => ({ type: 'confirm' as const }),
                },
              }
            : {}),
        }),
      ).resolves.toBe(false);
      const handle = onDepositTaskReady.mock.calls[0][0];
      expect(handle.getTask().recording).toEqual({
        txid: 'deposit-tx',
        status: 'failed',
      });
      expect(mockNavigate).toHaveBeenCalledTimes(mode === 'direct' ? 1 : 2);
      expect(mockTrackOrder).toHaveBeenCalledTimes(1);
      expect(onFail).toHaveBeenCalledTimes(1);
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onDepositTaskSettled).not.toHaveBeenCalled();
      const first = handle.retryRecording?.();
      const second = handle.retryRecording?.();
      expect(handle.getTask().recording?.status).toBe('pending');
      await waitFor(() => expect(mockTrackOrder).toHaveBeenCalledTimes(2));
      pending.resolve({ localStatus: 'saved', remoteStatus: 'synced' });
      await Promise.all([first, second]);
      expect(handle.getTask().recording?.status).toBe('succeeded');
      expect(mockNavigate).toHaveBeenCalledTimes(mode === 'direct' ? 1 : 2);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onDepositTaskSettled).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['direct', 'wrap'] as const)(
    'keeps an in-flight %s recording after disposal without notifying the old task',
    async (mode) => {
      const pending = deferred<void>();
      mockTrackOrder.mockReturnValue(pending.promise);
      if (mode === 'direct')
        mockBuildInternal.mockReset().mockResolvedValue(depositTx);
      mockNavigate.mockImplementation(
        async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
          await onBeforeSend?.();
          await onSuccess?.(
            successData(confirmationTxid(encodedTx, approvesInfo)),
          );
        },
      );
      const onSuccess = jest.fn();
      const onDepositTaskSettled = jest.fn();
      const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
      const { result } = renderHook(() => useUniversalStake(account));
      const running = result.current({
        ...params,
        taskMode: 'deposit',
        onSuccess,
        onDepositTaskReady,
        onDepositTaskSettled,
        ...(mode === 'direct'
          ? {
              stakeType: 'normal' as const,
              inputTokenAddress: weth.address,
              directDepositTask: {
                token: weth,
                spenderAddress: EtherFiLiquidReferContract,
                requiresAllowanceReset: false,
                confirmReset: async () => true,
                prepareDeposit: async () => ({ type: 'confirm' as const }),
              },
            }
          : {}),
      });
      await waitFor(() => expect(mockTrackOrder).toHaveBeenCalledTimes(1));
      onDepositTaskReady.mock.calls[0][0].dispose();
      pending.resolve(undefined);
      await running;
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onDepositTaskSettled).not.toHaveBeenCalled();
    },
  );

  it('does not repeat registration or success notification when the notification fails', async () => {
    const toast = jest
      .spyOn(errorToastUtils, 'showToastOfError')
      .mockImplementation(() => undefined);
    const onSuccess = jest
      .fn()
      .mockRejectedValue(new Error('navigation failed'));
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    mockNavigate.mockImplementation(
      async ({
        encodedTx,
        approvesInfo,
        onBeforeSend,
        onSuccess: confirmSuccess,
      }) => {
        await onBeforeSend?.();
        await confirmSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        onSuccess,
        onDepositTaskReady,
      }),
    ).resolves.toBe(true);
    const handle = onDepositTaskReady.mock.calls[0][0];
    expect(handle.getTask().recording?.status).toBe('succeeded');
    await handle.retryRecording?.();
    expect(mockTrackOrder).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);
    toast.mockRestore();
  });

  it('retains a recorded task when the owner changes before the success callback', async () => {
    mockTrackOrder.mockImplementationOnce(async () => {
      mockGetAccountAddress.mockResolvedValueOnce(
        '0x2222222222222222222222222222222222222222',
      );
      return { localStatus: 'saved', remoteStatus: 'synced' };
    });
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const onSuccess = jest.fn();
    const onDepositTaskSettled = jest.fn();
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        onSuccess,
        onDepositTaskReady,
        onDepositTaskSettled,
      }),
    ).resolves.toBe(true);
    expect(
      onDepositTaskReady.mock.calls[0][0].getTask().recording?.status,
    ).toBe('succeeded');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onDepositTaskSettled).not.toHaveBeenCalled();
  });

  it('does not resend an order when server synchronization outcome is unknown', async () => {
    mockTrackOrder
      .mockResolvedValueOnce({ localStatus: 'saved', remoteStatus: 'failed' })
      .mockResolvedValueOnce({ localStatus: 'saved', remoteStatus: 'synced' });
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const onSuccess = jest.fn();
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        onSuccess,
        onDepositTaskReady,
        onFail: jest.fn(),
      }),
    ).resolves.toBe(false);
    const handle = onDepositTaskReady.mock.calls[0][0];
    expect(handle.getTask().recording?.status).toBe('remoteUnknown');
    expect(onSuccess).not.toHaveBeenCalled();
    await handle.retryRecording?.();
    expect(handle.getTask().recording?.status).toBe('remoteUnknown');
    expect(mockTrackOrder).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('does not retry an order when the background response is lost', async () => {
    mockTrackOrder.mockRejectedValueOnce(new Error('background response lost'));
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        onDepositTaskReady,
        onFail: jest.fn(),
      }),
    ).resolves.toBe(false);
    const handle = onDepositTaskReady.mock.calls[0][0];
    expect(handle.getTask().recording?.status).toBe('remoteUnknown');
    await handle.retryRecording?.();
    expect(mockTrackOrder).toHaveBeenCalledTimes(1);
  });

  it('does not treat a missing background result as an untracked order', async () => {
    mockTrackOrder.mockResolvedValueOnce(undefined);
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        onDepositTaskReady,
        onFail: jest.fn(),
      }),
    ).resolves.toBe(false);
    const handle = onDepositTaskReady.mock.calls[0][0];
    expect(handle.getTask().recording?.status).toBe('remoteUnknown');
    await handle.retryRecording?.();
    expect(mockTrackOrder).toHaveBeenCalledTimes(1);
  });

  it('marks a successful transaction without an order id as not tracked', async () => {
    mockBuildStake.mockImplementation(async ({ stakeType }) => ({
      tx: stakeType === 'wrap' ? wrapTx : depositTx,
    }));
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({ ...params, taskMode: 'deposit', onDepositTaskReady }),
    ).resolves.toBe(true);
    expect(
      onDepositTaskReady.mock.calls[0][0].getTask().recording?.status,
    ).toBe('notTracked');
    expect(mockTrackOrder).not.toHaveBeenCalled();
  });

  it.each([
    [
      { localStatus: 'unavailable', remoteStatus: 'notAttempted' },
      'localUnavailable',
      false,
    ],
    [
      { localStatus: 'unavailable', remoteStatus: 'synced' },
      'remoteUnknown',
      false,
    ],
    [
      { localStatus: 'superseded', remoteStatus: 'notAttempted' },
      'remoteUnknown',
      false,
    ],
    [{ localStatus: 'saved', remoteStatus: 'skipped' }, 'remoteUnknown', false],
    [
      { localStatus: 'superseded', remoteStatus: 'skipped' },
      'superseded',
      true,
    ],
  ] as const)(
    'handles order result %o without confusing it with a locally recorded order',
    async (orderResult, status, complete) => {
      mockTrackOrder.mockResolvedValueOnce(orderResult).mockResolvedValueOnce({
        localStatus: 'saved',
        remoteStatus: 'synced',
      });
      mockNavigate.mockImplementation(
        async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
          await onBeforeSend?.();
          await onSuccess?.(
            successData(confirmationTxid(encodedTx, approvesInfo)),
          );
        },
      );
      const onSuccess = jest.fn();
      const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
      const { result } = renderHook(() => useUniversalStake(account));
      await expect(
        result.current({
          ...params,
          taskMode: 'deposit',
          onSuccess,
          onDepositTaskReady,
        }),
      ).resolves.toBe(complete);
      const handle = onDepositTaskReady.mock.calls[0][0];
      expect(handle.getTask().recording?.status).toBe(status);
      expect(onSuccess).not.toHaveBeenCalled();
      await handle.retryRecording?.();
      expect(mockTrackOrder).toHaveBeenCalledTimes(
        status === 'localUnavailable' ? 2 : 1,
      );
      if (status === 'localUnavailable') {
        expect(handle.getTask().recording?.status).toBe('succeeded');
        expect(onSuccess).toHaveBeenCalledTimes(1);
      }
      expect(mockNavigate).toHaveBeenCalledTimes(2);
    },
  );

  it('does not continue the deposit task when the wrap status is unknown', async () => {
    mockWaitForFinal.mockResolvedValue(undefined);
    mockNavigate.mockImplementation(async ({ onBeforeSend, onSuccess }) => {
      await onBeforeSend?.();
      await onSuccess?.(successData('wrap-tx'));
    });
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({ ...params, taskMode: 'deposit' }),
    ).resolves.toBe(false);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockAllowance).not.toHaveBeenCalled();
  });

  it.each([
    [
      'wrong address',
      { address: '0x1111111111111111111111111111111111111111' },
    ],
    ['wrong decimals', { decimals: 6 }],
    ['native token', { isNative: true }],
    ['wrong token network', { networkId: 'evm--137' }],
  ])(
    'refuses a %s before building the wrap transaction',
    async (_label, overrides) => {
      const { result } = renderHook(() => useUniversalStake(account));
      await expect(
        result.current({
          ...params,
          postWrapStakeToken: { ...weth, ...overrides },
        }),
      ).rejects.toThrow('Invalid wrapped stake token');
      expect(mockBuildStake).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'wrong address',
      { address: '0x1111111111111111111111111111111111111111' },
    ],
    ['wrong decimals', { decimals: 6 }],
    ['wrong token network', { networkId: 'evm--137' }],
  ])(
    'rejects Native %s before constructing a wrap',
    async (_label, overrides) => {
      const { result } = renderHook(() => useUniversalStake(account));
      await expect(
        result.current({
          ...params,
          provider: 'native',
          postWrapStakeToken: { ...weth, ...overrides },
        }),
      ).rejects.toThrow('Invalid wrapped stake token');
      expect(mockBuildStake).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    },
  );

  it('continues the Native wrap flow with canonical WETH', async () => {
    const nativeVault = '0x2222222222222222222222222222222222222222';
    const nativeSpender = '0x3333333333333333333333333333333333333333';
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        provider: 'native',
        symbol: 'WETH',
        protocolVault: nativeVault,
        postWrapApproveSpenderAddress: nativeSpender,
        stakingInfo: { ...stakingInfo, protocol: 'Native' },
      }),
    ).resolves.toBe(true);
    expect(mockBuildStake.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        provider: 'native',
        symbol: 'WETH',
        protocolVault: nativeVault,
        stakeType: 'wrap',
        inputTokenAddress: '',
      }),
    );
    expect(mockBuildStake.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        provider: 'native',
        symbol: 'WETH',
        protocolVault: nativeVault,
        stakeType: 'normal',
        inputTokenAddress: EthereumWETH,
      }),
    );
    expect(mockAllowance).toHaveBeenCalledWith(
      expect.objectContaining({
        spenderAddress: nativeSpender,
        tokenAddress: EthereumWETH,
      }),
    );
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  it('uses the Native spender and waits for approval before depositing WETH', async () => {
    const nativeVault = '0x2222222222222222222222222222222222222222';
    const nativeSpender = '0x3333333333333333333333333333333333333333';
    const approvalFinality = deferred<EOnChainHistoryTxStatus>();
    mockAllowance
      .mockResolvedValueOnce(allowance('0'))
      .mockResolvedValue(allowance('1'));
    mockWaitForFinal
      .mockResolvedValueOnce(EOnChainHistoryTxStatus.Success)
      .mockReturnValueOnce(approvalFinality.promise);
    const { result } = renderHook(() => useUniversalStake(account));
    const submit = result.current({
      ...params,
      provider: 'native',
      symbol: 'WETH',
      protocolVault: nativeVault,
      postWrapApproveSpenderAddress: nativeSpender,
      stakingInfo: { ...stakingInfo, protocol: 'Native' },
    });
    await waitFor(() => expect(mockWaitForFinal).toHaveBeenCalledTimes(2));
    expect(mockNavigate.mock.calls[1][0].approvesInfo).toEqual([
      expect.objectContaining({
        spender: nativeSpender,
        tokenInfo: weth,
        amount: '1',
      }),
    ]);
    expect(mockBuildStake).toHaveBeenCalledTimes(1);
    approvalFinality.resolve(EOnChainHistoryTxStatus.Success);
    await expect(submit).resolves.toBe(true);
    expect(mockBuildStake).toHaveBeenCalledTimes(2);
    expect(mockBuildStake.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        provider: 'native',
        symbol: 'WETH',
        protocolVault: nativeVault,
        inputTokenAddress: EthereumWETH,
        stakeType: 'normal',
      }),
    );
  });

  it('waits for wrap finality and WETH approval before depositing into the original vault', async () => {
    const wrapFinality = deferred<EOnChainHistoryTxStatus>();
    const approvedAllowance = deferred<IAllowance>();
    const onSuccess = jest.fn();
    const onStepChange = jest.fn();
    mockNavigate.mockResolvedValue(undefined);
    mockWaitForFinal
      .mockReturnValueOnce(wrapFinality.promise)
      .mockResolvedValue(EOnChainHistoryTxStatus.Success);
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
      expect(mockWaitForFinal).toHaveBeenCalledWith(
        expect.objectContaining({
          ...account,
          txid: 'wrap-tx',
        }),
      ),
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

  it('does not open the next transaction after the originating scope changes', async () => {
    const finality = deferred<EOnChainHistoryTxStatus>();
    mockWaitForFinal.mockReturnValueOnce(finality.promise);
    const { result, rerender } = renderHook(
      ({ scopeKey }: { scopeKey: string }) =>
        useUniversalStake({ ...account, scopeKey }),
      { initialProps: { scopeKey: 'first-vault' } },
    );
    const submit = result.current(params);
    await waitFor(() => expect(mockWaitForFinal).toHaveBeenCalledTimes(1));
    rerender({ scopeKey: 'other-vault' });
    finality.resolve(EOnChainHistoryTxStatus.Success);
    await expect(submit).resolves.toBe(false);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockAllowance).not.toHaveBeenCalled();
  });

  it('does not open a normal stake confirmation after a scope changes and changes back during build', async () => {
    const build = deferred<IStakeTxResponse>();
    mockBuildStake.mockReturnValueOnce(build.promise);
    const { result, rerender } = renderHook(
      ({ scopeKey }: { scopeKey: string }) =>
        useUniversalStake({ ...account, scopeKey }),
      { initialProps: { scopeKey: 'first-vault' } },
    );
    const submit = result.current({ ...params, stakeType: 'normal' });
    await waitFor(() => expect(mockBuildStake).toHaveBeenCalledTimes(1));
    rerender({ scopeKey: 'other-vault' });
    rerender({ scopeKey: 'first-vault' });
    build.resolve({ tx: depositTx });
    await expect(submit).resolves.toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not open a normal stake confirmation when the originating form becomes stale during build', async () => {
    const build = deferred<IStakeTxResponse>();
    mockBuildStake.mockReturnValueOnce(build.promise);
    let current = true;
    const { result } = renderHook(() => useUniversalStake(account));
    const submit = result.current({
      ...params,
      stakeType: 'normal',
      isActionCurrent: () => current,
    });
    await waitFor(() => expect(mockBuildStake).toHaveBeenCalledTimes(1));
    current = false;
    build.resolve({ tx: depositTx });
    await expect(submit).resolves.toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('rejects an old callback invoked after changing accounts', async () => {
    const { result, rerender } = renderHook(
      ({ accountId }: { accountId: string }) =>
        useUniversalStake({ accountId, networkId: account.networkId }),
      { initialProps: { accountId: 'account-1' } },
    );
    const oldCallback = result.current;
    rerender({ accountId: 'account-2' });
    await expect(oldCallback({ ...params, stakeType: 'normal' })).resolves.toBe(
      false,
    );
    expect(mockBuildStake).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('rejects a saved callback invoked after its owning hook unmounts', async () => {
    const { result, unmount } = renderHook(() => useUniversalStake(account));
    const oldCallback = result.current;
    unmount();
    await expect(oldCallback({ ...params, stakeType: 'normal' })).resolves.toBe(
      false,
    );
    expect(mockRiskAccepted).not.toHaveBeenCalled();
    expect(mockBuildStake).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('allows a current action after StrictMode replays effect setup', async () => {
    const { result } = renderHook(() => useUniversalStake(account), {
      wrapper: StrictMode,
    });
    await expect(
      result.current({ ...params, stakeType: 'normal' }),
    ).resolves.toBe(true);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('does not open a normal stake confirmation after the owning hook unmounts during build', async () => {
    const build = deferred<IStakeTxResponse>();
    mockBuildStake.mockReturnValueOnce(build.promise);
    const { result, unmount } = renderHook(() => useUniversalStake(account));
    const submit = result.current({ ...params, stakeType: 'normal' });
    await waitFor(() => expect(mockBuildStake).toHaveBeenCalledTimes(1));
    unmount();
    build.resolve({ tx: depositTx });
    await expect(submit).resolves.toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it.each(['normal', 'wrap'] as const)(
    'cancels a %s confirmation if the scope changes while navigation prepares',
    async (stakeType) => {
      const prepare = deferred<void>();
      const opened = jest.fn();
      mockNavigate.mockImplementation(async ({ isNavigationCurrent }) => {
        await prepare.promise;
        if (isNavigationCurrent?.() ?? true) opened();
      });
      const { result, rerender } = renderHook(
        ({ scopeKey }: { scopeKey: string }) =>
          useUniversalStake({ ...account, scopeKey }),
        { initialProps: { scopeKey: 'first-vault' } },
      );
      const submit = result.current({ ...params, stakeType });
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
      rerender({ scopeKey: 'other-vault' });
      prepare.resolve();
      await expect(submit).resolves.toBe(false);
      expect(opened).not.toHaveBeenCalled();
    },
  );

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
      const onWrapStateChange = jest.fn();
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

      await expect(
        result.current({ ...params, onWrapStateChange }),
      ).resolves.toBe(false);

      expect(mockBuildStake).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledTimes(step === 'wrap' ? 1 : 2);
      expect(mockAllowance).toHaveBeenCalledTimes(step === 'wrap' ? 0 : 1);
      expect(mockTrackOrder).not.toHaveBeenCalled();
      expect(onWrapStateChange.mock.calls).toEqual(
        step === 'wrap' ? [] : [['unknown'], ['submitted']],
      );
    },
  );

  it('treats cancel after sending starts as uncertain and settles only once', async () => {
    const onWrapStateChange = jest.fn();
    mockNavigate.mockImplementationOnce(
      async ({ onBeforeSend, onCancel, onFail }) => {
        await onBeforeSend?.();
        onCancel?.();
        onFail?.(new Error('late failure'));
      },
    );
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(
      result.current({ ...params, onWrapStateChange }),
    ).resolves.toBe(false);
    expect(onWrapStateChange.mock.calls).toEqual([['unknown']]);
    expect(mockAllowance).not.toHaveBeenCalled();
  });

  it('treats an early failure as uncertain and blocks retry on the old confirmation', async () => {
    const onWrapStateChange = jest.fn();
    mockNavigate.mockImplementationOnce(async ({ onFail }) =>
      onFail?.(new Error('preparation failed')),
    );
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(
      result.current({ ...params, onWrapStateChange }),
    ).resolves.toBe(false);
    expect(onWrapStateChange.mock.calls).toEqual([['unknown']]);
    expect(() => mockNavigate.mock.calls[0][0].onBeforeSend?.()).toThrow();
  });

  it('blocks an opened confirmation after its originating scope changes', async () => {
    mockNavigate.mockResolvedValueOnce(undefined);
    const { result, rerender } = renderHook(
      ({ scopeKey }: { scopeKey: string }) =>
        useUniversalStake({ ...account, scopeKey }),
      { initialProps: { scopeKey: 'first' } },
    );
    const submit = result.current(params);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    rerender({ scopeKey: 'second' });
    await expect(submit).resolves.toBe(false);
    expect(() => mockNavigate.mock.calls[0][0].onBeforeSend?.()).toThrow();
  });

  it('blocks retries and ignores late success after a send failure', async () => {
    const onWrapStateChange = jest.fn();
    mockNavigate.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useUniversalStake(account));
    const submit = result.current({ ...params, onWrapStateChange });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    const confirmation = mockNavigate.mock.calls[0][0];
    await confirmation.onBeforeSend?.();
    confirmation.onFail?.(new Error('send failed'));
    await expect(submit).resolves.toBe(false);
    expect(() => confirmation.onBeforeSend?.()).toThrow();
    await confirmation.onSuccess?.(successData('late-tx'));
    expect(onWrapStateChange.mock.calls).toEqual([['unknown']]);
    expect(mockAllowance).not.toHaveBeenCalled();
  });

  it('blocks a retry on an expired post-wrap approval confirmation', async () => {
    mockAllowance.mockResolvedValueOnce(allowance('0'));
    mockNavigate.mockImplementationOnce(async ({ onSuccess }) => {
      await onSuccess?.(successData('wrap-tx'));
    });
    mockNavigate.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useUniversalStake(account));
    const submit = result.current(params);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));
    const approval = mockNavigate.mock.calls[1][0];
    await approval.onBeforeSend?.();
    approval.onFail?.(new Error('approval failed'));
    await expect(submit).resolves.toBe(false);
    expect(() => approval.onBeforeSend?.()).toThrow();
    expect(mockBuildStake).toHaveBeenCalledTimes(1);
  });

  it.each(['wrap', 'approve'] as const)(
    'stops and reports a failed %s confirmation',
    async (step) => {
      const error = new Error('Transaction failed');
      const onFail = jest.fn();
      const onWrapStateChange = jest.fn();
      mockAllowance.mockResolvedValueOnce(allowance('0'));
      if (step === 'approve') {
        mockNavigate.mockImplementationOnce(async ({ onSuccess }) => {
          await onSuccess?.(successData('wrap-tx'));
        });
      }
      mockNavigate.mockImplementationOnce(
        async ({ onBeforeSend, onFail: fail }) => {
          await onBeforeSend?.();
          fail?.(error);
        },
      );
      const { result } = renderHook(() => useUniversalStake(account));

      await expect(
        result.current({ ...params, onFail, onWrapStateChange }),
      ).resolves.toBe(false);

      expect(onFail).toHaveBeenCalledWith(error);
      expect(mockBuildStake).toHaveBeenCalledTimes(1);
      expect(mockTrackOrder).not.toHaveBeenCalled();
      expect(onWrapStateChange.mock.calls).toEqual(
        step === 'wrap' ? [['unknown']] : [['unknown'], ['submitted']],
      );
    },
  );

  it.each([EOnChainHistoryTxStatus.Failed, undefined])(
    'does not check allowance after unsuccessful wrap finality %s',
    async (status) => {
      mockWaitForFinal.mockResolvedValue(status);
      const { result } = renderHook(() => useUniversalStake(account));
      const onWrapStateChange = jest.fn();

      await expect(
        result.current({ ...params, onWrapStateChange }),
      ).resolves.toBe(false);
      expect(onWrapStateChange.mock.calls).toEqual(
        status === EOnChainHistoryTxStatus.Failed
          ? [['unknown'], ['failed']]
          : [['unknown']],
      );

      expect(mockAllowance).not.toHaveBeenCalled();
      expect(mockBuildStake).toHaveBeenCalledTimes(1);
      expect(
        status === EOnChainHistoryTxStatus.Failed
          ? mockToastError
          : mockToastMessage,
      ).toHaveBeenCalledTimes(1);
    },
  );

  it('does not deposit when approval never becomes sufficient', async () => {
    mockAllowance.mockResolvedValue(allowance('0'));
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(result.current(params)).resolves.toBe(false);

    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockBuildStake).toHaveBeenCalledTimes(1);
    expect(mockToastMessage).toHaveBeenCalledTimes(1);
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
