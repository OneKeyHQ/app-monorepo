/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from '@testing-library/react';
import { createStore } from 'jotai';

import { Toast } from '@onekeyhq/components';
import { useFirstDepositAction } from '@onekeyhq/kit/src/views/Perp/hooks/useEnableTradingWithDepositFallback';
import {
  perpsActiveAccountAtom,
  perpsActiveAccountIsAgentReadyAtom,
  perpsActiveAccountStatusAtom,
  perpsActiveAssetAtom,
  perpsActiveAssetCtxAtom,
  perpsActiveAssetCtxDisplayAtom,
  perpsActiveAssetDataAtom,
  perpsActiveOrderBookOptionsAtom,
  perpsCommonConfigPersistAtom,
  perpsTradingPreferencesAtom,
  spotActiveAssetAtom,
  spotActiveAssetCtxAtom,
  spotAssetCtxsMapAtom,
  tradingModeAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IPerpsActiveAccountAtom,
  IPerpsActiveAccountStatusAtom,
  IPerpsActiveAssetAtom,
  IPerpsActiveOrderBookOptionsAtom,
  ISpotActiveAssetAtom,
  ISpotActiveAssetCtxAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  formatPriceToSignificantDigits,
  formatSpotAssetCtx,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IPerpsUniverse,
  IPlaceTwapOrderParams,
} from '@onekeyhq/shared/types/hyperliquid';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';
import {
  EPerpsSizeInputMode,
  ETriggerOrderType,
} from '@onekeyhq/shared/types/hyperliquid/types';

import {
  capturePerpsInstrumentChangeGuard,
  useHyperliquidActions,
} from './actions';
import {
  ProviderJotaiContextHyperliquid,
  activeTradeInstrumentAtom,
  perpsActiveOpenOrdersAtom,
  perpsActiveTwapOrdersAtom,
  perpsAllMidsAtom,
  tradeRouteViewStateAtom,
  tradingFormAtom,
  tradingFormEnvAtom,
} from './atoms';

type IDialogOptions = {
  onClose?: () => void;
  renderContent?: ReactNode;
};

type IDialogMockInstance = {
  close: jest.Mock<Promise<void>, []>;
  getForm: () => undefined;
  isExist: () => boolean;
};

const mockOrdersClose = jest
  .fn<Promise<unknown>, unknown[]>()
  .mockResolvedValue({ status: 'ok' });
const mockOrderOpen = jest
  .fn<Promise<unknown>, unknown[]>()
  .mockResolvedValue({});
const mockUpdateLeverage = jest
  .fn<Promise<void>, unknown[]>()
  .mockResolvedValue(undefined);

const mockDialogClose = jest.fn<Promise<void>, []>(async () => undefined);
const mockDialogShow = jest.fn<IDialogMockInstance, [IDialogOptions]>();
const mockRefreshHyperLiquidAgentPasswordStatus = jest.fn<
  Promise<{
    isPasswordSet: boolean;
    requiresPasswordSetupOrVerify: boolean;
  }>,
  []
>();
const mockCheckPerpsAccountStatus = jest.fn<Promise<void>, []>();
const mockPromptHyperLiquidAgentPasswordSetupOrVerify = jest.fn<
  Promise<void>,
  []
>();
const mockShowDepositWithdrawModal = jest.fn<Promise<void>, []>();
const mockShowHyperliquidTermsDialog = jest.fn<Promise<boolean>, []>();
const mockEnableTrading = jest.fn<
  Promise<IPerpsActiveAccountStatusAtom | undefined>,
  []
>();
const mockGetTwapStates = jest.fn<
  Promise<Pick<HL.IWsWebData2, 'user' | 'twapStates'> | undefined>,
  [HL.IEventWebData2Parameters]
>();
const mockAmendOrderPriceByOid = jest.fn<
  Promise<HL.IModifyResponse>,
  unknown[]
>();
const mockGetTwapHistory = jest.fn<Promise<HL.ITwapHistoryRecord[]>, []>();
const mockGetTwapSliceFills = jest.fn<Promise<HL.ITwapSliceFill[]>, []>();
const mockCancelTwapOrder = jest.fn<Promise<unknown>, unknown[]>();
const mockPlaceTwapOrder = jest.fn<Promise<unknown>, [IPlaceTwapOrderParams]>();
const mockChangeActiveAsset = jest.fn<
  Promise<unknown>,
  [{ coin: string; requestId?: number; restorationId?: string }]
>();
// The service's request ids, shared by the switches of every page.
let mockAssetChangeRequestId = 0;
// Rejects to make a request for one fail, as when the service cannot be
// reached.
const mockReachAssetChangeService = jest.fn<
  Promise<void> | undefined,
  [params?: { restorationId: string }]
>();
// The perp asset the service holds once it is back on the last one loaded.
const mockLoadedPerpAsset = jest.fn<
  Promise<IPerpsActiveAssetAtom | undefined>,
  []
>();
type IMockRestoreParams = {
  requestId: number;
  spotAsset?: ISpotActiveAssetAtom;
  unsettledRequestIds?: readonly number[];
};
const mockRestoreActiveAssetAfterFailedChange = jest.fn<
  Promise<{
    restored: boolean;
    perpAsset: IPerpsActiveAssetAtom | undefined;
  }>,
  [IMockRestoreParams]
>();
const mockSetTradingModeForActiveAssetChange = jest.fn<
  Promise<boolean>,
  [IMockRestoreParams]
>();
type IMockClearCtxParams = {
  requestId: number;
  spotAssetCtx?: ISpotActiveAssetCtxAtom;
};
const mockClearActiveAssetCtxForActiveAssetChange = jest.fn<
  Promise<boolean>,
  [IMockClearCtxParams]
>();
type IMockOrderBookOptionsParams = {
  requestId?: number;
  options: NonNullable<IPerpsActiveOrderBookOptionsAtom>;
};
const mockSetActiveOrderBookOptions = jest.fn<
  Promise<boolean>,
  [IMockOrderBookOptionsParams]
>();
const mockGetSpotMeta = jest.fn<
  Promise<{ tokens: unknown[]; universes: HL.ISpotUniverse[] }>,
  []
>();
const mockUpdateSubscriptions = jest.fn<Promise<void>, []>();
const mockRecoverSubscriptionsAfterLivenessProof = jest.fn<
  Promise<boolean>,
  [{ disabledCount: number }]
>();

