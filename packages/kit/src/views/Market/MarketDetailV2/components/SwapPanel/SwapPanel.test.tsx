/** @jest-environment jsdom */

import type { ComponentProps, PropsWithChildren } from 'react';

import { act, render } from '@testing-library/react';

import {
  prepareStockSwapEntry,
  prepareTopCoinSwapEntry,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/prepareSwapProEntry';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
const mockFooter = jest.fn(
  (_props: ComponentProps<typeof SwapPanelFooterButtons>) => null,
);

jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: PropsWithChildren) => <>{children}</>;
  return {
    Button: Container,
    Divider: Container,
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
  () => ({ useAccountSelectorTrigger: () => ({}) }),
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
    prepareTopCoinSwapEntry: jest.fn(),
  }),
);
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('./SwapPanelFooterButtons', () => ({
  __esModule: true,
  default: (props: ComponentProps<typeof SwapPanelFooterButtons>) =>
    mockFooter(props),
}));

const token: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xtarget',
  symbol: 'TARGET',
  decimals: 18,
};
const payToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};

describe('Market mobile Buy / Sell modal entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['to', 'from'] as const)(
    'opens the prepared %s trade in a modal without leaving the detail',
    (direction) => {
      const entry = {
        fromToken: direction === 'to' ? payToken : token,
        toToken: direction === 'to' ? token : payToken,
        swapType: ESwapTabSwitchType.SWAP,
      };
      jest.mocked(prepareTopCoinSwapEntry).mockReturnValue(entry);
      render(<SwapPanel swapToken={token} />);
      const footer = mockFooter.mock.calls[0][0];
      act(direction === 'to' ? footer.onBuy : footer.onSell);

      expect(prepareTopCoinSwapEntry).toHaveBeenCalledWith({
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
        },
      });
      expect(mockSwitchTab).not.toHaveBeenCalled();
      expect(mockDismissDetail).not.toHaveBeenCalled();
    },
  );

  it('preserves the prepared Bridge mode', () => {
    jest.mocked(prepareTopCoinSwapEntry).mockReturnValue({
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
      expect(prepareTopCoinSwapEntry).not.toHaveBeenCalled();
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
    expect(prepareTopCoinSwapEntry).not.toHaveBeenCalled();
    expect(prepareStockSwapEntry).not.toHaveBeenCalled();
    expect(mockPushModal).not.toHaveBeenCalled();
  });
});
