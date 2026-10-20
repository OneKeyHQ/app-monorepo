/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

// OK-64029: the perps tab's empty state hard-coded "$0.00" for the account
// value, so switching the display currency (e.g. to CNY) left the perps total
// in USD while every other home tab followed the new symbol. The empty state
// must format its zero total through the same currency-aware path as the
// ready state.

import type { ReactNode } from 'react';

type IBoxProps = {
  children?: ReactNode;
  testID?: string;
  onPress?: () => void;
};

const mockSettings = {
  currencyInfo: { id: 'cny', symbol: '¥' },
  hideValue: false,
};
const mockPerpsSettings = {
  hideSmallSpotHoldings: false,
  mobileTradingMode: 'pro',
};
const mockMedia = { gtMd: false };
let mockFocused = true;
let mockAccountId = 'test-account';
const mockBlurListeners = new Set<() => void>();
const mockRouteNavigation = {
  isFocused: () => mockFocused,
  addListener: (_event: string, listener: () => void) => {
    mockBlurListeners.add(listener);
    return () => mockBlurListeners.delete(listener);
  },
};
const mockDeriveType = jest.fn(async () => 'default');
const mockSetPendingInstrument = jest.fn(async (_params: unknown) => undefined);
const mockClearPendingInstrument = jest.fn(
  async (_params: unknown) => undefined,
);
const mockToastError = jest.fn();
const mockNavigation = {
  push: jest.fn(),
  pushModal: jest.fn(),
  switchTab: jest.fn(),
};
const mockChangeActiveAsset = jest.fn(async (_params: unknown) => undefined);
const mockChangeAccount = jest.fn(async (_params: unknown) => ({
  accountAddress: 'test-address',
}));
type ISettingsUpdate =
  | typeof mockPerpsSettings
  | ((previous: typeof mockPerpsSettings) => typeof mockPerpsSettings);
const mockSetSettings = jest.fn(async (settings: ISettingsUpdate) => {
  Object.assign(
    mockPerpsSettings,
    typeof settings === 'function' ? settings(mockPerpsSettings) : settings,
  );
});
const mockPortfolio: {
  viewState: 'empty' | 'ready';
  view?: IPerpsHomeView;
} = { viewState: 'empty' };
let mockHasAccount = false;
let mockHotTokens: { name: string; displayName: string }[] = [];

