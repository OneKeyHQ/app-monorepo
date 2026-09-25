/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { EBorrowDataStatus } from '../borrowDataStatus';
import { buildBorrowMarketKey } from '../borrowMarketKey';
import { BorrowTestIDs } from '../testIDs';

import { BorrowHome } from './BorrowHome';

const media = { gtMd: false, gtXl: false };
let mockRequestedMarket: typeof context.market | null = null;
const mockPrewarmCancel = jest.fn();
const mockPrewarmBorrowImages = jest.fn(
  (_sources: unknown, _options?: unknown) => mockPrewarmCancel,
);
const mockGetVisibleAssetIconSources = jest.fn((_input: unknown) => [
  { uri: 'https://example.com/visible.png', resizeWidth: 32 },
]);
const mockEModeStatusState = {
  eModeStatus: { eModeId: 1, categories: [], originalLtv: '0.8' },
  isError: false,
  isInitialLoading: false,
  refresh: jest.fn(),
};
const context = {
  reserves: {
    data: null as { supply: { assets: never[] } } | null,
    loading: false,
    refresh: jest.fn(),
    ownerMarketKey: undefined as string | undefined,
  },
  market: {
    networkId: 'evm--1',
    provider: 'aave',
    marketAddress: '0xMarket',
    name: 'Aave',
    logoURI: '',
    network: { logoURI: '' },
  },
  markets: [
    {
      networkId: 'evm--1',
      provider: 'aave',
      marketAddress: '0xMarket',
      name: 'Aave',
      logoURI: '',
      network: { logoURI: '' },
    },
  ],
  earnAccount: { data: { account: { id: 'account-1' } }, loading: false },
  borrowDataStatus: EBorrowDataStatus.Error,
  refreshAllBorrowData: jest.fn(),
  setPendingTxs: jest.fn(),
};
context.reserves.data = { supply: { assets: [] } };
context.reserves.ownerMarketKey = buildBorrowMarketKey(context.market);

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  function Container({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  }
  return {
    __esModule: true,
    YStack: Container,
    XStack: Container,
    ScrollView: Container,
    Tabs: Object.assign(Container, {
      Container,
      Tab: Container,
      TabBar: Container,
    }),
    Empty: ({ testID }: { testID?: string }) => <div data-testid={testID} />,
    useMedia: () => media,
    useScrollContentTabBarOffset: () => 0,
  };
});

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  useSharedValue: (value: unknown) => ({ value }),
}));

jest.mock('../BorrowProvider', () => ({
  __esModule: true,
  ...jest.requireActual<typeof import('../borrowMarketKey')>(
    '../borrowMarketKey',
  ),
  BorrowProvider: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  useBorrowContext: () => context,
  useBorrowMarketRequestContext: () => ({
    requestedMarket: mockRequestedMarket,
  }),
}));

jest.mock('../components/borrowImagePrewarm', () => ({
  getBorrowVisibleAssetIconSources: (input: unknown) =>
    mockGetVisibleAssetIconSources(input),
  prewarmBorrowImages: (sources: unknown, options?: unknown) =>
    mockPrewarmBorrowImages(sources, options),
}));

