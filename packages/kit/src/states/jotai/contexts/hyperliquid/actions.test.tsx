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
  spotActiveAssetCtxAtom,
  tradingModeAtom,
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

import {
  capturePerpsInstrumentChangeGuard,
  useHyperliquidActions,
} from './actions';
import {
  ProviderJotaiContextHyperliquid,
  activeTradeInstrumentAtom,
  perpsActiveTwapOrdersAtom,
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
const mockGetTwapHistory = jest.fn<Promise<HL.ITwapHistoryRecord[]>, []>();
const mockGetTwapSliceFills = jest.fn<Promise<HL.ITwapSliceFill[]>, []>();
const mockCancelTwapOrder = jest.fn<Promise<unknown>, unknown[]>();
const mockPlaceTwapOrder = jest.fn<Promise<unknown>, [IPlaceTwapOrderParams]>();
const mockCancelPendingActiveAssetChange = jest.fn<Promise<void>, []>();
const mockChangeActiveAsset = jest.fn<
  ReturnType<typeof perpsActiveAssetAtom.get>,
  [{ coin: string }]
>();
const mockGetSpotMeta = jest.fn<Promise<{ universes: [] }>, []>();
const mockUpdateSubscriptions = jest.fn<Promise<void>, []>();
const mockRecoverSubscriptionsAfterLivenessProof = jest.fn<
  Promise<boolean>,
  [{ disabledCount: number }]
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
      cancelTwapOrder: (...args: unknown[]) => mockCancelTwapOrder(...args),
      orderOpen: (...args: unknown[]) => mockOrderOpen(...args),
      updateLeverage: (...args: unknown[]) => mockUpdateLeverage(...args),
      placeTwapOrder: (params: IPlaceTwapOrderParams) =>
        mockPlaceTwapOrder(params),
    },
    serviceHyperliquid: {
      cancelPendingActiveAssetChange: () =>
        mockCancelPendingActiveAssetChange(),
      changeActiveAsset: (params: { coin: string }) =>
        mockChangeActiveAsset(params),
      getSpotMeta: () => mockGetSpotMeta(),
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

it('invalidates a captured instrument guard as soon as a real UI switch starts', async () => {
  let stop!: (error: Error) => void;
  mockCancelPendingActiveAssetChange.mockImplementationOnce(
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
    mockCancelPendingActiveAssetChange.mockImplementationOnce(
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
      coin: '',
      assetId: undefined,
      universe: undefined,
      margin: undefined,
    };
    mockCancelPendingActiveAssetChange.mockReset().mockResolvedValue();
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
      ).toBe(true);
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
      ).toBe(true);
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
      expect(await switching).toBe(true);
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
      ).toBe(true);
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
      expect(await switching).toBe(true);
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
    const pending = createDeferred<{ universes: [] }>();
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

describe('reviewed trading account propagation', () => {
  beforeEach(() => {
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
  it('forwards the confirmed account through standard order submission', async () => {
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
        formData: { ...store.get(tradingFormAtom()), size: '0.1' },
      });
    });
    expect(mockOrderOpen).toHaveBeenCalledWith(
      expect.objectContaining({ expectedAccountAddress: '0xconfirmed' }),
    );
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
