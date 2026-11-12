/** @jest-environment jsdom */
/* eslint-disable import/first */

import {
  StrictMode,
  Suspense,
  createContext,
  startTransition,
  useMemo,
  useState,
} from 'react';

const mockGetEarnAssetsList = jest.fn<Promise<unknown>, unknown[]>();
const mockFetchTokensDetails = jest.fn<Promise<unknown>, unknown[]>();
const mockRetainedAccountAddress = jest.fn<Promise<string>, []>();
const mockRetainedStakeForm = jest.fn<void, [unknown]>();
const mockStakeApproval = jest.fn<
  {
    approve?: { approveType: string; approveTarget: string };
    error: boolean;
    retry: () => void;
  },
  [unknown]
>();
const mockStakeForm = jest.fn();
const mockStakeFormRefresh = jest.fn();
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
let mockRoute: { params: Record<string, unknown> };
let mockFocused = true;
const mockRouteContext = createContext<typeof mockRoute | undefined>(undefined);

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isWeb: true },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => mockFocused,
}));
jest.mock('@onekeyhq/components', () => {
  const { useDeferredPromise } = jest.requireActual<
    typeof import('../../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../../components/src/hooks/useDeferredPromise');
  const Box = ({ children }: { children?: import('react').ReactNode }) => (
    <div>{children}</div>
  );
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
    Spinner: () => <div data-testid="task-loading" />,
    YStack: Box,
    SizableText: Box,
    Button: ({
      children,
      onPress,
    }: {
      children?: import('react').ReactNode;
      onPress?: () => void;
    }) => <button onClick={onPress}>{children}</button>,
    Page: Object.assign(Box, { Header: () => null, Body: Box }),
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
    },
    serviceToken: {
      fetchTokensDetails: (...args: unknown[]) =>
        mockFetchTokensDetails(...args),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal, pop: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppRoute', () => ({
  useAppRoute: () => {
    const react = jest.requireActual<typeof import('react')>('react');
    return react.useContext(mockRouteContext) ?? mockRoute;
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/earn/actions', () => ({
  useEarnActions: () => ({ current: { removePermitCache: jest.fn() } }),
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
jest.mock('@onekeyhq/shared/src/utils/earnUtils', () => ({
  __esModule: true,
  default: {
    isEtherFiProvider: ({ providerName }: { providerName: string }) =>
      providerName.toLowerCase() === 'etherfi',
    isNativeProvider: ({ providerName }: { providerName: string }) =>
      providerName.toLowerCase() === 'native',
    shouldSendEarnProtocolVault: () => false,
  },
}));
jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({
    children,
  }: {
    children?: import('react').ReactNode;
  }) => children,
}));
jest.mock(
  '../../../Discovery/components/DiscoveryBrowserProviderMirror',
  () => ({
    DiscoveryBrowserProviderMirror: ({
      children,
    }: {
      children?: import('react').ReactNode;
    }) => children,
  }),
);
jest.mock('../../../Earn/EarnProviderMirror', () => ({
  EarnProviderMirror: ({
    children,
  }: {
    children?: import('react').ReactNode;
  }) => children,
}));
jest.mock('../../hooks/useEtherFiStakeApproval', () => ({
  useEtherFiStakeApproval: (params: unknown) => mockStakeApproval(params),
}));
jest.mock('../../hooks/useUniversalHooks', () => ({
  useUniversalStake: () => jest.fn(),
}));
jest.mock('../../components/EarnProtocolForms/Stake', () => ({
  EarnStakeForm: ({
    tokenSymbol,
    balance,
    isDisabled,
    isStakeAssetRefreshing,
    beforeFooter,
    tokenSelectorTriggerProps,
    postWrapApproveTarget,
    retainedTask,
  }: {
    retainedTask?:
      | import('../../earnDepositTask/useRetainedDepositTask').IRetainedDepositTask
      | null;
    tokenSymbol?: string;
    balance?: string;
    isDisabled?: boolean;
    isStakeAssetRefreshing?: boolean;
    beforeFooter?: import('react').ReactNode;
    tokenSelectorTriggerProps?: { onPress?: () => void };
    postWrapApproveTarget?: unknown;
  }) => {
    mockRetainedStakeForm(retainedTask);
    mockStakeForm(postWrapApproveTarget);
    mockStakeFormRefresh({ isDisabled, isStakeAssetRefreshing });
    return (
      <div>
        <span data-testid="stake-token">{tokenSymbol}</span>
        <span data-testid="stake-balance">{balance}</span>
        <button data-testid="confirm" disabled={isDisabled}>
          Confirm
        </button>
        <button onClick={tokenSelectorTriggerProps?.onPress}>
          Select token
        </button>
        {beforeFooter}
      </div>
    );
  },
}));

