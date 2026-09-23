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
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IPerpsActiveAccountAtom,
  IPerpsActiveAccountStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useHyperliquidActions } from './actions';
import {
  ProviderJotaiContextHyperliquid,
  perpsActiveTwapOrdersAtom,
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
const mockGetTwapHistory = jest.fn<Promise<HL.ITwapHistoryRecord[]>, []>();
const mockGetTwapSliceFills = jest.fn<Promise<HL.ITwapSliceFill[]>, []>();

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
    },
    XStack: Container,
    YStack: Container,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
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
