/** @jest-environment jsdom */
/* eslint-disable import/first */

const mockGetEarnAssetsList = jest.fn<Promise<unknown>, unknown[]>();
const mockFetchTokensDetails = jest.fn<Promise<unknown>, unknown[]>();
const mockRetainedAccountAddress = jest.fn<Promise<string>, []>();
const mockRetainedStakeForm = jest.fn<void, [unknown]>();
const mockBorrowSupplyScope = jest.fn();
const mockBorrowBorrowScope = jest.fn();
const mockHandleStake = jest.fn<
  Promise<boolean>,
  [
    Parameters<
      ReturnType<
        typeof import('../../../hooks/useUniversalHooks').useUniversalStake
      >
    >[0],
  ]
>();
const mockRemovePermitCache = jest.fn();
const mockWaitForTxFinalStatus = jest.fn<Promise<undefined>, [unknown]>();
const mockConfirmStake = jest.fn<
  void,
  [
    import('../../../earnDepositTask/types').IEarnStakeConfirmParams,
    (
      | ((
          params: import('../../../earnDepositTask/types').IEarnStakeConfirmParams,
        ) => Promise<boolean>)
      | undefined
    ),
  ]
>();
const mockStakeApproval = jest.fn<
  {
    approve?: { approveType: string; approveTarget: string };
    error: boolean;
    retry: () => void;
  },
  [unknown]
>();
const mockStakeRender = jest.fn<
  void,
  [
    {
      balance?: string;
      tokenSymbol?: string;
      isDisabled?: boolean;
      isStakeAssetLoading?: boolean;
      isStakeAssetRefreshing?: boolean;
    },
  ]
>();
const mockPushModal = jest.fn<
  void,
  [
    unknown,
    {
      params: {
        onSelect: (
          asset: import('@onekeyhq/shared/types/staking').IEarnTokenItem,
        ) => void;
      };
    },
  ]