import StakePage from '.';

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
  IEarnTokenItem,
} from '@onekeyhq/shared/types/staking';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { depositTaskRegistry } from '../../earnDepositTask/registry';
import {
  createDepositTask,
  createDepositTaskState,
} from '../../earnDepositTask/state';
import { getDepositTaskOwnerKey } from '../../earnDepositTask/useRetainedDepositTask';

const weth = {
  address: EthereumWETH,
  symbol: 'WETH',
  name: 'WETH',
  decimals: 18,
  isNative: false,
  networkId: 'evm--1',
};
const eth = {
  ...weth,
  address: '',
  symbol: 'ETH',
  name: 'ETH',
  isNative: true,
};
const item = (info: typeof weth, balance = '1'): IEarnTokenItem => ({
  info,
  balance,
  balanceParsed: balance,
  fiatValue: balance,
  price: '1',
  price24h: '0',
});

beforeEach(() => {
  mockRetainedAccountAddress.mockReset().mockResolvedValue('0xowner');
  mockRetainedStakeForm.mockReset();
  mockGetEarnAssetsList.mockReset();
  mockFetchTokensDetails.mockReset();
  mockStakeApproval
    .mockReset()
    .mockReturnValue({ approve: undefined, error: false, retry: jest.fn() });
  mockStakeForm.mockReset();
  mockStakeFormRefresh.mockReset();
  mockPushModal.mockReset();
  mockFocused = true;
  mockRoute = {
    params: {
      accountId: 'account-1',
      networkId: 'evm--1',
      tokenInfo: {
        token: { ...weth, totalSupply: '0' },
        balanceParsed: '1',
        price: '1',
      },
      protocolInfo: {
        provider: 'native',
        providerDetail: { name: 'Native', logoURI: '' },
        networkId: 'evm--1',
        symbol: 'WETH',
        vault: 'vault',
        stakeTag: '',
      },
    },
  };
});

