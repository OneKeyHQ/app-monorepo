import { act, renderHook, waitFor } from '@testing-library/react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import type {
  IEarnFundingReceipt,
  IEarnFundingState,
} from '@onekeyhq/shared/types/earn/funding';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import {
  completeEarnFunding,
  refreshEarnFunding,
  releaseEarnFunding,
  reserveEarnFunding,
  settleEarnFunding,
  useEarnFunding,
} from '../EarnRouter/earnFundingRegistry';

import { loanOperationKey } from './loanRouter.utils';
import { useLoanRouterRun } from './useLoanRouterRun';

import type { ILoanRoute } from './loanRouter.utils';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({ Toast: { error: jest.fn() } }));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: { getAccount: jest.fn() },
    serviceStaking: {
      borrowBuildBorrowTransaction: jest.fn(),
      fetchTokenAllowance: jest.fn(),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const result = {
    accountId: 'account',
    networkId: 'evm--1',
    address: '0xowner',
  };
  return { usePromiseResult: () => ({ result }) };
});
jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => ({
  waitForTxFinalStatus: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/views/Earn/tasks/lateEarnOrderRecorder', () => ({
  createLateEarnOrderRecorder: () => jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/views/Earn/tasks/taskAccount', () => ({
  ...jest.requireActual<typeof import('../../tasks/taskAccount')>(
    '../../tasks/taskAccount',
  ),
  getTaskAccountAddress: async () => '0xowner',
  isTaskAccountCurrent: async () => true,
}));
jest.mock('../../../Staking/components/EarnRiskWarningDialog', () => ({
  useEarnRiskWarningGate: () => async () => true,
}));
jest.mock('../../../Borrow/components/borrowRepayPosition.utils', () => ({
  resolveBorrowTokenApproveSpenderAddress: () => '0xspender',
  shouldUseAaveNativeGateway: () => false,
}));
jest.mock('../../../Borrow/hooks/useUniversalBorrowWithdrawRepayHooks', () => ({
  attachBorrowOrderId: ({ stakingInfo }: { stakingInfo: object }) =>
    stakingInfo,
  handleBorrowSuccess: async () => {},
  parseBorrowEncodedTx: () => ({}),
}));
jest.mock('./useLoanRouterFacts', () => ({
  readLoanRoutePosition: jest.fn(),
}));
jest.mock('../EarnRouter/earnFundingRegistry', () => ({
  completeEarnFunding: jest.fn(),
  getEarnFunding: jest.fn(),
  refreshEarnFunding: jest.fn(),
  releaseEarnFunding: jest.fn(),
  reserveEarnFunding: jest.fn(),
  settleEarnFunding: jest.fn(),
  useEarnFunding: jest.fn(),
}));

const networkId = 'evm--1';
const route: ILoanRoute = {
  key: 'market',
  market: {
    provider: 'Aave',
    networkId,
    name: 'Aave',
    logoURI: '',
    marketAddress: '0xmarket',
    network: {
      networkId,
      network: 'Ethereum',
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
      logoURI: '',
      indexerSupported: true,
      fallbackSupported: true,
      nativeTokenAddress: '',
      coingeckoPlatform: 'ethereum',
      nativeTokenCoingeckoId: 'ethereum',
    },
  },
  marketLabel: 'Aave',
  collateral: {
    symbol: 'USDT',
    name: 'Tether',
    logoURI: '',
    address: '0xusdt',
    decimals: 6,
    networkId,
    reserveAddress: '0xusdt',
    supplyApy: 1,
    liquidationLtv: 0.8,
  },
  borrow: {
    symbol: 'USDC',
    name: 'USD Coin',
    logoURI: '',
    address: '0xusdc',
    decimals: 6,
    networkId,
    reserveAddress: '0xusdc',
    borrowApy: 2,
    borrowFactor: 1,
  },
};
const plan = { route, networkAccountId: 'account', accountAddress: '0xowner' };
const borrowKey = loanOperationKey(plan, 'borrow');
const supplyKey = loanOperationKey(plan, 'supply');
const confirm = jest.fn<
  Promise<void>,
  Parameters<ReturnType<typeof useSignatureConfirm>['navigationToTxConfirm']>
