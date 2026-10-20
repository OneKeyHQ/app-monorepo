/** @jest-environment jsdom */

import type { ComponentProps, PropsWithChildren } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import {
  prepareMarketSwapEntry,
  prepareStockSwapEntry,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/prepareSwapProEntry';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import {
  ESwapSource,
  ESwapTabSwitchType,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { SwapPanel } from './SwapPanel';

import type SwapPanelFooterButtons from './SwapPanelFooterButtons';

const mockPushModal = jest.fn();
const mockSwitchTab = jest.fn();
const mockDismissDetail = jest.fn();
const mockShowAccountSelector = jest.fn();
let mockActiveAccount: {
  account?: { id: string };
  indexedAccount?: { id: string };
} = {};
let mockSpeedConfigReady = true;
const mockFooter = jest.fn(
  (_props: ComponentProps<typeof SwapPanelFooterButtons>) => null,
);

const payToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};

jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: PropsWithChildren) => <>{children}</>;
  return {
    Button: ({
      children,
      disabled,
      onPress,
      testID,
      accessibilityLabel,
    }: PropsWithChildren<{
      disabled?: boolean;
      onPress?: () => void;
      testID?: string;
      accessibilityLabel?: string;
    }>) => (
      <button
        type="button"
        disabled={disabled}
        onClick={onPress}
        data-testid={testID}
        aria-label={accessibilityLabel}
      >
        {children}
      </button>
    ),
    Divider: Container,
    Icon: Container,
    SizableText: Container,
    Spinner: Container,
    Stack: Container,
    View: Container,
    XStack: Container,
    YStack: Container,
    usePageFooterSafeAreaBottom: () => 0,
    usePageFooterTabBarHeight: () => 0,
  };
});
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: PropsWithChildren) => (
    <>{children}</>
  ),
}));
jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger',
  () => ({
    useAccountSelectorTrigger: () => ({
      activeAccount: mockActiveAccount,
      showAccountSelector: mockShowAccountSelector,
    }),
  }),
);
jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  Currency: ({ children }: PropsWithChildren) => <>{children}</>,
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal, switchTab: mockSwitchTab }),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/utils/marketDetailNavigation',
  () => ({ dismissDiscoveryMarketDetailForTrade: mockDismissDetail }),
);
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/swap/prepareSwapProEntry',
  () => ({
    prepareStockSwapEntry: jest.fn(),
    prepareMarketSwapEntry: jest.fn(),
  }),
);
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isWeb: false },
}));
jest.mock('./hooks/useSpeedSwapInit', () => ({
  ESpeedSwapConfigScope: { DEFAULT: 'default', MARKET: 'market' },
  useSpeedSwapInit: () => ({
    defaultTokens: [payToken],
    speedConfigReady: mockSpeedConfigReady,
  }),
}));
jest.mock('./SwapPanelFooterButtons', () => ({
  __esModule: true,
  default: (props: ComponentProps<typeof SwapPanelFooterButtons>) => {
    mockFooter(props);
    const { default: FooterButtons } = jest.requireActual<
      typeof import('./SwapPanelFooterButtons')
    >('./SwapPanelFooterButtons');
    return <FooterButtons {...props} />;
  },
}));

const token: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xtarget',
  symbol: 'TARGET',
  decimals: 18,
};

