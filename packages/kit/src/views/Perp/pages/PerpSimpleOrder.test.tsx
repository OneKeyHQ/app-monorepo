/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useRef, useSyncExternalStore } from 'react';

import { act, fireEvent, render } from '@testing-library/react';
import BigNumber from 'bignumber.js';

import type { IPageHeaderProps } from '@onekeyhq/components/src/layouts/Page/PageHeader';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IAggressiveLimitPriceWarning } from '../utils/aggressiveLimitPrice';

const sourcePage: { hostKey: string; ownerKey?: string } = {
  hostKey: 'modal-host',
};
const route = {
  key: 'simple-order-route',
  name: 'MobilePerpSimpleOrder',
  params: { coin: 'BTC', side: 'long' },
};
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    perp: {
      common: { perpTradingModeSwitch: jest.fn() },
    },
  },
}));

const submitOrder = jest.fn().mockResolvedValue(undefined);
const showDepositWithdrawModal = jest.fn();
let inputAmount = '100';
let draftSource: 'manual' | 'percent' = 'manual';
let draftSizePercent = 50;
let draftInputUnit: 'usd' | 'margin' | 'token' = 'usd';
const setDraft = jest.fn();
const warnInputLimit = jest.fn();
const animateInputLimit = jest.fn((value: number) => value);
let pressAmountKey: (key: string) => boolean | void;
const showOrderConfirmDialog = jest.fn(
  (_options: { onConfirmSuccess?: () => void }) => ({ close: jest.fn() }),
);
const getWarning = jest.fn<
  IAggressiveLimitPriceWarning | undefined,
  unknown[]