jest.mock('@react-navigation/core', () => ({
  useNavigation: () => mockRouteNavigation,
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {
    toastIfError: (error: unknown) => {
      mockToastError(error);
    },
  },
}));
jest.mock('react-native', () => ({
  StyleSheet: { hairlineWidth: 1 },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const { numberFormat } =
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('@onekeyhq/shared/src/utils/numberUtils') as typeof import('@onekeyhq/shared/src/utils/numberUtils');
  const Box = ({ children, testID, onPress }: IBoxProps) =>
    onPress ? (
      <div
        role="button"
        tabIndex={0}
        data-testid={testID}
        onClick={onPress}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onPress();
        }}
      >
        {children}
      </div>
    ) : (
      <div data-testid={testID}>{children}</div>
    );
  const Text = ({ children }: IBoxProps) => <span>{children}</span>;
  const Nothing = () => null;
  return {
    Badge: Box,
    Button: Box,
    DashText: Text,
    Icon: Nothing,
    Image: Nothing,
    NumberSizeableText: ({
      children,
      formatter,
      formatterOptions,
    }: INumberFormatProps & { children: string | number | undefined }) => (
      <span>
        {numberFormat(String(children), { formatter, formatterOptions })}
      </span>
    ),
    SizableText: Text,
    Skeleton: {
      BodySm: Nothing,
      BodyMd: Nothing,
      BodyLg: Nothing,
      HeadingXl: Nothing,
    },
    Stack: Box,
    XStack: Box,
    YStack: Box,
    rootNavigationRef: { current: undefined },
    useMedia: () => mockMedia,
    useScrollContentTabBarOffset: () => 0,
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: () => mockDeriveType(),
    },
    serviceHyperliquid: {
      changeActivePerpsAccount: (params: unknown) => mockChangeAccount(params),
      changeActiveAsset: (params: unknown) => mockChangeActiveAsset(params),
      setPendingInitialTradeInstrument: (params: unknown) =>
        mockSetPendingInstrument(params),
      clearPendingInitialTradeInstrument: (params: unknown) =>
        mockClearPendingInstrument(params),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      account: mockHasAccount ? { id: mockAccountId } : undefined,
      indexedAccount: undefined,
      wallet: undefined,
    },
  }),
}));
jest.mock('@onekeyhq/kit/src/views/Market/components/PerpsBadges', () => ({
  LeverageBadge: () => null,
  PerpDexBadge: () => null,
  SubtitleText: () => null,
}));
jest.mock('@onekeyhq/kit/src/views/Market/hooks', () => ({
  useNavigateToMarketTab: () => jest.fn(),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketPerpsList/hooks/useMarketPerpsTokenList',
  () => ({
    useMarketPerpsTokenList: () => ({
      tokens: mockHotTokens,
      isLoading: false,
    }),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Perp/components/OrderInfoPanel/utils',
  () => ({
    isSpotHoldingVisible: () => true,
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Perp/hooks/useShowDepositWithdrawModal',
  () => ({
    useShowDepositWithdrawModal: () => ({
      showDepositWithdrawModal: jest.fn(),
    }),
  }),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  perpsCustomSettingsAtom: {
    ready: jest.fn(async () => undefined),
    get: jest.fn(async () => mockPerpsSettings),
    set: (settings: ISettingsUpdate) => mockSetSettings(settings),
  },
  perpsPendingInfoPanelTabAtom: { set: jest.fn(async () => undefined) },
  spotActiveAssetAtom: { set: jest.fn(async () => undefined) },
  tradingModeAtom: { set: jest.fn(async () => undefined) },
  useCurrencyPersistAtom: () => [{ currencyMap: {} }],
  usePerpsCustomSettingsAtom: () => [mockPerpsSettings],
  useSettingsPersistAtom: () => [mockSettings],
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isNativeAndroid: false },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    PerpSwitchActiveInstrument: 'PerpSwitchActiveInstrument',
    PerpSwitchInfoPanelTab: 'PerpSwitchInfoPanelTab',
  },
  appEventBus: { emit: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/logger/scopes/perp/perpPageSource', () => ({
  EPerpPageEnterSource: {},
  setPerpPageEnterSource: jest.fn(),
}));
jest.mock('../components/DeFiListBlock/DeFiOverviewLayout', () => ({
  OVERVIEW_TILE_SHADOW: {},
  buildOverviewGridStyle: () => ({}),
}));
jest.mock('../components/HomeScrollView', () => ({
  HomeScrollView: ({ children }: IBoxProps) => <>{children}</>,
}));
jest.mock('../components/PullToRefresh', () => ({
  PullToRefresh: () => null,
  onHomePageRefresh: jest.fn(),
}));
jest.mock('../components/RichBlock', () => ({
  RichBlock: ({
    title,
    subTitle,
    headerActions,
    content,
  }: {
    title?: ReactNode;
    subTitle?: ReactNode;
    headerActions?: ReactNode;
    content?: ReactNode;
  }) => (
    <div>
      {title}
      {subTitle}
      {headerActions}
      {content}
    </div>
  ),
}));
jest.mock('../components/SupportHub/SupportHub', () => ({
  SupportHub: () => null,
}));
jest.mock('../components/Upgrade/Upgrade', () => ({
  Upgrade: () => null,
}));
jest.mock('./perpsChainTrace', () => ({ debugPerpsChain: jest.fn() }));
jest.mock('./usePerpsHomePortfolio', () => ({
  usePerpsHomePortfolio: () => ({
    ...mockPortfolio,
    canDeposit: true,
    isDepositDisabled: false,
  }),
}));

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IPerpsHomeView } from '@onekeyhq/shared/src/utils/perpsHomeViewUtils';

import { PerpsContainer } from './PerpsContainer';

const mockPlatform = platformEnv as {
  isNative: boolean;
  isNativeAndroid: boolean;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSettings.hideValue = false;
  mockPortfolio.viewState = 'empty';
  mockPortfolio.view = undefined;
  mockPerpsSettings.mobileTradingMode = 'pro';
  mockMedia.gtMd = false;
  mockPlatform.isNative = false;
  mockHasAccount = false;
  mockFocused = true;
  mockAccountId = 'test-account';
  mockHotTokens = [];
});

/*
yarn jest packages/kit/src/views/Home/pages/PerpsContainer.emptyStateCurrency.test.tsx
*/

describe('PerpsContainer empty state account value', () => {
  afterEach(() => {
    mockSettings.currencyInfo = { id: 'cny', symbol: '¥' };
  });

  it('formats the zero total in the selected currency', () => {
    render(<PerpsContainer />);

    // Both the mobile summary row and the desktop RichBlock subtitle render
    // (the layout is toggled by display media props), so each must follow
    // the selected currency symbol.
    expect(screen.queryByText('$0.00')).toBeNull();
    expect(screen.getAllByText('¥0.00')).toHaveLength(2);
  });

  it('keeps the dollar form while USD is selected', () => {
    mockSettings.currencyInfo = { id: 'usd', symbol: '$' };

    render(<PerpsContainer />);

    expect(screen.getAllByText('$0.00')).toHaveLength(2);
  });
});

describe('PerpsContainer mobile trading mode', () => {
  beforeEach(() => {
    mockHasAccount = true;
    mockPerpsSettings.mobileTradingMode = 'simple';
    mockPortfolio.viewState = 'ready';
    mockPortfolio.view = {
      isEmpty: false,
      isDegraded: false,
      accountValueUsd: 20.78,
      holdings: [],
      positions: [
        {
          coin: 'xyz:GOOGL',
          side: 'short',
          leverageType: 'cross',
          leverageValue: 20,
          pnlUsd: -0.1,
          roi: -0.024,
          sizeCoin: '0.0341',
          marginUsd: 4.07,
          entryPx: '2385.9',
          fundingUsd: 0,
          markPx: '2388.8',
          liqPx: '2921.5',
        },
      ],
    };
  });

  it.each([
    [true, false],
    [true, true],
    [false, false],
  ])(
    'opens a simple position for native=%s and wide=%s',
    async (native, wide) => {
      mockPlatform.isNative = native;
      mockMedia.gtMd = wide;
      render(<PerpsContainer />);
      expect(screen.getAllByText(ETranslations.global_manage)).toHaveLength(2);
      fireEvent.click(
        screen.getAllByText(ETranslations.global_manage)[wide ? 0 : 1],
      );
      await waitFor(() =>
        expect(mockNavigation.pushModal).toHaveBeenCalledWith(
          EModalRoutes.PerpModal,
          {
            screen: EModalPerpRoutes.MobilePerpSimpleMarket,
            params: {
              coin: 'xyz:GOOGL',
              initialPortfolioTab: 'positions',
            },
          },
        ),
      );
      expect(mockChangeActiveAsset).toHaveBeenCalledWith({
        coin: 'xyz:GOOGL',
      });
      expect(mockNavigation.switchTab).toHaveBeenCalledWith(ETabRoutes.Perp);
    },
  );

  it.each([
    ['simple', true],
    ['pro', false],
  ] as const)(
    'keeps professional navigation for mode=%s and wide=%s',
    async (mode, wide) => {
      mockPerpsSettings.mobileTradingMode = mode;
      mockMedia.gtMd = wide;
      render(<PerpsContainer />);
      fireEvent.click(
        screen.getAllByText(ETranslations.global_manage)[wide ? 0 : 1],
      );
      await waitFor(() =>
        expect(mockNavigation.switchTab).toHaveBeenCalledWith(ETabRoutes.Perp),
      );
      expect(mockNavigation.pushModal).not.toHaveBeenCalled();
    },
  );

  it('ignores repeated presses across Home entry points while an account switch is pending', async () => {
    let finish!: (value: { accountAddress: string }) => void;
    mockChangeAccount.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    mockHotTokens = [{ name: 'BTC', displayName: 'BTC' }];
    render(<PerpsContainer />);
    fireEvent.click(screen.getAllByText(ETranslations.global_manage)[1]);
    await waitFor(() => expect(mockChangeAccount).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getAllByText(ETranslations.global_manage)[1]);
    fireEvent.click(screen.getAllByText('BTC')[0]);
    await act(async () => {
      finish({ accountAddress: 'test-address' });
    });
    expect(mockChangeAccount).toHaveBeenCalledTimes(1);
    expect(mockNavigation.pushModal).toHaveBeenCalledTimes(1);
    expect(mockChangeActiveAsset).toHaveBeenCalledWith({ coin: 'xyz:GOOGL' });
  });

  it.each(['blur', 'unmount', 'account change'])(
    'cancels before switching the account after %s',
    async (reason) => {
      let finish!: (value: string) => void;
      mockDeriveType.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const { unmount, rerender } = render(<PerpsContainer />);
      fireEvent.click(screen.getAllByText(ETranslations.global_manage)[1]);
      await waitFor(() => expect(mockDeriveType).toHaveBeenCalled());
      if (reason === 'blur') {
        // Returning before the RPC resolves must not revive the old request.
        act(() => {
          mockBlurListeners.forEach((listener) => listener());
        });
      } else if (reason === 'unmount') {
        unmount();
      } else {
        mockAccountId = 'another-account';
        rerender(<PerpsContainer />);
      }
      await act(async () => {
        finish('default');
      });
      expect(mockChangeAccount).not.toHaveBeenCalled();
      expect(mockChangeActiveAsset).not.toHaveBeenCalled();
      expect(mockNavigation.switchTab).not.toHaveBeenCalled();
    },
  );

  it('does not write the asset or navigate if focus is lost during the account RPC', async () => {
    let finish!: (value: { accountAddress: string }) => void;
    mockChangeAccount.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<PerpsContainer />);
    fireEvent.click(screen.getAllByText(ETranslations.global_manage)[1]);
    await waitFor(() => expect(mockChangeAccount).toHaveBeenCalled());
    mockFocused = false;
    await act(async () => {
      finish({ accountAddress: 'test-address' });
    });
    expect(mockChangeActiveAsset).not.toHaveBeenCalled();
    expect(mockNavigation.switchTab).not.toHaveBeenCalled();
  });

  it('clears only its pending instrument when navigation is cancelled', async () => {
    let finish!: (value: undefined) => void;
    mockSetPendingInstrument.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<PerpsContainer />);
    fireEvent.click(screen.getAllByText(ETranslations.global_manage)[1]);
    await waitFor(() => expect(mockSetPendingInstrument).toHaveBeenCalled());
    mockFocused = false;
    await act(async () => {
      finish(undefined);
    });
    const target = mockSetPendingInstrument.mock.calls[0][0] as {
      requestId: string;
    };
    expect(mockClearPendingInstrument).toHaveBeenCalledWith({
      requestId: target.requestId,
    });
    expect(mockNavigation.switchTab).not.toHaveBeenCalled();
  });

  it('handles account failures and allows a subsequent retry', async () => {
    const error = new Error('Account switch failed');
    mockChangeAccount.mockRejectedValueOnce(error);
    render(<PerpsContainer />);
    await act(async () => {
      fireEvent.click(screen.getAllByText(ETranslations.global_manage)[1]);
    });
    expect(mockToastError).toHaveBeenCalledWith(error);
    expect(mockNavigation.switchTab).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByText(ETranslations.global_manage)[1]);
    await waitFor(() =>
      expect(mockNavigation.pushModal).toHaveBeenCalledTimes(1),
    );
  });

  it('opens a hot market in simple mode even when no market page was requested by the legacy entry', async () => {
    mockHotTokens = [{ name: 'BTC', displayName: 'BTC' }];
    render(<PerpsContainer />);
    fireEvent.click(screen.getAllByText('BTC')[0]);
    await waitFor(() =>
      expect(mockNavigation.pushModal).toHaveBeenCalledWith(
        EModalRoutes.PerpModal,
        {
          screen: EModalPerpRoutes.MobilePerpSimpleMarket,
          params: { coin: 'BTC' },
        },
      ),
    );
  });

  it('does not navigate when the home account is unavailable', async () => {
    mockHasAccount = false;
    render(<PerpsContainer />);
    await act(async () => {
      fireEvent.click(screen.getAllByText(ETranslations.global_manage)[1]);
    });
    expect(mockNavigation.pushModal).not.toHaveBeenCalled();
    expect(mockChangeActiveAsset).not.toHaveBeenCalled();
  });

  it('keeps the professional manage entry on the Perps tab', async () => {
    mockPerpsSettings.mobileTradingMode = 'pro';
    render(<PerpsContainer />);
    fireEvent.click(screen.getAllByText(ETranslations.global_manage)[1]);
    await waitFor(() =>
      expect(mockNavigation.switchTab).toHaveBeenCalledWith(ETabRoutes.Perp),
    );
    expect(mockNavigation.pushModal).not.toHaveBeenCalled();
    expect(mockSetSettings).not.toHaveBeenCalled();
  });

  it('uses professional mode for spot holdings while preserving other settings', async () => {
    mockPortfolio.view = {
      isEmpty: false,
      isDegraded: false,
      accountValueUsd: 50,
      positions: [],
      holdings: [
        {
          symbol: 'HYPE',
          displaySymbol: 'HYPE',
          spotUniverseName: '@107',
          balance: '1',
          valueUsd: 50,
          pnlUsd: 1,
        },
      ],
    };
    render(<PerpsContainer />);
    fireEvent.click(screen.getAllByText('HYPE')[0]);
    await waitFor(() =>
      expect(mockNavigation.switchTab).toHaveBeenCalledWith(ETabRoutes.Perp),
    );
    expect(mockSetSettings).toHaveBeenCalledWith(expect.any(Function));
    expect(mockPerpsSettings).toEqual({
      hideSmallSpotHoldings: false,
      mobileTradingMode: 'pro',
    });
    expect(mockNavigation.pushModal).not.toHaveBeenCalled();
  });
});
