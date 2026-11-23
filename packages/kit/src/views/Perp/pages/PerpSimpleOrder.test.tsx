/** @jest-environment jsdom */

import type { PropsWithChildren, ReactNode } from 'react';
import {
  createContext,
  isValidElement,
  useContext,
  useRef,
  useSyncExternalStore,
} from 'react';

import { act, fireEvent, render } from '@testing-library/react';
import BigNumber from 'bignumber.js';
import { atom, createStore, useAtom } from 'jotai';

import type { IPageHeaderProps } from '@onekeyhq/components/src/layouts/Page/PageHeader';
import type { IPerpsSimplePendingLeverage } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
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
let activeAddress: string | undefined = 'account-a';
let sliderProps: {
  disabled: boolean;
  onSlideStart: () => void;
  onSlideCancel: () => void;
  onChange: (value: number) => void;
};
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
const stableIntl = {
  formatMessage: ({ id }: { id: string }, values?: { amount?: string }) =>
    values?.amount ? `${id} ${values.amount}` : id,
};
const setPerpsSettings = jest.fn();
const setTradingPreferences = jest.fn();
let midPrice = '50000';
let maxTradeSize = '1';
let markPx: string | undefined;
let contextMark = '50000';
let exchangeLeverage = 10;
let exchangeMode: 'cross' | 'isolated' = 'cross';
let selectedLeverage = 2;
let marginMode: 'noCross' | 'strictIsolated' | undefined;
let isWide = false;
let mobileMode: 'pro' | 'simple' = 'simple';
const testStore = createStore();
const pendingLeverageAtom = atom<
  Partial<Record<string, IPerpsSimplePendingLeverage>>
>({});
let isAgentReady = true;
let quoteFresh = true;
let dialogContent: ReactNode;
const closeSettings = jest.fn();
const closeOrderType = jest.fn();
const getActiveAssetDataByCoin = jest.fn();
const getMarketOrderReferencePrice = jest.fn<
  Promise<string | undefined>,
  [string]
