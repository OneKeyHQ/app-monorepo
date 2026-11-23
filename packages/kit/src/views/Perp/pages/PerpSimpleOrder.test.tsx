/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { act, fireEvent, render } from '@testing-library/react';
import BigNumber from 'bignumber.js';

import type { IAggressiveLimitPriceWarning } from '../utils/aggressiveLimitPrice';

const sourcePage: { hostKey: string; ownerKey?: string } = {
  hostKey: 'modal-host',
};
const route = {
  key: 'simple-order-route',
  name: 'MobilePerpSimpleOrder',
  params: { coin: 'BTC', side: 'long' },
};
const submitOrder = jest.fn().mockResolvedValue(undefined);
const showOrderConfirmDialog = jest.fn(() => ({ close: jest.fn() }));
const getWarning = jest.fn<
  IAggressiveLimitPriceWarning | undefined,
  unknown[]
>();
let focused = true;
const navigation = {
  addListener: () => () => undefined,
  isFocused: () => focused,
  getState: () => ({ index: 0, routes: [route] }),
  replace: jest.fn(),
};
let skipOrderConfirm = false;
const instrument = { mode: 'perp', coin: 'BTC', assetId: 0 };
const switchTradeInstrument = jest.fn(async () => true);
const actions = {
  current: {
    submitOrder,
    switchTradeInstrument,
    refreshAllPerpsData: jest.fn(),
  },
};