>();

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isWeb: true },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => ({
  waitForTxFinalStatus: (params: unknown) => mockWaitForTxFinalStatus(params),
}));
jest.mock('@onekeyhq/components', () => {
  const { useDeferredPromise } = jest.requireActual<
    typeof import('../../../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../../../components/src/hooks/useDeferredPromise');
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
    Spinner: () => <div data-testid="task-loading" />,
    YStack: ({ children }: { children?: import('react').ReactNode }) => (
      <div>{children}</div>
    ),
    SizableText: ({ children }: { children?: import('react').ReactNode }) => (
      <span>{children}</span>
    ),
    Button: ({
      children,
      onPress,
    }: {
      children?: import('react').ReactNode;
      onPress?: () => void;
    }) => <button onClick={onPress}>{children}</button>,
    Alert: ({ action }: { action?: { onPrimaryPress?: () => void } }) => (
      <button data-testid="stake-assets-retry" onClick={action?.onPrimaryPress}>
        Retry
      </button>
    ),
  };
});
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccountAddressForApi: () => mockRetainedAccountAddress(),
    },
    serviceStaking: {
      getEarnAssetsList: (...args: unknown[]) => mockGetEarnAssetsList(...args),
      fetchTokenAllowance: async () => ({ allowanceParsed: '0' }),
    },
    serviceToken: {
      fetchTokensDetails: (...args: unknown[]) =>
        mockFetchTokensDetails(...args),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/earn/actions', () => ({
  useEarnActions: () => ({
    current: { removePermitCache: mockRemovePermitCache },
  }),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Borrow/components/borrowRepayPosition.utils',
  () => ({
    buildAaveNativeGatewayReceiveToken: jest.fn(),
    isUnsupportedAaveNativeReserve: () => false,
    resolveBorrowTokenApproveSpenderAddress: () => '',
    shouldUseAaveNativeGateway: () => false,
  }),
);
jest.mock('@onekeyhq/kit/src/views/Borrow/components/ManagePosition', () => ({
  ManagePosition: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Borrow/components/ManagePosition/borrowApproval.utils',
  () => ({
    buildBorrowTokenApproveTarget: jest.fn(),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Borrow/hooks/useUniversalBorrowHooks',
  () => ({
    useUniversalBorrowBorrow: (params: unknown) => {
      mockBorrowBorrowScope(params);
      return jest.fn();
    },
    useUniversalBorrowSupply: (params: unknown) => {
      mockBorrowSupplyScope(params);
      return jest.fn();
    },
  }),
);
jest.mock('@onekeyhq/shared/src/utils/earnUtils', () => ({
  __esModule: true,
  default: {
    isEtherFiProvider: ({ providerName }: { providerName: string }) =>
      providerName.toLowerCase() === 'etherfi',
    isNativeProvider: ({ providerName }: { providerName: string }) =>
      providerName.toLowerCase() === 'native',
    isPendleProvider: ({ providerName }: { providerName: string }) =>
      providerName.toLowerCase() === 'pendle',
    getEarnProviderName: ({ providerName }: { providerName: string }) =>
      providerName,
    shouldSendEarnProtocolVault: () => true,
  },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/networkUtils')
  >('@onekeyhq/shared/src/utils/networkUtils');
  return {
    __esModule: true,
    default: { ...actual.default, isBTCNetwork: () => false },
  };
});
jest.mock('../../../hooks/useBorrowApiParams', () => ({
  useBorrowApiParams: () => ({ isBorrow: false, borrowApiParams: {} }),
}));
jest.mock('../../../hooks/useEtherFiStakeApproval', () => ({
  useEtherFiStakeApproval: (params: unknown) => mockStakeApproval(params),
}));
jest.mock('../../../hooks/useUniversalHooks', () => ({
  useUniversalStake: () => mockHandleStake,
}));
jest.mock('../../../components/UniversalStake', () => ({
  UniversalStake: ({
    tokenSymbol,
    tokenSelectorTriggerProps,
    isStakeAssetLoading,
    isStakeAssetRefreshing,
    isDisabled,
    isInModalContext,
    beforeFooter,
    balance,
    onConfirm,
    retainedTask,
  }: {
    retainedTask?:
      | import('../../../earnDepositTask/useRetainedDepositTask').IRetainedDepositTask
      | null;
    tokenSymbol?: string;
    tokenSelectorTriggerProps?: { onPress?: () => void };
    isStakeAssetLoading?: boolean;
    isStakeAssetRefreshing?: boolean;
    isDisabled?: boolean;
    isInModalContext?: boolean;
    beforeFooter?: import('react').ReactNode;
    balance?: string;
    onConfirm?: (
      params: import('../../../earnDepositTask/types').IEarnStakeConfirmParams,
    ) => Promise<boolean>;
  }) => {
    mockRetainedStakeForm(retainedTask);
    mockConfirmStake({ amount: '1' }, onConfirm);
    mockStakeRender({
      balance,
      tokenSymbol,
      isDisabled,
      isStakeAssetLoading,
      isStakeAssetRefreshing,
    });
    return (
      <div>
        {isStakeAssetLoading ? (
          <div data-testid="stake-skeleton" />
        ) : (
          <span data-testid="stake-form">{tokenSymbol}</span>
        )}
        <button
          data-testid={isInModalContext ? 'modal-confirm' : 'confirm'}
          disabled={isDisabled || isStakeAssetLoading}
        >
          Confirm
        </button>
        {tokenSelectorTriggerProps?.onPress ? (
          <button onClick={tokenSelectorTriggerProps.onPress}>
            Select token
          </button>
        ) : null}
        {beforeFooter}
      </div>
    );
  },
}));

import { Suspense, startTransition, useState } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { EthereumWETH } from '@onekeyhq/shared/src/consts/addresses';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  IEarnAssetsList,
  IEarnTokenInfo,
  IProtocolInfo,
} from '@onekeyhq/shared/types/staking';
import { EApproveType } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { depositTaskRegistry } from '../../../earnDepositTask/registry';
import {
  createDepositTask,
  createDepositTaskState,
} from '../../../earnDepositTask/state';
import { getDepositTaskOwnerKey } from '../../../earnDepositTask/useRetainedDepositTask';

import { StakeSection } from './StakeSection';

import type { IStakeWorkflowHandoff } from '../../../earnDepositTask/types';

const weth = {
  address: EthereumWETH,
  symbol: 'WETH',
  name: 'WETH',
  isNative: false,
  networkId: 'evm--1',
  decimals: 18,
  logoURI: '',
} as IToken;
const eth = {
  ...weth,
  address: '',
  symbol: 'ETH',
  name: 'ETH',
  isNative: true,
};
const tokenInfo = {
  token: weth,
  balanceParsed: '1',
  price: '1',
} as IEarnTokenInfo;
const nativeProtocol: IProtocolInfo = {
  provider: 'native',
  providerDetail: { name: 'Native', logoURI: '' },
  networkId: 'evm--1',
  symbol: 'WETH',
  vault: 'vault',
  stakeTag: '',
};
const item = (info: IToken) => ({
  info,
  balance: '1',
  balanceParsed: '1',
  fiatValue: '1',
  price: '1',
  price24h: '1',
});

function renderStake(provider = nativeProtocol) {
  return render(
    <StakeSection
      accountId="account-1"
      networkId="evm--1"
      tokenInfo={tokenInfo}
      protocolInfo={provider}
    />,
  );
}

beforeEach(() => {
  mockRetainedAccountAddress.mockReset().mockResolvedValue('0xowner');
  mockRetainedStakeForm.mockReset();
  mockGetEarnAssetsList.mockReset();
  mockFetchTokensDetails.mockReset();
  mockStakeApproval
    .mockReset()
    .mockReturnValue({ approve: undefined, error: false, retry: jest.fn() });
  mockPushModal.mockReset();
  mockStakeRender.mockReset();
  mockHandleStake.mockReset();
  mockRemovePermitCache.mockReset();
  mockWaitForTxFinalStatus.mockReset().mockResolvedValue(undefined);
  mockConfirmStake.mockReset();
});

it.each([true, false])(
  'restores a Spark deposit cancelled after approval only for its original fixed token: %s',
  async (matchingToken) => {
    const provider = { ...nativeProtocol, provider: 'spark' };
    const entryTokenInfo = {
      ...tokenInfo,
      accountId: 'account-1',
      networkId: 'evm--1',
      balanceParsed: '7',
    };
    const openPage = () =>
      render(
        <StakeSection
          accountId="account-1"
          networkId="evm--1"
          tokenInfo={entryTokenInfo}
          protocolInfo={provider}
        />,
      );
    const ownerKey = getDepositTaskOwnerKey({
      accountId: 'account-1',
      networkId: 'evm--1',
      provider: 'spark',
      vault: 'vault',
    });
    const state = createDepositTaskState(
      createDepositTask({
        taskId: 'spark-retained',
        identity: {
          accountId: 'account-1',
          accountAddress: '0xowner',
          networkId: 'evm--1',
          provider: 'spark',
          vault: 'vault',
          inputTokenAddress: matchingToken ? EthereumWETH : '0xother-token',
          depositTokenAddress: matchingToken ? EthereumWETH : '0xother-token',
          amount: '2',
          spenderAddress: '0xspender',
        },
        steps: [
          { id: 'approve', kind: 'approve' },
          { id: 'deposit', kind: 'deposit' },
        ],
      }),
    );
    const first = openPage();
    await screen.findByTestId('stake-form');
    const reservation = depositTaskRegistry.reserve(ownerKey, state);
    expect(reservation).toBeDefined();
    if (!reservation) throw new OneKeyLocalError('Missing test reservation');
    try {
      act(() => {
        const approve = {
          taskId: 'spark-retained',
          stepId: 'approve',
          attemptId: 'approve-1',
        };
        state.dispatch({ ...approve, type: 'start' });
        state.dispatch({ ...approve, type: 'confirmationOpened' });
        state.dispatch({ ...approve, type: 'sendStarted' });
        state.dispatch({ ...approve, type: 'submitted', txid: 'approval-tx' });
        state.dispatch({ ...approve, type: 'confirmed' });
        state.dispatch({ ...approve, type: 'verified' });
        const deposit = {
          taskId: 'spark-retained',
          stepId: 'deposit',
          attemptId: 'deposit-1',
        };
        state.dispatch({ ...deposit, type: 'start' });
        state.dispatch({ ...deposit, type: 'confirmationOpened' });
        state.dispatch({ ...deposit, type: 'cancel' });
      });
      expect(state.getTask().steps.map((step) => step.status.type)).toEqual([
        'succeeded',
        'cancelled',
      ]);
      first.unmount();
      mockRetainedStakeForm.mockClear();
      const second = openPage();
      if (matchingToken) {
        await waitFor(() =>
          expect(screen.getByTestId('stake-form').textContent).toBe('WETH'),
        );
        expect(mockRetainedStakeForm).toHaveBeenLastCalledWith(
          expect.objectContaining({ state, token: reservation }),
        );
        expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(
          false,
        );
        expect(screen.queryByText('global.pending')).toBeNull();
      } else {
        await screen.findByText('global.pending');
        expect(screen.queryByTestId('stake-form')).toBeNull();
        expect(mockRetainedStakeForm).not.toHaveBeenCalled();
      }
      expect(mockGetEarnAssetsList).not.toHaveBeenCalled();
      expect(mockFetchTokensDetails).not.toHaveBeenCalled();
      expect(depositTaskRegistry.find(ownerKey)?.state).toBe(state);
      second.unmount();
    } finally {
      first.unmount();
      depositTaskRegistry.release(ownerKey, reservation);
    }
  },
);

it('restores the original asset before mounting the manage form', async () => {
  const provider = { ...nativeProtocol, provider: 'etherfi' };
  const ownerKey = getDepositTaskOwnerKey({
    accountId: 'account-1',
    networkId: 'evm--1',
    provider: 'etherfi',
    vault: 'vault',
  });
  const state = createDepositTaskState(
    createDepositTask({
      taskId: 'manage-retained',
      identity: {
        accountId: 'account-1',
        accountAddress: '0xowner',
        networkId: 'evm--1',
        provider: 'etherfi',
        vault: 'vault',
        inputTokenAddress: '',
        depositTokenAddress: EthereumWETH,
        amount: '2',
        spenderAddress: '0xspender',
      },
      steps: [
        { id: 'wrap', kind: 'wrap' },
        { id: 'deposit', kind: 'deposit' },
      ],
    }),
  );
  const reservation = depositTaskRegistry.reserve(ownerKey, state);
  expect(reservation).toBeDefined();
  if (!reservation) return;
  try {
    mockGetEarnAssetsList.mockResolvedValue({
      assets: [item(weth), item(eth)],
    });
    const view = renderStake(provider);
    await waitFor(() =>
      expect(screen.getByTestId('stake-form').textContent).toBe('ETH'),
    );
    expect(
      mockStakeRender.mock.calls.every(
        ([rendered]) => rendered.tokenSymbol === 'ETH',
      ),
    ).toBe(true);
    view.unmount();
  } finally {
    depositTaskRegistry.release(ownerKey, reservation);
  }
});

it('enables the ETH entry after independently loading wrapped metadata', async () => {
  mockGetEarnAssetsList.mockResolvedValue({ assets: [item(eth)] });
  mockFetchTokensDetails
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce([{ info: weth }]);
  mockStakeApproval.mockReturnValue({
    approve: { approveType: 'legacy', approveTarget: '0xspender' },
    error: false,
    retry: jest.fn(),
  });
  render(
    <StakeSection
      accountId="account-1"
      networkId="evm--1"
      tokenInfo={{
        ...tokenInfo,
        token: {
          ...eth,
          uniqueKey: 'eth',
          logoURI: '',
          totalSupply: '0',
          riskLevel: 0,
          coingeckoId: 'ethereum',
          networkId: 'evm--1',
        },
      }}
      protocolInfo={{ ...nativeProtocol, provider: 'etherfi', symbol: 'ETH' }}
    />,
  );
  const retry = await screen.findByTestId('stake-assets-retry');
  expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(true);
  fireEvent.click(retry);
  await waitFor(() =>
    expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(false),
  );
  expect(mockStakeApproval).toHaveBeenLastCalledWith(
    expect.objectContaining({ symbol: 'ETH', wrappedNative: true }),
  );
});

it('shows a skeleton until the asset list selects its first token', async () => {
  let resolveAssets: ((value: IEarnAssetsList) => void) | undefined;
  mockGetEarnAssetsList.mockReturnValue(
    new Promise<IEarnAssetsList>((resolve) => {
      resolveAssets = resolve;
    }),
  );
  renderStake();
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(1));
  expect(screen.getByTestId('stake-skeleton')).toBeTruthy();
  expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(true);
  expect(screen.queryByTestId('stake-form')).toBeNull();

  await act(async () => resolveAssets?.({ assets: [item(eth), item(weth)] }));
  await waitFor(() =>
    expect(screen.getByTestId('stake-form').textContent).toBe('ETH'),
  );
  expect(screen.queryByTestId('stake-skeleton')).toBeNull();
});

it('falls back to the original token when the asset list is empty', async () => {
  mockGetEarnAssetsList.mockResolvedValue({ assets: [] });
  renderStake();
  await waitFor(() =>
    expect(screen.getByTestId('stake-form').textContent).toBe('WETH'),
  );
  expect(screen.queryByTestId('stake-skeleton')).toBeNull();
});

it('keeps the Native direct WETH deposit enabled without requiring a wrap step', async () => {
  mockGetEarnAssetsList.mockResolvedValue({ assets: [item(weth), item(eth)] });
  renderStake();
  await waitFor(() =>
    expect(screen.getByTestId('stake-form').textContent).toBe('WETH'),
  );
  expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(false);
  expect(screen.queryByTestId('stake-assets-retry')).toBeNull();
});

it('keeps the Native USDT deposit independent of WETH validation', async () => {
  const usdt = {
    ...weth,
    symbol: 'USDT',
    name: 'USDT',
    address: '0x1111111111111111111111111111111111111111',
    decimals: 6,
    uniqueKey: 'evm--1-usdt',
    networkId: 'evm--1',
    isNative: false,
    logoURI: '',
    riskLevel: 0,
    coingeckoId: 'tether',
    totalSupply: '0',
  };
  mockGetEarnAssetsList.mockResolvedValue({ assets: [item(usdt)] });
  render(
    <StakeSection
      accountId="account-1"
      networkId="evm--1"
      tokenInfo={{ ...tokenInfo, token: usdt }}
      protocolInfo={{ ...nativeProtocol, symbol: 'USDT' }}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId('stake-form').textContent).toBe('USDT'),
  );
  expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(false);
  expect(screen.queryByTestId('stake-assets-retry')).toBeNull();
});

it('does not wait for an asset list for other providers', async () => {
  renderStake({ ...nativeProtocol, provider: 'aave' });
  expect(screen.getByTestId('stake-form').textContent).toBe('WETH');
  expect(screen.queryByTestId('stake-skeleton')).toBeNull();
  await act(async () => Promise.resolve());
  expect(mockGetEarnAssetsList).not.toHaveBeenCalled();
});

it('ignores an older account response after switching accounts', async () => {
  let resolveOld: ((value: IEarnAssetsList) => void) | undefined;
  let resolveNew: ((value: IEarnAssetsList) => void) | undefined;
  mockGetEarnAssetsList
    .mockReturnValueOnce(
      new Promise<IEarnAssetsList>((resolve) => {
        resolveOld = resolve;
      }),
    )
    .mockReturnValueOnce(
      new Promise<IEarnAssetsList>((resolve) => {
        resolveNew = resolve;
      }),
    );
  const view = renderStake();
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(1));

  view.rerender(
    <StakeSection
      accountId="account-2"
      networkId="evm--1"
      tokenInfo={tokenInfo}
      protocolInfo={nativeProtocol}
    />,
  );
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId('stake-skeleton')).toBeTruthy();
  expect(screen.queryByTestId('stake-form')).toBeNull();

  await act(async () => resolveNew?.({ assets: [item(eth), item(weth)] }));
  await waitFor(() =>
    expect(screen.getByTestId('stake-form').textContent).toBe('ETH'),
  );
  await act(async () => resolveOld?.({ assets: [item(weth), item(eth)] }));
  expect(screen.getByTestId('stake-form').textContent).toBe('ETH');
});

