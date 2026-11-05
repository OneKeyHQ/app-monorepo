/** @jest-environment jsdom */
/* eslint-disable import/first */

const mockGetEarnAssetsList = jest.fn<Promise<unknown>, unknown[]>();
const mockFetchTokensDetails = jest.fn<Promise<unknown>, unknown[]>();
const mockRetainedAccountAddress = jest.fn<Promise<string>, []>();
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
  useEarnActions: () => ({ current: { removePermitCache: jest.fn() } }),
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
    useUniversalBorrowBorrow: () => jest.fn(),
    useUniversalBorrowSupply: () => jest.fn(),
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
    resolveEarnApproveSpenderAddress: () => '',
    resolveEarnApproveType: () => undefined,
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
jest.mock('../../../hooks/useIsPendleProvider', () => ({
  useIsPendleProvider: (provider: string) =>
    provider.toLowerCase() === 'pendle',
}));
jest.mock('../../../hooks/useUniversalHooks', () => ({
  useUniversalStake: () => jest.fn(),
}));
jest.mock('../../../components/UniversalStake', () => ({
  UniversalStake: ({
    tokenSymbol,
    tokenSelectorTriggerProps,
    isStakeAssetLoading,
    isDisabled,
    isInModalContext,
    beforeFooter,
    balance,
  }: {
    tokenSymbol?: string;
    tokenSelectorTriggerProps?: { onPress?: () => void };
    isStakeAssetLoading?: boolean;
    isDisabled?: boolean;
    isInModalContext?: boolean;
    beforeFooter?: import('react').ReactNode;
    balance?: string;
  }) => {
    mockStakeRender({ balance, tokenSymbol, isDisabled, isStakeAssetLoading });
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
import type {
  IEarnAssetsList,
  IEarnTokenInfo,
  IProtocolInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { depositTaskRegistry } from '../../../earnDepositTask/registry';
import {
  createDepositTask,
  createDepositTaskState,
} from '../../../earnDepositTask/state';
import { getDepositTaskOwnerKey } from '../../../earnDepositTask/useRetainedDepositTask';

import { StakeSection } from './StakeSection';

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
  mockGetEarnAssetsList.mockReset();
  mockFetchTokensDetails.mockReset();
  mockStakeApproval
    .mockReset()
    .mockReturnValue({ approve: undefined, error: false, retry: jest.fn() });
  mockPushModal.mockReset();
  mockStakeRender.mockReset();
});

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
