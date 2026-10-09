/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { BorrowTestIDs } from '../testIDs';

import { Overview } from './Overview';

import type { IBorrowOverviewData } from '../hooks/useBorrowOverviewData';

const media = { gtMd: false };
const context = {
  reserves: { data: { overview: {} }, loading: false },
  market: { networkId: 'evm--1', provider: 'aave', marketAddress: '0xMarket' },
  earnAccount: { data: { account: { id: 'account-1' } } },
  pendingTxs: [],
};

// Only the fields Overview reads. The hook's return type is inferred from its
// whole body, which a fixture cannot reproduce without standing up its requests.
const overviewData = {
  healthFactorData: undefined,
  isHealthFactorLoading: false,
  borrowRewards: undefined,
  isRewardsLoading: false,
  isManualRefreshing: false,
  requestRefresh: jest.fn(),
} as unknown as IBorrowOverviewData;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  function Container({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) {
    return <div data-testid={testID}>{children}</div>;
  }
  return {
    __esModule: true,
    Icon: () => null,
    IconButton: ({ testID }: { testID?: string }) => (
      <div data-testid={testID} />
    ),
    SizableText: Container,
    Skeleton: () => null,
    XStack: Container,
    YStack: Container,
    useMedia: () => media,
  };
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: jest.fn(), pushModal: jest.fn() }),
}));
jest.mock('../BorrowProvider', () => ({
  __esModule: true,
  useBorrowContext: () => context,
}));
jest.mock('../borrowUtils', () => ({
  __esModule: true,
  BorrowNavigation: { pushToBorrowHistory: jest.fn() },
}));
jest.mock('../hooks/useBorrowPlaceholderAmountText', () => ({
  __esModule: true,
  useBorrowPlaceholderAmountText: () => ({ text: '$0.00' }),
}));
jest.mock('../../Staking/components/ProtocolDetails/EarnActionIcon', () => ({
  __esModule: true,
  EarnActionIcon: () => null,
}));
jest.mock('../../Staking/components/ProtocolDetails/EarnText', () => ({
  __esModule: true,
  EarnText: () => null,
}));
jest.mock('../../Staking/components/StakingActivityIndicator', () => ({
  __esModule: true,
  PendingIndicator: () => null,
}));
jest.mock('./Markets', () => ({ __esModule: true, Markets: () => null }));
jest.mock('./BorrowBonusMetric', () => ({
  __esModule: true,
  BorrowBonusMetric: () => null,
}));
jest.mock('./BorrowEModeMetric', () => ({
  __esModule: true,
  BorrowEModeMetric: () => null,
}));
jest.mock('./BorrowRewardsMetric', () => ({
  __esModule: true,
  BorrowRewardsMetric: () => null,
}));

// Both metric components are stubbed down to the cell they occupy: what is
// under test is whether Overview renders a cell at all, not what it says.
jest.mock('./OverviewMetric', () => ({
  __esModule: true,
  OverviewMetric: ({ testID }: { testID?: string }) => (
    <div data-testid={testID} />
  ),
}));
jest.mock('./BorrowHealthFactorSummary', () => {
  const { BorrowTestIDs: ids } =
    jest.requireActual<typeof import('../testIDs')>('../testIDs');
  return {
    __esModule: true,
    BorrowHealthFactorSummary: ({ isLoading }: { isLoading?: boolean }) => (
      <div
        data-testid={ids.overviewHealthFactor}
        data-loading={isLoading ? 'true' : 'false'}
      />
    ),
  };
});

function renderOverview(props?: {
  showPositionMetrics?: boolean;
  isPositionStateUnsettled?: boolean;
}) {
  return render(
    <Overview eModeStatus={null} overviewData={overviewData} {...props} />,
  );
}