jest.mock('../components/BorrowDataGate', () => ({
  __esModule: true,
  BorrowDataGate: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

// The bar is the only phone entry point to the e-mode screen, so the stub
// reports the variant it was asked for rather than just its presence.
jest.mock('../components/BorrowEModeMetric', () => ({
  __esModule: true,
  BorrowEModeMetric: ({
    variant,
    eModeStatus,
    isError,
  }: {
    variant?: string;
    eModeStatus?: unknown;
    isError?: boolean;
  }) => (
    <div
      data-testid="e-mode-metric"
      data-variant={variant}
      data-has-status={String(Boolean(eModeStatus))}
      data-error={String(Boolean(isError))}
    />
  ),
}));

const mockOverviewProps: Record<string, unknown>[] = [];
jest.mock('../components/Overview', () => ({
  __esModule: true,
  Overview: (props: Record<string, unknown>) => {
    mockOverviewProps.push(props);
    return <div data-testid="overview" />;
  },
}));

jest.mock('../components/BorrowAlerts', () => ({
  __esModule: true,
  BorrowAlerts: () => null,
}));
jest.mock('../components/BorrowCard', () => ({
  __esModule: true,
  BorrowCard: () => null,
}));
jest.mock('../components/BorrowedCard', () => ({
  __esModule: true,
  BorrowedCard: () => null,
}));
jest.mock('../components/SupplyCard', () => ({
  __esModule: true,
  SupplyCard: () => null,
}));
jest.mock('../components/SuppliedCard', () => ({
  __esModule: true,
  SuppliedCard: () => null,
}));
jest.mock('../components/BorrowMobilePositions', () => ({
  __esModule: true,
  BorrowMobilePositions: ({ isPending }: { isPending?: boolean }) => (
    <div data-testid="mobile-positions" data-pending={String(isPending)} />
  ),
}));
jest.mock('../components/BorrowMobileEmptyState', () => ({
  __esModule: true,
  BorrowMobileEmptyState: () => <div data-testid="mobile-empty-state" />,
}));
jest.mock('../components/BorrowMobileSummary', () => ({
  __esModule: true,
  BorrowMobileSummary: () => null,
}));
jest.mock('../components/BorrowMobileActionBar', () => ({
  __esModule: true,
  BORROW_MOBILE_ACTION_BAR_SCROLL_INSET: 0,
  BorrowMobileActionBar: () => null,
}));
jest.mock('../../Staking/components/ProtocolDetails/NoAddressWarning', () => ({
  __esModule: true,
  NoAddressWarning: () => null,
}));

// Pulled in transitively by useManagePage; loading it for real drags in the
// whole background API and WalletConnect.
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../borrowUtils', () => ({
  __esModule: true,
  BorrowNavigation: {
    pushToBorrowManagePosition: jest.fn(),
    pushToBorrowTokenSelect: jest.fn(),
  },
}));
jest.mock('../../Staking/pages/ManagePosition/hooks/useManagePage', () => ({
  __esModule: true,
  EManagePositionType: { Supply: 'supply', Borrow: 'borrow' },
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: jest.fn(), pop: jest.fn(), pushModal: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  __esModule: true,
  useActiveAccount: () => ({
    activeAccount: { ready: true, wallet: null, account: null },
  }),
}));
jest.mock('../../Onboarding/hooks/useToOnBoardingPage', () => ({
  __esModule: true,
  useToOnBoardingPage: () => jest.fn(),
}));
jest.mock('../hooks/useBorrowEModeStatus', () => ({
  __esModule: true,
  useBorrowEModeStatus: () => mockEModeStatusState,
}));
jest.mock('../hooks/useBorrowOverviewData', () => ({
  __esModule: true,
  useBorrowOverviewData: () => ({}),
}));
const mockPositionEntries: unknown[] = [];
jest.mock('../hooks/useBorrowPositionEntries', () => ({
  __esModule: true,
  useBorrowPositionEntries: () => mockPositionEntries,
}));

