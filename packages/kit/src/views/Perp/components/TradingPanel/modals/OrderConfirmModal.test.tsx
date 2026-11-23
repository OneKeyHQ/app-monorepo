/** @jest-environment jsdom */

import { createContext, useContext } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';

import { act, render, renderHook } from '@testing-library/react';
import BigNumber from 'bignumber.js';
import { createStore } from 'jotai';
import { createIntl } from 'react-intl';

import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import type { IOrderOpenParams } from '@onekeyhq/shared/types/hyperliquid';
import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid';

const accountAddress = '0x1111111111111111111111111111111111111111';
const AccountAddress = createContext(accountAddress);
const submitOrder = jest.fn().mockResolvedValue(undefined);
const checkInstrument = jest.fn<Promise<boolean>, []>();
const dispatchOrder = jest.fn();
const sdkOrder = jest.fn();
const getReferencePrice = jest.fn<Promise<string | undefined>, [string]>();
const close = jest.fn();
const toastError = jest.fn();
let marketReady = true;
let dialogContent: ReactNode;
let confirm: () => Promise<void>;
const intl = createIntl({ locale: 'en', onError: () => {} });
const formData: ITradingFormData = {
  side: 'long',
  type: 'market',
  orderMode: 'standard',
  price: '100',
  size: '1',
  sizeInputMode: EPerpsSizeInputMode.MANUAL,
  sizePercent: 0,
  hasTpsl: false,
  tpTriggerPx: '',
  tpGainPercent: '',
  slTriggerPx: '',
  slLossPercent: '',
};
const Container = ({ children }: PropsWithChildren) => <>{children}</>;
const Empty = () => null;
const mocks = {
  '@nktkas/hyperliquid': {
    HttpTransport: jest.fn(),
    ExchangeClient: jest.fn(() => ({ order: sdkOrder })),
  },
  '@onekeyhq/kit-bg/src/services/ServiceHyperLiquid/hyperLiquidApiClients': {
    hyperLiquidApiClients: {},
  },
  '@onekeyhq/shared/src/locale/appLocale': {
    appLocale: { intl, onLocaleChange: () => () => {}, getLocale: () => 'en' },
  },
  '@onekeyhq/components': {
    Badge: Container,
    Checkbox: Empty,
    DashText: Container,
    SizableText: Container,
    XStack: Container,
    YStack: Container,
    Toast: { error: toastError, success: jest.fn() },
    Button: ({
      onPress,
      disabled,
      children,
    }: PropsWithChildren<{
      onPress: () => Promise<void>;
      disabled: boolean;
    }>) => {
      confirm = onPress;
      return (
        <button type="button" disabled={disabled}>
          {children}
        </button>
      );
    },
    Dialog: {
      show: ({ renderContent }: { renderContent: ReactNode }) => {
        dialogContent = renderContent;
        return { close };
      },
    },
  },
  '@onekeyfe/react-native-native-overlay': {
    OverlayPageHostScope: Container,
    OverlayPageOwnerScope: Container,
  },
  'react-intl': { useIntl: () => intl },
  '@onekeyhq/kit/src/background/instance/backgroundApiProxy': {
    __esModule: true,
    default: {
      simpleDb: { perp: { getExpectMaxBuilderFee: async () => 0 } },
      serviceHyperliquid: { getMarketOrderReferencePrice: getReferencePrice },
      serviceHyperliquidExchange: { orderOpen: dispatchOrder },
    },
  },
  '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid': {
    useHyperliquidActions: () => ({ current: { submitOrder } }),
    useTradingFormAtom: () => [formData],
    useActiveTradeInstrumentAtom: () => [
      { mode: 'perp', coin: 'BTC', assetId: 0 },
    ],
  },
  '@onekeyhq/kit-bg/src/states/jotai/atoms': {
    perpsActiveAccountAtom: { get: async () => ({ accountAddress }) },
    perpsActiveAccountStatusAtom: {
      get: async () => ({ canTrade: true, details: { agentOk: true } }),
    },
    perpsActiveAssetAtom: {
      get: async () => ({
        coin: 'BTC',
        assetId: 0,
        universe: { szDecimals: 3 },
      }),
    },
    perpsActiveAssetCtxAtom: { get: async () => undefined },
    perpsActiveAssetDataAtom: { get: async () => undefined },
    perpsCommonConfigPersistAtom: {
      get: async () => ({ perpConfigCommon: {} }),
    },
    usePerpsActiveAccountAtom: () => [
      { accountAddress: useContext(AccountAddress) },
    ],
    usePerpsCustomSettingsAtom: () => [{}, jest.fn()],
  },
  '../../../hooks': {
    useOrderConfirm: () => ({ isSubmitting: false, handleConfirm: jest.fn() }),
    useTradingCalculationsForSide: () => ({
      computedSizeForSide: new BigNumber(1),
      orderValue: new BigNumber(100),
    }),
  },
  '../../../hooks/useActiveTradeDisplay': {
    useActiveTradeDisplay: () => ({ baseName: 'BTC' }),
  },
  '../../../hooks/useTradingPrice': {
    useTradingPrice: () => ({ midPriceBN: new BigNumber(100) }),
  },
  '../../../hooks/usePerpsMarketDataFreshness': {
    getCurrentPerpsMarketDataFreshness: () => ({ isReady: marketReady }),
  },
  '../../../utils/perpsMarketDataFreshness': {
    isPerpsOrderFormDataOfInstrument: checkInstrument,
  },
  '../../../PerpsAccountSelectorProviderMirror': {
    PerpsAccountSelectorProviderMirror: Container,
  },
  '../../../PerpsProviderMirror': { PerpsProviderMirror: Container },
  '../../TradingGuardWrapper': { TradingGuardWrapper: Container },
  '../components/LiquidationPriceDisplay': { LiquidationPriceDisplay: Empty },
  './AggressiveLimitPriceWarning': { AggressiveLimitPriceWarning: Empty },
};
Object.entries(mocks).forEach(([path, mock]) => jest.doMock(path, () => mock));
const { showOrderConfirmDialog } =
  require('./OrderConfirmModal') as typeof import('./OrderConfirmModal');