const Box = ({
  children,
  testID,
  onPress,
  disabled,
}: PropsWithChildren<{
  testID?: string;
  onPress?: () => void;
  disabled?: boolean;
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
const Mirror = ({ children }: PropsWithChildren) => children;
const Empty = () => null;

// Keep the actual screen and its submit branches; isolate UI and account services.
const mocks = {
  'react-native': {
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  },
  '@onekeyfe/react-native-native-overlay': {
    useOverlayPageScope: () => sourcePage,
  },
  '@react-navigation/native': {
    useRoute: () => route,
    useNavigation: () => navigation,
    useIsFocused: () => focused,
  },
  '@onekeyhq/components': {
    Page: Object.assign(Box, { Header: Empty, Body: Box, Footer: Box }),
    Button: Box,
    Icon: Empty,
    SizableText: Box,
    Switch: Box,
    XStack: Box,
    YStack: Box,
    Toast: { error: jest.fn() },
    useMedia: () => ({ gtMd: false }),
    useTheme: () => ({
      bgSubdued: { val: 'white' },
      bgApp: { val: 'black' },
      bgAccent: { val: 'green' },
      bgCriticalStrong: { val: 'red' },
    }),
  },
  'react-intl': {
    useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
  },
  '@onekeyhq/shared/src/platformEnv': {
    __esModule: true,
    default: { isNative: false },
  },
  '@onekeyhq/shared/src/keyboard': { dismissKeyboardWithDelay: jest.fn() },
  '@onekeyhq/kit/src/hooks/useAppNavigation': {
    __esModule: true,
    default: () => navigation,
  },
  '@onekeyhq/kit/src/hooks/useThemeVariant': { useThemeVariant: () => 'light' },
  '@onekeyhq/kit/src/hooks/usePromiseResult': {
    usePromiseResult: () => ({
      result: {
        accountAddress: 'account-a',
        takerRate: '0.0005',
        builderRate: '0',
      },
    }),
  },
  '@onekeyhq/kit/src/background/instance/backgroundApiProxy': {
    __esModule: true,
    default: {
      serviceHyperliquidSubscription: {
        getSubscriptionsHandlerDisabledCount: async () => 0,
      },
    },
  },
  '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid': {
    useActiveTradeInstrumentAtom: () => [instrument],
    useHyperliquidActions: () => actions,
    useTradingLoadingAtom: () => [false],
  },
  '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms': {
    usePerpsSimpleDraftAtom: () => [
      {
        scope: 'account-a:BTC',
        side: 'long',
        source: 'manual',
        inputAmount: '100',
        inputUnit: 'usd',
      },
      jest.fn(),
    ],
  },
  '@onekeyhq/shared/src/utils/appVisibility': {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
  },
  '@onekeyhq/shared/src/errors/utils/errorToastUtils': {
    __esModule: true,
    default: { toastIfError: jest.fn() },
  },
  '@onekeyhq/kit-bg/src/states/jotai/atoms': {
    appIsLocked: { get: async () => false },
    useAppIsLockedAtom: () => [false],
    usePerpsAccountLoadingInfoAtom: () => [{ selectAccountLoading: false }],
    usePerpsActiveAccountAtom: () => [{ accountAddress: 'account-a' }],
    usePerpsActiveAccountSummaryAtom: () => [{ accountAddress: 'account-a' }],
    usePerpsActiveAssetAtom: () => [
      { coin: 'BTC', universe: { szDecimals: 5, maxLeverage: 50 } },
    ],
    usePerpsActiveAssetCtxAtom: () => [
      { coin: 'BTC', ctx: { markPrice: '50000', prevDayPrice: '50000' } },
    ],
    usePerpsActiveAssetDataAtom: () => [
      {
        coin: 'BTC',
        accountAddress: 'account-a',
        leverage: { value: 10, type: 'cross' },
        markPx: '50000',
        maxTradeSzs: ['1', '1'],
      },
    ],
    usePerpsCustomSettingsAtom: () => [
      { skipOrderConfirm, mobileTradingMode: 'simple' },
      jest.fn(),
    ],
    usePerpsTradingPreferencesAtom: () => [{}, jest.fn()],
  },
  '@onekeyhq/kit/src/views/Send/components/SendAutoSizeAmountInput': {
    SendAutoSizeAmountInput: Empty,
  },
  '../components/PerpActionButton': { PerpActionButton: Box },
  '../components/PerpsSlider': { PerpsSlider: Empty },
  '../components/PerpsNativeAmountKeypad': {},
  '../components/Simple/PerpsMobileMode': {
    useSimpleScope: () => 'account-a:BTC',
  },
  '../components/Simple/SimpleLeverageDialog': {},
  '../components/Simple/SimpleMarketHeader': {},
  '../components/Simple/SimpleOrderTypeDialog': {
    showSimpleOrderTypeDialog: ({
      onConfirm,
    }: {
      onConfirm: (value: { type: 'limit'; price: string }) => void;
    }) => onConfirm({ type: 'limit', price: '52000' }),
  },
  '../components/Simple/SimpleValue': { SimpleValue: Box },
  '../components/TradingGuardWrapper': { TradingGuardWrapper: Mirror },
  '../components/TradingPanel/modals/OrderConfirmModal': {
    showOrderConfirmDialog,
  },
  '../hooks/useAggressiveLimitPriceWarning': {
    useGetAggressiveLimitPriceWarning: () => getWarning,
  },
  '../hooks/usePerpsAccountScopedActivePositions': {
    usePerpsAccountScopedActivePositions: () => [],
  },
  '../hooks/usePerpsCrossAvailableAfterMaintenance': {
    usePerpsCrossAvailableAfterMaintenance: () => new BigNumber('1000'),
  },
  '../hooks/usePerpsMarketDataFreshness': {
    getCurrentPerpsMarketDataFreshness: () => ({ isReady: true }),
  },
  '../hooks/useShowDepositWithdrawModal': {
    useShowDepositWithdrawModal: () => ({}),
  },
  '../hooks/useTradingPrice': {
    useTradingPrice: () => ({
      midPrice: '50000',
      midPriceBN: new BigNumber('50000'),
    }),
  },
  '../PerpsAccountSelectorProviderMirror': {
    PerpsAccountSelectorProviderMirror: Mirror,
  },
  '../PerpsProviderMirror': { PerpsProviderMirror: Mirror },
};
Object.entries(mocks).forEach(([name, exports]) => {
  jest.doMock(name, () => exports);
});
const { default: PerpSimpleOrder } =
  jest.requireActual<typeof import('./PerpSimpleOrder')>('./PerpSimpleOrder');

beforeEach(() => {
  jest.clearAllMocks();
  skipOrderConfirm = false;
  focused = true;
  instrument.coin = 'BTC';
  sourcePage.ownerKey = undefined;
  getWarning.mockReturnValue(undefined);
});

it('opens confirmation with the order route owner even without an inherited owner', () => {
  const { getByTestId } = render(<PerpSimpleOrder />);
  fireEvent.click(getByTestId('perps-simple-submit'));

  expect(showOrderConfirmDialog).toHaveBeenCalledWith(
    expect.objectContaining({
      sourcePage: { hostKey: 'modal-host', ownerKey: 'simple-order-route' },
      formData: expect.objectContaining({ type: 'market' }),
    }),
  );
  expect(submitOrder).not.toHaveBeenCalled();
});

it('keeps aggressive warnings on the order route when confirmation is skipped', () => {
  skipOrderConfirm = true;
  sourcePage.ownerKey = 'previous-market-page';
  const warning: IAggressiveLimitPriceWarning = {
    side: 'long',
    referencePrice: '50000',
    deviationPercent: 4,
  };
  getWarning.mockReturnValue(warning);
  const { getByTestId } = render(<PerpSimpleOrder />);
  fireEvent.click(getByTestId('perps-simple-order-type'));
  fireEvent.click(getByTestId('perps-simple-submit'));

  expect(showOrderConfirmDialog).toHaveBeenCalledWith(
    expect.objectContaining({
      sourcePage: { hostKey: 'modal-host', ownerKey: 'simple-order-route' },
      aggressiveLimitPriceWarning: warning,
      formData: expect.objectContaining({ type: 'limit', price: '52000' }),
    }),
  );
  expect(submitOrder).not.toHaveBeenCalled();
});

it('submits directly when confirmation is skipped and no warning is present', async () => {
  skipOrderConfirm = true;
  const { getByTestId } = render(<PerpSimpleOrder />);
  await act(async () => {
    fireEvent.click(getByTestId('perps-simple-submit'));
  });

  expect(showOrderConfirmDialog).not.toHaveBeenCalled();
  expect(submitOrder).toHaveBeenCalledWith({
    assetId: 0,
    expectedAccountAddress: 'account-a',
    price: '50000',
    formData: expect.objectContaining({ type: 'market', size: '0.002' }),
  });
});

it('restores the order coin after leaving an in-flight token selection', async () => {
  const { rerender } = render(<PerpSimpleOrder />);
  focused = false;
  instrument.coin = 'ETH';
  await act(async () => rerender(<PerpSimpleOrder />));
  expect(switchTradeInstrument).not.toHaveBeenCalled();

  focused = true;
  await act(async () => rerender(<PerpSimpleOrder />));
  expect(switchTradeInstrument).toHaveBeenCalledTimes(1);
  expect(switchTradeInstrument).toHaveBeenCalledWith({
    mode: 'perp',
    coin: 'BTC',
    subscriptionRecoveryProof: { source: 'simple-market', disabledCount: 0 },
  });
});