it('disables the modal confirm action while selecting an asset', async () => {
  let resolveAssets: ((value: IEarnAssetsList) => void) | undefined;
  mockGetEarnAssetsList.mockReturnValue(
    new Promise<IEarnAssetsList>((resolve) => {
      resolveAssets = resolve;
    }),
  );
  render(
    <StakeSection
      accountId="account-1"
      networkId="evm--1"
      tokenInfo={tokenInfo}
      protocolInfo={nativeProtocol}
      isInModalContext
    />,
  );
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(1));
  expect(screen.getByTestId('stake-skeleton')).toBeTruthy();
  expect(screen.getByTestId('modal-confirm').hasAttribute('disabled')).toBe(
    true,
  );
  expect(screen.queryByTestId('stake-form')).toBeNull();
  await act(async () => resolveAssets?.({ assets: [item(eth), item(weth)] }));
  await waitFor(() =>
    expect(screen.getByTestId('stake-form').textContent).toBe('ETH'),
  );
  expect(screen.getByTestId('modal-confirm').hasAttribute('disabled')).toBe(
    false,
  );
});

it('keeps Native ETH selected and disabled through an asset error, then recovers on retry', async () => {
  const wrongWeth = {
    ...weth,
    address: '0x1111111111111111111111111111111111111111',
  };
  let failRefresh: ((reason: Error) => void) | undefined;
  const refreshedEth = { ...item(eth), balance: '2', balanceParsed: '2' };
  mockGetEarnAssetsList
    .mockResolvedValueOnce({ assets: [item(eth), item(wrongWeth)] })
    .mockReturnValueOnce(
      new Promise<IEarnAssetsList>((_resolve, reject) => {
        failRefresh = reject;
      }),
    )
    .mockResolvedValueOnce({ assets: [refreshedEth, item(weth)] });
  renderStake();

  await waitFor(() =>
    expect(screen.getByTestId('stake-form').textContent).toBe('ETH'),
  );
  const retry = await screen.findByTestId('stake-assets-retry');
  expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(true);
  fireEvent.click(retry);
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(screen.queryByTestId('stake-assets-retry')).toBeNull(),
  );
  expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(true);
  await act(async () => failRefresh?.(new Error('temporary asset failure')));
  await waitFor(() =>
    expect(screen.getByTestId('stake-assets-retry')).toBeTruthy(),
  );
  expect(screen.getByTestId('stake-form').textContent).toBe('ETH');
  expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(true);

  mockStakeRender.mockClear();
  fireEvent.click(screen.getByTestId('stake-assets-retry'));
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(3));
  await waitFor(() =>
    expect(screen.queryByTestId('stake-assets-retry')).toBeNull(),
  );
  expect(screen.getByTestId('stake-form').textContent).toBe('ETH');
  expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(false);
  const enabledEthRenders = mockStakeRender.mock.calls
    .map(([props]) => props)
    .filter(
      (props) =>
        props.tokenSymbol === 'ETH' &&
        !props.isDisabled &&
        !props.isStakeAssetLoading,
    );
  expect(enabledEthRenders.length).toBeGreaterThan(0);
  expect(enabledEthRenders.every((props) => props.balance === '2')).toBe(true);
});