>();
const store = new Map<string, IEarnFundingState>();

function setSubmitted(
  key: string,
  txId: string,
  intentAmount?: string,
  source?: IEarnFundingReceipt,
) {
  store.set(key, { status: 'submitted', txId, intentAmount, source });
}

beforeEach(() => {
  jest.resetAllMocks();
  store.clear();
  jest
    .mocked(useEarnFunding)
    .mockImplementation((key) => (key ? store.get(key) : undefined));
  jest
    .mocked(refreshEarnFunding)
    .mockImplementation(async (key) => store.get(key));
  jest
    .mocked(releaseEarnFunding)
    .mockImplementation(
      async (key, txId, status = txId ? 'submitted' : 'funded') => {
        const record = store.get(key);
        if (
          record &&
          record.status === status &&
          'txId' in record &&
          record.txId === txId
        )
          store.delete(key);
      },
    );
  jest
    .mocked(settleEarnFunding)
    .mockImplementation(async (key, txId, amount) => {
      store.set(key, {
        status: 'funded',
        txId,
        receivedAmount: amount,
        source: store.get(key)?.source,
      });
    });
  jest.mocked(completeEarnFunding).mockImplementation(async (key, txId) => {
    const record = store.get(key);
    if (record?.status !== 'funded' || record.txId !== txId || !record.source)
      return false;
    store.delete(record.source.scope);
    store.delete(key);
    return true;
  });
  jest
    .mocked(reserveEarnFunding)
    .mockImplementation((key, { amount } = {}) => ({
      markUnknown: async () => {
        store.set(key, { status: 'unknown', intentAmount: amount });
      },
      markSubmitted: async (txId) => setSubmitted(key, txId, amount),
      markFunded: async (receivedAmount) => {
        const record = store.get(key);
        if (record?.status === 'submitted') {
          await settleEarnFunding(key, record.txId, receivedAmount);
        }
      },
      release: async () => {
        store.delete(key);
      },
    }));
  jest.mocked(useSignatureConfirm).mockReturnValue({
    navigationToMessageConfirm: jest.fn(),
    navigationToMessageConfirmAsync: jest.fn(),
    navigationToTxConfirm: confirm,
    normalizeTxConfirm: jest.fn(),
  });
  jest
    .mocked(waitForTxFinalStatus)
    .mockResolvedValue(EOnChainHistoryTxStatus.Success);
});

it('restores a confirmed borrowed amount after reopening and acknowledges the original receipt', async () => {
  setSubmitted(borrowKey, 'borrow-tx', '4', {
    scope: supplyKey,
    txId: 'supply-tx',
  });
  store.set(supplyKey, {
    status: 'funded',
    txId: 'supply-tx',
    receivedAmount: '10',
  });
  const firstDone = jest.fn();
  const first = renderHook(() =>
    useLoanRouterRun({ ...plan, onDone: firstDone }),
  );
  await act(async () => first.result.current.reconcile());
  expect(waitForTxFinalStatus).toHaveBeenCalledWith(
    expect.objectContaining({
      txid: 'borrow-tx',
      accountId: 'account',
      networkId,
      expectedAccountAddress: '0xowner',
    }),
  );
  expect(firstDone).toHaveBeenCalledWith(
    expect.objectContaining({
      plan: expect.objectContaining({
        borrowAmount: '4',
        collateralAmount: '10',
      }),
      supplied: true,
    }),
  );
  expect(releaseEarnFunding).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
  first.unmount();

  const reopenedDone = jest.fn();
  const reopened = renderHook(() =>
    useLoanRouterRun({ ...plan, onDone: reopenedDone }),
  );
  await waitFor(() => expect(reopenedDone).toHaveBeenCalledTimes(1));
  expect(confirm).not.toHaveBeenCalled();
  await act(async () => {
    await reopened.result.current.acknowledgeDone();
  });
  expect(completeEarnFunding).toHaveBeenCalledWith(borrowKey, 'borrow-tx');
  expect(releaseEarnFunding).not.toHaveBeenCalled();
  expect(store.has(supplyKey)).toBe(false);
  expect(store.has(borrowKey)).toBe(false);
});

