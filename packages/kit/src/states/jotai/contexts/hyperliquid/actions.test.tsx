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
import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid/types';

import { useHyperliquidActions } from './actions';
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
const mockPlaceTwapOrder = jest.fn<Promise<unknown>, [IPlaceTwapOrderParams]>();
const mockChangeActiveAsset = jest.fn<
  Promise<unknown>,
  [{ coin: string; requestId?: number }]
>();
// The service's request ids, shared by the switches of every page.
let mockAssetChangeRequestId = 0;
// The perp asset the service holds once it is back on the last one loaded.
const mockLoadedPerpAsset = jest.fn<
  Promise<IPerpsActiveAssetAtom | undefined>,
  []
>();
type IMockRestoreParams = {
  requestId: number;
  spotAsset?: ISpotActiveAssetAtom;
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
      error: jest.fn(),
      success: jest.fn(),
      loading: jest.fn(() => ({ close: jest.fn() })),
    },
    XStack: Container,
    YStack: Container,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquidExchange: {
      placeTwapOrder: (params: IPlaceTwapOrderParams) =>
        mockPlaceTwapOrder(params),
      amendOrderPriceByOid: (...args: unknown[]) =>
        mockAmendOrderPriceByOid(...args),
    },
    serviceHyperliquid: {
      cancelPendingActiveAssetChange: async () => {
        mockAssetChangeRequestId += 1;
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
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
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
    // Sets the mode, with the spot token for spot, only while the switch
    // holds the market.
    const setModeWhileCurrent = async ({
      requestId,
      spotAsset,
    }: IMockRestoreParams) => {
      const isCurrent = () => requestId === mockAssetChangeRequestId;
      if (spotAsset) {
        await spotActiveAssetAtom.set(spotAsset);
        if (!isCurrent()) return false;
      }
      await tradingModeAtom.set(spotAsset ? 'spot' : 'perp');
      return isCurrent();
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
    mockSetActiveOrderBookOptions
      .mockReset()
      .mockImplementation(async ({ requestId, options }) => {
        if (requestId !== mockAssetChangeRequestId) {
          const marketCoin =
            (await tradingModeAtom.get()) === 'spot'
              ? (await spotActiveAssetAtom.get())?.coin
              : (await perpsActiveAssetAtom.get())?.coin;
          if (!marketCoin || marketCoin !== options.coin) return false;
        }
        await perpsActiveOrderBookOptionsAtom.set(options);
        return true;
      });
    // Puts the market back only while the failed switch holds it.
    mockRestoreActiveAssetAfterFailedChange
      .mockReset()
      .mockImplementation(async (params) => {
        const notRestored = { restored: false, perpAsset: undefined };
        const isCurrent = () => params.requestId === mockAssetChangeRequestId;
        if (!isCurrent()) return notRestored;
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
        // Given as a loss, which holds for any token.
        slValue: '10',
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