it('does not reuse a previous account result after switching away and back', async () => {
  let resolveOther: ((value: IEarnAssetsList) => void) | undefined;
  let resolveCurrent: ((value: IEarnAssetsList) => void) | undefined;
  mockGetEarnAssetsList
    .mockResolvedValueOnce({ assets: [item(eth), item(weth)] })
    .mockReturnValueOnce(
      new Promise<IEarnAssetsList>((resolve) => {
        resolveOther = resolve;
      }),
    )
    .mockReturnValueOnce(
      new Promise<IEarnAssetsList>((resolve) => {
        resolveCurrent = resolve;
      }),
    );
  const view = renderStake();
  await waitFor(() =>
    expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(false),
  );
  view.rerender(
    <StakeSection
      accountId="account-2"
      networkId="evm--1"
      tokenInfo={tokenInfo}
      protocolInfo={nativeProtocol}
    />,
  );
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(2));
  view.rerender(
    <StakeSection
      accountId="account-1"
      networkId="evm--1"
      tokenInfo={tokenInfo}
      protocolInfo={nativeProtocol}
    />,
  );
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(3));
  expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(true);
  await act(async () => resolveCurrent?.({ assets: [item(eth), item(weth)] }));
  await waitFor(() =>
    expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(false),
  );
  await act(async () => resolveOther?.({ assets: [item(weth), item(eth)] }));
  expect(screen.getByTestId('stake-form').textContent).toBe('ETH');
});

