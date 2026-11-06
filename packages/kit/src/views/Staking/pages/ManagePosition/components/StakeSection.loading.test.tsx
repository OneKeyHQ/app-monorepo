/** @jest-environment jsdom */
/* eslint-disable import/first */

const mockGetEarnAssetsList = jest.fn<Promise<unknown>, unknown[]>();
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
  };
});
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getEarnAssetsList: (...args: unknown[]) => mockGetEarnAssetsList(...args),
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
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { isBTCNetwork: () => false },
}));
jest.mock('../../../hooks/useBorrowApiParams', () => ({
  useBorrowApiParams: () => ({ isBorrow: false, borrowApiParams: {} }),
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
  }: {
    tokenSymbol?: string;
    tokenSelectorTriggerProps?: { onPress?: () => void };
    isStakeAssetLoading?: boolean;
    isDisabled?: boolean;
    isInModalContext?: boolean;
  }) => (
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
    </div>
  ),
}));
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import type {
  IEarnAssetsList,
  IEarnTokenInfo,
  IProtocolInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { StakeSection } from './StakeSection';

const weth = {
  address: '0xweth',
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
  mockGetEarnAssetsList.mockReset();
  mockPushModal.mockReset();
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

it.each([
  ['equivalent list asset', item({ ...weth })],
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
  },
);