describe('BorrowHome e-mode entry point', () => {
  beforeEach(() => {
    media.gtMd = false;
    media.gtXl = false;
    context.borrowDataStatus = EBorrowDataStatus.Error;
    mockEModeStatusState.isError = false;
  });

  // E-Mode is fed by its own request, so a reserves outage says nothing about
  // whether it is usable. Before the bar moved below the positions it lived in
  // Overview, above the cards, and survived this state; sitting inside the
  // cards' error short-circuit would strand phone users with no way to reach
  // the e-mode screen until reserves recover.
  it('keeps the e-mode bar reachable on phones while reserves are in error', () => {
    const { getByTestId } = render(<BorrowHome />);

    expect(getByTestId(BorrowTestIDs.reservesErrorState)).toBeTruthy();
    expect(getByTestId('e-mode-metric').getAttribute('data-variant')).toBe(
      'bar',
    );
  });

  it('still renders the bar on phones once reserves are healthy', () => {
    context.borrowDataStatus = EBorrowDataStatus.Ready;
    const { getByTestId, queryByTestId } = render(<BorrowHome />);

    expect(queryByTestId(BorrowTestIDs.reservesErrorState)).toBeNull();
    expect(getByTestId('e-mode-metric').getAttribute('data-variant')).toBe(
      'bar',
    );
  });

  it('does not expose the last E-Mode status after its request fails', () => {
    mockEModeStatusState.isError = true;
    mockOverviewProps.length = 0;
    const { getByTestId } = render(<BorrowHome />);

    expect(getByTestId('e-mode-metric').getAttribute('data-has-status')).toBe(
      'false',
    );
    expect(getByTestId('e-mode-metric').getAttribute('data-error')).toBe(
      'true',
    );
    expect(
      mockOverviewProps[mockOverviewProps.length - 1].eModeStatus,
    ).toBeNull();
  });

  // Wide layouts reach e-mode through Overview, which renders above the cards
  // and is untouched by the error branch. Adding the bar there too would show
  // the same control twice.
  it('leaves the wide layout to reach e-mode through the overview', () => {
    media.gtMd = true;
    media.gtXl = true;
    const { getByTestId, queryByTestId } = render(<BorrowHome />);

    expect(getByTestId(BorrowTestIDs.reservesErrorState)).toBeTruthy();
    expect(getByTestId('overview')).toBeTruthy();
    expect(queryByTestId('e-mode-metric')).toBeNull();
  });
});