it('ignores a late first request when the account returns to the same scope', async () => {
  let resolveOld: ((value: IEarnAssetsList) => void) | undefined;
  let resolveOther: ((value: IEarnAssetsList) => void) | undefined;
  let resolveCurrent: ((value: IEarnAssetsList) => void) | undefined;
  mockGetEarnAssetsList
    .mockReturnValueOnce(
      new Promise<IEarnAssetsList>((resolve) => {
        resolveOld = resolve;
      }),
    )
    .mockReturnValueOnce(
      new Promise<IEarnAssetsList>((resolve) => {
        resolveOther = resolve;
      }),
    )
    .mockReturnValueOnce(
      new Promise<IEarnAssetsList>((resolve) => {
        resolveCurrent = resolve;
      }),
    );
  const view = renderStake();
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(1));
  view.rerender(
    <StakeSection
      accountId="account-2"
      networkId="evm--1"
      tokenInfo={tokenInfo}
      protocolInfo={nativeProtocol}
    />,
  );
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(2));
  view.rerender(
    <StakeSection
      accountId="account-1"
      networkId="evm--1"
      tokenInfo={tokenInfo}
      protocolInfo={nativeProtocol}
    />,
  );
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(3));
  await act(async () =>
    resolveCurrent?.({
      assets: [{ ...item(eth), balanceParsed: '2' }, item(weth)],
    }),
  );
  await waitFor(() =>
    expect(screen.getByTestId('stake-form').textContent).toBe('ETH'),
  );
  await act(async () =>
    resolveOld?.({
      assets: [item(weth), { ...item(eth), balanceParsed: '9' }],
    }),
  );
  await act(async () => resolveOther?.({ assets: [item(weth), item(eth)] }));
  expect(screen.getByTestId('stake-form').textContent).toBe('ETH');
  expect(mockStakeRender.mock.calls.at(-1)?.[0].balance).toBe('2');
});

it.each([
  ['equivalent list asset', item({ ...weth })],
  [
    'newer snapshot of a list asset',
    { ...item({ ...weth }), balance: '2', balanceParsed: '2' },
  ],
  [
    'asset missing from the previous list',
    item({ ...weth, symbol: 'stETH', address: '0xsteth' }),
  ],
])(
  'shows a manually selected %s without returning to skeleton',
  async (_description, selected) => {
    mockGetEarnAssetsList.mockResolvedValue({
      assets: [item(eth), item(weth)],
    });
    renderStake();
    await waitFor(() =>
      expect(screen.getByTestId('stake-form').textContent).toBe('ETH'),
    );
    fireEvent.click(screen.getByText('Select token'));
    expect(mockPushModal).toHaveBeenCalledTimes(1);
    act(() => mockPushModal.mock.calls[0]?.[1].params.onSelect(selected));
    expect(screen.queryByTestId('stake-skeleton')).toBeNull();
    expect(screen.getByTestId('stake-form').textContent).toBe(
      selected.info.symbol,
    );
    expect(mockStakeRender.mock.calls.at(-1)?.[0].balance).toBe(
      selected.balanceParsed,
    );
  },
);