jest.mock('@onekeyhq/kit/src/views/Perp/hooks/usePerpsTradingUiMode', () => ({
  usePerpsTradingUiMode: () => 'simple',
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => {
  const actual = jest.requireActual(
    '@onekeyhq/shared/src/locale/appLocale',
  ) as typeof import('@onekeyhq/shared/src/locale/appLocale');
  const appLocale = Object.create(actual.appLocale) as typeof actual.appLocale;
  appLocale.intl = {
    ...actual.appLocale.intl,
    formatMessage: ({ id }: { id?: string }) => id ?? '',
  };

  return {
    ...actual,
    appLocale,
  };
});

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');

  function Container({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) {
    return React.createElement(
      'div',
      {
        'data-testid': testID,
        onClick: onPress,
      },
      children,
    );
  }

  function Button({
    children,
    disabled,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
    testID?: string;
  }) {
    return React.createElement(
      'button',
      {
        'data-testid': testID,
        disabled,
        onClick: onPress,
        type: 'button',
      },
      children,
    );
  }

  return {
    Button,
    Dialog: {
      Header: Container,
      Title: Container,
      show: (options: IDialogOptions) => mockDialogShow(options),
    },
    Icon: Container,
    SizableText: Container,
    Toast: {
      success: jest.fn(),
      loading: jest.fn(() => ({ close: jest.fn() })),
      error: jest.fn(),
    },
    XStack: Container,
    YStack: Container,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquidExchange: {
      ordersClose: (...args: unknown[]) => mockOrdersClose(...args),
      cancelTwapOrder: (...args: unknown[]) => mockCancelTwapOrder(...args),
      amendOrderPriceByOid: (...args: unknown[]) =>
        mockAmendOrderPriceByOid(...args),
      orderOpen: (...args: unknown[]) => mockOrderOpen(...args),
      updateLeverage: (...args: unknown[]) => mockUpdateLeverage(...args),
      placeTwapOrder: (params: IPlaceTwapOrderParams) =>
        mockPlaceTwapOrder(params),
    },
    serviceHyperliquid: {
      cancelPendingActiveAssetChange: async (params?: {
        restorationId: string;
      }) => {
        await mockReachAssetChangeService(params);
        if (!params) mockAssetChangeRequestId += 1;
        return mockAssetChangeRequestId;
      },
      changeActiveAsset: (params: { coin: string; requestId?: number }) =>
        mockChangeActiveAsset(params),
      getSpotMeta: () => mockGetSpotMeta(),
      restoreActiveAssetAfterFailedChange: (params: IMockRestoreParams) =>
        mockRestoreActiveAssetAfterFailedChange(params),
      setTradingModeForActiveAssetChange: (params: IMockRestoreParams) =>
        mockSetTradingModeForActiveAssetChange(params),
      clearActiveAssetCtxForActiveAssetChange: (params: IMockClearCtxParams) =>
        mockClearActiveAssetCtxForActiveAssetChange(params),
      setActiveOrderBookOptions: (params: IMockOrderBookOptionsParams) =>
        mockSetActiveOrderBookOptions(params),
      checkPerpsAccountStatus: () => mockCheckPerpsAccountStatus(),
      enableTrading: () => mockEnableTrading(),
      getTwapStates: (params: HL.IEventWebData2Parameters) =>
        mockGetTwapStates(params),
      getTwapHistory: () => mockGetTwapHistory(),
      getUserTwapSliceFills: () => mockGetTwapSliceFills(),
    },
    servicePassword: {
      promptHyperLiquidAgentPasswordSetupOrVerify: () =>
        mockPromptHyperLiquidAgentPasswordSetupOrVerify(),
      refreshHyperLiquidAgentPasswordStatus: () =>
        mockRefreshHyperLiquidAgentPasswordStatus(),
    },
    simpleDb: {
      perp: {
        getOrderBookTickOptions: async () => ({}),
      },
    },
    serviceHyperliquidSubscription: {
      updateSubscriptions: () => mockUpdateSubscriptions(),
      recoverSubscriptionsAfterLivenessProof: (params: {
        disabledCount: number;
      }) => mockRecoverSubscriptionsAfterLivenessProof(params),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {
    toastIfError: jest.fn(),
    withErrorAutoToast: (callback: () => Promise<unknown>) => callback(),
  },
}));

jest.mock('@onekeyhq/kit/src/views/Perp/components/HyperliquidTerms', () => ({
  showHyperliquidTermsDialog: () => mockShowHyperliquidTermsDialog(),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Perp/hooks/useShowDepositWithdrawModal',
  () => ({
    useShowDepositWithdrawModal: () => ({
      showDepositWithdrawModal: mockShowDepositWithdrawModal,
    }),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Perp/components/Guide/perpGuideData',
  () => ({
    CONTEXTUAL_ARTICLE_IDS: {
      enableTrading: 'enable-trading',
    },
    buildHelpUrl: (path: string) => path,
    openGuideUrl: jest.fn(),
  }),
);

function buildPerpsAccountStatus(
  canTrade: boolean,
): IPerpsActiveAccountStatusAtom {
  return {
    canTrade,
    canCreateAddress: false,
    accountNotSupport: false,
    accountAddress: '0xabc',
    details: {
      activatedOk: true,
      agentOk: canTrade,
      referralCodeOk: true,
      builderFeeOk: true,
      internalRebateBoundOk: true,
      abstractionOk: true,
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function createWrapper(store = createStore()) {
  return function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ProviderJotaiContextHyperliquid store={store}>
        {children}
      </ProviderJotaiContextHyperliquid>
    );
  };
}

beforeEach(() => {
  jest
    .spyOn(perpsCommonConfigPersistAtom, 'get')
    .mockResolvedValue({ perpConfigCommon: {} });
});

describe('useHyperliquidActions.setTokenSelectorOpen', () => {
  it('keeps the selector subscriptions on while any picker is open', () => {
    const store = createStore();
    const { result } = renderHook(() => useHyperliquidActions(), {
      wrapper: createWrapper(store),
    });
    const report = (owner: string, open: boolean) =>
      act(() => result.current.current.setTokenSelectorOpen({ owner, open }));
    const isOpen = () => store.get(tradeRouteViewStateAtom()).tokenSelectorOpen;

    report('chart', true);
    report('ticker', true);
    expect(isOpen()).toBe(true);
    report('chart', false);
    expect(isOpen()).toBe(true);
    // A picker closing twice cannot release another picker's hold.
    report('chart', false);
    expect(isOpen()).toBe(true);
    report('ticker', false);
    expect(isOpen()).toBe(false);
  });
});

describe('useHyperliquidActions.switchTradeInstrument', () => {
  const btc: IPerpsActiveAssetAtom = {
    coin: 'BTC',
    assetId: 0,
    universe: {
      assetId: 0,
      name: 'BTC',
      szDecimals: 5,
      maxLeverage: 40,
    } as IPerpsUniverse,
    margin: undefined,
  };
  const spot: ISpotActiveAssetAtom = {
    coin: '@107',
    assetId: 10_107,
    universe: undefined,
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    mockChangeActiveAsset.mockReset();
    // The service is back on its last loaded perp asset after a failure.
    mockLoadedPerpAsset.mockReset().mockResolvedValue(btc);
    // The requests the service saw write a mode or the contexts since the
    // market was last on a token for good.
    let marketWrites = new Set<number>();
    // Sets the mode, with the spot token for spot, only while the switch
    // holds the market.
    const setModeWhileCurrent = async ({
      requestId,
      spotAsset,
    }: IMockRestoreParams) => {
      const isCurrent = () => requestId === mockAssetChangeRequestId;
      marketWrites.add(requestId);
      if (spotAsset) {
        await spotActiveAssetAtom.set(spotAsset);
        if (!isCurrent()) return false;
      }
      await tradingModeAtom.set(spotAsset ? 'spot' : 'perp');
      if (!isCurrent()) return false;
      // A spot token with its mode is all of a spot market.
      if (spotAsset) marketWrites = new Set([requestId]);
      return true;
    };
    mockSetTradingModeForActiveAssetChange
      .mockReset()
      .mockImplementation(async (params) =>
        params.requestId === mockAssetChangeRequestId
          ? setModeWhileCurrent(params)
          : false,
      );
    // Clears the contexts only while the switch holds the market.
    mockClearActiveAssetCtxForActiveAssetChange
      .mockReset()
      .mockImplementation(async ({ requestId, spotAssetCtx }) => {
        const isCurrent = () => requestId === mockAssetChangeRequestId;
        if (!isCurrent()) return false;
        marketWrites.add(requestId);
        await perpsActiveAssetCtxAtom.set(undefined);
        if (!isCurrent()) return false;
        await perpsActiveAssetCtxDisplayAtom.set(undefined);
        await perpsActiveAssetDataAtom.set(undefined);
        if (!isCurrent()) return false;
        await spotActiveAssetCtxAtom.set(spotAssetCtx);
        return isCurrent();
      });
    // Takes the order book target from the switch that holds the market, or
    // for the token the market is on.
    let replacedTarget:
      | { requestId: number; options: IPerpsActiveOrderBookOptionsAtom }
      | undefined;
    mockSetActiveOrderBookOptions
      .mockReset()
      .mockImplementation(async ({ requestId, options }) => {
        if (requestId !== mockAssetChangeRequestId) {
          const marketCoin =
            (await tradingModeAtom.get()) === 'spot'
              ? (await spotActiveAssetAtom.get())?.coin
              : (await perpsActiveAssetAtom.get())?.coin;
          if (!marketCoin || marketCoin !== options.coin) return false;
        } else if (replacedTarget?.requestId !== requestId) {
          replacedTarget = {
            requestId,
            options: await perpsActiveOrderBookOptionsAtom.get(),
          };
        }
        await perpsActiveOrderBookOptionsAtom.set(options);
        return true;
      });
    // Puts the market back only while the failed switch holds it. Of a
    // market the page's switches left untouched, only the order book target
    // goes back, and the request ends.
    mockRestoreActiveAssetAfterFailedChange
      .mockReset()
      .mockImplementation(async (params) => {
        const notRestored = { restored: false, perpAsset: undefined };
        const isCurrent = () => params.requestId === mockAssetChangeRequestId;
        if (!isCurrent()) return notRestored;
        const wroteMarket = [
          params.requestId,
          ...(params.unsettledRequestIds ?? []),
        ].some((requestId) => marketWrites.has(requestId));
        if (!wroteMarket) {
          mockAssetChangeRequestId += 1;
          if (replacedTarget?.requestId === params.requestId) {
            await perpsActiveOrderBookOptionsAtom.set(replacedTarget.options);
          }
          return notRestored;
        }
        const perpAsset = await mockLoadedPerpAsset();
        if (!isCurrent()) return notRestored;
        if (!(await setModeWhileCurrent(params))) return notRestored;
        return { restored: true, perpAsset };
      });
    mockGetSpotMeta
      .mockReset()
      .mockResolvedValue({ tokens: [], universes: [] });
    // The service rolls its own active asset back when a change fails.
    jest.spyOn(perpsActiveAssetAtom, 'get').mockResolvedValue(btc);
    for (const atom of [
      perpsActiveAssetCtxAtom,
      perpsActiveAssetCtxDisplayAtom,
      perpsActiveAssetDataAtom,
      spotActiveAssetCtxAtom,
    ]) {
      jest.spyOn(atom, 'set').mockResolvedValue(undefined);
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function setup(mode: 'perp' | 'spot') {
    let currentMode = mode;
    let spotAsset = spot;
    let orderBookOptions: IPerpsActiveOrderBookOptionsAtom;
    jest
      .spyOn(tradingModeAtom, 'get')
      .mockImplementation(async () => currentMode);
    jest.spyOn(tradingModeAtom, 'set').mockImplementation(async (next) => {
      currentMode = next as typeof currentMode;
    });
    jest
      .spyOn(spotActiveAssetAtom, 'get')
      .mockImplementation(async () => spotAsset);
    jest.spyOn(spotActiveAssetAtom, 'set').mockImplementation(async (next) => {
      spotAsset = next as ISpotActiveAssetAtom;
    });
    // What the order book subscription is for.
    jest
      .spyOn(perpsActiveOrderBookOptionsAtom, 'get')
      .mockImplementation(async () => orderBookOptions);
    jest
      .spyOn(perpsActiveOrderBookOptionsAtom, 'set')
      .mockImplementation(async (update) => {
        orderBookOptions =
          typeof update === 'function'
            ? (
                update as (
                  prev: IPerpsActiveOrderBookOptionsAtom,
                ) => IPerpsActiveOrderBookOptionsAtom
              )(orderBookOptions)
            : (update as IPerpsActiveOrderBookOptionsAtom);
      });
    const store = createStore();
    store.set(
      activeTradeInstrumentAtom(),
      mode === 'perp'
        ? {
            mode: 'perp',
            coin: btc.coin,
            assetId: btc.assetId,
            universe: btc.universe,
          }
        : {
            mode: 'spot',
            coin: spot.coin,
            assetId: spot.assetId,
            universe: spot.universe,
          },
    );
    const { result } = renderHook(() => useHyperliquidActions(), {
      wrapper: createWrapper(store),
    });
    return {
      store,
      result,
      getMode: () => currentMode,
      getSpotAsset: () => spotAsset,
      getOrderBookCoin: () => orderBookOptions?.coin,
    };
  }

  it.each(['mode', 'contexts', 'metadata'] as const)(
    'restores the spot market when focus is cancelled after writing %s',
    async (stage) => {
      const { store, result, getMode } = setup('spot');
      const previous = store.get(activeTradeInstrumentAtom());
      const controller = new AbortController();
      if (stage === 'mode') {
        const setMode =
          mockSetTradingModeForActiveAssetChange.getMockImplementation();
        mockSetTradingModeForActiveAssetChange.mockImplementationOnce(
          async (params) => {
            const holdsMarket = await setMode?.(params);
            controller.abort();
            return holdsMarket ?? false;
          },
        );
      } else if (stage === 'contexts') {
        mockClearActiveAssetCtxForActiveAssetChange.mockImplementationOnce(
          async () => {
            controller.abort();
            return true;
          },
        );
      } else {
        mockChangeActiveAsset.mockImplementationOnce(async () => {
          controller.abort();
          return btc;
        });
      }
      await act(async () => {
        expect(
          await result.current.current.switchTradeInstrument({
            mode: 'perp',
            coin: 'ETH',
            restorationSignal: controller.signal,
          }),
        ).toBe(false);
      });
      expect(getMode()).toBe('spot');
      expect(store.get(activeTradeInstrumentAtom())).toEqual(previous);
      expect(mockRestoreActiveAssetAfterFailedChange).toHaveBeenCalledWith(
        expect.objectContaining({ spotAsset: spot }),
      );
    },
  );

  it.each(['perp', 'spot'] as const)(
    'goes back to the %s token it showed when the background fails a perp switch',
    async (mode) => {
      const { store, result, getMode } = setup(mode);
      mockChangeActiveAsset.mockRejectedValue(
        new OneKeyLocalError('Network error'),
      );

      await act(async () => {
        await expect(
          result.current.current.switchTradeInstrument({
            mode: 'perp',
            coin: 'ETH',
          }),
        ).rejects.toThrow('Network error');
      });

      // The page showed ETH at once; it must not stay there.
      expect(getMode()).toBe(mode);
      expect(store.get(activeTradeInstrumentAtom())).toMatchObject(
        mode === 'perp'
          ? { mode: 'perp', coin: 'BTC', assetId: 0 }
          : { mode: 'spot', coin: '@107', assetId: 10_107 },
      );
    },
  );

  it('goes back to the confirmed spot market when the last of two perp switches fails', async () => {
    const { store, result, getMode } = setup('spot');
    mockChangeActiveAsset
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockRejectedValueOnce(new OneKeyLocalError('Network error'));

    // The first switch sets perp mode while the background is still loading,
    // and the second supersedes it.
    await act(async () => {
      void result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'ETH',
      });
    });
    await act(async () => {
      await expect(
        result.current.current.switchTradeInstrument({
          mode: 'perp',
          coin: 'SOL',
        }),
      ).rejects.toThrow('Network error');
    });

    expect(getMode()).toBe('spot');
    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      mode: 'spot',
      coin: '@107',
    });
  });

  it('loads a perp token whose loading a superseded switch left unfinished', async () => {
    const { store, result } = setup('perp');
    // The service names the coin before its metadata has loaded.
    jest.spyOn(perpsActiveAssetAtom, 'get').mockResolvedValue({
      coin: 'ETH',
      assetId: undefined,
      universe: undefined,
      margin: undefined,
    });
    const eth = {
      assetId: 1,
      name: 'ETH',
      szDecimals: 4,
      maxLeverage: 25,
    } as IPerpsUniverse;
    mockChangeActiveAsset.mockResolvedValue({
      coin: 'ETH',
      assetId: 1,
      universe: eth,
      margin: undefined,
    });

    await act(async () => {
      await result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'ETH',
      });
    });

    expect(mockChangeActiveAsset).toHaveBeenCalledWith(
      expect.objectContaining({ coin: 'ETH' }),
    );
    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      coin: 'ETH',
      assetId: 1,
      universe: eth,
    });
  });

  it('leaves the trade token and mode to a newer switch when an older one fails', async () => {
    const { store, result, getMode } = setup('spot');
    let fail: (error: Error) => void = () => {};
    mockChangeActiveAsset
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            fail = reject;
          }),
      )
      .mockImplementationOnce(() => new Promise(() => {}));

    let older: Promise<boolean> | undefined;
    await act(async () => {
      older = result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'ETH',
      });
    });
    await act(async () => {
      void result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'SOL',
      });
    });
    await act(async () => {
      fail(new OneKeyLocalError('Network error'));
      await expect(older).rejects.toThrow('Network error');
    });

    expect(store.get(activeTradeInstrumentAtom()).coin).toBe('SOL');
    expect(getMode()).toBe('perp');
  });

  it('points the background back at the spot token when a failed perp switch interrupted a spot one', async () => {
    const { store, result, getMode, getSpotAsset, getOrderBookCoin } =
      setup('spot');
    // The spot switch is still seeding its quotes when the perp switch
    // supersedes it.
    jest
      .spyOn(spotAssetCtxsMapAtom, 'get')
      .mockImplementation(() => new Promise(() => {}));
    mockChangeActiveAsset.mockRejectedValue(
      new OneKeyLocalError('Network error'),
    );

    await act(async () => {
      void result.current.current.switchTradeInstrument({
        mode: 'spot',
        coin: '@150',
        spotUniverse: { name: '@150', assetId: 10_150 } as HL.ISpotUniverse,
      });
    });
    expect(getSpotAsset().coin).toBe('@150');
    await act(async () => {
      await expect(
        result.current.current.switchTradeInstrument({
          mode: 'perp',
          coin: 'ETH',
        }),
      ).rejects.toThrow('Network error');
    });

    // The subscriptions follow the background's spot token, which goes back
    // with the page.
    expect(getMode()).toBe('spot');
    expect(getSpotAsset()).toMatchObject({ coin: '@107', assetId: 10_107 });
    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      mode: 'spot',
      coin: '@107',
    });
    await waitFor(() => expect(getOrderBookCoin()).toBe('@107'));
  });

  it("writes the spot token back while the UI's copy of the spot asset lags behind", async () => {
    const { store, result, getSpotAsset } = setup('spot');
    // The UI's copy still shows the confirmed spot token, while bg already
    // took the token of a spot switch cut short.
    jest.spyOn(spotActiveAssetAtom, 'get').mockResolvedValue(spot);
    await act(async () => {
      await spotActiveAssetAtom.set({
        coin: '@150',
        assetId: 10_150,
        universe: undefined,
      });
    });
    mockChangeActiveAsset.mockRejectedValue(
      new OneKeyLocalError('Network error'),
    );

    await act(async () => {
      await expect(
        result.current.current.switchTradeInstrument({
          mode: 'perp',
          coin: 'ETH',
        }),
      ).rejects.toThrow('Network error');
    });

    expect(getSpotAsset()).toMatchObject({ coin: '@107', assetId: 10_107 });
    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      mode: 'spot',
      coin: '@107',
    });
  });

  it('follows the perp token the service rolled back to when a perp switch fails', async () => {
    const { store, result, getOrderBookCoin } = setup('perp');
    // The last token the service loaded, e.g. for a switch the page dropped
    // before it heard back.
    const sol: IPerpsActiveAssetAtom = {
      coin: 'SOL',
      assetId: 5,
      universe: {
        assetId: 5,
        name: 'SOL',
        szDecimals: 2,
        maxLeverage: 20,
      } as IPerpsUniverse,
      margin: undefined,
    };
    mockLoadedPerpAsset.mockResolvedValue(sol);
    mockChangeActiveAsset.mockRejectedValue(
      new OneKeyLocalError('Network error'),
    );

    await act(async () => {
      await expect(
        result.current.current.switchTradeInstrument({
          mode: 'perp',
          coin: 'ETH',
        }),
      ).rejects.toThrow('Network error');
    });

    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      mode: 'perp',
      coin: 'SOL',
      assetId: 5,
    });
    await waitFor(() => expect(getOrderBookCoin()).toBe('SOL'));
  });

  it('leaves the page to a newer switch made while a failed one goes back', async () => {
    const { store, result } = setup('perp');
    mockChangeActiveAsset
      .mockRejectedValueOnce(new OneKeyLocalError('Network error'))
      .mockImplementationOnce(() => new Promise(() => {}));
    // On a split runtime the way back waits for bg to take the mode.
    const modeWrite = createDeferred<void>();
    jest
      .mocked(tradingModeAtom.set)
      .mockImplementationOnce(async () => undefined)
      .mockImplementationOnce(() => modeWrite.promise);

    let failed: Promise<boolean> | undefined;
    await act(async () => {
      failed = result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'ETH',
      });
    });
    await act(async () => {
      void result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'SOL',
      });
    });
    await act(async () => {
      modeWrite.resolve();
      await expect(failed).rejects.toThrow('Network error');
    });

    expect(store.get(activeTradeInstrumentAtom()).coin).toBe('SOL');
  });

  it.each(['perp', 'spot'] as const)(
    'goes back to the %s token before a perp token the service could not load',
    async (mode) => {
      const { store, result, getMode } = setup(mode);
      // No longer listed: the service names it without its metadata.
      mockChangeActiveAsset
        .mockResolvedValueOnce({
          coin: 'XYZ',
          assetId: undefined,
          universe: undefined,
          margin: undefined,
        })
        .mockRejectedValueOnce(new OneKeyLocalError('Network error'));
      const before =
        mode === 'perp'
          ? { mode: 'perp', coin: 'BTC', assetId: 0 }
          : { mode: 'spot', coin: '@107', assetId: 10_107 };

      let switched: boolean | undefined;
      await act(async () => {
        switched = await result.current.current.switchTradeInstrument({
          mode: 'perp',
          coin: 'XYZ',
        });
      });
      // No switch: the page goes back at once.
      expect(switched).toBe(false);
      expect(getMode()).toBe(mode);
      expect(store.get(activeTradeInstrumentAtom())).toMatchObject(before);

      // A later failure goes back there as well.
      await act(async () => {
        await expect(
          result.current.current.switchTradeInstrument({
            mode: 'perp',
            coin: 'ETH',
          }),
        ).rejects.toThrow('Network error');
      });
      expect(getMode()).toBe(mode);
      expect(store.get(activeTradeInstrumentAtom())).toMatchObject(before);
    },
  );

  it("puts back the perp token the service holds, not the UI's copy of it", async () => {
    const { store, result, getOrderBookCoin } = setup('perp');
    // The UI's copy still names the failed coin: the broadcast of the
    // service's rollback is still on its way.
    jest.spyOn(perpsActiveAssetAtom, 'get').mockResolvedValue({
      coin: 'ETH',
      assetId: undefined,
      universe: undefined,
      margin: undefined,
    });
    mockChangeActiveAsset.mockRejectedValue(
      new OneKeyLocalError('Network error'),
    );

    await act(async () => {
      await expect(
        result.current.current.switchTradeInstrument({
          mode: 'perp',
          coin: 'ETH',
        }),
      ).rejects.toThrow('Network error');
    });

    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      mode: 'perp',
      coin: 'BTC',
      assetId: 0,
    });
    await waitFor(() => expect(getOrderBookCoin()).toBe('BTC'));
  });

  it('keeps the order begun after a newer switch while a failed one still clears up', async () => {
    const { store, result } = setup('perp');
    const sol: IPerpsActiveAssetAtom = {
      coin: 'SOL',
      assetId: 5,
      universe: {
        assetId: 5,
        name: 'SOL',
        szDecimals: 2,
        maxLeverage: 20,
      } as IPerpsUniverse,
      margin: undefined,
    };
    mockChangeActiveAsset
      .mockRejectedValueOnce(new OneKeyLocalError('Network error'))
      .mockResolvedValueOnce(sol);
    // On a split runtime the way back waits for bg to clear the quotes.
    const ctxWrite = createDeferred<void>();
    jest
      .mocked(perpsActiveAssetCtxAtom.set)
      .mockImplementationOnce(async () => undefined)
      .mockImplementationOnce(() => ctxWrite.promise);

    let failed: Promise<boolean> | undefined;
    await act(async () => {
      failed = result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'ETH',
      });
    });
    // SOL lands meanwhile, and an order is begun for it.
    await act(async () => {
      await result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'SOL',
      });
    });
    act(() =>
      store.set(tradingFormAtom(), {
        ...store.get(tradingFormAtom()),
        size: '2',
      }),
    );
    await act(async () => {
      ctxWrite.resolve();
      await expect(failed).rejects.toThrow('Network error');
    });

    expect(store.get(activeTradeInstrumentAtom()).coin).toBe('SOL');
    expect(store.get(tradingFormAtom()).size).toBe('2');
  });

  it('leaves the page where it is for a spot token the loaded spot markets do not list', async () => {
    const { store, result, getMode, getSpotAsset } = setup('perp');
    mockGetSpotMeta.mockResolvedValue({
      tokens: [],
      universes: [{ name: '@1', assetId: 10_001 } as HL.ISpotUniverse],
    });

    let switched: boolean | undefined;
    await act(async () => {
      switched = await result.current.current.switchTradeInstrument({
        mode: 'spot',
        coin: '@999',
      });
    });

    expect(switched).toBe(false);
    expect(getMode()).toBe('perp');
    expect(getSpotAsset().coin).toBe('@107');
    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      mode: 'perp',
      coin: 'BTC',
    });
  });

  it('reports a spot switch as not done while the spot markets have not loaded', async () => {
    const { store, result } = setup('perp');
    jest.spyOn(spotAssetCtxsMapAtom, 'get').mockResolvedValue({});
    jest
      .spyOn(perpsTradingPreferencesAtom, 'get')
      .mockResolvedValue({ sizeInputUnit: 'usd' } as Awaited<
        ReturnType<typeof perpsTradingPreferencesAtom.get>
      >);

    let switched: boolean | undefined;
    await act(async () => {
      switched = await result.current.current.switchTradeInstrument({
        mode: 'spot',
        coin: '@999',
      });
    });

    // Shown without its metadata until the markets load.
    expect(switched).toBe(false);
    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      mode: 'spot',
      coin: '@999',
    });
  });

  it('lets a perp switch on its way land when a spot pick is turned down on lookup', async () => {
    const { store, result } = setup('perp');
    const eth: IPerpsActiveAssetAtom = {
      coin: 'ETH',
      assetId: 1,
      universe: {
        assetId: 1,
        name: 'ETH',
        szDecimals: 4,
        maxLeverage: 25,
      } as IPerpsUniverse,
      margin: undefined,
    };
    const ethLoad = createDeferred<IPerpsActiveAssetAtom>();
    mockChangeActiveAsset.mockImplementationOnce(() => ethLoad.promise);
    mockGetSpotMeta.mockResolvedValue({
      tokens: [],
      universes: [{ name: '@1', assetId: 10_001 } as HL.ISpotUniverse],
    });

    let perpSwitch: Promise<boolean> | undefined;
    await act(async () => {
      perpSwitch = result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'ETH',
      });
    });
    let spotSwitched: boolean | undefined;
    await act(async () => {
      spotSwitched = await result.current.current.switchTradeInstrument({
        mode: 'spot',
        coin: '@999',
      });
    });
    let perpSwitched: boolean | undefined;
    await act(async () => {
      ethLoad.resolve(eth);
      perpSwitched = await perpSwitch;
    });

    expect(spotSwitched).toBe(false);
    // ETH lands with its trading metadata, so orders can be placed.
    expect(perpSwitched).toBe(true);
    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      mode: 'perp',
      coin: 'ETH',
      assetId: 1,
      universe: eth.universe,
    });
  });

  it('drops a spot pick still looking up its token for a switch asked after it', async () => {
    const { store, result, getMode } = setup('perp');
    const spotMeta = createDeferred<{
      tokens: unknown[];
      universes: HL.ISpotUniverse[];
    }>();
    mockGetSpotMeta.mockImplementationOnce(() => spotMeta.promise);
    mockChangeActiveAsset.mockResolvedValue({
      coin: 'ETH',
      assetId: 1,
      universe: {
        assetId: 1,
        name: 'ETH',
        szDecimals: 4,
        maxLeverage: 25,
      } as IPerpsUniverse,
      margin: undefined,
    });

    let spotSwitch: Promise<boolean> | undefined;
    await act(async () => {
      spotSwitch = result.current.current.switchTradeInstrument({
        mode: 'spot',
        coin: '@150',
      });
    });
    await act(async () => {
      await result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'ETH',
      });
    });
    let spotSwitched: boolean | undefined;
    await act(async () => {
      spotMeta.resolve({
        tokens: [],
        universes: [{ name: '@150', assetId: 10_150 } as HL.ISpotUniverse],
      });
      spotSwitched = await spotSwitch;
    });

    expect(spotSwitched).toBe(false);
    expect(getMode()).toBe('perp');
    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      mode: 'perp',
      coin: 'ETH',
      assetId: 1,
    });
  });

  it.each([
    ['fails', 'reject'],
    ['is superseded', 'superseded'],
  ] as const)(
    'leaves the market to a switch begun on another page when a perp switch %s',
    async (_label, outcome) => {
      const { store, result, getMode, getOrderBookCoin } = setup('spot');
      mockChangeActiveAsset.mockImplementationOnce(async ({ coin }) => {
        // Another extension tab begins a perp switch meanwhile.
        mockAssetChangeRequestId += 1;
        await tradingModeAtom.set('perp');
        if (outcome === 'reject') {
          throw new OneKeyLocalError('Network error');
        }
        // What the service answers a request a newer one superseded.
        return {
          coin,
          assetId: undefined,
          universe: undefined,
          margin: undefined,
        };
      });

      let switchError: unknown;
      let switched: boolean | undefined;
      await act(async () => {
        try {
          switched = await result.current.current.switchTradeInstrument({
            mode: 'perp',
            coin: 'XYZ',
          });
        } catch (error) {
          switchError = error;
        }
      });

      if (outcome === 'reject') {
        expect(switchError).toBeInstanceOf(OneKeyLocalError);
      } else {
        expect(switched).toBe(false);
      }
      // The other tab's switch keeps the mode, assets and order book target.
      expect(getMode()).toBe('perp');
      expect(spotActiveAssetAtom.set).not.toHaveBeenCalled();
      expect(getOrderBookCoin()).toBeUndefined();
      // The page alone goes back to the spot token, and what it publishes for
      // that token is turned down.
      expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
        mode: 'spot',
        coin: '@107',
        assetId: 10_107,
      });
      await expect(
        result.current.current.publishOrderBookOptions({
          coin: '@107',
          assetId: 10_107,
          nSigFigs: null,
          mantissa: null,
        }),
      ).resolves.toBe(false);
      expect(getOrderBookCoin()).toBeUndefined();
    },
  );

  it('leaves the mode to a switch begun on another page before a perp switch sets it', async () => {
    const { store, result, getMode, getOrderBookCoin } = setup('perp');
    jest.mocked(perpsActiveAssetAtom.get).mockImplementationOnce(async () => {
      // Another extension tab begins a spot switch meanwhile.
      mockAssetChangeRequestId += 1;
      await tradingModeAtom.set('spot');
      return btc;
    });

    let switched: boolean | undefined;
    await act(async () => {
      switched = await result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'ETH',
      });
    });

    expect(switched).toBe(false);
    // The spot mode stays with the order book target the other tab sets.
    expect(getMode()).toBe('spot');
    expect(mockChangeActiveAsset).not.toHaveBeenCalled();
    expect(getOrderBookCoin()).toBeUndefined();
    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      mode: 'perp',
      coin: 'BTC',
      assetId: 0,
    });
    // What the page publishes for the token it went back to is turned down.
    await expect(
      result.current.current.publishOrderBookOptions({
        coin: 'BTC',
        assetId: 0,
        nSigFigs: null,
        mantissa: null,
      }),
    ).resolves.toBe(false);
    expect(getOrderBookCoin()).toBeUndefined();

    // The next switch takes the market back, target and all.
    const sol: IPerpsActiveAssetAtom = {
      coin: 'SOL',
      assetId: 5,
      universe: {
        assetId: 5,
        name: 'SOL',
        szDecimals: 2,
        maxLeverage: 20,
      } as IPerpsUniverse,
      margin: undefined,
    };
    mockChangeActiveAsset.mockResolvedValueOnce(sol);
    await act(async () => {
      switched = await result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'SOL',
      });
    });
    expect(switched).toBe(true);
    expect(getMode()).toBe('perp');
    await waitFor(() => expect(getOrderBookCoin()).toBe('SOL'));
  });

  it('leaves the mode and spot token to a switch begun on another page before a spot switch sets them', async () => {
    const { store, result, getMode, getSpotAsset, getOrderBookCoin } =
      setup('perp');
    jest.mocked(spotActiveAssetAtom.get).mockImplementationOnce(async () => {
      // Another extension tab begins a perp switch meanwhile.
      mockAssetChangeRequestId += 1;
      await tradingModeAtom.set('perp');
      return spot;
    });

    let switched: boolean | undefined;
    await act(async () => {
      switched = await result.current.current.switchTradeInstrument({
        mode: 'spot',
        coin: '@150',
        spotUniverse: { name: '@150', assetId: 10_150 } as HL.ISpotUniverse,
      });
    });

    expect(switched).toBe(false);
    expect(getMode()).toBe('perp');
    expect(getSpotAsset()).toEqual(spot);
    expect(spotActiveAssetAtom.set).not.toHaveBeenCalled();
    expect(getOrderBookCoin()).toBeUndefined();
    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      mode: 'perp',
      coin: 'BTC',
      assetId: 0,
    });
  });

  it('leaves the contexts and the order book target to a switch another page finishes while a failed one goes back', async () => {
    const { store, result, getOrderBookCoin } = setup('perp');
    const sol: IPerpsActiveAssetAtom = {
      coin: 'SOL',
      assetId: 5,
      universe: {
        assetId: 5,
        name: 'SOL',
        szDecimals: 2,
        maxLeverage: 20,
      } as IPerpsUniverse,
      margin: undefined,
    };
    mockChangeActiveAsset.mockRejectedValueOnce(
      new OneKeyLocalError('Network error'),
    );
    // The first clearing of the contexts is the switch's own. During the
    // second, on the way back, another extension tab switches to SOL.
    jest
      .mocked(perpsActiveAssetCtxAtom.set)
      .mockImplementationOnce(async () => undefined)
      .mockImplementationOnce(async () => {
        mockAssetChangeRequestId += 1;
        jest.mocked(perpsActiveAssetAtom.get).mockResolvedValue(sol);
        await perpsActiveOrderBookOptionsAtom.set({
          coin: 'SOL',
          assetId: 5,
          nSigFigs: null,
          mantissa: null,
        });
      });

    await act(async () => {
      await expect(
        result.current.current.switchTradeInstrument({
          mode: 'perp',
          coin: 'ETH',
        }),
      ).rejects.toThrow('Network error');
    });
    // The page asks for BTC's target on its way back, and is turned down.
    await waitFor(() =>
      expect(mockSetActiveOrderBookOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ coin: 'BTC' }),
        }),
      ),
    );

    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      mode: 'perp',
      coin: 'BTC',
    });
    // SOL's contexts and order book target stay as the other tab set them.
    expect(perpsActiveAssetDataAtom.set).toHaveBeenCalledTimes(1);
    expect(getOrderBookCoin()).toBe('SOL');
  });

  it('publishes the token of a switch on its way under that switch', async () => {
    const { result } = setup('perp');
    mockChangeActiveAsset.mockImplementationOnce(() => new Promise(() => {}));

    await act(async () => {
      void result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'ETH',
      });
      // As the page does once it shows the token, before the service has
      // answered with the switch's request id.
      await result.current.current.publishOrderBookOptions({
        coin: 'ETH',
        assetId: undefined,
        nSigFigs: null,
        mantissa: null,
      });
    });

    expect(mockSetActiveOrderBookOptions).toHaveBeenCalledWith({
      requestId: mockAssetChangeRequestId,
      options: expect.objectContaining({ coin: 'ETH' }),
    });
  });

  it.each([
    ['perp', false],
    ['perp', true],
    ['spot', false],
  ] as const)(
    'drops the prices typed for a token whose switch from %s did not land (market taken elsewhere: %s)',
    async (mode, isTakenElsewhere) => {
      const { store, result } = setup(mode);
      store.set(perpsAllMidsAtom(), {
        mids: { BTC: '60000' },
      } as unknown as HL.IWsAllMids);
      let failChange: (error: Error) => void = () => {};
      mockChangeActiveAsset.mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            failChange = reject;
          }),
      );
      store.set(tradingFormAtom(), {
        ...store.get(tradingFormAtom()),
        type: 'limit',
        price: '59000',
      });

      let failed: Promise<boolean> | undefined;
      await act(async () => {
        failed = result.current.current.switchTradeInstrument({
          mode: 'perp',
          coin: 'ETH',
        });
      });
      // Typed for ETH while it loads.
      act(() => {
        store.set(tradingFormAtom(), {
          ...store.get(tradingFormAtom()),
          size: '2',
          price: '1700',
          tpType: 'price',
          tpValue: '1800',
          slType: 'percentage',
          slValue: '10',
          triggerPrice: '1710',
          executionPrice: '1705',
          scaleLowerPrice: '1600',
          scaleUpperPrice: '1800',
          twapTriggerPrice: '1690',
          twapStopPrice: '1500',
        });
      });
      await act(async () => {
        if (isTakenElsewhere) mockAssetChangeRequestId += 1;
        failChange(new OneKeyLocalError('Network error'));
        await expect(failed).rejects.toThrow('Network error');
      });

      expect(store.get(activeTradeInstrumentAtom()).mode).toBe(mode);
      expect(store.get(tradingFormAtom())).toMatchObject({
        size: '',
        // A perp limit order starts from its own token's mid again.
        price: mode === 'perp' ? formatPriceToSignificantDigits('60000') : '',
        tpValue: '',
        // ETH's as well: the order the page had on its own token had none.
        slValue: '',
        triggerPrice: '',
        executionPrice: '',
        scaleLowerPrice: '',
        scaleUpperPrice: '',
        twapTriggerPrice: '',
        twapStopPrice: '',
      });
    },
  );

  it('loads a spot token picked again after it was named without its metadata', async () => {
    const { store, result, getMode, getSpotAsset } = setup('perp');
    jest.spyOn(spotAssetCtxsMapAtom, 'get').mockResolvedValue({});
    jest
      .spyOn(perpsTradingPreferencesAtom, 'get')
      .mockResolvedValue({ sizeInputUnit: 'usd' } as Awaited<
        ReturnType<typeof perpsTradingPreferencesAtom.get>
      >);

    // The spot markets have not loaded for the first pick.
    let switched: boolean | undefined;
    await act(async () => {
      switched = await result.current.current.switchTradeInstrument({
        mode: 'spot',
        coin: '@150',
      });
    });
    expect(switched).toBe(false);
    expect(getMode()).toBe('spot');
    expect(getSpotAsset()).toMatchObject({ coin: '@150', universe: undefined });

    // They have for the second, which must not pass for done on the name.
    const universe = { name: '@150', assetId: 10_150 } as HL.ISpotUniverse;
    mockGetSpotMeta.mockResolvedValue({ tokens: [], universes: [universe] });
    await act(async () => {
      switched = await result.current.current.switchTradeInstrument({
        mode: 'spot',
        coin: '@150',
      });
    });
    expect(switched).toBe(true);
    expect(getSpotAsset()).toEqual({
      coin: '@150',
      assetId: 10_150,
      universe,
    });
    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      mode: 'spot',
      coin: '@150',
      assetId: 10_150,
    });
  });

  it('switches a page onto a perp market another page moved the background to like any other, with its order reset', async () => {
    const { store, result } = setup('perp');
    const eth: IPerpsActiveAssetAtom = {
      coin: 'ETH',
      assetId: 1,
      universe: {
        assetId: 1,
        name: 'ETH',
        szDecimals: 4,
        maxLeverage: 25,
      } as IPerpsUniverse,
      margin: undefined,
    };
    store.set(perpsAllMidsAtom(), {
      mids: { ETH: '1700' },
    } as unknown as HL.IWsAllMids);
    // A limit order begun on BTC, and the price range of a scale order.
    store.set(tradingFormAtom(), {
      ...store.get(tradingFormAtom()),
      type: 'limit',
      price: '59000',
      size: '2',
      scaleLowerPrice: '58000',
      scaleUpperPrice: '60000',
    });
    // Another extension tab has switched the background to ETH.
    jest.mocked(perpsActiveAssetAtom.get).mockResolvedValue(eth);
    mockChangeActiveAsset.mockResolvedValueOnce(eth);

    let switched: boolean | undefined;
    await act(async () => {
      switched = await result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'ETH',
      });
    });

    expect(switched).toBe(true);
    expect(mockChangeActiveAsset).toHaveBeenCalledWith(
      expect.objectContaining({ coin: 'ETH' }),
    );
    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      mode: 'perp',
      coin: 'ETH',
      assetId: 1,
    });
    // BTC's size and prices are not ETH's.
    expect(store.get(tradingFormAtom())).toMatchObject({
      size: '',
      price: formatPriceToSignificantDigits('1700'),
      scaleLowerPrice: '',
      scaleUpperPrice: '',
    });
  });

  it('switches a page onto a spot market another page moved the background to like any other, with its order reset', async () => {
    const { store, result, getSpotAsset } = setup('spot');
    jest.spyOn(spotAssetCtxsMapAtom, 'get').mockResolvedValue({});
    jest
      .spyOn(perpsTradingPreferencesAtom, 'get')
      .mockResolvedValue({ sizeInputUnit: 'usd' } as Awaited<
        ReturnType<typeof perpsTradingPreferencesAtom.get>
      >);
    const universe = { name: '@150', assetId: 10_150 } as HL.ISpotUniverse;
    // A limit order begun on @107, and a price range left from a scale order.
    store.set(tradingFormAtom(), {
      ...store.get(tradingFormAtom()),
      type: 'limit',
      price: '62',
      size: '2',
      scaleLowerPrice: '60',
      scaleUpperPrice: '64',
    });
    // Another extension tab has switched the background to @150.
    await spotActiveAssetAtom.set({
      coin: '@150',
      assetId: 10_150,
      universe,
    });
    jest.mocked(spotActiveAssetAtom.set).mockClear();

    let switched: boolean | undefined;
    await act(async () => {
      switched = await result.current.current.switchTradeInstrument({
        mode: 'spot',
        coin: '@150',
        spotUniverse: universe,
      });
    });

    expect(switched).toBe(true);
    // The whole switch, not only the page.
    expect(mockSetTradingModeForActiveAssetChange).toHaveBeenCalled();
    expect(getSpotAsset()).toMatchObject({ coin: '@150', assetId: 10_150 });
    expect(store.get(tradingFormAtom())).toMatchObject({
      size: '',
      price: '',
      type: 'market',
      scaleLowerPrice: '',
      scaleUpperPrice: '',
    });
  });

  it.each([
    ['keeps the order begun on it', false],
    ['begins a new order when forced', true],
  ] as const)(
    'takes the market back for the token the page is on and %s',
    async (_label, force) => {
      const { store, result } = setup('perp');
      const eth = {
        coin: 'ETH',
        assetId: 1,
        universe: { assetId: 1, name: 'ETH', szDecimals: 4, maxLeverage: 25 },
        margin: undefined,
      } as IPerpsActiveAssetAtom;
      store.set(perpsAllMidsAtom(), {
        mids: { BTC: '61000' },
      } as unknown as HL.IWsAllMids);
      const draft = {
        type: 'limit',
        price: '59000',
        size: '2',
        scaleLowerPrice: '58000',
        scaleUpperPrice: '60000',
      } as const;
      store.set(tradingFormAtom(), {
        ...store.get(tradingFormAtom()),
        ...draft,
      });
      // Another extension tab moved the background to ETH; the page still
      // shows BTC, and BTC is picked again on it.
      jest.mocked(perpsActiveAssetAtom.get).mockResolvedValue(eth);
      mockChangeActiveAsset.mockResolvedValueOnce(btc);

      let switched: boolean | undefined;
      await act(async () => {
        switched = await result.current.current.switchTradeInstrument({
          mode: 'perp',
          coin: 'BTC',
          force,
        });
      });

      expect(switched).toBe(true);
      // The whole switch, as the market was elsewhere.
      expect(mockChangeActiveAsset).toHaveBeenCalledWith(
        expect.objectContaining({ coin: 'BTC' }),
      );
      expect(store.get(tradingFormAtom())).toMatchObject(
        force
          ? {
              size: '',
              price: formatPriceToSignificantDigits('61000'),
              scaleLowerPrice: '',
              scaleUpperPrice: '',
            }
          : draft,
      );
    },
  );

  it('keeps the order begun on its token when asking for that token again fails before the switch begins', async () => {
    const { store, result } = setup('perp');
    const draft = { type: 'limit', price: '59000', size: '2' } as const;
    store.set(tradingFormAtom(), { ...store.get(tradingFormAtom()), ...draft });
    const error = new OneKeyLocalError('Bridge error');
    mockReachAssetChangeService.mockRejectedValueOnce(error);

    await act(async () => {
      await expect(
        result.current.current.switchTradeInstrument({
          mode: 'perp',
          coin: 'BTC',
        }),
      ).rejects.toBe(error);
    });

    // The page never left BTC, so the order begun there is still BTC's.
    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      mode: 'perp',
      coin: 'BTC',
    });
    expect(store.get(tradingFormAtom())).toMatchObject(draft);
  });

  it.each(['perp', 'spot'] as const)(
    'has nothing to switch for the %s token the page is on already',
    async (mode) => {
      const { store, result } = setup(mode);
      const universe = { name: '@107', assetId: 10_107 } as HL.ISpotUniverse;
      if (mode === 'spot') {
        await spotActiveAssetAtom.set({ ...spot, universe });
        store.set(activeTradeInstrumentAtom(), {
          mode: 'spot',
          coin: spot.coin,
          assetId: spot.assetId,
          universe,
        });
      }
      store.set(tradingFormAtom(), {
        ...store.get(tradingFormAtom()),
        size: '2',
      });

      let switched: boolean | undefined;
      await act(async () => {
        switched = await result.current.current.switchTradeInstrument(
          mode === 'perp'
            ? { mode, coin: 'BTC' }
            : { mode, coin: spot.coin, spotUniverse: universe },
        );
      });

      expect(switched).toBe(true);
      expect(mockChangeActiveAsset).not.toHaveBeenCalled();
      expect(mockSetTradingModeForActiveAssetChange).not.toHaveBeenCalled();
      expect(store.get(tradingFormAtom()).size).toBe('2');
    },
  );

  it('keeps the order begun after a newer switch while an older one still clears the contexts', async () => {
    const { store, result } = setup('perp');
    const sol: IPerpsActiveAssetAtom = {
      coin: 'SOL',
      assetId: 5,
      universe: {
        assetId: 5,
        name: 'SOL',
        szDecimals: 2,
        maxLeverage: 20,
      } as IPerpsUniverse,
      margin: undefined,
    };
    mockChangeActiveAsset.mockResolvedValueOnce(sol);
    // On a split runtime the service's answer takes its time.
    const ctxClear = createDeferred<boolean>();
    mockClearActiveAssetCtxForActiveAssetChange.mockImplementationOnce(
      () => ctxClear.promise,
    );

    let first: Promise<boolean> | undefined;
    await act(async () => {
      first = result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'ETH',
      });
    });
    await act(async () => {
      await result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'SOL',
      });
    });
    act(() => {
      store.set(tradingFormAtom(), {
        ...store.get(tradingFormAtom()),
        size: '2',
      });
    });
    await act(async () => {
      ctxClear.resolve(false);
      await expect(first).resolves.toBe(false);
    });

    expect(store.get(activeTradeInstrumentAtom()).coin).toBe('SOL');
    expect(store.get(tradingFormAtom()).size).toBe('2');
  });

  it.each([
    ['its request for the market', 'request'],
    ['setting the mode', 'mode'],
    ['clearing the contexts', 'contexts'],
    [
      'clearing the contexts, and then putting the market back',
      'contexts and restore',
    ],
  ] as const)(
    'goes back to the token it showed when the service fails a perp switch at %s',
    async (_label, failing) => {
      const { store, result, getMode } = setup('spot');
      const error = new OneKeyLocalError('Bridge error');
      if (failing === 'request') {
        mockReachAssetChangeService.mockRejectedValueOnce(error);
      } else if (failing === 'mode') {
        mockSetTradingModeForActiveAssetChange.mockRejectedValueOnce(error);
      } else {
        mockClearActiveAssetCtxForActiveAssetChange.mockRejectedValueOnce(
          error,
        );
      }
      if (failing === 'contexts and restore') {
        mockRestoreActiveAssetAfterFailedChange.mockRejectedValueOnce(error);
      }

      await act(async () => {
        await expect(
          result.current.current.switchTradeInstrument({
            mode: 'perp',
            coin: 'ETH',
          }),
        ).rejects.toThrow('Bridge error');
      });

      // The page showed ETH at once; it must not stay there.
      expect(mockChangeActiveAsset).not.toHaveBeenCalled();
      expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
        mode: 'spot',
        coin: '@107',
        assetId: 10_107,
      });
      // The service puts the market back once the switch has written a mode
      // or an asset to it, and while it can be reached. Before that the
      // market stays as the switch found it.
      if (failing !== 'contexts and restore') expect(getMode()).toBe('spot');
      if (failing === 'request') {
        expect(mockRestoreActiveAssetAfterFailedChange).not.toHaveBeenCalled();
      } else {
        // It hears of every request the page has made since its last
        // switch landed, and knows which of them wrote.
        expect(mockRestoreActiveAssetAfterFailedChange).toHaveBeenCalledTimes(
          1,
        );
        const [restore] = mockRestoreActiveAssetAfterFailedChange.mock.calls[0];
        expect(restore.unsettledRequestIds).toEqual([restore.requestId]);
      }
    },
  );

  it('leaves the market another page holds as it is when a switch fails before its first write', async () => {
    const { store, result, getMode, getSpotAsset, getOrderBookCoin } =
      setup('perp');
    // Another extension tab holds the market, on a spot token.
    await spotActiveAssetAtom.set({
      coin: '@150',
      assetId: 10_150,
      universe: { name: '@150', assetId: 10_150 } as HL.ISpotUniverse,
    });
    await tradingModeAtom.set('spot');
    await perpsActiveOrderBookOptionsAtom.set({
      coin: '@150',
      assetId: 10_150,
      nSigFigs: null,
      mantissa: null,
    });
    // The switch's first write to the market fails once it is let go.
    const modeCall = createDeferred<void>();
    mockSetTradingModeForActiveAssetChange.mockImplementationOnce(async () => {
      await modeCall.promise;
      throw new OneKeyLocalError('Bridge error');
    });

    let failed: Promise<boolean> | undefined;
    await act(async () => {
      failed = result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'ETH',
      });
      // As the page does once it shows the token, under the switch's request.
      await result.current.current.publishOrderBookOptions({
        coin: 'ETH',
        assetId: undefined,
        nSigFigs: null,
        mantissa: null,
      });
    });
    expect(getOrderBookCoin()).toBe('ETH');
    await act(async () => {
      modeCall.resolve();
      await expect(failed).rejects.toThrow('Bridge error');
    });

    // The page is back on its own token, and the market is not moved there.
    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      mode: 'perp',
      coin: 'BTC',
    });
    expect(mockRestoreActiveAssetAfterFailedChange).toHaveBeenCalledTimes(1);
    expect(getMode()).toBe('spot');
    expect(getSpotAsset()).toMatchObject({ coin: '@150' });
    // The order book target the page published for ETH is the other tab's
    // again, and the page's own token is not taken in its place.
    expect(getOrderBookCoin()).toBe('@150');
    await act(async () => {
      await result.current.current.publishOrderBookOptions({
        coin: 'BTC',
        assetId: 0,
        nSigFigs: null,
        mantissa: null,
      });
    });
    expect(getOrderBookCoin()).toBe('@150');
  });

  it('gives its request up when the service cannot be reached to end it either', async () => {
    const { result, getMode, getOrderBookCoin } = setup('perp');
    await spotActiveAssetAtom.set({
      coin: '@150',
      assetId: 10_150,
      universe: { name: '@150', assetId: 10_150 } as HL.ISpotUniverse,
    });
    await tradingModeAtom.set('spot');
    await perpsActiveOrderBookOptionsAtom.set({
      coin: '@150',
      assetId: 10_150,
      nSigFigs: null,
      mantissa: null,
    });
    const error = new OneKeyLocalError('Bridge error');
    mockSetTradingModeForActiveAssetChange.mockRejectedValueOnce(error);
    mockRestoreActiveAssetAfterFailedChange.mockRejectedValueOnce(error);

    await act(async () => {
      await expect(
        result.current.current.switchTradeInstrument({
          mode: 'perp',
          coin: 'ETH',
        }),
      ).rejects.toThrow('Bridge error');
    });

    // The request is still the service's current one, but no longer the
    // page's: its token is not taken as the order book target.
    await act(async () => {
      await result.current.current.publishOrderBookOptions({
        coin: 'BTC',
        assetId: 0,
        nSigFigs: null,
        mantissa: null,
      });
    });
    expect(mockSetActiveOrderBookOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ requestId: undefined }),
    );
    expect(getOrderBookCoin()).toBe('@150');
    expect(getMode()).toBe('spot');
  });

  it('puts the market back when a switch fails before its first write after an earlier one of the page had written', async () => {
    const { store, result, getMode } = setup('spot');
    // The first switch sets the perp mode and is still clearing the
    // contexts when the next one begins.
    mockClearActiveAssetCtxForActiveAssetChange.mockImplementationOnce(
      () => new Promise(() => {}),
    );
    await act(async () => {
      void result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'ETH',
      });
    });
    expect(getMode()).toBe('perp');
    mockSetTradingModeForActiveAssetChange.mockRejectedValueOnce(
      new OneKeyLocalError('Bridge error'),
    );

    await act(async () => {
      await expect(
        result.current.current.switchTradeInstrument({
          mode: 'perp',
          coin: 'SOL',
        }),
      ).rejects.toThrow('Bridge error');
    });

    // The mode the first switch left behind goes back with the page.
    expect(mockRestoreActiveAssetAfterFailedChange).toHaveBeenCalledTimes(1);
    expect(getMode()).toBe('spot');
    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      mode: 'spot',
      coin: '@107',
    });
  });

  it('puts the market back when the service had the mode in before its call failed', async () => {
    const { store, result, getMode } = setup('spot');
    // The mode takes effect in the service, whose write to storage fails.
    mockSetTradingModeForActiveAssetChange.mockImplementationOnce(
      async ({ requestId }) => {
        await mockSetTradingModeForActiveAssetChange.getMockImplementation()?.({
          requestId,
        });
        throw new OneKeyLocalError('Storage error');
      },
    );

    await act(async () => {
      await expect(
        result.current.current.switchTradeInstrument({
          mode: 'perp',
          coin: 'ETH',
        }),
      ).rejects.toThrow('Storage error');
    });

    // The page cannot tell, but the service knows the switch wrote.
    expect(getMode()).toBe('spot');
    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      mode: 'spot',
      coin: '@107',
    });
  });

  it.each([
    ['fails', 'fails'],
    ['lands', 'lands'],
    ['finds the service on that token already', 'shortcut'],
  ] as const)(
    'drops the price typed for a token the page showed meanwhile when asking for its own token again %s',
    async (_label, outcome) => {
      const { store, result } = setup('perp');
      store.set(perpsAllMidsAtom(), {
        mids: { BTC: '61000' },
      } as unknown as HL.IWsAllMids);
      store.set(tradingFormAtom(), {
        ...store.get(tradingFormAtom()),
        type: 'limit',
        price: '60000',
      });
      // ETH is still loading when a limit price is typed for it.
      mockChangeActiveAsset
        .mockImplementationOnce(() => new Promise(() => {}))
        .mockResolvedValueOnce(btc);
      await act(async () => {
        void result.current.current.switchTradeInstrument({
          mode: 'perp',
          coin: 'ETH',
        });
      });
      expect(store.get(activeTradeInstrumentAtom()).coin).toBe('ETH');
      store.set(tradingFormAtom(), {
        ...store.get(tradingFormAtom()),
        price: '1700',
        hasTpsl: true,
        slType: 'price',
        slValue: '1500',
        tpType: 'percentage',
        tpValue: '10',
      });
      // BTC is picked again, and shows at once.
      if (outcome === 'fails') {
        mockClearActiveAssetCtxForActiveAssetChange.mockRejectedValueOnce(
          new OneKeyLocalError('Bridge error'),
        );
      }
      if (outcome === 'shortcut') {
        // That switch is still clearing the contexts when BTC is picked
        // once more, which has nothing left to switch.
        mockClearActiveAssetCtxForActiveAssetChange.mockImplementationOnce(
          () => new Promise(() => {}),
        );
        await act(async () => {
          void result.current.current.switchTradeInstrument({
            mode: 'perp',
            coin: 'BTC',
          });
        });
      }

      await act(async () => {
        const again = result.current.current.switchTradeInstrument({
          mode: 'perp',
          coin: 'BTC',
        });
        if (outcome === 'fails') {
          await expect(again).rejects.toThrow('Bridge error');
        } else {
          await expect(again).resolves.toBe(true);
        }
      });

      // BTC shows either way, with an order of its own again: none of what
      // was given for ETH, a price or a gain, is BTC's.
      expect(store.get(activeTradeInstrumentAtom()).coin).toBe('BTC');
      expect(store.get(tradingFormAtom())).toMatchObject({
        price: formatPriceToSignificantDigits('61000'),
        hasTpsl: false,
        slValue: '',
        tpValue: '',
      });
    },
  );

  it('keeps what is typed for a token while it loads when its switch lands', async () => {
    const { store, result } = setup('perp');
    store.set(perpsAllMidsAtom(), {
      mids: { ETH: '1700' },
    } as unknown as HL.IWsAllMids);
    store.set(tradingFormAtom(), {
      ...store.get(tradingFormAtom()),
      type: 'limit',
      price: '60000',
      hasTpsl: true,
      slType: 'price',
      slValue: '58000',
    });
    const eth = createDeferred<IPerpsActiveAssetAtom>();
    mockChangeActiveAsset.mockImplementationOnce(() => eth.promise);
    let landing: Promise<boolean> | undefined;
    await act(async () => {
      landing = result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'ETH',
      });
    });
    // ETH shows: BTC's prices are gone, and the limit price is ETH's mid.
    expect(store.get(tradingFormAtom())).toMatchObject({
      price: formatPriceToSignificantDigits('1700'),
      slValue: '',
    });
    // An order is begun for ETH before its switch has landed.
    const typed = { price: '1650', size: '3', slValue: '1500' } as const;
    store.set(tradingFormAtom(), { ...store.get(tradingFormAtom()), ...typed });

    await act(async () => {
      eth.resolve({
        coin: 'ETH',
        assetId: 1,
        universe: { assetId: 1, name: 'ETH', szDecimals: 4, maxLeverage: 25 },
        margin: undefined,
      } as IPerpsActiveAssetAtom);
      await expect(landing).resolves.toBe(true);
    });

    // It is ETH's, and still there to be confirmed with its stop loss.
    expect(store.get(tradingFormAtom())).toMatchObject({
      ...typed,
      hasTpsl: true,
    });
  });

  it('keeps the order begun on its spot token, with its type, when the page takes the market back for it', async () => {
    const { store, result, getMode, getSpotAsset } = setup('spot');
    jest.spyOn(spotAssetCtxsMapAtom, 'get').mockResolvedValue({});
    jest
      .spyOn(perpsTradingPreferencesAtom, 'get')
      .mockResolvedValue({ sizeInputUnit: 'usd' } as Awaited<
        ReturnType<typeof perpsTradingPreferencesAtom.get>
      >);
    const universe = { name: '@107', assetId: 10_107 } as HL.ISpotUniverse;
    store.set(activeTradeInstrumentAtom(), {
      mode: 'spot',
      coin: '@107',
      assetId: 10_107,
      universe,
    });
    // A limit order begun on the pair.
    const draft = { type: 'limit', price: '62', size: '2' } as const;
    store.set(tradingFormAtom(), { ...store.get(tradingFormAtom()), ...draft });
    // Another extension tab moved the market to a perp token.
    await tradingModeAtom.set('perp');

    let switched: boolean | undefined;
    await act(async () => {
      switched = await result.current.current.switchTradeInstrument({
        mode: 'spot',
        coin: '@107',
        spotUniverse: universe,
      });
    });

    // The whole switch, and still a limit order at the price given: a
    // market order of that size would not be what was asked for.
    expect(switched).toBe(true);
    expect(getMode()).toBe('spot');
    expect(getSpotAsset()).toMatchObject({ coin: '@107' });
    expect(store.get(tradingFormAtom())).toMatchObject(draft);
  });

  it('begins a spot order as a standard market order when the page shows a spot token', async () => {
    const { store, result } = setup('perp');
    jest.spyOn(spotAssetCtxsMapAtom, 'get').mockResolvedValue({});
    store.set(tradingFormAtom(), {
      ...store.get(tradingFormAtom()),
      type: 'limit',
      price: '60000',
      size: '2',
      hasTpsl: true,
      orderMode: 'scale',
    });
    // The switch is still clearing the contexts.
    mockClearActiveAssetCtxForActiveAssetChange.mockImplementationOnce(
      () => new Promise(() => {}),
    );

    await act(async () => {
      void result.current.current.switchTradeInstrument({
        mode: 'spot',
        coin: '@150',
        spotUniverse: { name: '@150', assetId: 10_150 } as HL.ISpotUniverse,
      });
    });

    expect(store.get(activeTradeInstrumentAtom()).coin).toBe('@150');
    expect(store.get(tradingFormAtom())).toMatchObject({
      type: 'market',
      orderMode: 'standard',
      hasTpsl: false,
      price: '',
      size: '',
    });
  });

  // A market that takes one decimal in a price: HL allows 6 minus the size
  // decimals.
  const lowPrecision: IPerpsActiveAssetAtom = {
    coin: 'ETH',
    assetId: 1,
    universe: {
      assetId: 1,
      name: 'ETH',
      szDecimals: 5,
      maxLeverage: 25,
    } as IPerpsUniverse,
    margin: undefined,
  };

  it.each([
    ['left it blank', undefined, formatPriceToSignificantDigits('1.25', 5)],
    ['typed a price', '1.3', '1.3'],
    ['cleared it', '', ''],
  ] as const)(
    'starts a limit price from a mid that came in while the token loaded, unless the user %s',
    async (_label, edit, expected) => {
      const { store, result } = setup('perp');
      store.set(tradingFormAtom(), {
        ...store.get(tradingFormAtom()),
        type: 'limit',
        price: '60000',
      });
      const eth = createDeferred<IPerpsActiveAssetAtom>();
      mockChangeActiveAsset.mockImplementationOnce(() => eth.promise);
      let landing: Promise<boolean> | undefined;
      await act(async () => {
        landing = result.current.current.switchTradeInstrument({
          mode: 'perp',
          coin: 'ETH',
        });
      });
      // No mid for ETH yet: BTC's price is gone and nothing takes its place.
      expect(store.get(tradingFormAtom()).price).toBe('');
      act(() => {
        store.set(perpsAllMidsAtom(), {
          mids: { ETH: '1.25' },
        } as unknown as HL.IWsAllMids);
        if (edit !== undefined) {
          result.current.current.updateTradingForm({ price: '1' });
          result.current.current.updateTradingForm({ price: edit });
        }
      });

      await act(async () => {
        eth.resolve(lowPrecision);
        await expect(landing).resolves.toBe(true);
      });

      // At the precision of the loaded market, which an order is cut to.
      expect(expected).not.toBe('1.25');
      expect(store.get(tradingFormAtom()).price).toBe(expected);
    },
  );

  it('sets a limit price begun from the mid again at the precision of the loaded market', async () => {
    const { store, result } = setup('perp');
    store.set(perpsAllMidsAtom(), {
      mids: { ETH: '1.25' },
    } as unknown as HL.IWsAllMids);
    store.set(tradingFormAtom(), {
      ...store.get(tradingFormAtom()),
      type: 'limit',
      price: '60000',
    });
    const eth = createDeferred<IPerpsActiveAssetAtom>();
    mockChangeActiveAsset.mockImplementationOnce(() => eth.promise);
    let landing: Promise<boolean> | undefined;
    await act(async () => {
      landing = result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'ETH',
      });
    });
    // Shown before the market has loaded, without its precision.
    expect(store.get(tradingFormAtom()).price).toBe('1.25');

    await act(async () => {
      eth.resolve(lowPrecision);
      await expect(landing).resolves.toBe(true);
    });

    expect(store.get(tradingFormAtom()).price).toBe(
      formatPriceToSignificantDigits('1.25', 5),
    );
  });

  it.each([
    ['fails', 'fails'],
    ['is left for that token again', 'returns'],
  ] as const)(
    'gives an order the settings the one on its token had when a spot switch %s',
    async (_label, outcome) => {
      const { store, result } = setup('perp');
      jest.spyOn(spotAssetCtxsMapAtom, 'get').mockResolvedValue({});
      store.set(perpsAllMidsAtom(), {
        mids: { BTC: '61000' },
      } as unknown as HL.IWsAllMids);
      const settings = {
        type: 'limit',
        orderMode: 'scale',
        hasTpsl: true,
      } as const;
      store.set(tradingFormAtom(), {
        ...store.get(tradingFormAtom()),
        ...settings,
        price: '60000',
        size: '2',
      });
      if (outcome === 'fails') {
        mockClearActiveAssetCtxForActiveAssetChange.mockRejectedValueOnce(
          new OneKeyLocalError('Bridge error'),
        );
      } else {
        mockClearActiveAssetCtxForActiveAssetChange.mockImplementationOnce(
          () => new Promise(() => {}),
        );
        mockChangeActiveAsset.mockResolvedValueOnce(btc);
      }

      await act(async () => {
        const toSpot = result.current.current.switchTradeInstrument({
          mode: 'spot',
          coin: '@150',
          spotUniverse: { name: '@150', assetId: 10_150 } as HL.ISpotUniverse,
        });
        if (outcome === 'fails') {
          await expect(toSpot).rejects.toThrow('Bridge error');
        } else {
          void toSpot;
        }
      });
      if (outcome === 'returns') {
        // The spot pair shows with an order of its own kind.
        expect(store.get(tradingFormAtom())).toMatchObject({
          type: 'market',
          hasTpsl: false,
        });
        await act(async () => {
          await expect(
            result.current.current.switchTradeInstrument({
              mode: 'perp',
              coin: 'BTC',
            }),
          ).resolves.toBe(true);
        });
      }

      // Back on BTC: a new order, of the kind the one there was, and not a
      // market order without the TP/SL that had been chosen.
      expect(store.get(activeTradeInstrumentAtom()).coin).toBe('BTC');
      expect(store.get(tradingFormAtom())).toMatchObject({
        ...settings,
        size: '',
        price: formatPriceToSignificantDigits('61000'),
      });
    },
  );

  it('gives a trigger order its kind and reduce-only choice back when the switch after it fails', async () => {
    const { store, result } = setup('perp');
    const ticket = {
      orderMode: 'trigger',
      triggerOrderType: ETriggerOrderType.TRIGGER_LIMIT,
      triggerReduceOnly: true,
      side: 'short',
    } as const;
    store.set(tradingFormAtom(), {
      ...store.get(tradingFormAtom()),
      ...ticket,
    });
    let failChange: (error: Error) => void = () => {};
    mockChangeActiveAsset.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          failChange = reject;
        }),
    );
    let failed: Promise<boolean> | undefined;
    await act(async () => {
      failed = result.current.current.switchTradeInstrument({
        mode: 'perp',
        coin: 'ETH',
      });
    });
    // Chosen for ETH while it loads.
    act(() => {
      result.current.current.updateTradingForm({
        triggerOrderType: ETriggerOrderType.TRIGGER_MARKET,
        triggerReduceOnly: false,
        side: 'long',
      });
    });

    await act(async () => {
      failChange(new OneKeyLocalError('Network error'));
      await expect(failed).rejects.toThrow('Network error');
    });

    // A trigger market order that may add to a position was ETH's choice.
    expect(store.get(activeTradeInstrumentAtom()).coin).toBe('BTC');
    expect(store.get(tradingFormAtom())).toMatchObject(ticket);
  });

  it('begins no order sized by a share of the balance when the page comes back to its spot pair', async () => {
    const { store, result } = setup('spot');
    store.set(tradingFormAtom(), {
      ...store.get(tradingFormAtom()),
      type: 'market',
      sizeInputMode: EPerpsSizeInputMode.SLIDER,
      sizePercent: 50,
    });
    mockClearActiveAssetCtxForActiveAssetChange.mockRejectedValueOnce(
      new OneKeyLocalError('Bridge error'),
    );

    await act(async () => {
      await expect(
        result.current.current.switchTradeInstrument({
          mode: 'perp',
          coin: 'ETH',
        }),
      ).rejects.toThrow('Bridge error');
    });

    // Half of the balance was the size of the order that went.
    expect(store.get(activeTradeInstrumentAtom()).mode).toBe('spot');
    expect(store.get(tradingFormAtom())).toMatchObject({
      sizeInputMode: EPerpsSizeInputMode.MANUAL,
      sizePercent: 0,
      size: '',
    });
  });

  it('starts the limit price of the token the page goes back to at the precision of its market', async () => {
    // BTC here takes one decimal in a price: HL allows 6 minus the size
    // decimals, which are 5.
    const { store, result } = setup('perp');
    jest.spyOn(spotAssetCtxsMapAtom, 'get').mockResolvedValue({});
    store.set(perpsAllMidsAtom(), {
      mids: { BTC: '1.25' },
    } as unknown as HL.IWsAllMids);
    store.set(tradingFormAtom(), {
      ...store.get(tradingFormAtom()),
      type: 'limit',
      price: '1.2',
    });
    mockClearActiveAssetCtxForActiveAssetChange.mockRejectedValueOnce(
      new OneKeyLocalError('Bridge error'),
    );

    await act(async () => {
      await expect(
        result.current.current.switchTradeInstrument({
          mode: 'spot',
          coin: '@150',
          spotUniverse: { name: '@150', assetId: 10_150 } as HL.ISpotUniverse,
        }),
      ).rejects.toThrow('Bridge error');
    });

    const price = formatPriceToSignificantDigits('1.25', 5);
    expect(price).not.toBe('1.25');
    expect(store.get(tradingFormAtom())).toMatchObject({
      type: 'limit',
      price,
    });
  });

  it('clears a TP/SL given as a price for the token before when a switch lands', async () => {
    const { store, result } = setup('perp');
    store.set(tradingFormAtom(), {
      ...store.get(tradingFormAtom()),
      hasTpsl: true,
      tpType: 'price',
      tpValue: '65000',
      slType: 'percentage',
      slValue: '5',
    });
    mockChangeActiveAsset.mockResolvedValueOnce({
      coin: 'ETH',
      assetId: 1,
      universe: { assetId: 1, name: 'ETH', szDecimals: 4, maxLeverage: 25 },
      margin: undefined,
    });

    await act(async () => {
      await expect(
        result.current.current.switchTradeInstrument({
          mode: 'perp',
          coin: 'ETH',
        }),
      ).resolves.toBe(true);
    });

    // BTC's take profit price is none for ETH; a loss holds for any token.
    expect(store.get(tradingFormAtom())).toMatchObject({
      tpValue: '',
      slValue: '5',
    });
  });

  it('goes back to the token it showed when the service fails a spot switch at setting the mode', async () => {
    const { store, result, getMode } = setup('perp');
    mockSetTradingModeForActiveAssetChange.mockRejectedValueOnce(
      new OneKeyLocalError('Bridge error'),
    );

    await act(async () => {
      await expect(
        result.current.current.switchTradeInstrument({
          mode: 'spot',
          coin: '@150',
          spotUniverse: { name: '@150', assetId: 10_150 } as HL.ISpotUniverse,
        }),
      ).rejects.toThrow('Bridge error');
    });

    expect(getMode()).toBe('perp');
    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      mode: 'perp',
      coin: 'BTC',
      assetId: 0,
    });
  });

  it('leaves the page where it is for a spot token whose markets have not loaded when its caller needs the metadata', async () => {
    const { store, result, getMode } = setup('perp');

    let switched: boolean | undefined;
    await act(async () => {
      switched = await result.current.current.switchTradeInstrument({
        mode: 'spot',
        coin: '@999',
        // As a chart panel asks, which returns its selection otherwise.
        requireSpotMetadata: true,
      });
    });

    expect(switched).toBe(false);
    expect(getMode()).toBe('perp');
    expect(spotActiveAssetAtom.set).not.toHaveBeenCalled();
    expect(store.get(activeTradeInstrumentAtom())).toMatchObject({
      mode: 'perp',
      coin: 'BTC',
    });
  });
});

