/** @jest-environment jsdom */

import { Dialog } from '@onekeyhq/components';

import { showLimitOrderDialog } from '../panels/LimitOrderForm';

import { showOrderConfirmDialog } from './OrderConfirmModal';

import type { IntlShape } from 'react-intl';

const mockDialog = { close: jest.fn(), isExist: jest.fn(() => true) };

jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: jest.fn(() => mockDialog), Header: () => null },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/spot', () => ({}));
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  OverlayPageHostScope: 'OverlayPageHostScope',
  OverlayPageOwnerScope: 'OverlayPageOwnerScope',
}));
jest.mock('../../../hooks', () => ({}));
jest.mock('../../../hooks/useActiveTradeDisplay', () => ({}));
jest.mock('../../../hooks/useTradingPrice', () => ({}));
jest.mock('../../../hooks/useAggressiveLimitPriceWarning', () => ({}));
jest.mock('../../../hooks/useEnableTradingWithDepositFallback', () => ({}));
jest.mock('../../../hooks/useOrderPrice', () => ({}));
jest.mock('../../../hooks/usePerpsAccountScopedActivePositions', () => ({}));
jest.mock('../../../hooks/usePerpsCrossAvailableAfterMaintenance', () => ({}));
jest.mock('../../../hooks/usePerpsMarketDataFreshness', () => ({}));
jest.mock('../../../hooks/useShowDepositWithdrawModal', () => ({}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({}));
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector',
  () => ({}),
);
jest.mock('../../../PerpsAccountSelectorProviderMirror', () => ({
  PerpsAccountSelectorProviderMirror: 'AccountMirror',
}));
jest.mock('../../../PerpsProviderMirror', () => ({
  PerpsProviderMirror: 'PerpsMirror',
}));
jest.mock('../../TradingGuardWrapper', () => ({}));
jest.mock('../components/LiquidationPriceDisplay', () => ({}));
jest.mock('../selectors/bboDisplay', () => ({}));
jest.mock('./AggressiveLimitPriceWarning', () => ({}));
jest.mock('./EnableTradingStepsDialog', () => ({}));
jest.mock('../panels/PerpTradingForm', () => ({}));
jest.mock('../components/PerpsAccountNumberValue', () => ({}));
jest.mock('../components/PerpsFirstDepositPromptCard', () => ({}));
jest.mock('../inputs/PriceInput', () => ({}));
jest.mock('../inputs/SizeInput', () => ({}));
jest.mock('../inputs/TpSlFormInput', () => ({}));
jest.mock('../selectors/BBOSelector', () => ({}));
jest.mock('../selectors/TimeInForceSelector', () => ({}));
jest.mock('../../PerpsSlider', () => ({}));

const intl = { formatMessage: ({ id }: { id: string }) => id } as IntlShape;
const sourcePage = { hostKey: 'main-host', ownerKey: 'perps-page' };

describe('Perps global tickets restore their source page inside content', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['order', () => showOrderConfirmDialog({ sourcePage, intl })],
    [
      'limit',
      () =>
        showLimitOrderDialog({
          sourcePage,
          symbol: 'BTC',
          price: '83000',
          intl,
        }),
    ],
  ])(
    '%s keeps its parent global and restores the original content scope',
    (_name, show) => {
      show();
      const options = jest.mocked(Dialog.show).mock.calls[0][0];
      expect(options).not.toHaveProperty('portalContainer');
      expect(options).not.toHaveProperty('overlayPage');
      const host = options.renderContent as React.ReactElement<{
        hostKey: string;
        children: React.ReactElement<{ ownerKey: string }>;
      }>;
      expect(host.type).toBe('OverlayPageHostScope');
      expect(host.props.hostKey).toBe(sourcePage.hostKey);
      expect(host.props.children.type).toBe('OverlayPageOwnerScope');
      expect(host.props.children.props.ownerKey).toBe(sourcePage.ownerKey);
    },
  );

  it('rejects missing page ownership without opening a global ticket', () => {
    expect(() => showOrderConfirmDialog({ intl })).toThrow(
      'Order confirmation requires a source page',
    );
    expect(() =>
      showLimitOrderDialog({
        symbol: 'BTC',
        price: '83000',
        intl,
      }),
    ).toThrow('Limit order requires a source page');
    expect(Dialog.show).not.toHaveBeenCalled();
  });
});