it('waits for EtherFi assets and selects the entry token from the current vault', async () => {
  let resolveAssets: ((value: IEarnAssetsList) => void) | undefined;
  mockGetEarnAssetsList.mockReturnValue(
    new Promise<IEarnAssetsList>((resolve) => {
      resolveAssets = resolve;
    }),
  );
  renderStake({ ...nativeProtocol, provider: 'etherfi' });
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(1));
  expect(mockGetEarnAssetsList).toHaveBeenCalledWith(
    expect.objectContaining({ provider: 'etherfi', vault: 'vault' }),
  );
  expect(screen.getByTestId('stake-skeleton')).toBeTruthy();
  expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(true);

  await act(async () => resolveAssets?.({ assets: [item(eth), item(weth)] }));
  await waitFor(() =>
    expect(screen.getByTestId('stake-form').textContent).toBe('WETH'),
  );
  expect(screen.queryByTestId('stake-skeleton')).toBeNull();
});

it('refreshes the selected EtherFi asset after a matching transaction confirmation', async () => {
  const usdc = {
    ...tokenInfo.token,
    symbol: 'USDC',
    address: '0xusdc',
    decimals: 6,
  };
  const usdt = {
    ...tokenInfo.token,
    symbol: 'USDT',
    address: '0xusdt',
    decimals: 6,
  };
  const original = { ...item(usdc), balanceParsed: '24.271469' };
  const updated = { ...item(usdc), balanceParsed: '23.271469' };
  mockGetEarnAssetsList
    .mockResolvedValueOnce({ assets: [item(usdt), original] })
    .mockResolvedValueOnce({ assets: [item(usdt), original] })
    .mockResolvedValue({ assets: [item(usdt), updated] });
  const view = render(
    <StakeSection
      accountId="account-1"
      networkId="evm--1"
      tokenInfo={{ ...tokenInfo, token: usdt }}
      protocolInfo={{ ...nativeProtocol, provider: 'etherfi', symbol: 'USDT' }}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId('stake-form').textContent).toBe('USDT'),
  );
  fireEvent.click(screen.getByText('Select token'));
  act(() => mockPushModal.mock.calls[0]?.[1].params.onSelect(original));
  expect(mockStakeRender.mock.calls.at(-1)?.[0]).toEqual(
    expect.objectContaining({ tokenSymbol: 'USDC', balance: '24.271469' }),
  );

  jest.useFakeTimers();
  try {
    act(() => {
      appEventBus.emit(EAppEventBusNames.LocalPendingTxConfirmed, {
        accountId: 'account-1',
        networkId: 'evm--1',
        txid: 'deposit',
        status: EDecodedTxStatus.Confirmed,
      });
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(2);
    expect(mockGetEarnAssetsList).toHaveBeenLastCalledWith(
      expect.objectContaining({ forceRefresh: true, accountId: 'account-1' }),
    );
    expect(mockStakeRender.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ tokenSymbol: 'USDC', balance: '24.271469' }),
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(7000);
    });
    expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(3);
    expect(mockGetEarnAssetsList).toHaveBeenLastCalledWith(
      expect.objectContaining({ forceRefresh: true, accountId: 'account-1' }),
    );
    expect(mockStakeRender.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ tokenSymbol: 'USDC', balance: '23.271469' }),
    );
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});