>();
const updateLeverage = jest.fn().mockResolvedValue(undefined);
let exchangeSnapshot: ReturnType<typeof buildAssetData>;
function buildAssetData() {
  return {
    coin: 'BTC',
    accountAddress: 'account-a',
    leverage: { value: exchangeLeverage, type: exchangeMode },
    markPx: markPx ?? midPrice,
    maxTradeSzs: [maxTradeSize, maxTradeSize],
  };
}
function getExchangeSnapshot() {
  if (
    !exchangeSnapshot ||
    exchangeSnapshot.leverage.value !== exchangeLeverage ||
    exchangeSnapshot.leverage.type !== exchangeMode ||
    exchangeSnapshot.markPx !== (markPx ?? midPrice) ||
    exchangeSnapshot.maxTradeSzs[0] !== maxTradeSize
  )
    exchangeSnapshot = buildAssetData();
  return exchangeSnapshot;
}
const showDialog = jest.fn(
  ({ renderContent }: { renderContent: ReactNode }) => {
    dialogContent = renderContent;
    return { close: closeSettings };
  },
);
const showOrderType = jest.fn(
  ({
    onConfirm,
  }: {
    onConfirm: (value: { type: 'limit'; price: string }) => void;
  }) => {
    onConfirm({ type: 'limit', price: '52000' });
    return { close: closeOrderType };
  },
);
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
  popStack: jest.fn(),
};
let skipOrderConfirm = false;
let perpConfigCommon = { disablePerpActionPerp: false, ipDisablePerp: false };
const instrument = {
  mode: 'perp',
  coin: 'BTC',
  assetId: 0,
  universe: { szDecimals: 5 },
};
const switchTradeInstrument = jest.fn(async () => true);
const actions = {
  current: {
    submitOrder,
    updateLeverage,
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
    Dialog: { show: showDialog },
    useDialogInstance: () => ({ close: closeSettings }),
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
    useMedia: () => ({ gtMd: isWide }),
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
    default: { isNative: false, isWeb: true },
  },
  '@onekeyhq/shared/src/keyboard': { dismissKeyboardWithDelay: jest.fn() },
  '@onekeyhq/kit/src/hooks/useAppNavigation': {
    __esModule: true,
    default: () => navigation,
  },
  '@onekeyhq/kit/src/hooks/useThemeVariant': { useThemeVariant: () => 'light' },
  '@onekeyhq/kit/src/hooks/usePromiseResult': {
    usePromiseResult: () => ({ result: undefined }),
  },
  '@onekeyhq/kit/src/background/instance/backgroundApiProxy': {
    __esModule: true,
    default: {
      serviceHyperliquid: {
        getActiveAssetDataByCoin,
        getMarketOrderReferencePrice,
      },
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
    usePerpsSimplePendingLeverageAtom: () =>
      useAtom(pendingLeverageAtom, { store: testStore }),
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
    perpsCustomSettingsAtom: {
      ready: async () => undefined,
      get: async () => ({ mobileTradingMode: mobileMode }),
    },
    usePerpsCommonConfigPersistAtom: () => [{ perpConfigCommon }],
    usePerpsAccountLoadingInfoAtom: () => [{ selectAccountLoading: false }],
    usePerpsActiveAccountAtom: () => [{ accountAddress: activeAddress }],
    usePerpsActiveAccountSummaryAtom: () => [{ accountAddress: 'account-a' }],
    usePerpsActiveAssetAtom: () => [
      {
        coin: 'BTC',
        assetId: 0,
        universe: { szDecimals: 5, maxLeverage: 50, marginMode },
      },
    ],
    usePerpsActiveAssetCtxAtom: () => [
      { coin: 'BTC', ctx: { markPrice: contextMark, prevDayPrice: '50000' } },
    ],
    usePerpsActiveAssetDataAtom: () => [getExchangeSnapshot()],
    usePerpsCustomSettingsAtom: () => [
      { skipOrderConfirm, mobileTradingMode: mobileMode },
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
  '../components/PerpsSlider': {
    PerpsSlider: (props: typeof sliderProps) => {
      sliderProps = props;
      return null;
    },
  },
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
    useSimpleScope: () => `${activeAddress ?? ''}:BTC`,
  },
  '../components/Simple/LeverageRuler': {
    LeverageRuler: ({ onChange }: { onChange: (value: number) => void }) => (
      <button type="button" onClick={() => onChange(selectedLeverage)}>
        Change leverage
      </button>
    ),
  },
  '../components/Simple/SimpleMarketHeader': {
    SimpleMarketHeader: ({ price }: { price: string }) => (
      <output data-testid="order-header-price">{price}</output>
    ),
  },
  '../components/Simple/SimpleOrderTypeDialog': {
    showSimpleOrderTypeDialog: showOrderType,
  },
  '../components/Simple/SimpleValue': {
    SimpleValue: (props: { value: string }) => (
      <Box {...props}>{props.value}</Box>
    ),
  },
  '../components/TradingGuardWrapper': {
    TradingGuardWrapper: ({
      children,
      bypassEnableTradingGuard,
    }: PropsWithChildren<{
      bypassEnableTradingGuard?: boolean;
    }>) =>
      bypassEnableTradingGuard || isAgentReady ? (
        children
      ) : (
        <span>Enable Trading</span>
      ),
  },
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
    getCurrentPerpsMarketDataFreshness: () => ({ isReady: quoteFresh }),
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
  activeAddress = 'account-a';
  jest.clearAllMocks();
  getActiveAssetDataByCoin.mockResolvedValue(undefined);
  getMarketOrderReferencePrice.mockImplementation(async () => midPrice);
  midPrice = '50000';
  maxTradeSize = '1';
  exchangeLeverage = 10;
  exchangeMode = 'cross';
  selectedLeverage = 2;
  marginMode = undefined;
  isAgentReady = true;
  isWide = false;
  mobileMode = 'simple';
  testStore.set(pendingLeverageAtom, {});
  markPx = undefined;
  contextMark = '50000';
  quoteFresh = true;
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

it('opens confirmation without fee data and keeps the order route owner', () => {
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

it('refreshes the same-coin quote and keeps the previewed size when confirmation is skipped', async () => {
  skipOrderConfirm = true;
  getMarketOrderReferencePrice.mockResolvedValueOnce('49000');
  const { getByTestId } = render(<PerpSimpleOrder />);
  await act(async () => {
    fireEvent.click(getByTestId('perps-simple-submit'));
  });

  expect(showOrderConfirmDialog).not.toHaveBeenCalled();
  expect(getMarketOrderReferencePrice).toHaveBeenCalledWith('BTC');
  expect(submitOrder).toHaveBeenCalledWith({
    assetId: 0,
    expectedAccountAddress: 'account-a',
    tradingUiMode: 'simple',
    price: '49000',
    formData: expect.objectContaining({ type: 'market', size: '0.002' }),
  });
  expect(navigation.replace).toHaveBeenCalled();
  expect(actions.current.refreshAllPerpsData).not.toHaveBeenCalled();
});

it('submits the typed limit price without fetching a market quote', async () => {
  skipOrderConfirm = true;
  const { getByTestId } = render(<PerpSimpleOrder />);
  fireEvent.click(getByTestId('perps-simple-order-type'));
  await act(async () => fireEvent.click(getByTestId('perps-simple-submit')));
  expect(getMarketOrderReferencePrice).not.toHaveBeenCalled();
  expect(submitOrder).toHaveBeenCalledWith(
    expect.objectContaining({
      price: '52000',
      formData: expect.objectContaining({ type: 'limit', price: '52000' }),
    }),
  );
});

it.each(['missing quote', 'failed quote', 'disconnect'] as const)(
  'keeps the draft and allows a retry after a %s during direct submission',
  async (condition) => {
    skipOrderConfirm = true;
    getMarketOrderReferencePrice.mockImplementationOnce(async () => {
      if (condition === 'failed quote')
        throw new OneKeyLocalError('Quote unavailable');
      if (condition === 'missing quote') return undefined;
      quoteFresh = false;
      return '49000';
    });
    const { getByTestId } = render(<PerpSimpleOrder />);
    const button = getByTestId('perps-simple-submit');
    await act(async () => fireEvent.click(button));
    expect(submitOrder).not.toHaveBeenCalled();
    expect(setDraft).not.toHaveBeenCalled();
    expect(mocks['@onekeyhq/components'].Toast.error).toHaveBeenCalledTimes(1);
    quoteFresh = true;
    await act(async () => fireEvent.click(button));
    expect(submitOrder).toHaveBeenCalledTimes(1);
  },
);

it.each([
  'unchanged',
  'blur',
  'account switch',
  'coin switch',
  'unmount',
] as const)(
  'checks the pending direct submission after %s and ignores duplicate presses',
  async (change) => {
    skipOrderConfirm = true;
    let finishQuote!: (price: string) => void;
    getMarketOrderReferencePrice.mockReturnValueOnce(
      new Promise((resolve) => {
        finishQuote = resolve;
      }),
    );
    const { getByTestId, rerender, unmount } = render(<PerpSimpleOrder />);
    const button = getByTestId('perps-simple-submit');
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(getMarketOrderReferencePrice).toHaveBeenCalledTimes(1);
    expect(submitOrder).not.toHaveBeenCalled();
    if (change === 'unmount') unmount();
    else if (change !== 'unchanged') {
      if (change === 'blur') focused = false;
      if (change === 'account switch') activeAddress = 'account-b';
      if (change === 'coin switch') instrument.coin = 'ETH';
      await act(async () => rerender(<PerpSimpleOrder />));
      focused = true;
      activeAddress = 'account-a';
      instrument.coin = 'BTC';
      await act(async () => rerender(<PerpSimpleOrder />));
    }
    await act(async () => finishQuote('49000'));
    expect(submitOrder).toHaveBeenCalledTimes(change === 'unchanged' ? 1 : 0);
  },
);

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

it('restores the complete manual draft after a cancelled size drag', async () => {
  render(<PerpSimpleOrder />);
  await act(async () => sliderProps.onSlideStart());
  await act(async () => sliderProps.onChange(75));
  expect(setDraft).toHaveBeenLastCalledWith(
    expect.objectContaining({ source: 'percent', sizePercent: 75 }),
  );
  await act(async () => sliderProps.onSlideCancel());
  expect(setDraft).toHaveBeenLastCalledWith(
    expect.objectContaining({
      source: 'manual',
      inputAmount: '100',
      inputUnit: 'usd',
      scope: 'account-a:BTC',
    }),
  );
});

it('binds after initial account hydration and blocks subsequent account switches', async () => {
  activeAddress = undefined;
  const { rerender, getByTestId } = render(<PerpSimpleOrder />);
  expect(getByTestId('perps-simple-submit').hasAttribute('disabled')).toBe(
    true,
  );
  activeAddress = 'account-a';
  await act(async () => rerender(<PerpSimpleOrder />));
  expect(getByTestId('perps-simple-submit').hasAttribute('disabled')).toBe(
    false,
  );
  fireEvent.click(getByTestId('perps-simple-submit'));
  expect(showOrderConfirmDialog).toHaveBeenCalledTimes(1);
  activeAddress = 'account-b';
  await act(async () => rerender(<PerpSimpleOrder />));
  expect(getByTestId('perps-simple-submit').hasAttribute('disabled')).toBe(
    true,
  );
});

it.each([
  [10, 2, 'cross', 'cross'],
  [2, 10, 'cross', 'cross'],
  [10, 10, 'cross', 'isolated'],
] as const)(
  'previews %i× to %i× (%s to %s) and waits for matching capacity',
  async (initial, next, from, to) => {
    exchangeLeverage = initial;
    exchangeMode = from;
    midPrice = '100';
    maxTradeSize = '20';
    draftInputUnit = 'margin';
    selectedLeverage = next;
    const screen = render(<PerpSimpleOrder />);
    fireEvent.click(screen.getByTestId('perps-simple-leverage'));
    const dialog = render(<>{dialogContent}</>);
    fireEvent.click(dialog.getByText('Change leverage'));
    fireEvent.click(dialog.getByTestId(`perps-simple-margin-mode-${to}`));
    await act(async () =>
      fireEvent.click(dialog.getByTestId('perps-simple-leverage-confirm')),
    );
    expect(updateLeverage).toHaveBeenCalledWith(
      expect.objectContaining({ leverage: next, isCross: to === 'cross' }),
    );
    expect(screen.getByText(next === 2 ? '$200.00' : '$1,000.00')).toBeTruthy();
    expect(sliderProps.disabled).toBe(true);
    fireEvent.click(screen.getByTestId('perps-simple-submit'));
    expect(showOrderConfirmDialog).not.toHaveBeenCalled();
    exchangeLeverage = next;
    exchangeMode = to;
    maxTradeSize = '1';
    screen.rerender(<PerpSimpleOrder />);
    expect(screen.getByTestId('perps-simple-validation').textContent).toContain(
      'top_up',
    );
    maxTradeSize = '20';
    screen.rerender(<PerpSimpleOrder />);
    fireEvent.click(screen.getByTestId('perps-simple-submit'));
    expect(showOrderConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        formData: expect.objectContaining({
          leverage: next,
          size: String(next),
        }),
      }),
    );
  },
);

it.each(['noCross', 'strictIsolated'] as const)(
  'disables cross for %s assets',
  (restriction) => {
    marginMode = restriction;
    exchangeMode = 'isolated';
    const screen = render(<PerpSimpleOrder />);
    fireEvent.click(screen.getByTestId('perps-simple-leverage'));
    const dialog = render(<>{dialogContent}</>);
    expect(
      dialog
        .getByTestId('perps-simple-margin-mode-cross')
        .hasAttribute('disabled'),
    ).toBe(true);
  },
);

it('accepts a typed limit without mid while keeping the live-data and sizing guards', () => {
  midPrice = '';
  markPx = '50000';
  const screen = render(<PerpSimpleOrder />);
  expect(
    screen.getByTestId('perps-simple-submit').hasAttribute('disabled'),
  ).toBe(true);
  fireEvent.click(screen.getByTestId('perps-simple-order-type'));
  quoteFresh = false;
  fireEvent.click(screen.getByTestId('perps-simple-submit'));
  expect(showOrderConfirmDialog).not.toHaveBeenCalled();
  quoteFresh = true;
  fireEvent.click(screen.getByTestId('perps-simple-submit'));
  expect(showOrderConfirmDialog).toHaveBeenCalledWith(
    expect.objectContaining({
      formData: expect.objectContaining({ type: 'limit', price: '52000' }),
    }),
  );
  markPx = '0';
  screen.rerender(<PerpSimpleOrder />);
  expect(
    screen.getByTestId('perps-simple-submit').hasAttribute('disabled'),
  ).toBe(true);
});

it('blocks order type while instrument and route differ', async () => {
  const screen = render(<PerpSimpleOrder />);
  instrument.coin = 'ETH';
  await act(async () => screen.rerender(<PerpSimpleOrder />));
  fireEvent.click(screen.getByTestId('perps-simple-order-type'));
  expect(showOrderType).not.toHaveBeenCalled();
});

it.each([
  ['usd', '10.09', '$10.10'],
  ['margin', '1', '$1.01'],
  ['token', '0.00012', '0.00013 BTC'],
] as const)('shows the first actionable %s amount', (unit, amount, minimum) => {
  midPrice = '77639.5';
  inputAmount = amount;
  draftInputUnit = unit;
  const screen = render(<PerpSimpleOrder />);
  expect(screen.getByTestId('perps-simple-validation').textContent).toContain(
    minimum,
  );
});

it('shows geographic restrictions ahead of Enable Trading', () => {
  isAgentReady = false;
  perpConfigCommon.ipDisablePerp = true;
  const screen = render(<PerpSimpleOrder />);
  expect(screen.getByTestId('perps-simple-submit').textContent).toContain(
    'trading_unavailable',
  );
  expect(screen.queryByText('Enable Trading')).toBeNull();
});

it('dismisses the order type dialog before popping a wide screen', () => {
  const screen = render(<PerpSimpleOrder />);
  fireEvent.click(screen.getByTestId('perps-simple-order-type'));
  isWide = true;
  screen.rerender(<PerpSimpleOrder />);
  expect(closeOrderType).toHaveBeenCalled();
  expect(navigation.popStack).toHaveBeenCalled();
});

it('closes the leverage dialog when the order page unmounts', () => {
  const screen = render(<PerpSimpleOrder />);
  fireEvent.click(screen.getByTestId('perps-simple-leverage'));
  screen.unmount();
  expect(closeSettings).toHaveBeenCalled();
});

it('dismisses an open order type dialog when the focused order leaves Easy mode', async () => {
  const screen = render(<PerpSimpleOrder />);
  fireEvent.click(screen.getByTestId('perps-simple-order-type'));
  mobileMode = 'pro';
  await act(async () => screen.rerender(<PerpSimpleOrder />));
  expect(closeOrderType).toHaveBeenCalled();
  expect(navigation.popStack).toHaveBeenCalledTimes(1);
});

it.each(['matching', 'wrong account', 'wrong coin', 'old mode'] as const)(
  'uses a %s post-update capacity refresh only for the confirmed leverage scope',
  async (response) => {
    midPrice = '100';
    draftInputUnit = 'margin';
    skipOrderConfirm = true;
    exchangeMode = 'isolated';
    contextMark = '0';
    getActiveAssetDataByCoin.mockResolvedValue({
      coin: response === 'wrong coin' ? 'ETH' : 'BTC',
      user: response === 'wrong account' ? 'account-b' : 'account-a',
      leverage: {
        value: 2,
        type: response === 'old mode' ? 'cross' : 'isolated',
      },
      markPx: '110',
      maxTradeSzs: ['2', '2'],
    });
    const screen = render(<PerpSimpleOrder />);
    fireEvent.click(screen.getByTestId('perps-simple-leverage'));
    const dialog = render(<>{dialogContent}</>);
    fireEvent.click(dialog.getByText('Change leverage'));
    await act(async () =>
      fireEvent.click(dialog.getByTestId('perps-simple-leverage-confirm')),
    );
    expect(getActiveAssetDataByCoin).toHaveBeenCalledWith({
      coin: 'BTC',
      user: 'account-a',
    });
    await act(async () =>
      fireEvent.click(screen.getByTestId('perps-simple-submit')),
    );
    if (response === 'matching') {
      expect(screen.getByText('$55.5556')).toBeTruthy();
      expect(submitOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: expect.objectContaining({ leverage: 2, size: '2' }),
        }),
      );
      // A later WS frame invalidates the provisional REST capacity.
      maxTradeSize = '10';
      screen.rerender(<PerpSimpleOrder />);
      expect(
        screen.getByTestId('perps-simple-submit').hasAttribute('disabled'),
      ).toBe(true);
    } else {
      expect(submitOrder).not.toHaveBeenCalled();
    }
  },
);

it('closes settings and ignores further unit edits after the page loses focus', () => {
  const screen = render(<PerpSimpleOrder />);
  const headerRight = setOptions.mock.calls[0][0].headerRight;
  if (typeof headerRight !== 'function')
    throw new OneKeyLocalError('Expected order settings');
  const settings = headerRight({ canGoBack: true });
  if (!isValidElement<{ onPress: () => void }>(settings))
    throw new OneKeyLocalError('Expected settings button');
  act(() => settings.props.onPress());
  const dialog = render(<>{dialogContent}</>);
  focused = false;
  screen.rerender(<PerpSimpleOrder />);
  expect(closeSettings).toHaveBeenCalled();
  fireEvent.click(dialog.getByTestId('perps-simple-unit-margin'));
  expect(setDraft).not.toHaveBeenCalled();
  expect(setTradingPreferences).not.toHaveBeenCalled();
});

it('reopens with a newer Pro acknowledgment and ignores the late Easy refresh', async () => {
  midPrice = '100';
  maxTradeSize = '20';
  draftInputUnit = 'margin';
  let resolveRefresh!: (
    value: ReturnType<typeof buildAssetData> & { user: string },
  ) => void;
  getActiveAssetDataByCoin.mockReturnValue(
    new Promise((resolve) => {
      resolveRefresh = resolve;
    }),
  );
  const first = render(<PerpSimpleOrder />);
  fireEvent.click(first.getByTestId('perps-simple-leverage'));
  const dialog = render(<>{dialogContent}</>);
  fireEvent.click(dialog.getByText('Change leverage'));
  await act(async () =>
    fireEvent.click(dialog.getByTestId('perps-simple-leverage-confirm')),
  );
  first.unmount();
  dialog.unmount();
  testStore.set(pendingLeverageAtom, {
    'account-a:0': {
      type: 'cross',
      value: 5,
      previous: [
        { type: 'cross', value: 10 },
        { type: 'cross', value: 2 },
      ],
    },
  });
  await act(async () =>
    resolveRefresh({
      ...buildAssetData(),
      user: 'account-a',
      leverage: { type: 'cross', value: 2 },
    }),
  );
  const reopened = render(<PerpSimpleOrder />);
  expect(reopened.getByText('$500.00')).toBeTruthy();
  expect(sliderProps.disabled).toBe(true);
  exchangeLeverage = 5;
  reopened.rerender(<PerpSimpleOrder />);
  fireEvent.click(reopened.getByTestId('perps-simple-submit'));
  expect(showOrderConfirmDialog).toHaveBeenCalledWith(
    expect.objectContaining({
      formData: expect.objectContaining({ leverage: 5, size: '5' }),
    }),
  );
  expect(getActiveAssetDataByCoin).toHaveBeenCalledTimes(1);
});

it('recovers a newer external leverage on return only when live and REST agree', async () => {
  midPrice = '100';
  maxTradeSize = '20';
  draftInputUnit = 'margin';
  const first = render(<PerpSimpleOrder />);
  fireEvent.click(first.getByTestId('perps-simple-leverage'));
  const dialog = render(<>{dialogContent}</>);
  fireEvent.click(dialog.getByText('Change leverage'));
  await act(async () =>
    fireEvent.click(dialog.getByTestId('perps-simple-leverage-confirm')),
  );
  first.unmount();
  dialog.unmount();
  // The pre-ACK 10× frame stays blocked across re-entry.
  const reopened = render(<PerpSimpleOrder />);
  expect(sliderProps.disabled).toBe(true);
  expect(getActiveAssetDataByCoin).toHaveBeenCalledTimes(1);
  exchangeLeverage = 5;
  getActiveAssetDataByCoin.mockResolvedValue({
    ...buildAssetData(),
    user: 'account-a',
    leverage: { type: 'cross', value: 5 },
  });
  await act(async () => reopened.rerender(<PerpSimpleOrder />));
  expect(reopened.getByText('$500.00')).toBeTruthy();
  fireEvent.click(reopened.getByTestId('perps-simple-submit'));
  expect(showOrderConfirmDialog).toHaveBeenCalledWith(
    expect.objectContaining({
      formData: expect.objectContaining({ leverage: 5, size: '5' }),
    }),
  );
  expect(getActiveAssetDataByCoin).toHaveBeenCalledTimes(2);
});

it('can reapply the prior leverage after an unobserved external reversal and waits for fresh capacity', async () => {
  midPrice = '100';
  maxTradeSize = '20';
  draftInputUnit = 'margin';
  getActiveAssetDataByCoin.mockRejectedValue(new OneKeyLocalError('offline'));
  const first = render(<PerpSimpleOrder />);
  fireEvent.click(first.getByTestId('perps-simple-leverage'));
  const firstDialog = render(<>{dialogContent}</>);
  fireEvent.click(firstDialog.getByText('Change leverage'));
  await act(async () =>
    fireEvent.click(firstDialog.getByTestId('perps-simple-leverage-confirm')),
  );
  first.unmount();
  firstDialog.unmount();
  const returned = render(<PerpSimpleOrder />);
  expect(sliderProps.disabled).toBe(true);
  selectedLeverage = 10;
  expect(
    returned.getByTestId('perps-simple-leverage').hasAttribute('disabled'),
  ).toBe(false);
  fireEvent.click(returned.getByTestId('perps-simple-leverage'));
  const secondDialog = render(<>{dialogContent}</>);
  fireEvent.click(secondDialog.getByText('Change leverage'));
  await act(async () =>
    fireEvent.click(secondDialog.getByTestId('perps-simple-leverage-confirm')),
  );
  expect(updateLeverage).toHaveBeenLastCalledWith(
    expect.objectContaining({ leverage: 10 }),
  );
  expect(sliderProps.disabled).toBe(true);
  maxTradeSize = '15';
  returned.rerender(<PerpSimpleOrder />);
  fireEvent.click(returned.getByTestId('perps-simple-submit'));
  expect(showOrderConfirmDialog).toHaveBeenCalledWith(
    expect.objectContaining({
      formData: expect.objectContaining({ leverage: 10, size: '10' }),
    }),
  );
});