async function openDialog(reviewedForm = formData) {
  showOrderConfirmDialog({
    intl,
    sourcePage: { hostKey: 'test-host', ownerKey: 'test-owner' },
    formData: reviewedForm,
    tradingUiMode: 'simple',
    expectedCoin: 'BTC',
    expectedAccountAddress: accountAddress,
  });
  const view = render(
    <AccountAddress.Provider value={accountAddress}>
      {dialogContent}
    </AccountAddress.Provider>,
  );
  await act(async () => {});
  return view;
}

function deferInstrumentCheck() {
  let resolve!: (matches: boolean) => void;
  checkInstrument.mockReturnValue(
    new Promise<boolean>((done) => {
      resolve = done;
    }),
  );
  return (matches: boolean) => resolve(matches);
}

beforeEach(() => {
  jest.clearAllMocks();
  checkInstrument.mockResolvedValue(true);
  marketReady = true;
  getReferencePrice.mockResolvedValue('100');
});

it('locks before validation so rapid confirmations submit only once', async () => {
  const resolve = deferInstrumentCheck();
  const { getByRole } = await openDialog();
  let pending!: Promise<void>;
  act(() => {
    pending = confirm();
    void confirm();
  });
  expect(checkInstrument).toHaveBeenCalledTimes(1);
  expect(getByRole('button').hasAttribute('disabled')).toBe(true);
  expect(submitOrder).not.toHaveBeenCalled();
  await act(async () => {
    resolve(true);
    await pending;
  });
  expect(submitOrder).toHaveBeenCalledTimes(1);
  expect(submitOrder).toHaveBeenCalledWith(
    expect.objectContaining({
      assetId: 0,
      expectedAccountAddress: accountAddress,
      formData,
    }),
  );
});

it('does not submit after the dialog unmounts during validation', async () => {
  const resolve = deferInstrumentCheck();
  const { unmount } = await openDialog();
  let pending!: Promise<void>;
  act(() => {
    pending = confirm();
  });
  unmount();
  await act(async () => {
    resolve(true);
    await pending;
  });
  expect(submitOrder).not.toHaveBeenCalled();
});

it('does not submit after an account change closes the pending dialog', async () => {
  const resolve = deferInstrumentCheck();
  const { rerender } = await openDialog();
  let pending!: Promise<void>;
  act(() => {
    pending = confirm();
  });
  rerender(
    <AccountAddress.Provider value="0x2222222222222222222222222222222222222222">
      {dialogContent}
    </AccountAddress.Provider>,
  );
  expect(close).toHaveBeenCalled();
  await act(async () => {
    resolve(true);
    await pending;
  });
  expect(submitOrder).not.toHaveBeenCalled();
});

it('releases the lock after an offline check so the user can retry', async () => {
  const { getByRole } = await openDialog();
  marketReady = false;
  await act(async () => {
    await confirm();
  });
  expect(submitOrder).not.toHaveBeenCalled();
  expect(toastError).toHaveBeenCalledTimes(1);
  expect(getByRole('button').hasAttribute('disabled')).toBe(false);
  marketReady = true;
  await act(async () => {
    await confirm();
  });
  expect(submitOrder).toHaveBeenCalledTimes(1);
});

