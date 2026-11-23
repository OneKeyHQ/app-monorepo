/** @jest-environment jsdom */

import type { PropsWithChildren, ReactNode } from 'react';

import { fireEvent, render, renderHook } from '@testing-library/react';

import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

const pushModal = jest.fn();
let focused = true;
const navigation = { pushModal, isFocused: () => focused };
const switchTradeInstrument = jest.fn(() => new Promise<boolean>(() => {}));
const actions = {
  current: {
    switchTradeInstrument,
    markAllAssetCtxsRequired: jest.fn(),
    markAllAssetCtxsNotRequired: jest.fn(),
  },
};
const refresh = jest.fn();
const position = { position: { coin: 'ETH' } };
const order = { oid: 1, coin: 'xyz:GOLD' };
const accountA = { accountAddress: 'account-a', accountId: 'wallet-a' };
const walletA = { account: { id: 'wallet-a' }, ready: true };
const walletB = { account: { id: 'wallet-b' }, ready: true };
const initialAccountValue = {
  accountValue: '500',
  withdrawable: '90',
  availableUsdc: '90',
  isAccountValuePartial: false,
};
let activeAccount = accountA;
let selectedWalletAccount = walletA;
let accountValue = initialAccountValue;
let hideValue = false;
let cachedWalletB = false;
const showDepositWithdrawModal = jest.fn();
let portfolioTab: 'positions' | 'orders' = 'positions';
const Box = ({
  children,
  disabled,
  onPress,
  testID,
}: PropsWithChildren<{
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
}>) =>
  onPress ? (
    <button
      type="button"
      data-testid={testID}
      onClick={onPress}
      disabled={disabled}
    >
      {children}
    </button>
  ) : (
    <div data-testid={testID}>{children}</div>
  );