it('invalidates a captured instrument guard as soon as a real UI switch starts', async () => {
  let stop!: (error: Error) => void;
  mockReachAssetChangeService.mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, reject) => {
        stop = reject;
      }),
  );
  const store = createStore();
  store.set(activeTradeInstrumentAtom(), {
    mode: 'perp',
    coin: 'BTC',
    assetId: undefined,
    universe: undefined,
  });
  const { result } = renderHook(() => useHyperliquidActions(), {
    wrapper: createWrapper(store),
  });
  const isCurrent = capturePerpsInstrumentChangeGuard();
  expect(isCurrent()).toBe(true);
  let switching!: Promise<boolean>;
  act(() => {
    switching = result.current.current.switchTradeInstrument({
      mode: 'perp',
      coin: 'ETH',
    });
  });
  expect(store.get(activeTradeInstrumentAtom()).coin).toBe('ETH');
  expect(isCurrent()).toBe(false);
  expect(capturePerpsInstrumentChangeGuard()()).toBe(true);
  await act(async () => {
    stop(new OneKeyLocalError('stopped before BG write'));
    await expect(switching).rejects.toThrow('stopped before BG write');
  });
});

it.each([
  { entry: 'switch', coin: 'BTC', allowed: true },
  { entry: 'perp', coin: 'ETH', allowed: false },
  { entry: 'spot', coin: 'BTC', allowed: false },
])(
  'checks the latest requested target for the $entry entry before BG writes',
  async ({ entry, coin, allowed }) => {
    let stop!: (error: Error) => void;
    mockReachAssetChangeService.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          stop = reject;
        }),
    );
    const store = createStore();
    const { result } = renderHook(() => useHyperliquidActions(), {
      wrapper: createWrapper(store),
    });
    const strictGuard = capturePerpsInstrumentChangeGuard();
    const targetGuard = capturePerpsInstrumentChangeGuard({
      mode: 'perp',
      coin: 'BTC',
    });
    let switching!: Promise<boolean>;
    act(() => {
      const actions = result.current.current;
      if (entry === 'switch') {
        switching = actions.switchTradeInstrument({ mode: 'perp', coin });
      } else if (entry === 'perp') {
        switching = actions.changeActiveAsset({ coin });
      } else {
        switching = actions.changeActiveSpotAsset({
          coin,
          spotUniverse: undefined,
        });
      }
    });
    expect(strictGuard()).toBe(false);
    expect(targetGuard()).toBe(allowed);
    await act(async () => {
      stop(new OneKeyLocalError('stopped before BG write'));
      await expect(switching).rejects.toThrow('stopped before BG write');
    });
  },
);