it('ignores confirmation events for another account or network', async () => {
  mockGetEarnAssetsList.mockResolvedValue({ assets: [item(weth)] });
  const view = renderStake({ ...nativeProtocol, provider: 'etherfi' });
  await waitFor(() =>
    expect(screen.getByTestId('stake-form').textContent).toBe('WETH'),
  );
  jest.useFakeTimers();
  try {
    act(() => {
      for (const [accountId, networkId] of [
        ['account-2', 'evm--1'],
        ['account-1', 'evm--10'],
      ]) {
        appEventBus.emit(EAppEventBusNames.LocalPendingTxConfirmed, {
          accountId,
          networkId,
          txid: 'unrelated',
          status: EDecodedTxStatus.Confirmed,
        });
      }
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(1);
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});

it('keeps the selected asset and form visible while the confirmed balance refresh is pending', async () => {
  const usdc = {
    ...tokenInfo.token,
    symbol: 'USDC',
    address: '0xusdc',
    decimals: 6,
  };
  const usdt = {
    ...tokenInfo.token,
    symbol: 'USDT',
    address: '0xusdt',
    decimals: 6,
  };
  const original = { ...item(usdc), balanceParsed: '24.271469' };
  let resolveRefresh: (value: IEarnAssetsList) => void = () => undefined;
  mockGetEarnAssetsList
    .mockResolvedValueOnce({ assets: [item(usdt), original] })
    .mockReturnValueOnce(
      new Promise<IEarnAssetsList>((resolve) => {
        resolveRefresh = resolve;
      }),
    );
  mockStakeApproval.mockReturnValue({
    approve: { approveType: 'legacy', approveTarget: '0xspender' },
    error: false,
    retry: jest.fn(),
  });
  const view = render(
    <StakeSection
      accountId="account-1"
      networkId="evm--1"
      tokenInfo={{ ...tokenInfo, token: usdt }}
      protocolInfo={{ ...nativeProtocol, provider: 'etherfi', symbol: 'USDT' }}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId('stake-form').textContent).toBe('USDT'),
  );
  fireEvent.click(screen.getByText('Select token'));
  act(() => mockPushModal.mock.calls[0]?.[1].params.onSelect(original));
  expect(mockStakeRender.mock.calls.at(-1)?.[0].balance).toBe('24.271469');

  jest.useFakeTimers();
  try {
    act(() => {
      appEventBus.emit(EAppEventBusNames.LocalPendingTxConfirmed, {
        accountId: 'account-1',
        networkId: 'evm--1',
        txid: 'deposit',
        status: EDecodedTxStatus.Confirmed,
      });
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('stake-skeleton')).toBeNull();
    expect(screen.getByTestId('stake-form').textContent).toBe('USDC');
    expect(mockStakeRender.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        tokenSymbol: 'USDC',
        balance: '24.271469',
        isStakeAssetLoading: false,
        isStakeAssetRefreshing: true,
      }),
    );

    await act(async () => {
      resolveRefresh({
        assets: [item(usdt), { ...item(usdc), balanceParsed: '23.271469' }],
      });
    });
    expect(screen.getByTestId('stake-form').textContent).toBe('USDC');
    expect(mockStakeRender.mock.calls.at(-1)?.[0].balance).toBe('23.271469');
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});

it('shows an error and disables EtherFi submission if a balance refresh fails', async () => {
  mockGetEarnAssetsList
    .mockResolvedValueOnce({ assets: [item(weth)] })
    .mockRejectedValueOnce(new Error('offline'));
  mockStakeApproval.mockReturnValue({
    approve: { approveType: 'legacy', approveTarget: '0xspender' },
    error: false,
    retry: jest.fn(),
  });
  const view = renderStake({ ...nativeProtocol, provider: 'etherfi' });
  await waitFor(() =>
    expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(false),
  );
  jest.useFakeTimers();
  try {
    act(() => {
      appEventBus.emit(EAppEventBusNames.LocalPendingTxConfirmed, {
        accountId: 'account-1',
        networkId: 'evm--1',
        txid: 'deposit',
        status: EDecodedTxStatus.Confirmed,
      });
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByTestId('stake-assets-retry')).toBeTruthy();
    expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(true);
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});

it('requests a fresh asset list when returning after a confirmation was missed', async () => {
  const usdc = {
    ...tokenInfo.token,
    symbol: 'USDC',
    address: '0xusdc',
    decimals: 6,
  };
  const original = { ...item(usdc), balanceParsed: '24.271469' };
  const updated = { ...item(usdc), balanceParsed: '23.271469' };
  mockGetEarnAssetsList
    .mockResolvedValueOnce({ assets: [original] })
    .mockResolvedValueOnce({ assets: [updated] });
  const props = {
    accountId: 'account-1',
    networkId: 'evm--1',
    tokenInfo: { ...tokenInfo, token: usdc },
    protocolInfo: { ...nativeProtocol, provider: 'etherfi', symbol: 'USDC' },
  };
  const first = render(<StakeSection {...props} />);
  await waitFor(() =>
    expect(mockStakeRender.mock.calls.at(-1)?.[0].balance).toBe('24.271469'),
  );
  first.unmount();
  act(() => {
    appEventBus.emit(EAppEventBusNames.LocalPendingTxConfirmed, {
      accountId: 'account-1',
      networkId: 'evm--1',
      txid: 'deposit',
      status: EDecodedTxStatus.Confirmed,
    });
  });
  render(<StakeSection {...props} />);
  await waitFor(() =>
    expect(mockStakeRender.mock.calls.at(-1)?.[0].balance).toBe('23.271469'),
  );
  expect(mockGetEarnAssetsList).toHaveBeenLastCalledWith(
    expect.objectContaining({ forceRefresh: true, accountId: 'account-1' }),
  );
});

it('tracks the submitted EtherFi transaction with its original account and network', async () => {
  mockGetEarnAssetsList.mockResolvedValue({ assets: [item(weth)] });
  mockStakeApproval.mockReturnValue({
    approve: { approveType: 'legacy', approveTarget: '0xspender' },
    error: false,
    retry: jest.fn(),
  });
  mockHandleStake.mockImplementation(async (params) => {
    await params.onSubmitted?.('deposit-tx');
    return true;
  });
  renderStake({ ...nativeProtocol, provider: 'etherfi' });
  await waitFor(() =>
    expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(false),
  );
  const onConfirm = mockConfirmStake.mock.calls.at(-1)?.[1];
  if (!onConfirm)
    throw new OneKeyLocalError('Stake confirmation is unavailable');
  await act(async () => {
    await onConfirm({ amount: '1', taskAccountAddress: '0xowner' });
  });
  expect(mockWaitForTxFinalStatus).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: 'account-1',
      networkId: 'evm--1',
      txid: 'deposit-tx',
      expectedAccountAddress: '0xowner',
      signal: expect.any(AbortSignal),
    }),
  );
});

it('does not apply a confirmation refresh to a different account', async () => {
  let resolveOld: (value: IEarnAssetsList) => void = () => undefined;
  mockGetEarnAssetsList
    .mockResolvedValueOnce({ assets: [item(weth)] })
    .mockReturnValueOnce(
      new Promise<IEarnAssetsList>((resolve) => {
        resolveOld = resolve;
      }),
    )
    .mockResolvedValue({ assets: [{ ...item(weth), balanceParsed: '8' }] });
  const provider = { ...nativeProtocol, provider: 'etherfi' };
  const view = renderStake(provider);
  await waitFor(() =>
    expect(screen.getByTestId('stake-form').textContent).toBe('WETH'),
  );
  jest.useFakeTimers();
  try {
    act(() => {
      appEventBus.emit(EAppEventBusNames.LocalPendingTxConfirmed, {
        accountId: 'account-1',
        networkId: 'evm--1',
        txid: 'deposit',
        status: EDecodedTxStatus.Confirmed,
      });
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(2);
    view.rerender(
      <StakeSection
        accountId="account-2"
        networkId="evm--1"
        tokenInfo={tokenInfo}
        protocolInfo={provider}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(3);
    await act(async () =>
      resolveOld({ assets: [{ ...item(weth), balanceParsed: '99' }] }),
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(7000);
    });
    expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(3);
    expect(mockStakeRender.mock.calls.at(-1)?.[0].balance).toBe('8');
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});

it('keeps loaded assets when an account render is abandoned', async () => {
  mockGetEarnAssetsList.mockResolvedValue({ assets: [item(eth), item(weth)] });
  const suspended = new Promise<never>(() => undefined);
  let suspendedRenders = 0;
  let setAccount: (accountId: string) => void = () => undefined;
  let rerenderCurrent: () => void = () => undefined;
  const SuspendOtherAccount = ({ accountId }: { accountId: string }) => {
    if (accountId === 'account-2') {
      suspendedRenders += 1;
      throw suspended;
    }
    return null;
  };
  const Harness = () => {
    const [accountId, updateAccount] = useState('account-1');
    const [, updateTick] = useState(0);
    setAccount = updateAccount;
    rerenderCurrent = () => updateTick((tick) => tick + 1);
    return (
      <Suspense fallback={<span>Loading</span>}>
        <StakeSection
          accountId={accountId}
          networkId="evm--1"
          tokenInfo={tokenInfo}
          protocolInfo={nativeProtocol}
        />
        <SuspendOtherAccount accountId={accountId} />
      </Suspense>
    );
  };
  render(<Harness />);
  await waitFor(() =>
    expect(screen.getByTestId('stake-form').textContent).toBe('ETH'),
  );
  act(() => startTransition(() => setAccount('account-2')));
  expect(suspendedRenders).toBeGreaterThan(0);
  act(() => setAccount('account-1'));
  act(() => rerenderCurrent());
  expect(screen.getByTestId('stake-form').textContent).toBe('ETH');
  expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(false);
  expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(1);
});

it('passes the resolved address only for the matching action account and network', () => {
  mockGetEarnAssetsList.mockResolvedValue({ assets: [] });
  const earnAccount: NonNullable<IProtocolInfo['earnAccount']> = {
    accountId: 'account-1',
    networkId: 'evm--1',
    accountAddress: '0xabc',
    account: {} as NonNullable<IProtocolInfo['earnAccount']>['account'],
  };
  const { rerender } = renderStake({ ...nativeProtocol, earnAccount });
  const expected = {
    accountId: 'account-1',
    networkId: 'evm--1',
    accountAddress: '0xabc',
  };
  expect(mockBorrowSupplyScope).toHaveBeenLastCalledWith(expected);
  expect(mockBorrowBorrowScope).toHaveBeenLastCalledWith(expected);
  rerender(
    <StakeSection
      accountId="account-1"
      networkId="evm--1"
      tokenInfo={tokenInfo}
      protocolInfo={{
        ...nativeProtocol,
        earnAccount: { ...earnAccount, accountId: 'other' },
      }}
    />,
  );
  expect(mockBorrowSupplyScope).toHaveBeenLastCalledWith({
    ...expected,
    accountAddress: undefined,
  });
  expect(mockBorrowBorrowScope).toHaveBeenLastCalledWith({
    ...expected,
    accountAddress: undefined,
  });
});

it.each([true, false])(
  'preserves a newer cached Permit after submission with workflow=%s',
  async (hasWorkflow) => {
    let permitCache: string | undefined = 'old-signature';
    let finishRecording: () => void = () => undefined;
    const recording = new Promise<void>((resolve) => {
      finishRecording = resolve;
    });
    mockRemovePermitCache.mockImplementation(
      (params: { expectedSignature?: string }) => {
        if (
          params.expectedSignature === undefined ||
          params.expectedSignature === permitCache
        )
          permitCache = undefined;
      },
    );
    const handoff: IStakeWorkflowHandoff = {
      accountAddress: '0xowner',
      isResultCurrent: () => true,
      onSubmitted: () => {
        mockRemovePermitCache({ expectedSignature: 'old-signature' });
      },
      register: async () => true,
    };
    mockHandleStake.mockImplementation(async (params) => {
      params.workflowHandoff?.onSubmitted();
      await params.onSubmitted?.('stake-tx');
      await recording;
      params.onSuccess?.([]);
      return true;
    });
    mockGetEarnAssetsList.mockResolvedValue({ assets: [item(weth)] });
    renderStake({ ...nativeProtocol, provider: 'morpho' });
    await waitFor(() => expect(mockConfirmStake).toHaveBeenCalled());
    const onConfirm = mockConfirmStake.mock.calls.at(-1)?.[1];
    expect(onConfirm).toBeDefined();
    if (!onConfirm)
      throw new OneKeyLocalError('Stake confirmation is unavailable');
    let pending: Promise<boolean> | undefined;
    await act(async () => {
      pending = onConfirm({
        amount: '1',
        approveType: EApproveType.Permit,
        permitSignature: 'old-signature',
        ...(hasWorkflow ? { workflowHandoff: handoff } : undefined),
      });
      await Promise.resolve();
    });
    expect(mockHandleStake).toHaveBeenCalledTimes(1);
    expect(permitCache).toBeUndefined();
    permitCache = 'new-signature';
    await act(async () => {
      finishRecording();
      await pending;
    });
    expect(permitCache).toBe('new-signature');
    expect(mockRemovePermitCache).toHaveBeenCalledTimes(1);
  },
);