describe('Overview position metrics', () => {
  beforeEach(() => {
    media.gtMd = false;
  });

  it('shows all three headline numbers on phones once a position exists', () => {
    const { queryByTestId } = renderOverview({ showPositionMetrics: true });

    expect(queryByTestId(BorrowTestIDs.overviewNetWorth)).toBeTruthy();
    expect(queryByTestId(BorrowTestIDs.overviewHealthFactor)).toBeTruthy();
    expect(queryByTestId(BorrowTestIDs.overviewNetApy)).toBeTruthy();
  });

  // All three describe a position, so a market the user holds nothing in has
  // nothing to put in them: they would read as a net worth of zero, at no
  // risk, earning nothing, above a list inviting the user to start.
  it('drops all three on phones when there is no position to describe', () => {
    const { queryByTestId } = renderOverview({ showPositionMetrics: false });

    expect(queryByTestId(BorrowTestIDs.overviewNetWorth)).toBeNull();
    expect(queryByTestId(BorrowTestIDs.overviewHealthFactor)).toBeNull();
    expect(queryByTestId(BorrowTestIDs.overviewNetApy)).toBeNull();
  });

  it('keeps the refresh button alongside the metrics', () => {
    const { queryByTestId } = renderOverview({ showPositionMetrics: true });

    expect(queryByTestId(BorrowTestIDs.overviewRefreshBtn)).toBeTruthy();
  });

  // Refresh rides the metric row, so it stands down with it and the empty state
  // picks it up on its own list heading. Holding the row open for the button
  // alone left it stranded in the gap under the market picker.
  it('takes the refresh button down with the metrics', () => {
    const { queryByTestId } = renderOverview({ showPositionMetrics: false });

    expect(queryByTestId(BorrowTestIDs.overviewRefreshBtn)).toBeNull();
  });

  // Whether a position exists is unknown both while reserves are in flight and
  // after they fail. Hiding on the strength of a list that never arrived would
  // blank the metrics and bring them straight back on the next attempt.
  it('holds the metrics while the position state is unsettled', () => {
    const { queryByTestId } = renderOverview({
      showPositionMetrics: false,
      isPositionStateUnsettled: true,
    });

    expect(queryByTestId(BorrowTestIDs.overviewNetWorth)).toBeTruthy();
    expect(queryByTestId(BorrowTestIDs.overviewNetApy)).toBeTruthy();
  });

  // The wide layout is built around the net worth hero and has no empty state
  // to put in its place, so the gate stops at the phone breakpoint.
  it('leaves the wide layout showing them with no positions', () => {
    media.gtMd = true;
    const { queryByTestId } = renderOverview({ showPositionMetrics: false });

    expect(queryByTestId(BorrowTestIDs.overviewHealthFactor)).toBeTruthy();
    expect(queryByTestId(BorrowTestIDs.overviewNetApy)).toBeTruthy();
  });

  it('keeps health factor through polling but loads on a market or account change', () => {
    const originalMarket = context.market;
    const originalEarnAccount = context.earnAccount;
    const originalHealthFactorData = overviewData.healthFactorData;
    const originalHealthFactorLoading = overviewData.isHealthFactorLoading;

    try {
      overviewData.healthFactorData =
        {} as IBorrowOverviewData['healthFactorData'];
      overviewData.isHealthFactorLoading = false;
      const { queryByTestId, rerender } = renderOverview();
      const loading = () =>
        queryByTestId(BorrowTestIDs.overviewHealthFactor)?.getAttribute(
          'data-loading',
        );

      expect(loading()).toBe('false');
      overviewData.healthFactorData = null;
      overviewData.isHealthFactorLoading = true;
      rerender(<Overview eModeStatus={null} overviewData={overviewData} />);
      expect(loading()).toBe('false');

      context.market = { ...originalMarket, marketAddress: '0xOtherMarket' };
      rerender(<Overview eModeStatus={null} overviewData={overviewData} />);
      expect(loading()).toBe('true');

      overviewData.healthFactorData =
        {} as IBorrowOverviewData['healthFactorData'];
      rerender(<Overview eModeStatus={null} overviewData={overviewData} />);
      expect(loading()).toBe('false');
      context.earnAccount = { data: { account: { id: 'account-2' } } };
      overviewData.healthFactorData = null;
      rerender(<Overview eModeStatus={null} overviewData={overviewData} />);
      expect(loading()).toBe('true');
    } finally {
      context.market = originalMarket;
      context.earnAccount = originalEarnAccount;
      overviewData.healthFactorData = originalHealthFactorData;
      overviewData.isHealthFactorLoading = originalHealthFactorLoading;
    }
  });
});
