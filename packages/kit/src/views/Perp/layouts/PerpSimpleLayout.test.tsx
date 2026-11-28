/** @jest-environment jsdom */

import type { PropsWithChildren, ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

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
let portfolioTab: 'positions' | 'orders' = 'positions';
const Box = ({
  children,
  onPress,
  testID,
}: PropsWithChildren<{ onPress?: () => void; testID?: string }>) =>
  onPress ? (
    <button type="button" data-testid={testID} onClick={onPress}>
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
  '@react-navigation/core': { useNavigation: () => navigation },
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
    useSettingsValuePersistAtom: () => [{ hideValue: false }],
    usePerpsActiveAccountAtom: () => [{ accountAddress: 'account-a' }],
    usePerpsAccountLoadingInfoAtom: () => [{ selectAccountLoading: false }],
    usePerpsComputedAccountValueAtom: () => [
      { accountValue: '100', withdrawable: '90' },
    ],
    usePerpTokenSelectorTabsAtom: () => [[]],
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
  '../hooks/usePerpsAccountScopedActivePositions': {
    usePerpsAccountScopedActivePositions: () => [position],
  },
  '../hooks/usePerpsAccountScopedCacheAddress': {
    usePerpsAccountScopedCacheAddress: () => 'account-a',
  },
  '../hooks/usePerpsAssetCtx': { usePerpsAssetCtx: () => ({}) },
  '../hooks/usePerpsFavorites': {
    usePerpsFavorites: () => ({ favoriteItems: [] }),
  },
  '../hooks/useShowDepositWithdrawModal': {
    useShowDepositWithdrawModal: () => ({}),
  },
  '../hooks/useShowPortfolio': { useShowPortfolio: () => ({}) },
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
  '../components/Simple/SimpleValue': { SimpleValue: Box },
};
Object.entries(mocks).forEach(([path, exports]) =>
  jest.doMock(path, () => exports),
);
const { default: PerpSimpleLayout } =
  jest.requireActual<typeof import('./PerpSimpleLayout')>('./PerpSimpleLayout');

beforeEach(() => {
  jest.clearAllMocks();
  focused = true;
  portfolioTab = 'positions';
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