const Empty = () => null;
const mocks = {
  'react-intl': {
    useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
  },
  '@react-navigation/core': {
    useIsFocused: () => focused,
    useNavigation: () => navigation,
  },
  '@onekeyhq/components': {
    Button: Box,
    Icon: Empty,
    NumberSizeableText: Box,
    Select: Empty,
    SizableText: Box,
    Skeleton: Empty,
    Spinner: Empty,
    XStack: Box,
    YStack: Box,
    useTheme: () => ({ bgAccent: { val: 'green' } }),
  },
  '@onekeyhq/kit/src/hooks/useAppNavigation': {
    __esModule: true,
    default: () => navigation,
  },
  '@onekeyhq/kit/src/hooks/usePromiseResult': {
    usePromiseResult: () => ({ result: undefined, run: refresh }),
  },
  '@onekeyhq/kit/src/background/instance/backgroundApiProxy': {
    __esModule: true,
    default: {
      serviceHyperliquid: { refreshTradingMeta: async () => undefined },
    },
  },
  '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger':
    {
      useAccountSelectorTrigger: () => ({ showAccountSelector: jest.fn() }),
    },
  '@onekeyhq/kit/src/components/LightweightChart': { LightweightChart: Empty },
  '@onekeyhq/kit/src/components/RollingNumberText': { RollingNumberText: Box },
  '@onekeyhq/kit/src/components/Token': { Token: Empty },
  '@onekeyhq/kit/src/views/Market/components/PerpsBadges': {
    PerpDexBadge: Empty,
    SubtitleText: Box,
  },
  '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid': {
    useHyperliquidActions: () => actions,
    useActiveTradeInstrumentAtom: () => [{ mode: 'perp', coin: 'BTC' }],
    usePerpsActivePositionAtom: () => [
      { accountAddress: 'account-a', activePositions: [position] },
    ],
  },
  '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms': {
    usePerpsActiveOpenOrdersAtom: () => [
      { accountAddress: 'account-a', openOrders: [order] },
    ],
    usePerpsActiveTwapOrdersAtom: () => [
      { accountAddress: 'account-a', twapOrders: [] },
    ],
  },
  '@onekeyhq/kit-bg/src/states/jotai/atoms': {
    useSettingsValuePersistAtom: () => [{ hideValue }],
    usePerpsActiveAccountAtom: () => [activeAccount],
    usePerpsAccountLoadingInfoAtom: () => [{ selectAccountLoading: false }],
    usePerpsComputedAccountValueAtom: () => [accountValue],
    usePerpsAccountDisplaySnapshotAtom: () => [{ entries: {} }],
    getPerpsAccountDisplaySnapshotEntry: ({
      accountId,
    }: {
      accountId?: string;
    }) =>
      cachedWalletB && accountId === 'wallet-b'
        ? { account: { accountAddress: 'account-b' } }
        : undefined,
    usePerpTokenSelectorTabsAtom: () => [[]],
  },
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/atoms': {
    useActiveAccount: () => ({ activeAccount: selectedWalletAccount }),
  },
  '@onekeyhq/shared/src/errors/utils/errorToastUtils': {
    __esModule: true,
    default: { toastIfError: jest.fn() },
  },
  '@onekeyhq/shared/src/logger/logger': {
    defaultLogger: {
      perp: { hyperliquid: { coldStartInitializationError: jest.fn() } },
    },
  },
  '../hooks/usePerpsAssetCtx': { usePerpsAssetCtx: () => ({}) },
  '../hooks/usePerpsFavorites': {
    usePerpsFavorites: () => ({ favoriteItems: [] }),
  },
  '../hooks/useShowDepositWithdrawModal': {
    useShowDepositWithdrawModal: () => ({ showDepositWithdrawModal }),
  },
  '../hooks/useShowPortfolio': {
    useShowPortfolio: () => ({ showPortfolio: jest.fn() }),
  },
  '../utils/perpsCachedData': {},
  '../utils/simpleOrderSummary': {
    getSimpleOrderSummary: () => ({ coin: order.coin }),
  },
  '../components/PerpActionButton': { PerpActionButton: Box },
  '../components/Portfolio/portfolioStats': {},
  '../components/Simple/SimpleLeverageBadge': { SimpleLeverageBadge: Empty },
  '../components/Simple/SimpleMarketCategories': {
    SimpleMarketCategories: Empty,
  },
  '../components/Simple/SimpleMarketList': {
    SimpleMarketList: ({ overview }: { overview: ReactNode }) => (
      <>{overview}</>
    ),
  },
  '../components/Simple/SimpleNetworkAlert': { SimpleNetworkAlert: Empty },
  '../components/Simple/SimpleOrderSummary': {
    SimpleOrderSummary: ({ onPress }: { onPress: () => void }) => (
      <Box testID="order" onPress={onPress} />
    ),
  },
  '../components/Simple/SimplePortfolioTabs': {
    SimplePortfolioTabs: ({
      children,
    }: {
      children: (tab: string) => ReactNode;
    }) => <>{children(portfolioTab)}</>,
  },
  '../components/Simple/SimplePositionCard': {
    SimplePositionSummary: ({ onPress }: { onPress: () => void }) => (
      <Box testID="position" onPress={onPress} />
    ),
  },
  '../components/Simple/SimpleTwapEntry': { SimpleTwapEntry: Empty },
  '../components/Simple/SimpleValue': {
    SimpleValue: ({ value }: { value: string }) => (
      <span data-testid="available-usdc">{value}</span>
    ),
  },
};
Object.entries(mocks).forEach(([path, exports]) =>
  jest.doMock(path, () => exports),
);
const { default: PerpSimpleLayout } =
  jest.requireActual<typeof import('./PerpSimpleLayout')>('./PerpSimpleLayout');
const { usePerpsAccountScopedCacheAddress } = jest.requireActual<
  typeof import('../hooks/usePerpsAccountScopedCacheAddress')
>('../hooks/usePerpsAccountScopedCacheAddress');

beforeEach(() => {
  jest.clearAllMocks();
  focused = true;
  portfolioTab = 'positions';
  activeAccount = accountA;
  selectedWalletAccount = walletA;
  accountValue = initialAccountValue;
  hideValue = false;
  cachedWalletB = false;
});

