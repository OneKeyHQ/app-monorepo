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

type IRewardGroup = { items: { id: string }[] };

const group = (...ids: string[]): IRewardGroup => ({
  items: ids.map((id) => ({ id })),
});

// Shaped the way the server sends it: the object arrives either way. `disabled`
// is the server's own verdict on whether a claim can be made, and it tracks the
// claimable list unless a case overrides it to pull the two apart.
const rewards = ({
  claimable = [],
  unclaimable = [],
  disabled,
}: {
  claimable?: IRewardGroup[];
  unclaimable?: IRewardGroup[];
  disabled?: boolean;
} = {}) =>
  ({
    title: { text: 'Rewards' },
    description: { text: '$0' },
    button: {
      disabled: disabled ?? !claimable.some((item) => item.items.length > 0),
      data: { rewardsDetail: { claimable, unclaimable } },
    },
  }) as unknown as IBorrowOverviewData['borrowRewards'];

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
  BorrowRewardsMetric: ({ isError }: { isError?: boolean }) => (
    <div data-testid="rewards-metric" data-error={String(Boolean(isError))} />
  ),
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
          borrowRewards: rewards({ claimable: [group('r1')] }),
        })}
        showPositionTotals={false}
      />,
    );

    expect(queryByTestId('rewards-metric')).toBeTruthy();
    expect(queryByTestId(suppliedMetricId)).toBeNull();
  });

  // The server answers a first-time account with a zero-valued rewards object
  // rather than nothing at all, so the cell used to render "$0" under a rule of
  // its own on a page that had just finished hiding every other empty figure.
  it('drops the whole frame when rewards arrive with nothing to collect', () => {
    const { container, queryByTestId } = render(
      <BorrowMobileSummary
        overviewData={overviewData({ borrowRewards: rewards() })}
        showPositionTotals={false}
      />,
    );

    expect(queryByTestId('rewards-metric')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  // Rewards that exist but cannot be claimed yet still have a dialog behind
  // them listing why, so the cell stays.
  it('keeps the cell for rewards that are not claimable yet', () => {
    const { queryByTestId } = render(
      <BorrowMobileSummary
        overviewData={overviewData({
          borrowRewards: rewards({ unclaimable: [group('u1')] }),
        })}
        showPositionTotals={false}
      />,
    );

    expect(queryByTestId('rewards-metric')).toBeTruthy();
  });

  // The dialog behind the cell is built from the two lists alone, so a server
  // that leaves the claim enabled over an empty payload is offering a button
  // that opens nothing. The lists decide, not the flag.
  it('stays hidden when the claim reads live over an empty payload', () => {
    const { container, queryByTestId } = render(
      <BorrowMobileSummary
        overviewData={overviewData({
          borrowRewards: rewards({
            disabled: false,
          }),
        })}
        showPositionTotals={false}
      />,
    );

    expect(queryByTestId('rewards-metric')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  // Counting groups rather than the items inside them let an empty group stand
  // in for a reward, putting up a $0 cell whose dialog had nothing to claim.
  it('drops the cell for a claim group with nothing inside it', () => {
    const { container, queryByTestId } = render(
      <BorrowMobileSummary
        overviewData={overviewData({
          borrowRewards: rewards({
            claimable: [group()],
          }),
        })}
        showPositionTotals={false}
      />,
    );

    expect(queryByTestId('rewards-metric')).toBeNull();
    expect(container.firstChild).toBeNull();
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

  it('shows an error placeholder for failed rewards instead of dropping the cell', () => {
    const { getByTestId } = render(
      <BorrowMobileSummary
        overviewData={overviewData({ isRewardsError: true })}
        showPositionTotals={false}
      />,
    );

    expect(getByTestId('rewards-metric').getAttribute('data-error')).toBe(
      'true',
    );
  });
});