describe('useHyperliquidActions.hydrateUnresolvedActivePerp', () => {
  const universe: HL.IPerpsUniverse = {
    name: 'ETH',
    assetId: 1,
    szDecimals: 3,
    maxLeverage: 50,
    marginTableId: 1,
  };
  let metadataReady: boolean;
  let bgAsset: Awaited<ReturnType<typeof perpsActiveAssetAtom.get>>;

  beforeEach(() => {
    metadataReady = false;
    bgAsset = {
      coin: 'ETH',
      assetId: undefined,
      universe: undefined,
      margin: undefined,
    };
    mockReachAssetChangeService.mockReset().mockResolvedValue();
    mockSetTradingModeForActiveAssetChange.mockReset().mockResolvedValue(true);
    mockClearActiveAssetCtxForActiveAssetChange
      .mockReset()
      .mockResolvedValue(true);
    mockRestoreActiveAssetAfterFailedChange
      .mockReset()
      .mockImplementation(async () => ({ restored: true, perpAsset: bgAsset }));
    mockSetActiveOrderBookOptions
      .mockReset()
      .mockImplementation(async ({ options }) => {
        await perpsActiveOrderBookOptionsAtom.set(options);
        return true;
      });
    mockUpdateSubscriptions.mockReset().mockResolvedValue();
    mockRecoverSubscriptionsAfterLivenessProof
      .mockReset()
      .mockResolvedValue(true);
    mockChangeActiveAsset.mockReset().mockImplementation(async ({ coin }) => {
      bgAsset = {
        coin,
        assetId: metadataReady ? universe.assetId : undefined,
        universe: metadataReady ? { ...universe, name: coin } : undefined,
        margin: undefined,
      };
      return bgAsset;
    });
    jest
      .spyOn(perpsActiveAssetAtom, 'get')
      .mockImplementation(async () => bgAsset);
    jest.spyOn(tradingModeAtom, 'get').mockResolvedValue('perp');
    jest.spyOn(tradingModeAtom, 'set').mockResolvedValue();
    jest.spyOn(perpsActiveAssetCtxAtom, 'set').mockResolvedValue();
    jest.spyOn(perpsActiveAssetCtxDisplayAtom, 'set').mockResolvedValue();
    jest.spyOn(perpsActiveAssetDataAtom, 'set').mockResolvedValue();
    jest.spyOn(spotActiveAssetCtxAtom, 'set').mockResolvedValue();
    jest
      .spyOn(perpsActiveOrderBookOptionsAtom, 'get')
      .mockResolvedValue(undefined);
    jest.spyOn(perpsActiveOrderBookOptionsAtom, 'set').mockResolvedValue();
  });

  afterEach(() => jest.restoreAllMocks());

  function setup() {
    const store = createStore();
    const hook = renderHook(() => useHyperliquidActions(), {
      wrapper: createWrapper(store),
    });
    return { store, actions: hook.result.current.current };
  }

  it('fills the current asset metadata after a cache-empty switch has completed', async () => {
    const { store, actions } = setup();
    await act(async () => {
      expect(
        await actions.switchTradeInstrument({ mode: 'perp', coin: 'ETH' }),
      ).toBe(false);
    });
    expect(store.get(activeTradeInstrumentAtom())).toEqual({
      mode: 'perp',
      coin: 'ETH',
      assetId: undefined,
      universe: undefined,
    });
    const isCurrent = capturePerpsInstrumentChangeGuard();
    const isCurrentTarget = capturePerpsInstrumentChangeGuard({
      mode: 'perp',
      coin: 'ETH',
    });
    metadataReady = true;
    await act(async () => {
      expect(await actions.hydrateUnresolvedActivePerp()).toBe(true);
    });
    expect(store.get(activeTradeInstrumentAtom())).toEqual({
      mode: 'perp',
      coin: 'ETH',
      assetId: 1,
      universe,
    });
    expect(isCurrent()).toBe(false);
    expect(isCurrentTarget()).toBe(true);
    expect(
      mockChangeActiveAsset.mock.calls.map(([target]) => target.coin),
    ).toEqual(['ETH', 'ETH']);
  });

  it('reconciles a no-proof switch after hydration publishes its resolved options while the root route is hidden', async () => {
    let publishedOptions: Awaited<
      ReturnType<typeof perpsActiveOrderBookOptionsAtom.get>
    >;
    jest
      .spyOn(perpsActiveOrderBookOptionsAtom, 'get')
      .mockImplementation(async () => publishedOptions);
    jest
      .spyOn(perpsActiveOrderBookOptionsAtom, 'set')
      .mockImplementation(async (update) => {
        publishedOptions =
          typeof update === 'function' ? update(publishedOptions) : update;
      });
    const reconciledOptions: Array<typeof publishedOptions> = [];
    mockUpdateSubscriptions.mockImplementation(async () => {
      reconciledOptions.push(publishedOptions);
    });
    const { actions } = setup();
    await act(async () => {
      expect(
        await actions.switchTradeInstrument({ mode: 'perp', coin: 'ETH' }),
      ).toBe(false);
    });
    metadataReady = true;
    await act(async () => {
      expect(await actions.hydrateUnresolvedActivePerp()).toBe(true);
    });
    await waitFor(() =>
      expect(reconciledOptions).toContainEqual({
        coin: 'ETH',
        assetId: 1,
        nSigFigs: null,
        mantissa: null,
      }),
    );
    expect(mockRecoverSubscriptionsAfterLivenessProof).not.toHaveBeenCalled();
  });

  it('reconciles hydration without reusing the original switch proof', async () => {
    const { actions } = setup();
    await act(async () => {
      await actions.switchTradeInstrument({
        mode: 'perp',
        coin: 'ETH',
        subscriptionRecoveryProof: {
          source: 'simple-market',
          disabledCount: 3,
        },
      });
    });
    await waitFor(() =>
      expect(mockRecoverSubscriptionsAfterLivenessProof).toHaveBeenCalledTimes(
        1,
      ),
    );
    metadataReady = true;
    await act(async () => {
      expect(await actions.hydrateUnresolvedActivePerp()).toBe(true);
    });
    await waitFor(() =>
      expect(mockUpdateSubscriptions).toHaveBeenCalledTimes(1),
    );
    expect(mockRecoverSubscriptionsAfterLivenessProof).toHaveBeenCalledTimes(1);
  });

  it('does not reconcile hydrated options superseded by a newer target during publication', async () => {
    const readOptions = jest.spyOn(perpsActiveOrderBookOptionsAtom, 'get');
    const writeOptions = jest.spyOn(perpsActiveOrderBookOptionsAtom, 'set');
    const { store, actions } = setup();
    await act(async () => {
      await actions.switchTradeInstrument({ mode: 'perp', coin: 'ETH' });
    });
    await waitFor(() => expect(writeOptions).toHaveBeenCalledTimes(1));
    const previousOptions =
      createDeferred<
        Awaited<ReturnType<typeof perpsActiveOrderBookOptionsAtom.get>>
      >();
    readOptions.mockReturnValueOnce(previousOptions.promise);
    metadataReady = true;
    await act(async () => {
      expect(await actions.hydrateUnresolvedActivePerp()).toBe(true);
    });
    await waitFor(() => expect(readOptions).toHaveBeenCalledTimes(2));
    await act(async () => {
      expect(
        await actions.switchTradeInstrument({ mode: 'perp', coin: 'SOL' }),
      ).toBe(true);
      previousOptions.resolve(undefined);
    });
    await waitFor(() => expect(writeOptions).toHaveBeenCalledTimes(2));
    expect(store.get(activeTradeInstrumentAtom()).coin).toBe('SOL');
    const publishedOptions = writeOptions.mock.calls.map(([update]) =>
      typeof update === 'function' ? update(undefined) : update,
    );
    expect(publishedOptions).toEqual([
      { coin: 'ETH', assetId: undefined, nSigFigs: null, mantissa: null },
      { coin: 'SOL', assetId: 1, nSigFigs: null, mantissa: null },
    ]);
    expect(mockUpdateSubscriptions).not.toHaveBeenCalled();
    expect(mockRecoverSubscriptionsAfterLivenessProof).not.toHaveBeenCalled();
  });

  it('cancels only the pending focus restore when the page blurs during the BG switch', async () => {
    const pending =
      createDeferred<Awaited<ReturnType<typeof perpsActiveAssetAtom.get>>>();
    mockChangeActiveAsset.mockImplementationOnce(() => pending.promise);
    const { store, actions } = setup();
    const previous = store.get(activeTradeInstrumentAtom());
    if (previous.mode !== 'perp')
      throw new OneKeyLocalError('Expected a perp fixture');
    mockRestoreActiveAssetAfterFailedChange.mockResolvedValueOnce({
      restored: true,
      perpAsset: { ...previous, margin: undefined },
    });
    const controller = new AbortController();
    let switching!: Promise<boolean>;
    act(() => {
      switching = actions.switchTradeInstrument({
        mode: 'perp',
        coin: 'ETH',
        restorationSignal: controller.signal,
      });
    });
    await waitFor(() => expect(mockChangeActiveAsset).toHaveBeenCalledTimes(1));
    const { restorationId } = mockChangeActiveAsset.mock.calls[0][0];
    expect(restorationId).toEqual(expect.any(String));
    await act(async () => {
      controller.abort();
      expect(mockReachAssetChangeService).toHaveBeenLastCalledWith({
        restorationId,
      });
      pending.resolve(bgAsset);
      expect(await switching).toBe(false);
    });
    expect(store.get(activeTradeInstrumentAtom())).toEqual(previous);
    expect(mockRestoreActiveAssetAfterFailedChange).toHaveBeenCalled();
  });

  it('waits for an in-flight switch without superseding its successful result', async () => {
    const pending =
      createDeferred<Awaited<ReturnType<typeof perpsActiveAssetAtom.get>>>();
    mockChangeActiveAsset.mockImplementationOnce(() => pending.promise);
    const { store, actions } = setup();
    let switching!: Promise<boolean>;
    act(() => {
      switching = actions.switchTradeInstrument({ mode: 'perp', coin: 'ETH' });
    });
    await waitFor(() => expect(mockChangeActiveAsset).toHaveBeenCalledTimes(1));
    metadataReady = true;
    let hydrating!: Promise<boolean>;
    act(() => {
      hydrating = actions.hydrateUnresolvedActivePerp();
    });
    expect(mockChangeActiveAsset).toHaveBeenCalledTimes(1);
    await act(async () => {
      bgAsset = {
        coin: 'ETH',
        assetId: undefined,
        universe: undefined,
        margin: undefined,
      };
      pending.resolve(bgAsset);
      expect(await switching).toBe(false);
      expect(await hydrating).toBe(true);
    });
    expect(store.get(activeTradeInstrumentAtom())).toEqual({
      mode: 'perp',
      coin: 'ETH',
      assetId: 1,
      universe,
    });
  });

  it('reconciles a no-proof switch that resolves its metadata while hydration waits', async () => {
    const pending =
      createDeferred<Awaited<ReturnType<typeof perpsActiveAssetAtom.get>>>();
    mockChangeActiveAsset.mockImplementationOnce(() => pending.promise);
    const writeOptions = jest.spyOn(perpsActiveOrderBookOptionsAtom, 'set');
    const { store, actions } = setup();
    let switching!: Promise<boolean>;
    act(() => {
      switching = actions.switchTradeInstrument({ mode: 'perp', coin: 'ETH' });
    });
    await waitFor(() => expect(mockChangeActiveAsset).toHaveBeenCalledTimes(1));
    let hydrating!: Promise<boolean>;
    act(() => {
      hydrating = actions.hydrateUnresolvedActivePerp();
    });
    await act(async () => {
      metadataReady = true;
      bgAsset = {
        coin: 'ETH',
        assetId: 1,
        universe,
        margin: undefined,
      };
      pending.resolve(bgAsset);
      expect(await switching).toBe(true);
      expect(await hydrating).toBe(false);
    });
    expect(store.get(activeTradeInstrumentAtom()).assetId).toBe(1);
    expect(mockChangeActiveAsset).toHaveBeenCalledTimes(1);
    expect(mockUpdateSubscriptions).toHaveBeenCalledTimes(1);
    const [update] = writeOptions.mock.calls[0];
    expect(typeof update === 'function' ? update(undefined) : update).toEqual({
      coin: 'ETH',
      assetId: 1,
      nSigFigs: null,
      mantissa: null,
    });
    expect(writeOptions.mock.invocationCallOrder[0]).toBeLessThan(
      mockUpdateSubscriptions.mock.invocationCallOrder[0],
    );
    expect(mockRecoverSubscriptionsAfterLivenessProof).not.toHaveBeenCalled();
  });

  it('rejects the old unresolved subscription publication after hydration starts a new request', async () => {
    const previousOptions =
      createDeferred<
        Awaited<ReturnType<typeof perpsActiveOrderBookOptionsAtom.get>>
      >();
    const readOptions = jest
      .spyOn(perpsActiveOrderBookOptionsAtom, 'get')
      .mockReturnValueOnce(previousOptions.promise);
    const writeOptions = jest.spyOn(perpsActiveOrderBookOptionsAtom, 'set');
    const { actions } = setup();
    await act(async () => {
      expect(
        await actions.switchTradeInstrument({ mode: 'perp', coin: 'ETH' }),
      ).toBe(false);
    });
    await waitFor(() => expect(readOptions).toHaveBeenCalledTimes(1));
    metadataReady = true;
    await act(async () => {
      expect(await actions.hydrateUnresolvedActivePerp()).toBe(true);
    });
    expect(writeOptions).not.toHaveBeenCalled();
    await act(async () => previousOptions.resolve(undefined));
    await waitFor(() => expect(writeOptions).toHaveBeenCalledTimes(1));
    const [update] = writeOptions.mock.calls[0];
    expect(typeof update === 'function' ? update(undefined) : update).toEqual(
      expect.objectContaining({ coin: 'ETH', assetId: 1 }),
    );
  });

  it('does not reset an already resolved instrument or its order form', async () => {
    const { store, actions } = setup();
    metadataReady = true;
    await act(async () => {
      await actions.switchTradeInstrument({ mode: 'perp', coin: 'ETH' });
    });
    store.set(tradingFormAtom(), (previous) => ({ ...previous, size: '123' }));
    await act(async () => {
      expect(await actions.hydrateUnresolvedActivePerp()).toBe(false);
    });
    expect(mockChangeActiveAsset).toHaveBeenCalledTimes(1);
    expect(store.get(tradingFormAtom()).size).toBe('123');
    expect(mockUpdateSubscriptions).toHaveBeenCalledTimes(1);
    expect(mockRecoverSubscriptionsAfterLivenessProof).not.toHaveBeenCalled();
  });

  it('waits for a same-coin force switch that can invalidate its previously resolved snapshot', async () => {
    const pending =
      createDeferred<Awaited<ReturnType<typeof perpsActiveAssetAtom.get>>>();
    mockChangeActiveAsset.mockImplementationOnce(() => pending.promise);
    const { store, actions } = setup();
    store.set(activeTradeInstrumentAtom(), {
      mode: 'perp',
      coin: 'ETH',
      assetId: 1,
      universe,
    });
    let switching!: Promise<boolean>;
    act(() => {
      switching = actions.switchTradeInstrument({
        mode: 'perp',
        coin: 'ETH',
        force: true,
      });
    });
    await waitFor(() => expect(mockChangeActiveAsset).toHaveBeenCalledTimes(1));
    metadataReady = true;
    let hydrating!: Promise<boolean>;
    act(() => {
      hydrating = actions.hydrateUnresolvedActivePerp();
    });
    await act(async () => {
      pending.resolve({
        coin: 'ETH',
        assetId: undefined,
        universe: undefined,
        margin: undefined,
      });
      expect(await switching).toBe(false);
      expect(await hydrating).toBe(true);
    });
    expect(store.get(activeTradeInstrumentAtom())).toEqual({
      mode: 'perp',
      coin: 'ETH',
      assetId: 1,
      universe,
    });
  });

  it('releases hydration after the original switch rejects', async () => {
    const pending =
      createDeferred<Awaited<ReturnType<typeof perpsActiveAssetAtom.get>>>();
    mockChangeActiveAsset.mockImplementationOnce(() => pending.promise);
    const { store, actions } = setup();
    let switching!: Promise<boolean>;
    act(() => {
      switching = actions.switchTradeInstrument({ mode: 'perp', coin: 'ETH' });
    });
    await waitFor(() => expect(mockChangeActiveAsset).toHaveBeenCalledTimes(1));
    metadataReady = true;
    let hydrating!: Promise<boolean>;
    act(() => {
      hydrating = actions.hydrateUnresolvedActivePerp();
    });
    await act(async () => {
      pending.reject(new OneKeyLocalError('cache-empty switch failed'));
      await expect(switching).rejects.toThrow('cache-empty switch failed');
      expect(await hydrating).toBe(true);
    });
    expect(store.get(activeTradeInstrumentAtom()).assetId).toBe(1);
  });

  it('does not use an old owner store when the latest request names another target', async () => {
    const { store, actions } = setup();
    await act(async () => {
      await actions.switchTradeInstrument({ mode: 'perp', coin: 'ETH' });
    });
    store.set(activeTradeInstrumentAtom(), {
      mode: 'perp',
      coin: 'BTC',
      assetId: undefined,
      universe: undefined,
    });
    await act(async () => {
      expect(await actions.hydrateUnresolvedActivePerp()).toBe(false);
    });
    expect(mockChangeActiveAsset).toHaveBeenCalledTimes(1);
  });

  it('does not hydrate a perp when a same-name spot request has started before its store update', async () => {
    const pending = createDeferred<{ tokens: unknown[]; universes: [] }>();
    mockGetSpotMeta.mockReturnValueOnce(pending.promise);
    const { store, actions } = setup();
    await act(async () => {
      await actions.switchTradeInstrument({ mode: 'perp', coin: 'ETH' });
    });
    let switching!: Promise<boolean>;
    act(() => {
      switching = actions.switchTradeInstrument({ mode: 'spot', coin: 'ETH' });
    });
    expect(store.get(activeTradeInstrumentAtom()).mode).toBe('perp');
    await act(async () => {
      expect(await actions.hydrateUnresolvedActivePerp()).toBe(false);
    });
    expect(mockChangeActiveAsset).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.reject(new OneKeyLocalError('stopped before spot store update'));
      await expect(switching).rejects.toThrow(
        'stopped before spot store update',
      );
    });
  });

  it('does not hydrate an old target when another request starts while it waits', async () => {
    const pending =
      createDeferred<Awaited<ReturnType<typeof perpsActiveAssetAtom.get>>>();
    mockChangeActiveAsset.mockImplementationOnce(() => pending.promise);
    const { store, actions } = setup();
    let switching!: Promise<boolean>;
    act(() => {
      switching = actions.switchTradeInstrument({ mode: 'perp', coin: 'ETH' });
    });
    await waitFor(() => expect(mockChangeActiveAsset).toHaveBeenCalledTimes(1));
    let hydrating!: Promise<boolean>;
    act(() => {
      hydrating = actions.hydrateUnresolvedActivePerp();
    });
    metadataReady = true;
    await act(async () => {
      expect(
        await actions.switchTradeInstrument({ mode: 'perp', coin: 'SOL' }),
      ).toBe(true);
    });
    await act(async () => {
      pending.resolve({
        coin: 'ETH',
        assetId: undefined,
        universe: undefined,
        margin: undefined,
      });
      expect(await switching).toBe(false);
      expect(await hydrating).toBe(false);
    });
    expect(store.get(activeTradeInstrumentAtom()).coin).toBe('SOL');
    expect(
      mockChangeActiveAsset.mock.calls.map(([target]) => target.coin),
    ).toEqual(['ETH', 'SOL']);
  });
});