>();
let focused = true;
const setOptions = jest.fn<void, [IPageHeaderProps]>();
const stableIntl = { formatMessage: ({ id }: { id: string }) => id };
const setPerpsSettings = jest.fn();
const setTradingPreferences = jest.fn();
let midPrice = '50000';
let maxTradeSize = '1';
const priceListeners = new Set<() => void>();
const subscribePrice = (listener: () => void) => {
  priceListeners.add(listener);
  return () => {
    priceListeners.delete(listener);
  };
};
const getPrice = () => midPrice;
const PerpsContext = createContext(false);
function PerpsMirror({ children }: PropsWithChildren) {
  return <PerpsContext.Provider value>{children}</PerpsContext.Provider>;
}
const navigation = {
  setOptions,
  addListener: () => () => undefined,
  isFocused: () => focused,
  getState: () => ({ index: 0, routes: [route] }),
  replace: jest.fn(),
};
let skipOrderConfirm = false;
let perpConfigCommon = { disablePerpActionPerp: false, ipDisablePerp: false };
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
  variant,
}: PropsWithChildren<{
  testID?: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: string;
}>) =>
  onPress ? (
    <button
      type="button"
      data-testid={testID}
      onClick={onPress}
      disabled={disabled}
      data-variant={variant}
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
  '../../../../../components/src/hocs': { useIsOverlayPage: () => false },
  '../../../../../components/src/hooks': {
    useTheme: () => ({ text: { val: 'black' } }),
  },
  '../../../../../components/src/primitives/Button/GlassHeaderContext': {
    toNoGlassHeaderItems: () => undefined,
    wrapHeaderRenderInGlass: (callback: unknown) => callback,
  },
  '../../../../../components/src/layouts/Navigation/Header/HeaderSearchBar': {
    __esModule: true,
    default: Empty,
  },
  'react-native-reanimated': {
    __esModule: true,
    default: { View: Box },
    useSharedValue: (value: number) => useRef({ value }).current,
    useAnimatedStyle: (callback: () => unknown) => callback(),
    cancelAnimation: jest.fn(),
    withTiming: animateInputLimit,
    withSequence: (...values: number[]) => values.at(-1),
  },
  'react-native': {
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  },
  '@onekeyfe/react-native-native-overlay': {
    useOverlayPageScope: () => sourcePage,
    OverlayPageHostScope: Mirror,
    OverlayPageOwnerScope: Mirror,
  },
  '@react-navigation/native': {
    useRoute: () => route,
    useNavigation: () => navigation,
    useIsFocused: () => focused,
  },
  '@onekeyhq/components': {
    Page: Object.assign(Box, {
      Header: (props: IPageHeaderProps) => {
        const { PageHeader } = jest.requireActual<
          typeof import('../../../../../components/src/layouts/Page/PageHeader')
        >('../../../../../components/src/layouts/Page/PageHeader');
        return <PageHeader {...props} />;
      },
      Body: Box,
      Footer: Box,
    }),
    Button: Box,
    Icon: Empty,
    SizableText: Box,
    Switch: Box,
    XStack: Box,
    YStack: Box,
    Toast: { error: jest.fn() },
    Haptics: { warning: warnInputLimit },
    useMedia: () => ({ gtMd: false }),
    useTheme: () => ({
      bgSubdued: { val: 'white' },
      bgApp: { val: 'black' },
      bgAccent: { val: 'green' },
      bgCriticalStrong: { val: 'red' },
    }),
  },
  'react-intl': {
    useIntl: () => stableIntl,
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
        side: route.params.side,
        source: draftSource,
        sizePercent: draftSizePercent,
        inputAmount,
        inputUnit: draftInputUnit,
      },
      setDraft,
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
    usePerpsCommonConfigPersistAtom: () => [{ perpConfigCommon }],
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
        markPx: midPrice,
        maxTradeSzs: [maxTradeSize, maxTradeSize],
      },
    ],
    usePerpsCustomSettingsAtom: () => [
      { skipOrderConfirm, mobileTradingMode: 'simple' },
      setPerpsSettings,
    ],
    usePerpsTradingPreferencesAtom: () => [{}, setTradingPreferences],
  },
  '@onekeyhq/kit/src/views/Send/components/SendAutoSizeAmountInput': {
    SendAutoSizeAmountInput: ({ value }: { value: string }) => (
      <span>{value}</span>
    ),
  },
  '../components/PerpActionButton': { PerpActionButton: Box },
  '../components/PerpsSlider': { PerpsSlider: Empty },
  '../components/PerpsNativeAmountKeypad': {
    PerpsNativeAmountKeypad: ({
      onKeyPress,
    }: {
      onKeyPress: (key: string) => boolean | void;
    }) => {
      pressAmountKey = onKeyPress;
      return (
        <button type="button" onClick={() => onKeyPress('backspace')}>
          Backspace
        </button>
      );
    },
  },
  '../components/Simple/PerpsMobileMode': {
    useSimpleScope: () => 'account-a:BTC',
  },
  '../components/Simple/SimpleLeverageDialog': {},
  '../components/Simple/SimpleMarketHeader': {
    SimpleMarketHeader: ({ price }: { price: string }) => (
      <output data-testid="order-header-price">{price}</output>
    ),
  },
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
    useShowDepositWithdrawModal: () => ({
      showDepositWithdrawModal,
      isDepositDisabled: false,
    }),
  },
  '../hooks/useTradingPrice': {
    useTradingPrice: () => {
      const hasProvider = useContext(PerpsContext);
      const price = useSyncExternalStore(subscribePrice, getPrice);
      if (!hasProvider)
        throw new OneKeyLocalError(
          'Missing Perps context in navigation header',
        );
      return { midPrice: price, midPriceBN: new BigNumber(price) };
    },
  },
  '../PerpsAccountSelectorProviderMirror': {
    PerpsAccountSelectorProviderMirror: Mirror,
  },
  '../PerpsProviderMirror': { PerpsProviderMirror: PerpsMirror },
};
Object.entries(mocks).forEach(([name, exports]) => {
  jest.doMock(name, () => exports);
});
const { default: PerpSimpleOrder } =
  jest.requireActual<typeof import('./PerpSimpleOrder')>('./PerpSimpleOrder');

beforeEach(() => {
  jest.clearAllMocks();
  midPrice = '50000';
  maxTradeSize = '1';
  skipOrderConfirm = false;
  perpConfigCommon = { disablePerpActionPerp: false, ipDisablePerp: false };
  inputAmount = '100';
  draftSource = 'manual';
  draftSizePercent = 50;
  draftInputUnit = 'usd';
  mocks['@onekeyhq/shared/src/platformEnv'].default.isNative = false;
  route.params.side = 'long';
  focused = true;
  instrument.coin = 'BTC';
  sourcePage.ownerKey = undefined;
  getWarning.mockReturnValue(undefined);
});

