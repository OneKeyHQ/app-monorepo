/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { BorrowMobileSummary } from './BorrowMobileSummary';

import type { IBorrowOverviewData } from '../hooks/useBorrowOverviewData';

const suppliedMetricId = `metric-${ETranslations.defi_supplied_balance}`;

type IReservesData = {
  overview?: { platformBonus?: unknown };
  supplied?: { suppliedBalance?: { title: { text: string } } };
};

const context: { reserves: { data?: IReservesData } } = {
  reserves: { data: undefined },
};

const overviewData = (over: Partial<IBorrowOverviewData> = {}) =>
  ({
    healthFactorData: undefined,
    isHealthFactorLoading: false,
    borrowRewards: undefined,
    isRewardsLoading: false,
    isManualRefreshing: false,
    requestRefresh: jest.fn(),
    ...over,
  }) as unknown as IBorrowOverviewData;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('react-native', () => ({
  __esModule: true,
  StyleSheet: { hairlineWidth: 1 },
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
    DashText: Container,
    SizableText: Container,
    XStack: Container,
    YStack: Container,
  };
});

jest.mock('../../Staking/components/ProtocolDetails/EarnTooltip', () => ({
  __esModule: true,
  EarnTooltip: () => null,
}));
jest.mock('../BorrowProvider', () => ({
  __esModule: true,
  useBorrowContext: () => context,
}));
jest.mock('./OverviewMetric', () => ({
  __esModule: true,
  OverviewMetric: ({ title }: { title: { text: string } }) => (
    <div data-testid={`metric-${title.text}`} />
  ),
}));
jest.mock('./BorrowBonusMetric', () => ({
  __esModule: true,
  BorrowBonusMetric: () => <div data-testid="bonus-metric" />,
}));
jest.mock('./BorrowRewardsMetric', () => ({
  __esModule: true,
  BorrowRewardsMetric: () => <div data-testid="rewards-metric" />,
}));

describe('BorrowMobileSummary', () => {
  beforeEach(() => {
    context.reserves.data = undefined;
  });

  // A first-time market has no totals, no bonus record and nothing to claim.
  // The frame itself draws a rule across the page, so rendering it empty leaves
  // a line with nothing under it.
  it('renders nothing at all when every metric is empty', () => {
    const { container } = render(
      <BorrowMobileSummary
        overviewData={overviewData()}
        showPositionTotals={false}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  // Rewards outlive the position that earned them: withdrawing everything
  // leaves a claim still to make, and this metric is the only way to reach it.
  it('keeps rewards reachable after the last position is gone', () => {
    const { queryByTestId } = render(
      <BorrowMobileSummary
        overviewData={overviewData({
          borrowRewards: { description: { text: '$12.00' } },
        } as Partial<IBorrowOverviewData>)}
        showPositionTotals={false}
      />,
    );

    expect(queryByTestId('rewards-metric')).toBeTruthy();
    expect(queryByTestId(suppliedMetricId)).toBeNull();
  });

  it('drops the bonus cell when the market sent no bonus', () => {
    context.reserves.data = {
      supplied: { suppliedBalance: { title: { text: '$10.00' } } },
    };
    const { queryByTestId } = render(
      <BorrowMobileSummary overviewData={overviewData()} showPositionTotals />,
    );

    expect(queryByTestId('bonus-metric')).toBeNull();
    expect(queryByTestId(suppliedMetricId)).toBeTruthy();
  });

  it('shows the bonus cell once the market sends one', () => {
    context.reserves.data = { overview: { platformBonus: {} } };
    const { queryByTestId } = render(
      <BorrowMobileSummary
        overviewData={overviewData()}
        showPositionTotals={false}
      />,
    );

    expect(queryByTestId('bonus-metric')).toBeTruthy();
  });

  // A load in flight is not evidence of emptiness; the cells hold their place
  // as skeletons rather than popping in when it lands.
  it('holds the frame while reserves are still pending', () => {
    const { queryByTestId } = render(
      <BorrowMobileSummary
        overviewData={overviewData()}
        showPositionTotals={false}
        isPositionTotalsLoading
      />,
    );

    expect(queryByTestId(suppliedMetricId)).toBeTruthy();
    expect(queryByTestId('bonus-metric')).toBeTruthy();
  });
});