describe('useHyperliquidActions.ensureTradingEnabled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDialogShow.mockReturnValue({
      close: mockDialogClose,
      getForm: () => undefined,
      isExist: () => true,
    });
    mockRefreshHyperLiquidAgentPasswordStatus.mockResolvedValue({
      isPasswordSet: true,
      requiresPasswordSetupOrVerify: true,
    });
    mockCheckPerpsAccountStatus.mockResolvedValue(undefined);
    mockShowDepositWithdrawModal.mockResolvedValue(undefined);
    mockShowHyperliquidTermsDialog.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the fresh, password- and terms-gated enable-trading flow', async () => {
    const passwordDeferred = createDeferred<void>();
    const enabledStatus = buildPerpsAccountStatus(true);
    const callOrder: string[] = [];
    jest
      .spyOn(perpsActiveAccountIsAgentReadyAtom, 'get')
      .mockResolvedValue({ isAgentReady: false });
    jest
      .spyOn(perpsActiveAccountStatusAtom, 'get')
      .mockResolvedValue(buildPerpsAccountStatus(false));
    mockCheckPerpsAccountStatus.mockImplementation(async () => {
      callOrder.push('checkStatus');
    });
    mockPromptHyperLiquidAgentPasswordSetupOrVerify.mockImplementation(
      async () => {
        callOrder.push('password');
        await passwordDeferred.promise;
      },
    );
    mockShowHyperliquidTermsDialog.mockImplementation(async () => {
      callOrder.push('terms');
      return true;
    });
    mockEnableTrading.mockImplementation(async () => {
      callOrder.push('enableTrading');
      return enabledStatus;
    });

    const { result } = renderHook(
      () => ({
        actions: useHyperliquidActions(),
        firstDepositAction: useFirstDepositAction(),
      }),
      {
        wrapper: createWrapper(),
      },
    );

    const ensureTradingPromise =
      result.current.actions.current.ensureTradingEnabled(
        result.current.firstDepositAction,
      );
    const ensureTradingErrorPromise = ensureTradingPromise.catch(
      (error: unknown) => error,
    );
    await waitFor(() => expect(mockDialogShow).toHaveBeenCalledTimes(1));
    expect(callOrder).toEqual(['checkStatus']);

    const dialogOptions = mockDialogShow.mock.calls[0]?.[0];
    const dialogContent = dialogOptions?.renderContent;
    expect(dialogContent).toBeTruthy();
    const dialog = render(dialogContent as ReactElement);

    fireEvent.click(dialog.getByTestId('perp-enable-trading-steps-continue'));

    await waitFor(() =>
      expect(
        mockPromptHyperLiquidAgentPasswordSetupOrVerify,
      ).toHaveBeenCalledTimes(1),
    );
    expect(mockEnableTrading).not.toHaveBeenCalled();
    expect(mockShowHyperliquidTermsDialog).not.toHaveBeenCalled();
    expect(callOrder).toEqual(['checkStatus', 'password']);

    await act(async () => {
      passwordDeferred.resolve();
      await passwordDeferred.promise;
    });

    await waitFor(() => expect(mockEnableTrading).toHaveBeenCalledTimes(1));
    expect(await ensureTradingErrorPromise).toBeInstanceOf(Error);
    expect(callOrder).toEqual([
      'checkStatus',
      'password',
      'terms',
      'enableTrading',
    ]);
  });
});