it.each([true, false])(
  'restores a Spark deposit cancelled after approval only for its original fixed token: %s',
  async (matchingToken) => {
    mockRoute.params.protocolInfo = {
      provider: 'spark',
      providerDetail: { name: 'Spark', logoURI: '' },
      networkId: 'evm--1',
      symbol: 'WETH',
      vault: 'vault',
      stakeTag: '',
    };
    mockRoute.params.tokenInfo = {
      token: weth,
      accountId: 'account-1',
      networkId: 'evm--1',
      balanceParsed: '7',
      price: '1',
    };
    const openPage = () => render(<StakePage />);
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
    await screen.findByTestId('stake-token');
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
          expect(screen.getByTestId('stake-token').textContent).toBe('WETH'),
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
        expect(screen.queryByTestId('stake-token')).toBeNull();
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

it('restores the original asset before mounting the standalone form', async () => {
  mockRoute.params.protocolInfo = {
    provider: 'etherfi',
    providerDetail: { name: 'EtherFi', logoURI: '' },
    networkId: 'evm--1',
    symbol: 'ETH',
    vault: 'vault',
    stakeTag: '',
  };
  const ownerKey = getDepositTaskOwnerKey({
    accountId: 'account-1',
    networkId: 'evm--1',
    provider: 'etherfi',
    vault: 'vault',
  });
  const state = createDepositTaskState(
    createDepositTask({
      taskId: 'standalone-retained',
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
    const view = render(<StakePage />);
    await waitFor(() =>
      expect(screen.getByTestId('stake-token').textContent).toBe('ETH'),
    );
    view.unmount();
  } finally {
    depositTaskRegistry.release(ownerKey, reservation);
  }
});

it('allows the ETH entry when WETH is only available as preparation metadata', async () => {
  mockRoute.params.tokenInfo = { token: eth, balanceParsed: '1', price: '1' };
  mockRoute.params.protocolInfo = {
    provider: 'etherfi',
    providerDetail: { name: 'EtherFi', logoURI: '' },
    networkId: 'evm--1',
    symbol: 'ETH',
    vault: 'vault',
    stakeTag: '',
  };
  mockGetEarnAssetsList.mockResolvedValue({ assets: [item(eth)] });
  mockFetchTokensDetails.mockResolvedValue([{ info: weth }]);
  mockStakeApproval.mockReturnValue({
    approve: { approveType: 'legacy', approveTarget: '0xspender' },
    error: false,
    retry: jest.fn(),
  });
  render(<StakePage />);
  await waitFor(() =>
    expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(false),
  );
  expect(mockStakeApproval).toHaveBeenLastCalledWith(
    expect.objectContaining({ symbol: 'ETH', wrappedNative: true }),
  );
  expect(mockStakeForm).toHaveBeenLastCalledWith(
    expect.objectContaining({ token: weth }),
  );
});

it('keeps the ETH wrap form enabled and visible during a background balance refresh', async () => {
  mockRoute.params.tokenInfo = { token: eth, balanceParsed: '1', price: '1' };
  mockRoute.params.protocolInfo = {
    provider: 'etherfi',
    providerDetail: { name: 'EtherFi', logoURI: '' },
    networkId: 'evm--1',
    symbol: 'ETH',
    vault: 'vault',
    stakeTag: '',
  };
  let finishRefresh: (value: IEarnAssetsList) => void = () => undefined;
  mockGetEarnAssetsList
    .mockResolvedValueOnce({ assets: [item(eth, '1'), item(weth)] })
    .mockReturnValueOnce(
      new Promise<IEarnAssetsList>((resolve) => {
        finishRefresh = resolve;
      }),
    );
  mockStakeApproval.mockReturnValue({
    approve: { approveType: 'legacy', approveTarget: '0xspender' },
    error: false,
    retry: jest.fn(),
  });
  const view = render(<StakePage />);
  await waitFor(() =>
    expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(false),
  );
  expect(screen.getByTestId('stake-token').textContent).toBe('ETH');
  expect(screen.getByTestId('stake-balance').textContent).toBe('1');
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
    expect(screen.getByTestId('stake-token').textContent).toBe('ETH');
    expect(screen.getByTestId('stake-balance').textContent).toBe('1');
    expect(mockStakeFormRefresh).toHaveBeenLastCalledWith({
      isDisabled: false,
      isStakeAssetRefreshing: true,
    });
    await act(async () => {
      finishRefresh({ assets: [item(eth, '0.5'), item(weth)] });
    });
    expect(screen.getByTestId('stake-balance').textContent).toBe('0.5');
    expect(mockStakeFormRefresh).toHaveBeenLastCalledWith({
      isDisabled: false,
      isStakeAssetRefreshing: false,
    });
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});

it('retains the selected ETH and blocks wrapping across failed and successful retries', async () => {
  const wrongWeth = {
    ...weth,
    address: '0x1111111111111111111111111111111111111111',
  };
  let failRefresh: ((reason: Error) => void) | undefined;
  mockGetEarnAssetsList
    .mockResolvedValueOnce({ assets: [item(wrongWeth), item(eth)] })
    .mockReturnValueOnce(
      new Promise<IEarnAssetsList>((_resolve, reject) => {
        failRefresh = reject;
      }),
    )
    .mockResolvedValueOnce({ assets: [item(eth, '2'), item(weth)] });
  render(<StakePage />);
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.getByTestId('stake-token').textContent).toBe('WETH'),
  );
  fireEvent.click(screen.getByText('Select token'));
  act(() => mockPushModal.mock.calls[0][1].params.onSelect(item(eth)));
  expect(screen.getByTestId('stake-token').textContent).toBe('ETH');
  const missingAssetRetry = await screen.findByTestId('stake-assets-retry');
  expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(true);
  fireEvent.click(missingAssetRetry);
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(screen.queryByTestId('stake-assets-retry')).toBeNull(),
  );
  expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(true);
  await act(async () => failRefresh?.(new Error('temporary failure')));
  const failedRetry = await screen.findByTestId('stake-assets-retry');
  expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(true);
  fireEvent.click(failedRetry);
  expect(screen.getByTestId('stake-token').textContent).toBe('ETH');
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(3));
  await waitFor(() =>
    expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(false),
  );
  expect(screen.getByTestId('stake-token').textContent).toBe('ETH');
  expect(screen.getByTestId('stake-balance').textContent).toBe('2');
});