describe('Market mobile Buy / Sell modal entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.replaceProperty(platformEnv, 'isNative', true);
    jest.replaceProperty(platformEnv, 'isWeb', false);
    mockActiveAccount = {};
    mockSpeedConfigReady = true;
  });

  it.each([
    { account: { id: 'account' } },
    { indexedAccount: { id: 'indexed-account' } },
  ])(
    'exposes Buy and Sell for connected narrow web accounts: %p',
    (account) => {
      jest.replaceProperty(platformEnv, 'isNative', false);
      jest.replaceProperty(platformEnv, 'isWeb', true);
      mockActiveAccount = account;
      render(<SwapPanel swapToken={token} mobileLayout />);
      expect(mockFooter).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'buy-sell', tradeDisabled: false }),
      );
    },
  );

  it('connects a narrow web guest and switches to Buy/Sell after connection', () => {
    jest.replaceProperty(platformEnv, 'isNative', false);
    jest.replaceProperty(platformEnv, 'isWeb', true);
    const { rerender } = render(<SwapPanel swapToken={token} mobileLayout />);
    fireEvent.click(
      screen.getByRole('button', { name: ETranslations.global_connect }),
    );
    expect(mockShowAccountSelector).toHaveBeenCalledTimes(1);
    expect(mockPushModal).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: ETranslations.global_buy }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: ETranslations.global_sell }),
    ).toBeNull();

    mockActiveAccount = { account: { id: 'connected' } };
    rerender(<SwapPanel swapToken={token} mobileLayout />);
    expect(
      screen.queryByRole('button', { name: ETranslations.global_connect }),
    ).toBeNull();
    expect(mockFooter).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'buy-sell', tradeDisabled: false }),
    );
  });

  it('keeps narrow web Connect disabled until execution is ready', () => {
    jest.replaceProperty(platformEnv, 'isNative', false);
    jest.replaceProperty(platformEnv, 'isWeb', true);
    render(<SwapPanel swapToken={token} mobileLayout executionReady={false} />);
    const button = screen.getByRole('button', {
      name: ETranslations.global_connect,
    });
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.click(button);
    expect(mockShowAccountSelector).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'waits for speed configuration only for connected narrow web trades (connected=%s)',
    (connected) => {
      jest.replaceProperty(platformEnv, 'isNative', false);
      jest.replaceProperty(platformEnv, 'isWeb', true);
      mockSpeedConfigReady = false;
      mockActiveAccount = connected ? { account: { id: 'connected' } } : {};
      render(<SwapPanel swapToken={token} mobileLayout />);
      if (connected) {
        const buy = screen.getByRole('button', {
          name: ETranslations.global_buy,
        });
        const sell = screen.getByRole('button', {
          name: ETranslations.global_sell,
        });
        expect(buy.hasAttribute('disabled')).toBe(true);
        expect(sell.hasAttribute('disabled')).toBe(true);
        fireEvent.click(buy);
        fireEvent.click(sell);
        expect(prepareMarketSwapEntry).not.toHaveBeenCalled();
      } else {
        const connect = screen.getByRole('button', {
          name: ETranslations.global_connect,
        });
        expect(connect.hasAttribute('disabled')).toBe(false);
        fireEvent.click(connect);
        expect(mockShowAccountSelector).toHaveBeenCalledTimes(1);
      }
    },
  );

  it.each([false, true])(
    'retains the independent Perps entry for narrow web guests (disabled=%s)',
    (perpsDisabled) => {
      jest.replaceProperty(platformEnv, 'isNative', false);
      jest.replaceProperty(platformEnv, 'isWeb', true);
      const onPerps = jest.fn();
      render(
        <SwapPanel
          swapToken={token}
          mobileLayout
          footerMode="perps-buy-sell"
          onPerps={onPerps}
          perpsDisabled={perpsDisabled}
        />,
      );
      expect(
        screen.getByRole('button', { name: ETranslations.global_connect }),
      ).toBeTruthy();
      const perps = screen.getByRole('button', {
        name: ETranslations.perps_perps,
      });
      expect(perps.hasAttribute('disabled')).toBe(perpsDisabled);
      fireEvent.click(perps);
      expect(onPerps).toHaveBeenCalledTimes(perpsDisabled ? 0 : 1);
      expect(mockShowAccountSelector).not.toHaveBeenCalled();
      expect(mockPushModal).not.toHaveBeenCalled();
    },
  );

  it('preserves Connect for wide web guests', () => {
    jest.replaceProperty(platformEnv, 'isNative', false);
    jest.replaceProperty(platformEnv, 'isWeb', true);
    render(<SwapPanel swapToken={token} />);
    fireEvent.click(
      screen.getByRole('button', { name: ETranslations.global_connect }),
    );
    expect(mockShowAccountSelector).toHaveBeenCalledTimes(1);
    expect(mockFooter).not.toHaveBeenCalled();
  });

  it.each(['to', 'from'] as const)(
    'opens the prepared %s trade in a modal without leaving the detail',
    (direction) => {
      const entry = {
        fromToken: direction === 'to' ? payToken : token,
        toToken: direction === 'to' ? token : payToken,
        swapType: ESwapTabSwitchType.SWAP,
      };
      jest.mocked(prepareMarketSwapEntry).mockReturnValue(entry);
      render(<SwapPanel swapToken={token} />);
      const footer = mockFooter.mock.calls[0][0];
      act(direction === 'to' ? footer.onBuy : footer.onSell);

      expect(prepareMarketSwapEntry).toHaveBeenCalledWith({
        defaultTokens: [payToken],
        token,
        direction,
        storeName: EJotaiContextStoreNames.swapModal,
      });
      expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapMainLand,
        params: {
          importFromToken: entry.fromToken,
          importToToken: entry.toToken,
          swapTabSwitchType: ESwapTabSwitchType.SWAP,
          swapSource: ESwapSource.MARKET,
          marketSwapDirection: direction,
        },
      });
      expect(mockSwitchTab).not.toHaveBeenCalled();
      expect(mockDismissDetail).not.toHaveBeenCalled();
    },
  );

  it('preserves the prepared Bridge mode', () => {
    jest.mocked(prepareMarketSwapEntry).mockReturnValue({
      fromToken: { ...payToken, networkId: 'evm--56' },
      toToken: token,
      swapType: ESwapTabSwitchType.BRIDGE,
    });
    render(<SwapPanel swapToken={token} detailKind="topCoin" />);
    act(mockFooter.mock.calls[0][0].onBuy);
    expect(mockPushModal.mock.calls[0][1].params.swapTabSwitchType).toBe(
      ESwapTabSwitchType.BRIDGE,
    );
  });

  it.each(['to', 'from'] as const)(
    'prepares a Stock %s trade in the modal store',
    (direction) => {
      const stock = { ...token, isStock: true };
      jest.mocked(prepareStockSwapEntry).mockReturnValue({
        fromToken: direction === 'to' ? undefined : stock,
        toToken: direction === 'to' ? stock : undefined,
        swapType: ESwapTabSwitchType.STOCK,
      });
      render(<SwapPanel swapToken={stock} detailKind="stock" />);
      const footer = mockFooter.mock.calls[0][0];
      act(direction === 'to' ? footer.onBuy : footer.onSell);
      expect(prepareStockSwapEntry).toHaveBeenCalledWith({
        token: stock,
        direction,
        storeName: EJotaiContextStoreNames.swapModal,
      });
      expect(prepareMarketSwapEntry).not.toHaveBeenCalled();
      expect(mockPushModal.mock.calls[0][1].params.swapTabSwitchType).toBe(
        ESwapTabSwitchType.STOCK,
      );
    },
  );

  it('ignores gesture callbacks before execution is ready', () => {
    render(<SwapPanel swapToken={token} executionReady={false} />);
    const footer = mockFooter.mock.calls[0][0];
    expect(footer.tradeDisabled).toBe(true);
    act(footer.onBuy);
    act(footer.onSell);
    expect(prepareMarketSwapEntry).not.toHaveBeenCalled();
    expect(prepareStockSwapEntry).not.toHaveBeenCalled();
    expect(mockPushModal).not.toHaveBeenCalled();
  });
});