describe('useHyperliquidActions.loadTwapData', () => {
  const accountAddress = '0xabcd';
  const state: HL.ITwapState = {
    coin: 'BTC',
    executedNtl: '0',
    trigger: null,
    stopPx: null,
    executedSz: '0',
    minutes: 5,
    randomize: false,
    reduceOnly: false,
    side: 'B',
    sz: '1',
    timestamp: 1,
    user: accountAddress,
  };

  const activeAccount = {
    accountId: null,
    indexedAccountId: null,
    deriveType: 'default' as const,
    accountAddress,
  } satisfies IPerpsActiveAccountAtom;

  beforeEach(() => {
    jest.mocked(Toast.error).mockClear();
    jest.mocked(Toast.success).mockClear();
    mockGetTwapStates.mockReset();
    mockGetTwapHistory.mockReset().mockResolvedValue([]);
    mockGetTwapSliceFills.mockReset().mockResolvedValue([]);
    jest.spyOn(perpsActiveAccountAtom, 'get').mockResolvedValue(activeAccount);
  });

  afterEach(() => jest.restoreAllMocks());

  const setup = () => {
    const store = createStore();
    const existingOrders = [
      { twapId: 1, state, dex: '' },
      { twapId: 2, state: { ...state, coin: 'xyz:BTC' }, dex: 'xyz' },
    ];
    store.set(perpsActiveTwapOrdersAtom(), {
      accountAddress,
      twapOrders: existingOrders,
      twapOrdersByCoin: {},
    });
    const { result } = renderHook(() => useHyperliquidActions(), {
      wrapper: createWrapper(store),
    });
    return { store, result, existingOrders };
  };

  it.each([false, true])(
    'forwards plain/advanced TWAP parameters to background: %s',
    async (advanced) => {
      jest.spyOn(perpsActiveAssetAtom, 'get').mockResolvedValue({
        coin: 'BTC',
        assetId: 0,
        universe: undefined,
        margin: undefined,
      });
      jest.spyOn(perpsActiveAssetCtxAtom, 'get').mockResolvedValue(undefined);
      jest.spyOn(perpsActiveAssetDataAtom, 'get').mockResolvedValue(undefined);
      mockGetTwapStates.mockResolvedValue(undefined);
      const { store, result } = setup();
      store.set(activeTradeInstrumentAtom(), {
        mode: 'perp',
        coin: 'BTC',
        assetId: 0,
        universe: undefined,
      });
      store.set(tradingFormEnvAtom(), { markPrice: '100', szDecimals: 3 });
      const triggerPrice = advanced ? '110' : '';
      const stopPrice = advanced ? '120' : '';
      mockPlaceTwapOrder.mockClear().mockResolvedValue({ status: 'ok' });
      await act(async () =>
        result.current.current.placeTwapOrder({
          assetId: 0,
          triggerAbove: advanced ? true : undefined,
          formData: {
            ...store.get(tradingFormAtom()),
            orderMode: 'twap',
            size: '1',
            twapDurationMinutes: '5',
            twapTriggerPrice: triggerPrice,
            twapStopPrice: stopPrice,
          },
        }),
      );
      expect(mockPlaceTwapOrder).toHaveBeenCalledWith({
        assetId: 0,
        isBuy: true,
        size: '1',
        reduceOnly: false,
        minutes: 5,
        randomize: true,
        triggerPrice,
        triggerAbove: advanced ? true : undefined,
        stopPrice,
        referencePrice: '100',
        markPrice: '100',
        szDecimals: 3,
      });
    },
  );

  it.each([
    ['its own token', 'BTC', true, 0],
    ['another token', 'SOL', false, 0],
    ['the original token but the submitted asset changed', 'BTC', false, 5],
  ] as const)(
    'submits an order only while the market the background holds is on %s',
    async (_label, marketCoin, isSubmitted, requestedAssetId) => {
      // As after another extension tab took the market: the page still shows
      // BTC, while the price and sizes in the shared atoms are SOL's.
      jest.spyOn(tradingModeAtom, 'get').mockResolvedValue('perp');
      jest.spyOn(perpsActiveAssetAtom, 'get').mockResolvedValue({
        coin: marketCoin,
        assetId: marketCoin === 'BTC' ? 0 : 5,
        universe: undefined,
        margin: undefined,
      });
      jest.spyOn(perpsActiveAssetCtxAtom, 'get').mockResolvedValue(undefined);
      jest.spyOn(perpsActiveAssetDataAtom, 'get').mockResolvedValue(undefined);
      jest.spyOn(spotActiveAssetAtom, 'get').mockResolvedValue({
        coin: '',
        assetId: undefined,
        universe: undefined,
      });
      jest.spyOn(spotActiveAssetCtxAtom, 'get').mockResolvedValue(undefined);
      mockGetTwapStates.mockResolvedValue(undefined);
      const { store, result } = setup();
      store.set(activeTradeInstrumentAtom(), {
        mode: 'perp',
        coin: 'BTC',
        assetId: 0,
        universe: undefined,
      });
      store.set(tradingFormEnvAtom(), { markPrice: '100', szDecimals: 3 });
      mockPlaceTwapOrder.mockClear().mockResolvedValue({ status: 'ok' });

      let failure: unknown;
      await act(async () => {
        try {
          await result.current.current.submitOrder({
            assetId: requestedAssetId,
            price: '100',
            formData: {
              ...store.get(tradingFormAtom()),
              orderMode: 'twap',
              size: '1',
              twapDurationMinutes: '5',
            },
          });
        } catch (error) {
          failure = error;
        }
      });

      expect(mockPlaceTwapOrder).toHaveBeenCalledTimes(isSubmitted ? 1 : 0);
      expect(failure === undefined).toBe(isSubmitted);
      await waitFor(() => {
        expect(Toast.error).toHaveBeenCalledTimes(isSubmitted ? 0 : 1);
        expect(Toast.success).toHaveBeenCalledTimes(isSubmitted ? 1 : 0);
      });
    },
  );

  it('turns an order down when the market moves on before its sizes are read', async () => {
    const asset = (coin: string, assetId: number) => ({
      coin,
      assetId,
      universe: undefined,
      margin: undefined,
    });
    jest.spyOn(tradingModeAtom, 'get').mockResolvedValue('perp');
    // BTC when the order is confirmed; another extension tab has the market
    // on SOL by the time the order reads what its size is computed from.
    jest
      .spyOn(perpsActiveAssetAtom, 'get')
      .mockResolvedValueOnce(asset('BTC', 0))
      .mockResolvedValue(asset('SOL', 5));
    jest.spyOn(perpsActiveAssetCtxAtom, 'get').mockResolvedValue(undefined);
    jest.spyOn(perpsActiveAssetDataAtom, 'get').mockResolvedValue(undefined);
    jest.spyOn(spotActiveAssetAtom, 'get').mockResolvedValue({
      coin: '',
      assetId: undefined,
      universe: undefined,
    });
    jest.spyOn(spotActiveAssetCtxAtom, 'get').mockResolvedValue(undefined);
    mockGetTwapStates.mockResolvedValue(undefined);
    const { store, result } = setup();
    store.set(activeTradeInstrumentAtom(), {
      mode: 'perp',
      coin: 'BTC',
      assetId: 0,
      universe: undefined,
    });
    store.set(tradingFormEnvAtom(), { markPrice: '100', szDecimals: 3 });
    mockPlaceTwapOrder.mockClear().mockResolvedValue({ status: 'ok' });

    let failure: unknown;
    await act(async () => {
      try {
        await result.current.current.submitOrder({
          assetId: 0,
          price: '100',
          formData: {
            ...store.get(tradingFormAtom()),
            orderMode: 'twap',
            size: '1',
            twapDurationMinutes: '5',
          },
        });
      } catch (error) {
        failure = error;
      }
    });

    expect(failure).toBeDefined();
    expect(mockPlaceTwapOrder).not.toHaveBeenCalled();
    await waitFor(() => expect(Toast.error).toHaveBeenCalledTimes(1));
    expect(Toast.success).not.toHaveBeenCalled();
  });

  it.each(['102', undefined])(
    'keeps spot sizing at mid and forwards the current mark: %s',
    async (markPrice) => {
      jest.spyOn(perpsActiveAssetAtom, 'get').mockResolvedValue({
        coin: 'BTC',
        assetId: 0,
        universe: undefined,
        margin: undefined,
      });
      jest.spyOn(perpsActiveAssetCtxAtom, 'get').mockResolvedValue(undefined);
      jest.spyOn(perpsActiveAssetDataAtom, 'get').mockResolvedValue(undefined);
      jest.spyOn(spotActiveAssetCtxAtom, 'get').mockResolvedValue({
        coin: '@1',
        assetId: 10_001,
        ctx: {
          ...formatSpotAssetCtx(null),
          midPrice: '100',
          markPrice: markPrice ?? '0',
        },
      });
      const { store, result } = setup();
      store.set(activeTradeInstrumentAtom(), {
        mode: 'spot',
        coin: '@1',
        assetId: 10_001,
        universe: undefined,
      });
      store.set(tradingFormEnvAtom(), {
        markPrice: '100',
        szDecimals: 2,
        maxTradeSzs: ['2', '2'],
      });
      mockGetTwapStates.mockResolvedValue(undefined);
      mockPlaceTwapOrder.mockClear().mockResolvedValue({ status: 'ok' });
      await act(async () =>
        result.current.current.placeTwapOrder({
          assetId: 10_001,
          price: '100',
          formData: {
            ...store.get(tradingFormAtom()),
            orderMode: 'twap',
            sizeInputMode: EPerpsSizeInputMode.SLIDER,
            sizePercent: 50,
            twapDurationMinutes: '5',
          },
        }),
      );
      expect(mockPlaceTwapOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          size: '1',
          referencePrice: '100',
          markPrice: markPrice ?? '0',
        }),
      );
    },
  );

  it('forwards TWAP account binding and removes the canceled order', async () => {
    mockCancelTwapOrder.mockReset().mockResolvedValue({ status: 'ok' });
    mockGetTwapStates.mockResolvedValue(undefined);
    const { store, result, existingOrders } = setup();
    await act(async () =>
      result.current.current.cancelTwapOrder({
        assetId: 0,
        twapId: 1,
        expectedAccountAddress: accountAddress,
      }),
    );
    expect(mockCancelTwapOrder).toHaveBeenCalledWith(
      { assetId: 0, twapId: 1 },
      { expectedAccountAddress: accountAddress },
    );
    expect(store.get(perpsActiveTwapOrdersAtom()).twapOrders).toEqual([
      existingOrders[1],
    ]);
  });

  it('preserves the new account orders when a TWAP cancel finishes after switching', async () => {
    const pending = createDeferred<unknown>();
    mockCancelTwapOrder.mockReset().mockReturnValue(pending.promise);
    const { store, result, existingOrders } = setup();
    const canceling = result.current.current.cancelTwapOrder({
      assetId: 0,
      twapId: 1,
      expectedAccountAddress: accountAddress,
    });
    await waitFor(() => expect(mockCancelTwapOrder).toHaveBeenCalledTimes(1));
    jest.spyOn(perpsActiveAccountAtom, 'get').mockResolvedValue({
      ...activeAccount,
      accountAddress: '0xdef0',
    });
    const newOrders = existingOrders.map((order) => ({
      ...order,
      state: { ...order.state, user: '0xdef0' as const },
    }));
    store.set(perpsActiveTwapOrdersAtom(), {
      accountAddress: '0xdef0',
      twapOrders: newOrders,
      twapOrdersByCoin: {},
    });
    await act(async () => {
      pending.resolve({ status: 'ok' });
      await canceling;
    });
    expect(store.get(perpsActiveTwapOrdersAtom()).twapOrders).toEqual(
      newOrders,
    );
  });

  it('accepts checksum-cased identity and preserves other-dex orders', async () => {
    mockGetTwapStates.mockResolvedValue({
      user: '0xAbCd',
      twapStates: [[3, state]],
    });
    const { store, result } = setup();
    await act(async () => result.current.current.loadTwapData());
    const orders = store.get(perpsActiveTwapOrdersAtom());
    expect(orders.accountAddress).toBe(accountAddress);
    expect(orders.twapOrders.map((order) => order.twapId)).toEqual([3, 2]);
    expect(mockGetTwapStates).toHaveBeenCalledWith({ user: accountAddress });
  });

  it('removes default-dex orders for a successful empty response', async () => {
    mockGetTwapStates.mockResolvedValue({
      user: accountAddress,
      twapStates: [],
    });
    const { store, result } = setup();
    await act(async () => result.current.current.loadTwapData());
    expect(store.get(perpsActiveTwapOrdersAtom()).twapOrders).toEqual([
      { twapId: 2, state: { ...state, coin: 'xyz:BTC' }, dex: 'xyz' },
    ]);
  });

  it('preserves current-account orders on request failure', async () => {
    mockGetTwapStates.mockRejectedValue(
      new OneKeyLocalError('TWAP unavailable'),
    );
    const { store, result, existingOrders } = setup();
    await act(async () => result.current.current.loadTwapData());
    expect(store.get(perpsActiveTwapOrdersAtom()).twapOrders).toEqual(
      existingOrders,
    );
  });

  it('does not apply a response after the active account changes', async () => {
    const pending =
      createDeferred<Pick<HL.IWsWebData2, 'user' | 'twapStates'>>();
    mockGetTwapStates.mockReturnValue(pending.promise);
    const { store, result, existingOrders } = setup();
    const loading = result.current.current.loadTwapData();
    await waitFor(() => expect(mockGetTwapStates).toHaveBeenCalledTimes(1));
    jest.spyOn(perpsActiveAccountAtom, 'get').mockResolvedValue({
      ...activeAccount,
      accountAddress: '0xdef0',
    });
    await act(async () => {
      pending.resolve({ user: accountAddress, twapStates: [[3, state]] });
      await loading;
    });
    expect(store.get(perpsActiveTwapOrdersAtom()).twapOrders).toEqual(
      existingOrders,
    );
  });
});