it('does not attribute or clear collateral from a different route when acknowledging the same borrow', async () => {
  const priorRouteSupply = 'other-route-supply';
  store.set(priorRouteSupply, {
    status: 'funded',
    txId: 'old-supply',
    receivedAmount: '20',
  });
  store.set(supplyKey, {
    status: 'funded',
    txId: 'current-supply',
    receivedAmount: '10',
  });
  store.set(borrowKey, {
    status: 'funded',
    txId: 'borrow-tx',
    receivedAmount: '4',
    source: { scope: priorRouteSupply, txId: 'old-supply' },
  });
  const onDone = jest.fn();
  const { result } = renderHook(() => useLoanRouterRun({ ...plan, onDone }));
  await waitFor(() =>
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({
        supplied: false,
        plan: expect.objectContaining({
          collateralAmount: '0',
          borrowAmount: '4',
        }),
      }),
    ),
  );
  await act(async () => {
    await result.current.acknowledgeDone();
  });
  expect(store.get(supplyKey)).toEqual(
    expect.objectContaining({ txId: 'current-supply' }),
  );
  expect(store.has(priorRouteSupply)).toBe(false);
});

it('retains confirmed collateral after a borrow reverts', async () => {
  setSubmitted(borrowKey, 'reverted-tx', '4');
  store.set(supplyKey, {
    status: 'funded',
    txId: 'supply-tx',
    receivedAmount: '10',
  });
  jest
    .mocked(waitForTxFinalStatus)
    .mockResolvedValue(EOnChainHistoryTxStatus.Failed);
  const onDone = jest.fn();
  const { result } = renderHook(() => useLoanRouterRun({ ...plan, onDone }));
  await act(async () => result.current.reconcile());
  expect(result.current.fundedSupplyAmount).toBe('10');
  expect(releaseEarnFunding).toHaveBeenCalledTimes(1);
  expect(releaseEarnFunding).toHaveBeenCalledWith(borrowKey, 'reverted-tx');
  expect(onDone).not.toHaveBeenCalled();
});

it('confirms the USDT allowance reset before asking to authorize the new amount', async () => {
  const accountId = plan.networkAccountId;
  const address = plan.accountAddress;
  jest
    .spyOn(backgroundApiProxy.serviceStaking, 'fetchTokenAllowance')
    .mockResolvedValue({ allowance: '1000000', allowanceParsed: '1' });
  jest
    .spyOn(backgroundApiProxy.serviceAccount, 'getAccount')
    .mockResolvedValue({
      id: accountId,
      name: 'Test account',
      type: undefined,
      path: '',
      coinType: '60',
      impl: 'evm',
      pub: '',
      address,
      addressDetail: {
        isValid: true,
        networkId,
        address,
        normalizedAddress: address,
        baseAddress: address,
        displayAddress: address,
        allowEmptyAddress: false,
      },
    });
  const amounts: string[] = [];
  confirm.mockImplementation(
    async ({ approvesInfo, onBeforeSend, onSuccess, onCancel }) => {
      expect(approvesInfo).toHaveLength(1);
      const [amount] = approvesInfo?.map((approval) => approval.amount) ?? [];
      amounts.push(String(amount));
      if (amount === '0') {
        await onBeforeSend?.();
        onSuccess?.([
          {
            signedTx: { txid: 'reset-tx', rawTx: '', encodedTx: null },
            decodedTx: {
              txid: 'reset-tx',
              owner: address,
              signer: address,
              nonce: 1,
              actions: [],
              status: EDecodedTxStatus.Pending,
              networkId,
              accountId,
              extraInfo: null,
            },
          },
        ]);
      } else {
        expect(waitForTxFinalStatus).toHaveBeenCalledWith(
          expect.objectContaining({ txid: 'reset-tx' }),
        );
        onCancel?.();
      }
    },
  );
  const onDone = jest.fn();
  const { result } = renderHook(() => useLoanRouterRun({ ...plan, onDone }));
  await act(async () =>
    result.current.start({
      ...plan,
      collateralAmount: '10',
      borrowAmount: '4',
    }),
  );
  expect(amounts).toEqual(['0', '10']);
  expect(result.current.phase).toBe('idle');
  expect(onDone).not.toHaveBeenCalled();
});
