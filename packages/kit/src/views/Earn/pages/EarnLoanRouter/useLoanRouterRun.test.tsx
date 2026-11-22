import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
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
  recoverEarnFundingDestination,
  refreshEarnFunding,
  releaseEarnFunding,
  reserveEarnFunding,
  settleEarnFunding,
  useEarnFunding,
} from '../EarnRouter/earnFundingRegistry';

import { loanOperationKey } from './loanRouter.utils';
import { readLoanRoutePosition } from './useLoanRouterFacts';
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
      borrowBuildSupplyTransaction: jest.fn(),
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
jest.mock('../../../Borrow/components/borrowReserve.utils', () => ({
  resolveBorrowTokenApproveSpenderAddress: ({
    providerName,
  }: {
    providerName: string;
  }) =>
    ['kamino', 'unknown'].includes(providerName.toLowerCase())
      ? ''
      : '0xspender',
}));
jest.mock('../../../Borrow/components/borrowNativeReserve.utils', () => ({
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
  recoverEarnFundingDestination: jest.fn(),
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
  jest
    .mocked(completeEarnFunding)
    .mockImplementation(async (key, txId, options) => {
      const record = store.get(key);
      if (record?.status !== 'funded' || record.txId !== txId || !record.source)
        return false;
      const source = store.get(record.source.scope);
      if (source?.status !== 'funded' || source.txId !== record.source.txId)
        return false;
      store.delete(record.source.scope);
      if (options?.keepDestination)
        store.set(key, { ...record, source: undefined });
      else store.delete(key);
      return true;
    });
  jest
    .mocked(reserveEarnFunding)
    .mockImplementation((key, { amount, source, positionBefore } = {}) => ({
      markUnknown: async (_swap, _uuid, destinationRecovery) => {
        if (store.get(key)?.status === 'unknown') return;
        store.set(key, {
          status: 'unknown',
          intentAmount: amount,
          source,
          positionBefore,
          destinationRecovery,
        });
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
        await onBeforeSend?.({
          unsignedTxs: [
            {
              uuid: 'approval-uuid',
              accountId,
              networkId,
              approveInfo: approvesInfo?.[0],
            } as IUnsignedTxPro,
          ],
        });
        expect(store.get(loanOperationKey(plan, 'approval'))).toEqual(
          expect.objectContaining({
            status: 'unknown',
            destinationRecovery: {
              uuid: 'approval-uuid',
              accountId,
              networkId,
              accountAddress: address,
            },
          }),
        );
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

it('builds Kamino SPL supply without requesting an EVM allowance', async () => {
  const buildSupply = jest.spyOn(
    backgroundApiProxy.serviceStaking,
    'borrowBuildSupplyTransaction',
  );
  const fetchAllowance = jest.spyOn(
    backgroundApiProxy.serviceStaking,
    'fetchTokenAllowance',
  );
  const solRoute = {
    ...route,
    market: { ...route.market, provider: 'Kamino', networkId: 'sol--101' },
    collateral: {
      ...route.collateral,
      networkId: 'sol--101',
      address: 'spl-usdc',
    },
  };
  jest
    .mocked(readLoanRoutePosition)
    .mockResolvedValue({ collateralSupplied: '0' } as Awaited<
      ReturnType<typeof readLoanRoutePosition>
    >);
  buildSupply.mockResolvedValue({ tx: '{}', orderId: 'order' });
  confirm.mockImplementation(async ({ onCancel }) => onCancel?.());
  const { result } = renderHook(() =>
    useLoanRouterRun({ ...plan, route: solRoute, onDone: jest.fn() }),
  );
  await act(async () =>
    result.current.start({
      ...plan,
      route: solRoute,
      collateralAmount: '10',
      borrowAmount: '0',
    }),
  );
  expect(fetchAllowance).not.toHaveBeenCalled();
  expect(buildSupply).toHaveBeenCalledWith(
    expect.objectContaining({
      networkId: 'sol--101',
      provider: 'Kamino',
      amount: '10',
    }),
  );
  expect(confirm).toHaveBeenCalledTimes(1);
});

it('persists the actual supply transaction identity before spending swap funding', async () => {
  jest
    .mocked(readLoanRoutePosition)
    .mockResolvedValue({ collateralSupplied: '0' } as Awaited<
      ReturnType<typeof readLoanRoutePosition>
    >);
  jest
    .spyOn(backgroundApiProxy.serviceStaking, 'fetchTokenAllowance')
    .mockResolvedValue({ allowance: '100000000', allowanceParsed: '100' });
  jest
    .spyOn(backgroundApiProxy.serviceStaking, 'borrowBuildSupplyTransaction')
    .mockResolvedValue({ tx: '{}', orderId: 'order' });
  confirm.mockImplementation(
    async ({ onBeforeSend, onCancel, preserveBatchTxIds }) => {
      expect(preserveBatchTxIds).toBe(true);
      await onBeforeSend?.({
        unsignedTxs: [
          {
            uuid: 'supply-uuid',
            accountId: 'account',
            networkId,
          } as IUnsignedTxPro,
        ],
      });
      await expect(
        onBeforeSend?.({
          unsignedTxs: [
            {
              uuid: 'supply-uuid',
              accountId: 'account',
              networkId,
            } as IUnsignedTxPro,
          ],
        }),
      ).rejects.toThrow();
      onCancel?.();
    },
  );
  const { result } = renderHook(() =>
    useLoanRouterRun({ ...plan, onDone: jest.fn() }),
  );
  await act(async () =>
    result.current.start({
      ...plan,
      collateralAmount: '10',
      borrowAmount: '0',
      fundingSource: { scope: 'swap-source', txId: 'swap-tx' },
    }),
  );
  expect(store.get(supplyKey)).toEqual(
    expect.objectContaining({
      status: 'unknown',
      source: { scope: 'swap-source', txId: 'swap-tx' },
      destinationRecovery: {
        uuid: 'supply-uuid',
        accountId: 'account',
        networkId,
        accountAddress: '0xowner',
      },
    }),
  );
});

it('persists the actual direct supply identity even without an upstream receipt', async () => {
  jest
    .mocked(readLoanRoutePosition)
    .mockResolvedValue({ collateralSupplied: '0' } as Awaited<
      ReturnType<typeof readLoanRoutePosition>
    >);
  jest
    .spyOn(backgroundApiProxy.serviceStaking, 'fetchTokenAllowance')
    .mockResolvedValue({ allowance: '100000000', allowanceParsed: '100' });
  jest
    .spyOn(backgroundApiProxy.serviceStaking, 'borrowBuildSupplyTransaction')
    .mockResolvedValue({ tx: '{}', orderId: 'order' });
  confirm.mockImplementation(
    async ({ onBeforeSend, onCancel, preserveBatchTxIds }) => {
      expect(preserveBatchTxIds).toBe(true);
      await onBeforeSend?.({
        unsignedTxs: [
          {
            uuid: 'direct-uuid',
            accountId: 'account',
            networkId,
          } as IUnsignedTxPro,
        ],
      });
      onCancel?.();
    },
  );
  const { result } = renderHook(() =>
    useLoanRouterRun({ ...plan, onDone: jest.fn() }),
  );
  await act(async () =>
    result.current.start({
      ...plan,
      collateralAmount: '10',
      borrowAmount: '0',
    }),
  );
  expect(store.get(supplyKey)).toEqual(
    expect.objectContaining({
      status: 'unknown',
      source: undefined,
      destinationRecovery: {
        uuid: 'direct-uuid',
        accountId: 'account',
        networkId,
        accountAddress: '0xowner',
      },
    }),
  );
});

it.each(['account', 'network'] as const)(
  'blocks a direct batch with a mismatched later %s',
  async (mismatch) => {
    jest
      .mocked(readLoanRoutePosition)
      .mockResolvedValue({ collateralSupplied: '0' } as Awaited<
        ReturnType<typeof readLoanRoutePosition>
      >);
    jest
      .spyOn(backgroundApiProxy.serviceStaking, 'fetchTokenAllowance')
      .mockResolvedValue({ allowance: '100000000', allowanceParsed: '100' });
    jest
      .spyOn(backgroundApiProxy.serviceStaking, 'borrowBuildSupplyTransaction')
      .mockResolvedValue({ tx: '{}', orderId: 'order' });
    const checked = jest.fn();
    confirm.mockImplementation(async ({ onBeforeSend, onCancel }) => {
      await expect(
        onBeforeSend?.({
          unsignedTxs: [
            {
              uuid: 'first',
              accountId: 'account',
              networkId,
            } as IUnsignedTxPro,
            {
              uuid: 'second',
              accountId: mismatch === 'account' ? 'other' : 'account',
              networkId: mismatch === 'network' ? 'evm--2' : networkId,
            } as IUnsignedTxPro,
          ],
        }),
      ).rejects.toThrow();
      checked();
      onCancel?.();
    });
    const { result } = renderHook(() =>
      useLoanRouterRun({ ...plan, onDone: jest.fn() }),
    );
    await act(async () =>
      result.current.start({
        ...plan,
        collateralAmount: '10',
        borrowAmount: '0',
      }),
    );
    expect(checked).toHaveBeenCalledTimes(1);
    expect(store.get(supplyKey)?.status).not.toBe('submitted');
  },
);

it('recovers a submitted supply by identity before checking the position delta', async () => {
  store.set('swap-source', {
    status: 'funded',
    txId: 'swap-tx',
    receivedAmount: '10',
  });
  store.set(supplyKey, {
    status: 'unknown',
    intentAmount: '10',
    positionBefore: '0',
    source: { scope: 'swap-source', txId: 'swap-tx' },
    destinationRecovery: {
      uuid: 'supply-uuid',
      accountId: 'account',
      networkId,
      accountAddress: '0xowner',
    },
  });
  jest.mocked(recoverEarnFundingDestination).mockImplementation(async (key) => {
    const current = store.get(key);
    if (!current) return null;
    const submitted = {
      ...current,
      status: 'submitted' as const,
      txId: 'supply-tx',
    };
    store.set(key, submitted);
    return submitted;
  });
  jest
    .mocked(readLoanRoutePosition)
    .mockResolvedValue({ collateralSupplied: '10' } as Awaited<
      ReturnType<typeof readLoanRoutePosition>
    >);
  const { result } = renderHook(() =>
    useLoanRouterRun({ ...plan, onDone: jest.fn() }),
  );
  expect(result.current.canReconcile).toBe(true);
  await act(async () => result.current.reconcile());
  expect(recoverEarnFundingDestination).toHaveBeenCalledWith(supplyKey);
  expect(waitForTxFinalStatus).toHaveBeenCalledWith(
    expect.objectContaining({ txid: 'supply-tx' }),
  );
  expect(completeEarnFunding).toHaveBeenCalledWith(supplyKey, 'supply-tx', {
    keepDestination: true,
  });
  expect(store.has('swap-source')).toBe(false);
});

it.each([
  { unsignedTxs: [] },
  {
    unsignedTxs: [
      { uuid: 'supply-uuid', accountId: 'other', networkId } as IUnsignedTxPro,
    ],
  },
  {
    unsignedTxs: [
      {
        uuid: 'supply-uuid',
        accountId: 'account',
        networkId: 'evm--2',
      } as IUnsignedTxPro,
    ],
  },
])(
  'does not send a funded supply with an invalid transaction identity: %p',
  async ({ unsignedTxs }) => {
    jest
      .mocked(readLoanRoutePosition)
      .mockResolvedValue({ collateralSupplied: '0' } as Awaited<
        ReturnType<typeof readLoanRoutePosition>
      >);
    jest
      .spyOn(backgroundApiProxy.serviceStaking, 'fetchTokenAllowance')
      .mockResolvedValue({ allowance: '100000000', allowanceParsed: '100' });
    jest
      .spyOn(backgroundApiProxy.serviceStaking, 'borrowBuildSupplyTransaction')
      .mockResolvedValue({ tx: '{}', orderId: 'order' });
    store.set('swap-source', {
      status: 'funded',
      txId: 'swap-tx',
      receivedAmount: '10',
    });
    confirm.mockImplementation(async ({ onBeforeSend }) => {
      await onBeforeSend?.({ unsignedTxs });
    });
    const { result } = renderHook(() =>
      useLoanRouterRun({ ...plan, onDone: jest.fn() }),
    );
    await act(async () =>
      result.current.start({
        ...plan,
        collateralAmount: '10',
        borrowAmount: '0',
        fundingSource: { scope: 'swap-source', txId: 'swap-tx' },
      }),
    );
    expect(store.has(supplyKey)).toBe(false);
    expect(store.get('swap-source')).toEqual(
      expect.objectContaining({ txId: 'swap-tx' }),
    );
  },
);

it('keeps source funding when destination recovery has no accepted identity', async () => {
  const unknown = {
    status: 'unknown' as const,
    intentAmount: '10',
    positionBefore: '0',
    source: { scope: 'swap-source', txId: 'swap-tx' },
    destinationRecovery: {
      uuid: 'supply-uuid',
      accountId: 'account',
      networkId,
      accountAddress: '0xowner',
    },
  };
  store.set('swap-source', {
    status: 'funded',
    txId: 'swap-tx',
    receivedAmount: '10',
  });
  store.set(supplyKey, unknown);
  jest.mocked(recoverEarnFundingDestination).mockResolvedValue(unknown);
  const { result } = renderHook(() =>
    useLoanRouterRun({ ...plan, onDone: jest.fn() }),
  );
  await act(async () => result.current.reconcile());
  expect(store.get(supplyKey)).toEqual(unknown);
  expect(store.has('swap-source')).toBe(true);
  expect(waitForTxFinalStatus).not.toHaveBeenCalled();
  expect(completeEarnFunding).not.toHaveBeenCalled();
});

it('does not recover a destination after switching account during its read', async () => {
  const unknown = {
    status: 'unknown' as const,
    intentAmount: '10',
    positionBefore: '0',
    source: { scope: 'swap-source', txId: 'swap-tx' },
    destinationRecovery: {
      uuid: 'supply-uuid',
      accountId: 'account',
      networkId,
      accountAddress: '0xowner',
    },
  };
  store.set(supplyKey, unknown);
  let finish: ((value: typeof unknown) => void) | undefined;
  jest.mocked(refreshEarnFunding).mockImplementation(async (key) =>
    key === supplyKey
      ? new Promise<typeof unknown>((resolve) => {
          finish = resolve;
        })
      : store.get(key),
  );
  const { result, rerender } = renderHook(
    ({ accountId }: { accountId: string }) =>
      useLoanRouterRun({
        ...plan,
        networkAccountId: accountId,
        onDone: jest.fn(),
      }),
    { initialProps: { accountId: 'account' } },
  );
  let pending: Promise<void> | undefined;
  await act(async () => {
    pending = result.current.reconcile();
    await waitFor(() => expect(finish).toBeDefined());
  });
  rerender({ accountId: 'another-account' });
  await act(async () => {
    finish?.(unknown);
    await pending;
  });
  expect(recoverEarnFundingDestination).not.toHaveBeenCalled();
  expect(releaseEarnFunding).not.toHaveBeenCalled();
  expect(completeEarnFunding).not.toHaveBeenCalled();
});

it('releases a recovered failed supply while retaining the source receipt', async () => {
  const unknown = {
    status: 'unknown' as const,
    intentAmount: '10',
    positionBefore: '0',
    source: { scope: 'swap-source', txId: 'swap-tx' },
    destinationRecovery: {
      uuid: 'supply-uuid',
      accountId: 'account',
      networkId,
      accountAddress: '0xowner',
    },
  };
  store.set('swap-source', {
    status: 'funded',
    txId: 'swap-tx',
    receivedAmount: '10',
  });
  store.set(supplyKey, unknown);
  jest.mocked(recoverEarnFundingDestination).mockImplementation(async (key) => {
    const submitted = {
      ...unknown,
      status: 'submitted' as const,
      txId: 'failed-tx',
    };
    store.set(key, submitted);
    return submitted;
  });
  jest
    .mocked(waitForTxFinalStatus)
    .mockResolvedValue(EOnChainHistoryTxStatus.Failed);
  const { result } = renderHook(() =>
    useLoanRouterRun({ ...plan, onDone: jest.fn() }),
  );
  await act(async () => result.current.reconcile());
  expect(releaseEarnFunding).toHaveBeenCalledWith(supplyKey, 'failed-tx');
  expect(store.has('swap-source')).toBe(true);
  expect(completeEarnFunding).not.toHaveBeenCalled();
});

it('keeps the original claim when two destination guards overlap', async () => {
  jest
    .mocked(readLoanRoutePosition)
    .mockResolvedValue({ collateralSupplied: '0' } as Awaited<
      ReturnType<typeof readLoanRoutePosition>
    >);
  jest
    .spyOn(backgroundApiProxy.serviceStaking, 'fetchTokenAllowance')
    .mockResolvedValue({ allowance: '100000000', allowanceParsed: '100' });
  jest
    .spyOn(backgroundApiProxy.serviceStaking, 'borrowBuildSupplyTransaction')
    .mockResolvedValue({ tx: '{}', orderId: 'order' });
  let finish: (() => void) | undefined;
  const release = jest.fn(async () => {});
  jest.mocked(reserveEarnFunding).mockReturnValue({
    markUnknown: async () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    markSubmitted: jest.fn(),
    markFunded: jest.fn(),
    release,
  });
  confirm.mockImplementation(async ({ onBeforeSend, onSafePreSendFail }) => {
    const first = onBeforeSend?.({
      unsignedTxs: [
        { uuid: 'first', accountId: 'account', networkId } as IUnsignedTxPro,
      ],
    });
    await waitFor(() => expect(finish).toBeDefined());
    await expect(
      onBeforeSend?.({
        unsignedTxs: [
          { uuid: 'second', accountId: 'account', networkId } as IUnsignedTxPro,
        ],
      }),
    ).rejects.toThrow();
    onSafePreSendFail?.(new Error('duplicate guard'));
    finish?.();
    await first;
  });
  const { result } = renderHook(() =>
    useLoanRouterRun({ ...plan, onDone: jest.fn() }),
  );
  await act(async () =>
    result.current.start({
      ...plan,
      collateralAmount: '10',
      borrowAmount: '0',
      fundingSource: { scope: 'swap-source', txId: 'swap-tx' },
    }),
  );
  expect(release).not.toHaveBeenCalled();
});

it('does not repeat a destination send after its result becomes unknown', async () => {
  jest
    .mocked(readLoanRoutePosition)
    .mockResolvedValue({ collateralSupplied: '0' } as Awaited<
      ReturnType<typeof readLoanRoutePosition>
    >);
  jest
    .spyOn(backgroundApiProxy.serviceStaking, 'fetchTokenAllowance')
    .mockResolvedValue({ allowance: '100000000', allowanceParsed: '100' });
  jest
    .spyOn(backgroundApiProxy.serviceStaking, 'borrowBuildSupplyTransaction')
    .mockResolvedValue({ tx: '{}', orderId: 'order' });
  confirm.mockImplementation(
    async ({ onBeforeSend, onConfirmationFail, onSafePreSendFail }) => {
      const params = {
        unsignedTxs: [
          {
            uuid: 'supply-uuid',
            accountId: 'account',
            networkId,
          } as IUnsignedTxPro,
        ],
      };
      await onBeforeSend?.(params);
      onConfirmationFail?.(new Error('unknown broadcast'));
      await expect(onBeforeSend?.(params)).rejects.toThrow();
      onSafePreSendFail?.(new Error('duplicate'));
    },
  );
  const { result } = renderHook(() =>
    useLoanRouterRun({ ...plan, onDone: jest.fn() }),
  );
  await act(async () =>
    result.current.start({
      ...plan,
      collateralAmount: '10',
      borrowAmount: '0',
      fundingSource: { scope: 'swap-source', txId: 'swap-tx' },
    }),
  );
  expect(store.get(supplyKey)).toEqual(
    expect.objectContaining({
      status: 'unknown',
      destinationRecovery: expect.objectContaining({ uuid: 'supply-uuid' }),
    }),
  );
});

it.each(['Unknown', 'Kamino'])(
  'does not skip a missing EVM approval target for %s',
  async (provider) => {
    const buildSupply = jest.spyOn(
      backgroundApiProxy.serviceStaking,
      'borrowBuildSupplyTransaction',
    );
    const fetchAllowance = jest.spyOn(
      backgroundApiProxy.serviceStaking,
      'fetchTokenAllowance',
    );
    const evmRoute = {
      ...route,
      market: { ...route.market, provider },
    };
    const { result } = renderHook(() =>
      useLoanRouterRun({ ...plan, route: evmRoute, onDone: jest.fn() }),
    );
    await act(async () =>
      result.current.start({
        ...plan,
        route: evmRoute,
        collateralAmount: '10',
        borrowAmount: '0',
      }),
    );
    expect(fetchAllowance).not.toHaveBeenCalled();
    expect(buildSupply).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  },
);

it('requires a borrow-only plan when the same route already has retained supply', async () => {
  store.set(supplyKey, {
    status: 'funded',
    txId: 'supply-tx',
    receivedAmount: '10',
  });
  const borrow = jest
    .spyOn(backgroundApiProxy.serviceStaking, 'borrowBuildBorrowTransaction')
    .mockResolvedValue({ tx: '{}', orderId: 'borrow-order' });
  const supply = jest.spyOn(
    backgroundApiProxy.serviceStaking,
    'borrowBuildSupplyTransaction',
  );
  confirm.mockImplementation(async ({ onCancel }) => onCancel?.());
  const { result } = renderHook(() =>
    useLoanRouterRun({ ...plan, onDone: jest.fn() }),
  );
  await act(async () =>
    result.current.start({
      ...plan,
      collateralAmount: '10',
      borrowAmount: '4',
    }),
  );
  expect(borrow).not.toHaveBeenCalled();
  expect(supply).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
  await act(async () =>
    result.current.start({ ...plan, collateralAmount: '0', borrowAmount: '4' }),
  );
  expect(borrow).toHaveBeenCalledWith(
    expect.objectContaining({ amount: '4', networkId }),
  );
  expect(supply).not.toHaveBeenCalled();
  expect(confirm).toHaveBeenCalledTimes(1);
});

it.each([2, 3])(
  'does not reuse collateral that becomes funded on supply read %i',
  async (fundedAt) => {
    let supplyReads = 0;
    const funded = {
      status: 'funded' as const,
      txId: 'supply-tx',
      receivedAmount: '10',
    };
    jest.mocked(refreshEarnFunding).mockImplementation(async (key) => {
      if (key === supplyKey) {
        supplyReads += 1;
        return supplyReads >= fundedAt ? funded : undefined;
      }
      return store.get(key);
    });
    jest
      .spyOn(backgroundApiProxy.serviceStaking, 'fetchTokenAllowance')
      .mockResolvedValue({ allowance: '100000000', allowanceParsed: '100' });
    const borrow = jest.spyOn(
      backgroundApiProxy.serviceStaking,
      'borrowBuildBorrowTransaction',
    );
    const supply = jest.spyOn(
      backgroundApiProxy.serviceStaking,
      'borrowBuildSupplyTransaction',
    );
    const { result } = renderHook(() =>
      useLoanRouterRun({ ...plan, onDone: jest.fn() }),
    );
    await act(async () =>
      result.current.start({
        ...plan,
        collateralAmount: '10',
        borrowAmount: '4',
      }),
    );
    expect(supplyReads).toBeGreaterThanOrEqual(fundedAt);
    expect(borrow).not.toHaveBeenCalled();
    expect(supply).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(completeEarnFunding).not.toHaveBeenCalled();
  },
);

it('keeps the original funded supply as the borrow source without repeating supply', async () => {
  store.set('swap-source', {
    status: 'funded',
    txId: 'swap-tx',
    receivedAmount: '10',
  });
  store.set(supplyKey, {
    status: 'funded',
    txId: 'supply-tx',
    receivedAmount: '10',
    source: { scope: 'swap-source', txId: 'swap-tx' },
  });
  const borrow = jest
    .spyOn(backgroundApiProxy.serviceStaking, 'borrowBuildBorrowTransaction')
    .mockResolvedValue({ tx: '{}', orderId: 'borrow-order' });
  const supply = jest.spyOn(
    backgroundApiProxy.serviceStaking,
    'borrowBuildSupplyTransaction',
  );
  confirm.mockImplementation(async ({ onCancel }) => onCancel?.());
  const { result } = renderHook(() =>
    useLoanRouterRun({ ...plan, onDone: jest.fn() }),
  );
  await act(async () =>
    result.current.start({ ...plan, collateralAmount: '0', borrowAmount: '4' }),
  );
  expect(completeEarnFunding).toHaveBeenCalledTimes(1);
  expect(completeEarnFunding).toHaveBeenCalledWith(supplyKey, 'supply-tx', {
    keepDestination: true,
  });
  expect(reserveEarnFunding).toHaveBeenCalledWith(
    borrowKey,
    expect.objectContaining({
      source: { scope: supplyKey, txId: 'supply-tx' },
    }),
  );
  expect(borrow).toHaveBeenCalledTimes(1);
  expect(supply).not.toHaveBeenCalled();
});

it('acknowledges a retained supply by consuming its source before clearing it', async () => {
  store.set('swap-source', {
    status: 'funded',
    txId: 'swap-tx',
    receivedAmount: '10',
  });
  store.set(supplyKey, {
    status: 'funded',
    txId: 'supply-tx',
    receivedAmount: '10',
    source: { scope: 'swap-source', txId: 'swap-tx' },
  });
  const { result } = renderHook(() =>
    useLoanRouterRun({ ...plan, onDone: jest.fn() }),
  );
  await act(async () => {
    expect(await result.current.acknowledgeFundedSupply()).toBe(true);
  });
  expect(completeEarnFunding).toHaveBeenCalledWith(supplyKey, 'supply-tx', {
    keepDestination: true,
  });
  expect(releaseEarnFunding).toHaveBeenCalledWith(
    supplyKey,
    'supply-tx',
    'funded',
  );
  expect(
    jest.mocked(completeEarnFunding).mock.invocationCallOrder[0],
  ).toBeLessThan(jest.mocked(releaseEarnFunding).mock.invocationCallOrder[0]);
  expect(store.has('swap-source')).toBe(false);
  expect(store.has(supplyKey)).toBe(false);
});

it('does not acknowledge a replacement supply that appeared after the displayed one', async () => {
  store.set(supplyKey, {
    status: 'funded',
    txId: 'supply-a',
    receivedAmount: '10',
  });
  const { result } = renderHook(() =>
    useLoanRouterRun({ ...plan, onDone: jest.fn() }),
  );
  let finish: (() => void) | undefined;
  jest.mocked(refreshEarnFunding).mockImplementation(async (key) => {
    if (key === supplyKey)
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    return store.get(key);
  });
  let pending: Promise<boolean> | undefined;
  await act(async () => {
    pending = result.current.acknowledgeFundedSupply();
    await waitFor(() => expect(finish).toBeDefined());
  });
  store.set('swap-source', {
    status: 'funded',
    txId: 'swap-b',
    receivedAmount: '20',
  });
  store.set(supplyKey, {
    status: 'funded',
    txId: 'supply-b',
    receivedAmount: '20',
    source: { scope: 'swap-source', txId: 'swap-b' },
  });
  await act(async () => {
    finish?.();
    expect(await pending).toBe(false);
  });
  expect(completeEarnFunding).not.toHaveBeenCalled();
  expect(releaseEarnFunding).not.toHaveBeenCalled();
  expect(store.get(supplyKey)).toEqual(
    expect.objectContaining({ txId: 'supply-b' }),
  );
  expect(store.has('swap-source')).toBe(true);
});

it('keeps a retained supply locked when its source or downstream claim conflicts', async () => {
  store.set(supplyKey, {
    status: 'funded',
    txId: 'supply-tx',
    receivedAmount: '10',
    source: { scope: 'swap-source', txId: 'swap-tx' },
  });
  const { result } = renderHook(() =>
    useLoanRouterRun({ ...plan, onDone: jest.fn() }),
  );
  await act(async () => {
    expect(await result.current.acknowledgeFundedSupply()).toBe(false);
  });
  expect(releaseEarnFunding).not.toHaveBeenCalled();
  expect(store.get(supplyKey)).toEqual(
    expect.objectContaining({
      source: { scope: 'swap-source', txId: 'swap-tx' },
    }),
  );
  store.set(supplyKey, {
    status: 'funded',
    txId: 'supply-tx',
    receivedAmount: '10',
  });
  jest.mocked(releaseEarnFunding).mockResolvedValue(undefined);
  await act(async () => {
    expect(await result.current.acknowledgeFundedSupply()).toBe(false);
  });
  expect(store.get(supplyKey)).toEqual(
    expect.objectContaining({ txId: 'supply-tx' }),
  );
});

it('deduplicates simultaneous attempts to acknowledge retained supply', async () => {
  store.set(supplyKey, {
    status: 'funded',
    txId: 'supply-tx',
    receivedAmount: '10',
  });
  let finish: (() => void) | undefined;
  jest.mocked(releaseEarnFunding).mockImplementation(async () => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    store.delete(supplyKey);
  });
  const { result } = renderHook(() =>
    useLoanRouterRun({ ...plan, onDone: jest.fn() }),
  );
  let first: Promise<boolean> | undefined;
  await act(async () => {
    first = result.current.acknowledgeFundedSupply();
    await waitFor(() => expect(finish).toBeDefined());
    expect(await result.current.acknowledgeFundedSupply()).toBe(false);
    finish?.();
    expect(await first).toBe(true);
  });
  expect(releaseEarnFunding).toHaveBeenCalledTimes(1);
});

it('does not clear retained supply after switching accounts during the read', async () => {
  const funded = {
    status: 'funded' as const,
    txId: 'supply-tx',
    receivedAmount: '10',
  };
  store.set(supplyKey, funded);
  let finish: ((value: typeof funded) => void) | undefined;
  jest.mocked(refreshEarnFunding).mockImplementation(async (key) => {
    if (key === supplyKey)
      return new Promise<typeof funded>((resolve) => {
        finish = resolve;
      });
    return store.get(key);
  });
  const { result, rerender } = renderHook(
    ({ accountId }: { accountId: string }) =>
      useLoanRouterRun({
        ...plan,
        networkAccountId: accountId,
        onDone: jest.fn(),
      }),
    { initialProps: { accountId: 'account' } },
  );
  let pending: Promise<boolean> | undefined;
  await act(async () => {
    pending = result.current.acknowledgeFundedSupply();
    await waitFor(() => expect(finish).toBeDefined());
  });
  rerender({ accountId: 'another-account' });
  await act(async () => {
    finish?.(funded);
    expect(await pending).toBe(false);
  });
  expect(releaseEarnFunding).not.toHaveBeenCalled();
  expect(store.get(supplyKey)).toEqual(funded);
});

it('does not apply a retained supply from a different market to a new supply', async () => {
  store.set(supplyKey, {
    status: 'funded',
    txId: 'supply-tx',
    receivedAmount: '10',
  });
  const otherRoute = {
    ...route,
    key: 'other-market',
    market: { ...route.market, marketAddress: '0xother' },
  };
  jest
    .mocked(readLoanRoutePosition)
    .mockResolvedValue({ collateralSupplied: '0' } as Awaited<
      ReturnType<typeof readLoanRoutePosition>
    >);
  jest
    .spyOn(backgroundApiProxy.serviceStaking, 'fetchTokenAllowance')
    .mockResolvedValue({ allowance: '100000000', allowanceParsed: '100' });
  const supply = jest
    .spyOn(backgroundApiProxy.serviceStaking, 'borrowBuildSupplyTransaction')
    .mockResolvedValue({ tx: '{}', orderId: 'other-order' });
  confirm.mockImplementation(async ({ onCancel }) => onCancel?.());
  const { result } = renderHook(() =>
    useLoanRouterRun({ ...plan, route: otherRoute, onDone: jest.fn() }),
  );
  await act(async () =>
    result.current.start({
      ...plan,
      route: otherRoute,
      collateralAmount: '5',
      borrowAmount: '0',
    }),
  );
  expect(supply).toHaveBeenCalledWith(
    expect.objectContaining({ marketAddress: '0xother', amount: '5' }),
  );
  expect(store.get(supplyKey)).toEqual(
    expect.objectContaining({ txId: 'supply-tx' }),
  );
});