it('releases the lock when the background validation rejects', async () => {
  await openDialog();
  checkInstrument.mockRejectedValueOnce(new Error('background unavailable'));
  await act(async () => {
    await expect(confirm()).rejects.toThrow('background unavailable');
  });
  expect(submitOrder).not.toHaveBeenCalled();
  await act(async () => {
    await confirm();
  });
  expect(submitOrder).toHaveBeenCalledTimes(1);
});

it('closes without submitting when the background market no longer matches', async () => {
  await openDialog();
  checkInstrument.mockResolvedValueOnce(false);
  await act(async () => {
    await confirm();
  });
  expect(submitOrder).not.toHaveBeenCalled();
  expect(toastError).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
});

it.each(['90', '120'])(
  'uses current reference %s without resizing the reviewed order',
  async (mid) => {
    await openDialog();
    getReferencePrice.mockResolvedValue(mid);
    await act(async () => confirm());
    expect(getReferencePrice).toHaveBeenCalledWith('BTC');
    expect(submitOrder).toHaveBeenCalledWith(
      expect.objectContaining({ price: mid, formData }),
    );
  },
);

it.each([
  ['market', '100', '91.8', 'FrontendMarket'],
  ['limit', '94', '94', 'Gtc'],
] as const)(
  'sends the confirmed %s price and reviewed size to the exchange SDK',
  async (type, reviewedPrice, sdkPrice, tif) => {
    const { useHyperliquidActions } =
      await import('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/actions');
    const { ProviderJotaiContextHyperliquid, activeTradeInstrumentAtom } =
      await import('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms');
    const { default: ServiceHyperliquidExchange } =
      await import('@onekeyhq/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidExchange');
    const store = createStore();
    store.set(activeTradeInstrumentAtom(), {
      mode: 'perp',
      coin: 'BTC',
      assetId: 0,
      universe: undefined,
    });
    const { result } = renderHook(useHyperliquidActions, {
      wrapper: ({ children }: PropsWithChildren) => (
        <ProviderJotaiContextHyperliquid store={store}>
          {children}
        </ProviderJotaiContextHyperliquid>
      ),
    });
    sdkOrder.mockResolvedValue({
      status: 'ok',
      response: {
        type: 'order',
        data: { statuses: [{ resting: { oid: 1 } }] },
      },
    });
    const previousScope = globalThis.$onekeyIsInBackground;
    try {
      globalThis.$onekeyIsInBackground = true;
      const exchange = new ServiceHyperliquidExchange({
        backgroundApi: {
          simpleDb: {
            perp: {
              getPerpData: async () => ({}),
              getTradingUniverse: async () => ({
                universesByDex: [[{ assetId: 0, szDecimals: 3 }]],
              }),
              getSpotMeta: async () => ({ universes: [] }),
              isFirstPerpOrderOpen: async () => false,
            },
          },
          serviceHyperliquidWallet: { getOnekeyWallet: async () => ({}) },
          serviceRookieGuide: { recordTaskCompleted: jest.fn() },
        } as unknown as IBackgroundApi,
      });
      await exchange.setup({
        userAddress: accountAddress,
        userAccountId: 'test-account',
      });
      dispatchOrder.mockImplementationOnce((params: IOrderOpenParams) =>
        exchange.orderOpen(params),
      );
      submitOrder.mockImplementationOnce(result.current.current.submitOrder);
      await openDialog({
        ...formData,
        type,
        price: reviewedPrice,
        size: '1.235',
      });
      getReferencePrice.mockResolvedValue('85');
      await act(async () => confirm());

      expect(getReferencePrice).toHaveBeenCalledTimes(
        type === 'market' ? 1 : 0,
      );
      expect(sdkOrder).toHaveBeenCalledTimes(1);
      expect(sdkOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          orders: [
            {
              a: 0,
              b: true,
              p: sdkPrice,
              s: '1.235',
              r: false,
              t: { limit: { tif } },
            },
          ],
        }),
      );
    } finally {
      globalThis.$onekeyIsInBackground = previousScope;
    }
  },
);

it.each(['missing', 'failed'])(
  'keeps the dialog open when the current quote is %s',
  async (condition) => {
    await openDialog();
    if (condition === 'missing') getReferencePrice.mockResolvedValue(undefined);
    else getReferencePrice.mockRejectedValue(new Error('Quote unavailable'));
    await act(async () => confirm());
    expect(submitOrder).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledTimes(1);
    getReferencePrice.mockResolvedValue('90');
    await act(async () => confirm());
    expect(submitOrder).toHaveBeenCalledTimes(1);
  },
);
