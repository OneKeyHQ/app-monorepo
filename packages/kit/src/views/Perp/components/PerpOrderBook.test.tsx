/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const Primitive = ({
    children,
    h,
    minHeight,
    onPress,
  }: {
    children?: ReactNode;
    h?: number;
    minHeight?: number;
    onPress?: () => void;
  }) => {
    if (onPress) {
      return (
        <button
          type="button"
          data-height={h}
          data-min-height={minHeight}
          onClick={onPress}
        >
          {children}
        </button>
      );
    }
    return (
      <div data-height={h} data-min-height={minHeight}>
        {children}
      </div>
    );
  };

  return {
    Button: Primitive,
    DashText: Primitive,
    DebugRenderTracker: Primitive,
    Dialog: { show: jest.fn() },
    Divider: () => null,
    SizableText: Primitive,
    XStack: Primitive,
    YStack: Primitive,
    useMedia: () => ({ gtMd: false }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {},
    simpleDb: { perp: {} },
  },
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [{ coin: 'BTC', mode: 'perp' }],
  useConnectionStateAtom: () => [{ isConnected: true, reconnectCount: 0 }],
  useHyperliquidActions: () => ({ current: {} }),
  useOrderBookTickOptionsAtom: () => [{}],
  usePerpsL2BookColdCacheAtom: () => [{}],
  usePerpsMidByCoin: () => '1',
  useTradingFormAtom: () => [{ hasTpsl: false, type: 'limit' }],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsCommonConfigPersistAtom: () => [{ perpConfigCommon: {} }],
  usePerpsShouldShowEnableTradingButtonAtom: () => [false],
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    perp: { hyperliquid: { cacheSnapshotError: jest.fn() } },
  },
}));

jest.mock('@onekeyhq/shared/src/performance/perpsColdStartPerf', () => ({
  markPerpsColdStartPerfOnce: jest.fn(),
}));

jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: jest.fn() }),
}));

jest.mock('../hooks/useFundingCountdown', () => ({
  useFundingCountdown: () => '39:51',
}));

jest.mock('../hooks/usePerpMarketData', () => ({
  getFreshL2BookSnapshotFromSwr: jest.fn(),
  normalizeL2BookData: jest.fn(),
  useL2Book: jest.fn(),
}));

jest.mock('../hooks/usePerpsAccountDisplayState', () => ({
  usePerpsAccountDisplayState: jest.fn(),
}));

jest.mock('../hooks/usePerpsActiveAssetCtxDisplay', () => ({
  usePerpsActiveAssetCtxDisplay: () => ({
    assetCtx: {
      ctx: {
        fundingRate: '0.000002',
        markPrice: '1',
      },
    },
    cacheAgeMs: 0,
    source: 'live',
  }),
}));

jest.mock('../PerpsProviderMirror', () => ({
  PerpsProviderMirror: ({ children }: { children?: ReactNode }) => children,
}));

jest.mock('../utils/enableTradingDialogConfirm', () => ({
  shouldShowPerpsFirstDepositPrompt: jest.fn(),
}));

jest.mock('../utils/l2BookFreshness', () => ({
  getFreshL2BookSnapshotFromColdCache: jest.fn(),
  getPerpsL2BookColdCacheGlobalSnapshot: jest.fn(),
  isL2BookForTarget: jest.fn(),
  isPerpsL2BookInteractive: jest.fn(),
}));

jest.mock('../utils/mobileLayoutTrace', () => ({
  getPerpsMobileLayoutTraceRect: jest.fn(),
  isPerpsMobileLayoutTraceRectChanged: jest.fn(),
  tracePerpsMobileLayout: jest.fn(),
}));

jest.mock('../utils/orderBookVisualScheduler', () => ({
  PERPS_ORDER_BOOK_MOBILE_VISUAL_FRAME_MS: 100,
  getPerpsOrderBookVisualSnapshotDelayMs: jest.fn(),
}));

jest.mock('./OrderBook', () => ({
  OrderBook: () => null,
  OrderBookMobile: () => null,
}));

jest.mock('./OrderBook/DefaultLoadingNode', () => ({
  DefaultLoadingNode: () => null,
}));

jest.mock('./OrderBook/useTickOptions', () => ({
  useTickOptions: jest.fn(),
}));

jest.mock('./PerpOrderBookMobileVerticalShell', () => ({
  PerpOrderBookMobileVerticalShell: ({ header }: { header?: ReactNode }) =>
    header,
}));

import { MobileHeader } from './PerpOrderBook';

describe('PerpOrderBook mobile funding header', () => {
  it('lets the localized funding and countdown title grow beyond one line', () => {
    render(<MobileHeader />);

    const title = screen.getByText(ETranslations.perp_token_bar_Funding);
    const header = title.parentElement;

    expect(header?.getAttribute('data-min-height')).toBe('32');
    expect(header?.getAttribute('data-height')).toBeNull();
    expect(screen.getByText('0.0002%')).toBeTruthy();
    expect(screen.getByText('39:51')).toBeTruthy();
  });
});
