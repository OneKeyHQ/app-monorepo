import { buildRecoveredEarnSwapHistory } from '@onekeyhq/shared/src/utils/earnSwapRecovery';
import type {
  IEarnFundingState,
  IEarnSwapRecovery,
} from '@onekeyhq/shared/types/earn/funding';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';
import type {
  ISwapToken,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

import { isTaskAccountCurrent } from '../../tasks/taskAccount';

import { reconcileEarnSwapFunding } from './earnRouterSwap';

const mockRefresh = jest.fn<Promise<IEarnFundingState | undefined>, [string]>();
const mockGetFunding = jest.fn<IEarnFundingState | undefined, [string]>();
const mockGetHistory = jest.fn<
  Promise<ISwapTxHistory | undefined>,
  [{ txId: string }]
>();
const mockRestoreHistory = jest.fn<
  Promise<boolean>,
  [{ scope: string; txId: string }]
>();
const mockRecoverFunding = jest.fn<Promise<void>, [string]>();
const mockRelease = jest.fn<Promise<void>, [string, string]>();
const mockFetchState = jest.fn<
  Promise<{ state: ESwapTxHistoryStatus }>,
  [unknown]
>();
jest.mock('./earnFundingRegistry', () => ({
  refreshEarnFunding: (scope: string) => mockRefresh(scope),
  getEarnFunding: (scope: string) => mockGetFunding(scope),
  releaseEarnFunding: (scope: string, txId: string) => mockRelease(scope, txId),
  settleEarnFunding: jest.fn(),
}));
jest.mock('../../tasks/taskAccount', () => ({
  ...jest.requireActual<typeof import('../../tasks/taskAccount')>(
    '../../tasks/taskAccount',
  ),
  isTaskAccountCurrent: jest.fn(async () => true),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      recoverEarnSwapFunding: (scope: string) => mockRecoverFunding(scope),
    },
    serviceSwap: {
      getSwapHistoryByTxId: (params: { txId: string }) =>
        mockGetHistory(params),
      restoreEarnSwapHistory: (params: { scope: string; txId: string }) =>
        mockRestoreHistory(params),
      fetchTxState: (params: unknown) => mockFetchState(params),
    },
  },
}));

const fromToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0x1',
  symbol: 'A',
  decimals: 18,
};
const toToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0x2',
  symbol: 'B',
  decimals: 6,
};
const account = { accountId: 'account', networkId: 'evm--1', address: '0xabc' };
const recovery: IEarnSwapRecovery = {
  sender: { ...account, amount: '1', token: fromToken },
  receiver: { ...account, amount: '2', token: toToken },
  provider: { provider: 'provider', providerName: 'Provider' },
  useOrderId: false,
  currency: { id: 'usd', symbol: '$' },
  createdAt: 1,
};
const state: IEarnFundingState = {
  status: 'submitted',
  txId: 'swap-tx',
  intentAmount: '1',
  swapRecovery: recovery,
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(isTaskAccountCurrent).mockResolvedValue(true);
  mockRefresh.mockResolvedValue(state);
  mockGetFunding.mockReturnValue(state);
  mockRestoreHistory.mockResolvedValue(true);
  mockFetchState.mockResolvedValue({ state: ESwapTxHistoryStatus.PENDING });
});

it('rechecks a persisted unknown swap before restoring its history', async () => {
  const unknown: IEarnFundingState = {
    status: 'unknown',
    intentAmount: '1',
    swapRecovery: recovery,
    swapTxUuid: 'swap-uuid',
  };
  mockRefresh.mockResolvedValueOnce(unknown).mockResolvedValue(state);
  mockGetHistory
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(buildRecoveredEarnSwapHistory(recovery, 'swap-tx'));
  await reconcileEarnSwapFunding({
    scope: 'scope',
    fromToken,
    toToken,
    account,
  });
  expect(mockRecoverFunding).toHaveBeenCalledWith('scope');
  expect(mockRestoreHistory).toHaveBeenCalledWith({
    scope: 'scope',
    txId: 'swap-tx',
  });
});

