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
  perpsActiveAssetDataAtom,
  spotActiveAssetCtxAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IPerpsActiveAccountAtom,
  IPerpsActiveAccountStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { formatSpotAssetCtx } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPlaceTwapOrderParams } from '@onekeyhq/shared/types/hyperliquid';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';
import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid/types';

import { useHyperliquidActions } from './actions';
import {
  ProviderJotaiContextHyperliquid,
  activeTradeInstrumentAtom,
  perpsActiveOpenOrdersAtom,
  perpsActivePositionAtom,
  perpsActiveTwapOrdersAtom,
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

describe('useHyperliquidActions position updates', () => {
  const accountA = '0x1111111111111111111111111111111111111111';
  const accountB = '0x2222222222222222222222222222222222222222';
  const btcPosition: HL.IPerpsAssetPosition = {
    type: 'oneWay',
    position: {
      coin: 'BTC',
      szi: '1',
      leverage: { type: 'cross', value: 2 },
      entryPx: '50000',
      positionValue: '50000',
      unrealizedPnl: '0',
      returnOnEquity: '0',
      liquidationPx: null,
      marginUsed: '25000',
      maxLeverage: 20,
      cumFunding: { allTime: '0', sinceOpen: '0', sinceChange: '0' },
    },
  };

  afterEach(() => jest.restoreAllMocks());

  it.each(['updateAllDexsClearinghouseState', 'updateWebData2'] as const)(
    '%s waits for live positions after a stale account frame',
    async (action) => {
      jest.spyOn(perpsActiveAccountAtom, 'get').mockResolvedValue({
        accountId: null,
        indexedAccountId: null,
        deriveType: 'default',
        accountAddress: accountB,
      });
      const store = createStore();
      store.set(perpsActivePositionAtom(), {
        accountAddress: accountA,
        activePositions: [btcPosition],
      });
      const { result } = renderHook(() => useHyperliquidActions(), {
        wrapper: createWrapper(store),
      });
      const updatePositions = (
        user: `0x${string}`,
        assetPositions: HL.IPerpsAssetPosition[],
      ) => {
        const margin = {
          accountValue: '50000',
          totalNtlPos: '50000',
          totalRawUsd: '50000',
          totalMarginUsed: '25000',
        };
        const clearinghouseState: HL.IPerpsClearinghouseState = {
          assetPositions,
          marginSummary: margin,
          crossMarginSummary: margin,
          crossMaintenanceMarginUsed: '0',
          withdrawable: '0',
          time: 1,
        };
        return act(async () => {
          if (action === 'updateAllDexsClearinghouseState') {
            await result.current.current.updateAllDexsClearinghouseState({
              user,
              clearinghouseStates: [['', clearinghouseState]],
            });
          } else {
            await result.current.current.updateWebData2({
              user,
              clearinghouseState,
              assetCtxs: [],
              openOrders: [],
              twapStates: [],
              leadingVaults: [],
              totalVaultEquity: '0',
              agentAddress: null,
              agentValidUntil: null,
              cumLedger: '0',
              meta: { universe: [], marginTables: [], collateralToken: 0 },
              serverTime: 1,
              isVault: false,
              spotAssetCtxs: [],
            });
          }
        });
      };
      const getPositions = () => store.get(perpsActivePositionAtom());

      await updatePositions(accountA, [btcPosition]);
      const pendingPositions = getPositions();
      expect(pendingPositions).toEqual({
        accountAddress: accountB,
        activePositions: [],
        isPending: true,
      });
      await updatePositions(accountA, [btcPosition]);
      expect(getPositions()).toBe(pendingPositions);

      const ethPosition = {
        ...btcPosition,
        position: { ...btcPosition.position, coin: 'ETH' },
      };
      await updatePositions(accountB, [ethPosition]);
      const currentPositions = getPositions();
      expect(currentPositions).toEqual({
        accountAddress: accountB,
        activePositions: [ethPosition],
      });
      await updatePositions(accountA, [btcPosition]);
      expect(getPositions()).toBe(currentPositions);

      store.set(perpsActivePositionAtom(), {
        accountAddress: undefined,
        activePositions: [],
      });
      await updatePositions(accountA, [btcPosition]);
      expect(getPositions()).toEqual(pendingPositions);

      await updatePositions(accountB, []);
      const emptyPositions = getPositions();
      expect(emptyPositions).toEqual({
        accountAddress: accountB,
        activePositions: [],
      });
      await updatePositions(accountA, [btcPosition]);
      expect(getPositions()).toBe(emptyPositions);
    },
  );
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