describe('useHyperliquidActions.chaseOrder', () => {
  const accountAddress = '0xabcd';

  afterEach(() => jest.restoreAllMocks());

  function setup(overrides: Partial<HL.IPerpsFrontendOrder> = {}) {
    jest.spyOn(perpsActiveAccountAtom, 'get').mockResolvedValue({
      accountId: null,
      indexedAccountId: null,
      deriveType: 'default',
      accountAddress,
    });
    const order: HL.IPerpsFrontendOrder = {
      coin: 'BTC',
      oid: 1,
      orderType: 'Limit',
      tif: 'Alo',
      side: 'B',
      limitPx: '100',
      sz: '0.25',
      origSz: '1',
      reduceOnly: false,
      isTrigger: false,
      isPositionTpsl: false,
      triggerCondition: '',
      triggerPx: '0',
      timestamp: 1,
      cloid: null,
      children: [],
      ...overrides,
    };
    const store = createStore();
    store.set(perpsActiveOpenOrdersAtom(), {
      accountAddress,
      openOrders: [order],
      openOrdersByCoin: { BTC: [order] },
    });
    mockAmendOrderPriceByOid.mockReset().mockResolvedValue({
      status: 'ok',
      response: { type: 'default' },
    });
    jest.mocked(Toast.success).mockClear();
    jest.mocked(Toast.error).mockClear();
    const { result } = renderHook(() => useHyperliquidActions(), {
      wrapper: createWrapper(store),
    });
    return { result, order };
  }

  it.each([
    ['Alo', '100.00', false],
    ['Gtc', '100.00', true],
    ['Alo', '101', true],
  ] as const)(
    'chases %s at %s only when price or TIF changes',
    async (tif, newPrice, shouldAmend) => {
      const { result, order } = setup({ tif });
      await act(async () => {
        await result.current.current.chaseOrder({
          coin: order.coin,
          oid: order.oid,
          newPrice,
          expectedAccountAddress: accountAddress,
        });
      });

      expect(mockAmendOrderPriceByOid).toHaveBeenCalledTimes(
        shouldAmend ? 1 : 0,
      );
      expect(Toast.success).toHaveBeenCalledTimes(shouldAmend ? 1 : 0);
      if (shouldAmend) {
        expect(mockAmendOrderPriceByOid).toHaveBeenCalledWith(
          expect.objectContaining({
            newPrice,
            amendKind: { kind: 'limit', tif: 'Alo' },
          }),
        );
      }
    },
  );

  it.each(['ineligible order', 'changed account', 'lookup failure'])(
    'reports %s even when an ALO order has the target price',
    async (scenario) => {
      const { result, order } = setup(
        scenario === 'ineligible order' ? { sz: '0' } : {},
      );
      if (scenario === 'lookup failure') {
        jest
          .mocked(perpsActiveAccountAtom.get)
          .mockRejectedValueOnce(new OneKeyLocalError('Order lookup failed'));
      }
      await expect(
        result.current.current.chaseOrder({
          coin: order.coin,
          oid: order.oid,
          newPrice: '100.00',
          expectedAccountAddress:
            scenario === 'changed account' ? '0xdef0' : accountAddress,
        }),
      ).rejects.toThrow();

      await waitFor(() => expect(Toast.error).toHaveBeenCalledTimes(1));
      expect(Toast.success).not.toHaveBeenCalled();
      expect(mockAmendOrderPriceByOid).not.toHaveBeenCalled();
    },
  );
});