it('keeps an unverified or conflicting unknown attempt blocked', async () => {
  const unknown: IEarnFundingState = {
    status: 'unknown',
    intentAmount: '1',
    swapRecovery: recovery,
    swapTxUuid: 'swap-uuid',
  };
  mockRefresh.mockResolvedValue(unknown);
  await reconcileEarnSwapFunding({
    scope: 'scope',
    fromToken,
    toToken,
    account,
  });
  expect(mockRecoverFunding).toHaveBeenCalledTimes(1);
  expect(mockRestoreHistory).not.toHaveBeenCalled();
  mockRecoverFunding.mockClear();
  mockRefresh.mockResolvedValue({ ...unknown, txIdConflict: true });
  await reconcileEarnSwapFunding({
    scope: 'scope',
    fromToken,
    toToken,
    account,
  });
  expect(mockRecoverFunding).not.toHaveBeenCalled();
});

it('releases a proven failed source transaction only after persisting failed history', async () => {
  const failed: IEarnFundingState = {
    ...state,
    status: 'submitted',
    txId: 'swap-tx',
    sourceTxFailed: true,
  };
  const existing = buildRecoveredEarnSwapHistory(recovery, 'swap-tx');
  mockRefresh.mockResolvedValue(failed);
  mockGetFunding.mockReturnValue(failed);
  mockGetHistory.mockResolvedValueOnce(existing).mockResolvedValueOnce({
    ...existing,
    status: ESwapTxHistoryStatus.FAILED,
    sourceTxFailed: true,
  });
  await reconcileEarnSwapFunding({
    scope: 'scope',
    fromToken,
    toToken,
    account,
  });
  expect(mockRestoreHistory).toHaveBeenCalledWith({
    scope: 'scope',
    txId: 'swap-tx',
  });
  expect(mockRelease).toHaveBeenCalledWith('scope', 'swap-tx');
  expect(mockFetchState).not.toHaveBeenCalled();
});

it('recreates a missing history from the persisted same-scope submitted receipt', async () => {
  mockGetHistory
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(buildRecoveredEarnSwapHistory(recovery, 'swap-tx'));
  await reconcileEarnSwapFunding({
    scope: 'scope',
    fromToken,
    toToken,
    account,
  });
  expect(mockRestoreHistory).toHaveBeenCalledWith({
    scope: 'scope',
    txId: 'swap-tx',
  });
  expect(mockFetchState).toHaveBeenCalledWith(
    expect.objectContaining({ txId: 'swap-tx', provider: 'provider' }),
  );
});

it('does not recreate history for a different account or a changed transaction', async () => {
  mockGetHistory.mockResolvedValue(undefined);
  mockRefresh
    .mockResolvedValueOnce(state)
    .mockResolvedValueOnce({ ...state, txId: 'another-tx' });
  await reconcileEarnSwapFunding({
    scope: 'scope',
    fromToken,
    toToken,
    account,
  });
  expect(mockRestoreHistory).not.toHaveBeenCalled();
  mockRefresh.mockResolvedValue({
    ...state,
    swapRecovery: {
      ...recovery,
      sender: { ...recovery.sender, accountId: 'other' },
    },
  });
  await reconcileEarnSwapFunding({
    scope: 'scope',
    fromToken,
    toToken,
    account,
  });
  expect(mockRestoreHistory).not.toHaveBeenCalled();
});

it('leaves a legacy submitted record unchanged when it has no recovery snapshot', async () => {
  mockGetHistory.mockResolvedValue(undefined);
  mockRefresh.mockResolvedValue({ status: 'submitted', txId: 'old-tx' });
  await reconcileEarnSwapFunding({
    scope: 'scope',
    fromToken,
    toToken,
    account,
  });
  expect(mockRestoreHistory).not.toHaveBeenCalled();
});