it.each(['long', 'short'])(
  'uses a primary deposit action when %s exceeds available margin',
  (side) => {
    route.params.side = side;
    inputAmount = '555555555555';
    const { getByTestId } = render(<PerpSimpleOrder />);
    const button = getByTestId('perps-simple-validation');

    expect(button.getAttribute('data-variant')).toBe('primary');
    expect(button.textContent).toBe(
      'perp_simple_insufficient_margin_top_up__action',
    );
    fireEvent.click(button);
    expect(showDepositWithdrawModal).toHaveBeenCalledWith('deposit');
    expect(submitOrder).not.toHaveBeenCalled();
    expect(showOrderConfirmDialog).not.toHaveBeenCalled();
  },
);

it('opens confirmation with the order route owner even without an inherited owner', () => {
  const { getByTestId } = render(<PerpSimpleOrder />);
  fireEvent.click(getByTestId('perps-simple-submit'));

  expect(showOrderConfirmDialog).toHaveBeenCalledWith(
    expect.objectContaining({
      sourcePage: { hostKey: 'modal-host', ownerKey: 'simple-order-route' },
      tradingUiMode: 'simple',
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
      tradingUiMode: 'simple',
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
    tradingUiMode: 'simple',
    price: '50000',
    formData: expect.objectContaining({ type: 'market', size: '0.002' }),
  });
  expect(navigation.replace).toHaveBeenCalled();
  expect(actions.current.refreshAllPerpsData).not.toHaveBeenCalled();
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
    restorationSignal: expect.any(AbortSignal),
    subscriptionRecoveryProof: { source: 'simple-market', disabledCount: 0 },
  });
});

it('returns to the market after confirmation without consuming manual refresh', () => {
  const { getByTestId } = render(<PerpSimpleOrder />);
  fireEvent.click(getByTestId('perps-simple-submit'));

  act(() => {
    showOrderConfirmDialog.mock.calls[0][0].onConfirmSuccess?.();
  });

  expect(navigation.replace).toHaveBeenCalled();
  expect(actions.current.refreshAllPerpsData).not.toHaveBeenCalled();
});

it('edits the displayed native amount after a slider selection', () => {
  mocks['@onekeyhq/shared/src/platformEnv'].default.isNative = true;
  draftSource = 'percent';
  const { getByText } = render(<PerpSimpleOrder />);
  expect(getByText('25000.00')).toBeTruthy();
  fireEvent.click(getByText('Backspace'));
  expect(setDraft).toHaveBeenCalledWith(
    expect.objectContaining({ source: 'manual', inputAmount: '25000.0' }),
  );
});

it.each([
  ['usd', '25000.00'],
  ['margin', '2500.00'],
  ['token', '0.5'],
] as const)(
  'accepts native %s keypad input after moving the slider back to zero',
  (unit, selectedAmount) => {
    mocks['@onekeyhq/shared/src/platformEnv'].default.isNative = true;
    draftSource = 'percent';
    draftInputUnit = unit;
    const { getByText, rerender } = render(<PerpSimpleOrder />);
    expect(getByText(selectedAmount)).toBeTruthy();

    draftSizePercent = 0;
    rerender(<PerpSimpleOrder />);
    expect(getByText('0')).toBeTruthy();
    act(() => {
      for (const key of '7.25') expect(pressAmountKey(key)).toBe(true);
    });
    expect(setDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: 'manual', inputAmount: '7.25' }),
    );

    rerender(<PerpSimpleOrder />);
    act(() => {
      for (const key of '.05') expect(pressAmountKey(key)).toBe(true);
    });
    expect(setDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: 'manual', inputAmount: '0.05' }),
    );
    expect(warnInputLimit).not.toHaveBeenCalled();
  },
);