describe('reviewed trading account propagation', () => {
  beforeEach(() => {
    jest.spyOn(tradingModeAtom, 'get').mockResolvedValue('perp');
    jest
      .spyOn(spotActiveAssetAtom, 'get')
      .mockResolvedValue({ coin: '', assetId: undefined, universe: undefined });
    jest.spyOn(spotActiveAssetCtxAtom, 'get').mockResolvedValue(undefined);
    jest.spyOn(perpsActiveAssetAtom, 'get').mockResolvedValue({
      coin: 'BTC',
      assetId: 0,
      universe: undefined,
      margin: undefined,
    });
    jest.spyOn(perpsActiveAssetCtxAtom, 'get').mockResolvedValue(undefined);
    jest.spyOn(perpsActiveAssetDataAtom, 'get').mockResolvedValue(undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  it.each(['simple', 'pro', undefined] as const)(
    'forwards the confirmed account and UI mode %s through standard order submission',
    async (tradingUiMode) => {
      const store = createStore();
      store.set(activeTradeInstrumentAtom(), {
        mode: 'perp',
        coin: 'BTC',
        assetId: 0,
        universe: undefined,
      });
      const { result } = renderHook(() => useHyperliquidActions(), {
        wrapper: createWrapper(store),
      });
      await act(async () => {
        await result.current.current.submitOrder({
          assetId: 0,
          price: '50000',
          expectedAccountAddress: '0xconfirmed',
          tradingUiMode,
          formData: { ...store.get(tradingFormAtom()), size: '0.1' },
        });
      });
      expect(mockOrderOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedAccountAddress: '0xconfirmed',
          tradingUiMode: tradingUiMode ?? 'pro',
        }),
      );
    },
  );

  it.each([
    ['disablePerpActionPerp', 'market'],
    ['disablePerpActionPerp', 'limit'],
    ['ipDisablePerp', 'market'],
    ['ipDisablePerp', 'limit'],
  ] as const)(
    'blocks %s on a reviewed %s order before confirmation',
    async (flag, type) => {
      const store = createStore();
      store.set(activeTradeInstrumentAtom(), {
        mode: 'perp',
        coin: 'BTC',
        assetId: 0,
        universe: undefined,
      });
      const { result } = renderHook(() => useHyperliquidActions(), {
        wrapper: createWrapper(store),
      });
      const reviewedForm = {
        ...store.get(tradingFormAtom()),
        type,
        size: '0.1',
      };
      jest
        .spyOn(perpsCommonConfigPersistAtom, 'get')
        .mockResolvedValue({ perpConfigCommon: { [flag]: true } });
      mockOrderOpen.mockClear();
      await act(async () => {
        await expect(
          result.current.current.submitOrder({
            assetId: 0,
            price: '50000',
            tradingUiMode: 'simple',
            formData: reviewedForm,
          }),
        ).rejects.toThrow();
      });
      expect(mockOrderOpen).not.toHaveBeenCalled();
    },
  );

  it('forwards the position owner through close submission', async () => {
    const { result } = renderHook(() => useHyperliquidActions(), {
      wrapper: createWrapper(),
    });
    const orders = [{ assetId: 0, isBuy: true, size: '0.1', midPx: '100' }];
    await act(async () =>
      result.current.current.ordersClose(orders, {
        expectedAccountAddress: '0xconfirmed',
        tradingUiMode: 'simple',
      }),
    );
    expect(mockOrdersClose).toHaveBeenCalledWith(orders, {
      expectedAccountAddress: '0xconfirmed',
      tradingUiMode: 'simple',
    });
  });

  it('forwards the leverage dialog account separately from the SDK request', async () => {
    const { result } = renderHook(() => useHyperliquidActions(), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.current.updateLeverage({
        asset: 0,
        leverage: 5,
        isCross: true,
        expectedAccountAddress: '0xconfirmed',
      });
    });
    expect(mockUpdateLeverage).toHaveBeenCalledWith(
      { asset: 0, leverage: 5, isCross: true },
      { expectedAccountAddress: '0xconfirmed' },
    );
  });
});