it.each(['positions', 'orders'] as const)(
  'opens %s immediately without waiting for a market switch',
  (tab) => {
    portfolioTab = tab;
    const view = render(<PerpSimpleLayout />);
    fireEvent.click(
      view.getByTestId(tab === 'positions' ? 'position' : 'order'),
    );
    expect(pushModal).toHaveBeenCalledWith(EModalRoutes.PerpModal, {
      screen: EModalPerpRoutes.MobilePerpSimpleMarket,
      params: expect.objectContaining({
        coin: tab === 'positions' ? 'ETH' : 'xyz:GOLD',
      }),
    });
    if (tab === 'orders')
      expect(pushModal.mock.calls[0][1].params.initialPortfolioTab).toBe(
        'orders',
      );
    expect(switchTradeInstrument).not.toHaveBeenCalled();
  },
);

it('ignores presses from a screen that is no longer focused', () => {
  focused = false;
  const view = render(<PerpSimpleLayout />);
  fireEvent.click(view.getByTestId('position'));
  expect(pushModal).not.toHaveBeenCalled();
  expect(switchTradeInstrument).not.toHaveBeenCalled();
});

it('releases the home market data requirement while a modal covers the route', () => {
  const { rerender, unmount } = render(<PerpSimpleLayout />);
  expect(actions.current.markAllAssetCtxsRequired).toHaveBeenCalledTimes(1);
  focused = false;
  rerender(<PerpSimpleLayout />);
  expect(actions.current.markAllAssetCtxsNotRequired).toHaveBeenCalledTimes(1);
  focused = true;
  rerender(<PerpSimpleLayout />);
  expect(actions.current.markAllAssetCtxsRequired).toHaveBeenCalledTimes(2);
  unmount();
  expect(actions.current.markAllAssetCtxsNotRequired).toHaveBeenCalledTimes(2);
});

it.each([false, true])(
  'hides the previous wallet portfolio and disables its actions during selection (hidden values: %s)',
  (isHidden) => {
    hideValue = isHidden;
    const { getByTestId, queryByTestId, rerender } = render(
      <PerpSimpleLayout />,
    );
    expect(getByTestId('position')).toBeTruthy();
    expect(getByTestId('perps-simple-toggle-assets').textContent).toBe(
      isHidden ? '****' : '$500.00',
    );

    selectedWalletAccount = walletB;
    rerender(<PerpSimpleLayout />);

    expect(getByTestId('perps-simple-toggle-assets').textContent).toBe(
      isHidden ? '****' : '--',
    );
    expect(getByTestId('available-usdc').textContent).toBe(
      isHidden ? '****' : '--',
    );
    expect(queryByTestId('perps-simple-account-chart')).toBeNull();
    expect(queryByTestId('position')).toBeNull();
    expect(queryByTestId('PerpSimpleLayout-2')).toBeNull();
    fireEvent.click(getByTestId('PerpSimpleLayout-1'));
    expect(showDepositWithdrawModal).not.toHaveBeenCalled();

    portfolioTab = 'orders';
    rerender(<PerpSimpleLayout />);
    expect(queryByTestId('order')).toBeNull();
  },
);

it('only uses a cached address belonging to the selected wallet', () => {
  const { result, rerender } = renderHook(usePerpsAccountScopedCacheAddress);
  expect(result.current).toBe('account-a');
  selectedWalletAccount = walletB;
  rerender();
  expect(result.current).toBeNull();
  cachedWalletB = true;
  rerender();
  expect(result.current).toBe('account-b');
  activeAccount = { accountAddress: 'account-b', accountId: 'wallet-b' };
  cachedWalletB = false;
  rerender();
  expect(result.current).toBe('account-b');
});

it('marks a partial zero estimate and keeps withdrawals available', () => {
  accountValue = {
    accountValue: '0',
    withdrawable: '0',
    availableUsdc: '0',
    isAccountValuePartial: true,
  };
  const { getByTestId, queryByTestId, rerender } = render(<PerpSimpleLayout />);
  expect(getByTestId('perps-simple-toggle-assets').textContent).toBe('≈$0.00');
  fireEvent.click(getByTestId('PerpSimpleLayout-2'));
  expect(showDepositWithdrawModal).toHaveBeenCalledWith('withdraw');

  accountValue = { ...accountValue, isAccountValuePartial: false };
  rerender(<PerpSimpleLayout />);
  expect(queryByTestId('PerpSimpleLayout-2')).toBeNull();
});