it('ignores a late asset response after the account switches away and back', async () => {
  let resolveOld: ((value: IEarnAssetsList) => void) | undefined;
  let resolveOther: ((value: IEarnAssetsList) => void) | undefined;
  let resolveCurrent: ((value: IEarnAssetsList) => void) | undefined;
  mockRoute.params.tokenInfo = {
    token: { ...eth, totalSupply: '0' },
    balanceParsed: '1',
    price: '1',
  };
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
  const view = render(<StakePage />);
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(1));
  mockRoute = { params: { ...mockRoute.params, accountId: 'account-2' } };
  view.rerender(<StakePage />);
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(2));
  mockRoute = { params: { ...mockRoute.params, accountId: 'account-1' } };
  view.rerender(<StakePage />);
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(3));
  expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(true);
  await act(async () =>
    resolveCurrent?.({ assets: [item(eth, '2'), item(weth)] }),
  );
  await waitFor(() =>
    expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(false),
  );
  await act(async () => resolveOld?.({ assets: [item(weth), item(eth, '9')] }));
  await act(async () =>
    resolveOther?.({ assets: [item(weth), item(eth, '8')] }),
  );
  expect(screen.getByTestId('stake-token').textContent).toBe('ETH');
  expect(screen.getByTestId('stake-balance').textContent).toBe('2');
});

it('keeps the committed stake assets when another account render is abandoned', async () => {
  mockRoute.params.tokenInfo = {
    token: { ...eth, totalSupply: '0' },
    balanceParsed: '1',
    price: '1',
  };
  mockGetEarnAssetsList.mockResolvedValue({ assets: [item(eth), item(weth)] });
  const originalParams = mockRoute.params;
  const suspended = new Promise<never>(() => undefined);
  let setAccount: (accountId: string) => void = () => undefined;
  let rerenderCurrent: () => void = () => undefined;
  let suspendedRenders = 0;

  const CurrentPage = ({ accountId }: { accountId: string }) => {
    const route = useMemo(
      () => ({ params: { ...originalParams, accountId } }),
      [accountId],
    );
    return (
      <mockRouteContext.Provider value={route}>
        <StakePage />
      </mockRouteContext.Provider>
    );
  };
  const SuspendNextAccount = ({ accountId }: { accountId: string }) => {
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
        <CurrentPage accountId={accountId} />
        <SuspendNextAccount accountId={accountId} />
      </Suspense>
    );
  };

  render(<Harness />);
  await waitFor(() =>
    expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(false),
  );
  act(() => {
    startTransition(() => setAccount('account-2'));
  });
  expect(suspendedRenders).toBeGreaterThan(0);
  act(() => setAccount('account-1'));
  act(() => rerenderCurrent());
  expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(false);
  expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(1);
});

it('retries the committed account while another account render is suspended', async () => {
  const originalParams = {
    ...mockRoute.params,
    protocolInfo: {
      provider: 'etherfi',
      providerDetail: { name: 'EtherFi', logoURI: '' },
      networkId: 'evm--1',
      symbol: 'WETH',
      vault: 'vault',
      stakeTag: '',
    },
  };
  mockRoute.params = originalParams;
  mockGetEarnAssetsList
    .mockRejectedValueOnce(new Error('asset list unavailable'))
    .mockResolvedValueOnce({ assets: [item(eth), item(weth)] });
  const suspended = new Promise<never>(() => undefined);
  let setAccount: (accountId: string) => void = () => undefined;
  let suspendedRenders = 0;
  const CurrentPage = ({ accountId }: { accountId: string }) => {
    const route = useMemo(
      () => ({ params: { ...originalParams, accountId } }),
      [accountId],
    );
    return (
      <mockRouteContext.Provider value={route}>
        <StakePage />
      </mockRouteContext.Provider>
    );
  };
  const SuspendNextAccount = ({ accountId }: { accountId: string }) => {
    if (accountId === 'account-2') {
      suspendedRenders += 1;
      throw suspended;
    }
    return null;
  };
  const Harness = () => {
    const [accountId, updateAccount] = useState('account-1');
    setAccount = updateAccount;
    return (
      <Suspense fallback={<span>Loading</span>}>
        <CurrentPage accountId={accountId} />
        <SuspendNextAccount accountId={accountId} />
      </Suspense>
    );
  };

  render(<Harness />);
  const retry = await screen.findByTestId('stake-assets-retry');
  act(() => {
    startTransition(() => setAccount('account-2'));
  });
  expect(suspendedRenders).toBeGreaterThan(0);
  fireEvent.click(retry);
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(2));
  expect(mockGetEarnAssetsList.mock.calls[1][0]).toEqual(
    expect.objectContaining({ accountId: 'account-1', provider: 'etherfi' }),
  );
});