describe('BorrowHome overview metrics', () => {
  beforeEach(() => {
    media.gtMd = false;
    media.gtXl = false;
    context.borrowDataStatus = EBorrowDataStatus.Ready;
    mockPositionEntries.length = 0;
    mockOverviewProps.length = 0;
    mockRequestedMarket = null;
  });

  const lastOverviewProps = () =>
    mockOverviewProps[mockOverviewProps.length - 1];

  // Net worth, health factor and net APY all describe a position. This page
  // owns the only list that knows whether one exists, so it is what has to
  // tell Overview.
  it('tells the overview an empty market has no position metrics', () => {
    render(<BorrowHome />);

    expect(lastOverviewProps()).toMatchObject({
      showPositionMetrics: false,
      isPositionStateUnsettled: false,
    });
  });

  it('turns them back on as soon as a position is in the list', () => {
    mockPositionEntries.push({ kind: 'supplied' });
    render(<BorrowHome />);

    expect(lastOverviewProps()).toMatchObject({ showPositionMetrics: true });
  });

  // An unsettled list is not evidence of an empty market. Without this the
  // metrics would blank out for the length of every load and come straight
  // back, which is the flicker the separate flag exists to prevent.
  it('reports the position state as unsettled while reserves are pending', () => {
    context.borrowDataStatus = EBorrowDataStatus.LoadingReserves;
    render(<BorrowHome />);

    expect(lastOverviewProps()).toMatchObject({
      isPositionStateUnsettled: true,
      isInteractionBlocked: true,
    });
  });

  it('blocks the previous market overview while a different market is requested', () => {
    mockRequestedMarket = { ...context.market, marketAddress: '0xOtherMarket' };
    render(<BorrowHome />);

    expect(lastOverviewProps()).toMatchObject({
      isInteractionBlocked: true,
    });
  });

  // renderCards short-circuits to its own error block here, so the empty state
  // never renders and there is nothing for the metrics to make way for. A
  // failed load also says nothing about whether positions exist, and reporting
  // it as settled-and-empty made the whole row vanish behind the error.
  it('reports the position state as unsettled when reserves failed', () => {
    context.borrowDataStatus = EBorrowDataStatus.Error;
    const { getByTestId } = render(<BorrowHome />);

    expect(getByTestId(BorrowTestIDs.reservesErrorState)).toBeTruthy();
    expect(lastOverviewProps()).toMatchObject({
      showPositionMetrics: false,
      isPositionStateUnsettled: true,
    });
  });

  // Retry walks Error -> LoadingReserves -> Error. Both ends have to agree, or
  // the row flashes into view as a skeleton on every attempt and back out.
  it('keeps the position state unsettled across a failed retry', () => {
    context.borrowDataStatus = EBorrowDataStatus.Error;
    render(<BorrowHome />);
    const whenFailed = lastOverviewProps().isPositionStateUnsettled;

    mockOverviewProps.length = 0;
    context.borrowDataStatus = EBorrowDataStatus.LoadingReserves;
    render(<BorrowHome />);
    const whenRetrying = lastOverviewProps().isPositionStateUnsettled;

    expect([whenFailed, whenRetrying]).toEqual([true, true]);
  });

  it('keeps the home list in skeleton state when its reserves are missing', () => {
    context.borrowDataStatus = EBorrowDataStatus.Ready;
    context.reserves.data = null;
    context.reserves.ownerMarketKey = buildBorrowMarketKey(context.market);

    const { getByTestId, queryByTestId } = render(<BorrowHome />);

    expect(getByTestId('mobile-positions').getAttribute('data-pending')).toBe(
      'true',
    );
    expect(queryByTestId('mobile-empty-state')).toBeNull();

    context.reserves.data = { supply: { assets: [] } };
  });

  it('does not use a previous market snapshot as a settled empty state', () => {
    context.borrowDataStatus = EBorrowDataStatus.Ready;
    context.market = { ...context.market, marketAddress: '0xNewMarket' };
    context.reserves.ownerMarketKey = buildBorrowMarketKey({
      ...context.market,
      marketAddress: '0xOldMarket',
    });

    const { getByTestId, queryByTestId } = render(<BorrowHome />);

    expect(getByTestId('mobile-positions').getAttribute('data-pending')).toBe(
      'true',
    );
    expect(queryByTestId('mobile-empty-state')).toBeNull();

    context.market = {
      ...context.market,
      marketAddress: '0xMarket',
    };
    context.reserves.ownerMarketKey = buildBorrowMarketKey(context.market);
  });

  it('keeps the retryable error visible when the failed market has no snapshot', () => {
    context.borrowDataStatus = EBorrowDataStatus.Error;
    context.reserves.data = null;
    context.reserves.ownerMarketKey = buildBorrowMarketKey(context.market);

    const { getByTestId, queryByTestId } = render(<BorrowHome />);

    expect(getByTestId(BorrowTestIDs.reservesErrorState)).toBeTruthy();
    expect(queryByTestId('mobile-positions')).toBeNull();

    context.reserves.data = { supply: { assets: [] } };
  });
});

describe('BorrowHome visible asset icons', () => {
  const originalMarket = context.market;

  beforeEach(() => {
    jest.clearAllMocks();
    context.market = originalMarket;
    context.reserves.ownerMarketKey = buildBorrowMarketKey(originalMarket);
    context.borrowDataStatus = EBorrowDataStatus.Ready;
  });

  afterEach(() => {
    context.market = originalMarket;
    context.reserves.ownerMarketKey = undefined;
  });

  it('cancels queued icons when the published market no longer owns the reserves', () => {
    const screen = render(<BorrowHome header={<div>first</div>} />);
    expect(mockGetVisibleAssetIconSources).toHaveBeenCalledWith({
      reserves: context.reserves.data,
      market: originalMarket,
      section: 'supply',
    });
    expect(mockPrewarmBorrowImages).toHaveBeenCalledWith(
      [{ uri: 'https://example.com/visible.png', resizeWidth: 32 }],
      { priority: true },
    );

    context.market = { ...originalMarket, marketAddress: '0xOtherMarket' };
    screen.rerender(<BorrowHome header={<div>other</div>} />);
    expect(mockPrewarmCancel).toHaveBeenCalledTimes(1);
    expect(mockPrewarmBorrowImages).toHaveBeenCalledTimes(1);
  });
});