it('retains every key when rapid input arrives before the draft renders', () => {
  mocks['@onekeyhq/shared/src/platformEnv'].default.isNative = true;
  inputAmount = '';
  render(<PerpSimpleOrder />);
  act(() => {
    for (const key of '123456789012') pressAmountKey(key);
  });
  expect(setDraft).toHaveBeenCalledTimes(12);
  expect(setDraft).toHaveBeenLastCalledWith(
    expect.objectContaining({ inputAmount: '123456789012' }),
  );
  expect(warnInputLimit).not.toHaveBeenCalled();
});

it('signals the fiat digit limit without changing the value and allows correction', () => {
  mocks['@onekeyhq/shared/src/platformEnv'].default.isNative = true;
  inputAmount = '123456789012';
  render(<PerpSimpleOrder />);
  act(() => {
    expect(pressAmountKey('3')).toBe(false);
  });
  expect(setDraft).not.toHaveBeenCalled();
  expect(warnInputLimit).toHaveBeenCalledTimes(1);
  expect(animateInputLimit).toHaveBeenCalled();
  act(() => {
    pressAmountKey('backspace');
    pressAmountKey('9');
  });
  expect(setDraft).toHaveBeenLastCalledWith(
    expect.objectContaining({ inputAmount: '123456789019' }),
  );
});

it('signals excess decimal precision and accepts deletion immediately', () => {
  mocks['@onekeyhq/shared/src/platformEnv'].default.isNative = true;
  inputAmount = '1.23';
  render(<PerpSimpleOrder />);
  act(() => {
    pressAmountKey('4');
    pressAmountKey('backspace');
    pressAmountKey('5');
  });
  expect(warnInputLimit).toHaveBeenCalledTimes(1);
  expect(setDraft).toHaveBeenLastCalledWith(
    expect.objectContaining({ inputAmount: '1.25' }),
  );
});

it('keeps navigation options stable through order edits and live quote updates', () => {
  const { rerender } = render(<PerpSimpleOrder />);
  expect(setOptions).toHaveBeenCalledTimes(1);
  const headerTitle = setOptions.mock.calls[0][0].headerTitle;
  if (typeof headerTitle !== 'function')
    throw new OneKeyLocalError('Expected a header renderer');
  const title = render(<>{headerTitle({ children: 'BTC' })}</>);
  expect(title.getByTestId('order-header-price').textContent).toBe('$50,000');
  inputAmount = '200';
  rerender(<PerpSimpleOrder />);
  act(() => {
    midPrice = '51000';
    priceListeners.forEach((listener) => listener());
  });
  expect(setOptions).toHaveBeenCalledTimes(1);
  expect(title.getByTestId('order-header-price').textContent).toBe('$51,000');
});

it.each(['disablePerpActionPerp', 'ipDisablePerp'] as const)(
  'disables both confirmation and direct submission when %s changes',
  (flag) => {
    const { getByTestId, rerender } = render(<PerpSimpleOrder />);
    expect(getByTestId('perps-simple-submit').hasAttribute('disabled')).toBe(
      false,
    );
    perpConfigCommon[flag] = true;
    rerender(<PerpSimpleOrder />);
    expect(getByTestId('perps-simple-submit').hasAttribute('disabled')).toBe(
      true,
    );
    fireEvent.click(getByTestId('perps-simple-submit'));
    skipOrderConfirm = true;
    rerender(<PerpSimpleOrder />);
    fireEvent.click(getByTestId('perps-simple-submit'));
    expect(submitOrder).not.toHaveBeenCalled();
    expect(showOrderConfirmDialog).not.toHaveBeenCalled();
  },
);

it.each(['usd', 'margin', 'token'] as const)(
  'submits the full token lot at 100 percent in %s mode despite fiat display rounding',
  async (unit) => {
    midPrice = '10001';
    maxTradeSize = '0.001';
    draftSource = 'percent';
    draftSizePercent = 100;
    draftInputUnit = unit;
    skipOrderConfirm = true;
    const { getByTestId } = render(<PerpSimpleOrder />);
    await act(async () => fireEvent.click(getByTestId('perps-simple-submit')));
    expect(submitOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        price: '10001',
        formData: expect.objectContaining({ size: '0.001' }),
      }),
    );
  },
);