it('accepts the committed account asset response while another account is suspended', async () => {
  const originalParams = {
    ...mockRoute.params,
    tokenInfo: {
      token: { ...eth, totalSupply: '0' },
      balanceParsed: '1',
      price: '1',
    },
  };
  let finish: (value: IEarnAssetsList) => void = () => undefined;
  mockGetEarnAssetsList.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const suspended = new Promise<never>(() => undefined);
  let setAccount: (accountId: string) => void = () => undefined;
  let suspendedRenders = 0;
  const SuspendNextAccount = ({ accountId }: { accountId: string }) => {
    if (accountId === 'account-2') {
      suspendedRenders += 1;
      throw suspended;
    }
    return null;
  };
  const Harness = () => {
    const [accountId, updateAccount] = useState('account-1');
    const route = useMemo(
      () => ({ params: { ...originalParams, accountId } }),
      [accountId],
    );
    setAccount = updateAccount;
    return (
      <Suspense fallback={<span>Loading</span>}>
        <mockRouteContext.Provider value={route}>
          <StakePage />
        </mockRouteContext.Provider>
        <SuspendNextAccount accountId={accountId} />
      </Suspense>
    );
  };

  render(<Harness />);
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(1));
  act(() => startTransition(() => setAccount('account-2')));
  expect(suspendedRenders).toBeGreaterThan(0);
  await act(async () => finish({ assets: [item(eth, '2'), item(weth)] }));
  await waitFor(() =>
    expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(false),
  );
  expect(screen.getByTestId('stake-balance').textContent).toBe('2');
  expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(1);
});

it('loads stake assets after StrictMode reconnects effects', async () => {
  mockRoute.params.tokenInfo = {
    token: { ...eth, totalSupply: '0' },
    balanceParsed: '1',
    price: '1',
  };
  mockGetEarnAssetsList.mockResolvedValue({ assets: [item(eth), item(weth)] });
  render(
    <StrictMode>
      <StakePage />
    </StrictMode>,
  );
  await waitFor(() =>
    expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(false),
  );
});

it('does not reuse stake assets after switching away and back while unfocused', async () => {
  mockRoute.params.tokenInfo = {
    token: { ...eth, totalSupply: '0' },
    balanceParsed: '1',
    price: '1',
  };
  mockGetEarnAssetsList.mockResolvedValue({ assets: [item(eth), item(weth)] });
  const view = render(<StakePage />);
  await waitFor(() =>
    expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(false),
  );
  mockFocused = false;
  mockRoute = { params: { ...mockRoute.params, accountId: 'account-2' } };
  view.rerender(<StakePage />);
  mockRoute = { params: { ...mockRoute.params, accountId: 'account-1' } };
  view.rerender(<StakePage />);
  expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(true);
  expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(1);
  let finish: (value: IEarnAssetsList) => void = () => undefined;
  mockGetEarnAssetsList.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  mockFocused = true;
  view.rerender(<StakePage />);
  await waitFor(() => expect(mockGetEarnAssetsList).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(true);
  await act(async () => finish({ assets: [item(eth, '2'), item(weth)] }));
  await waitFor(() =>
    expect(screen.getByTestId('confirm').hasAttribute('disabled')).toBe(false),
  );
  expect(screen.getByTestId('stake-balance').textContent).toBe('2');
});
