/** @jest-environment jsdom */
/*
yarn jest packages/kit/src/views/RewardCenter/pages/SubsidyCenter/SubsidyRecords.test.tsx
*/
import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  SubsidyRecentRecords,
  SubsidyRecordsPaged,
  SubsidySummaryIssue,
} from './SubsidyRecords';

import type { ISubsidyRecordRow } from './subsidyRecordUtils';
import type { ISubsidyHistoryView, ISubsidyQuery } from './useSubsidyRecords';

const mockUseSubsidyHistoryPage: jest.Mock<
  ISubsidyQuery<ISubsidyHistoryView>,
  []
> = jest.fn();

let mockLocale = 'en';
jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => `${mockLocale}:${id}`,
  }),
}));
beforeEach(() => {
  mockLocale = 'en';
});

jest.mock('@onekeyhq/components', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) =>
    children ?? null;
  const Null = () => null;
  const Container = ({
    testID,
    children,
  }: {
    testID?: string;
    children?: ReactNode;
  }) => <div data-testid={testID}>{children}</div>;
  const Text = ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  );
  return {
    Button: ({
      testID,
      disabled,
      loading,
      onPress,
      children,
    }: {
      testID?: string;
      disabled?: boolean;
      loading?: boolean;
      onPress?: () => void;
      children?: ReactNode;
    }) => (
      <button
        type="button"
        data-testid={testID}
        disabled={Boolean(disabled || loading)}
        onClick={onPress}
      >
        {children}
      </button>
    ),
    Empty: Null,
    Icon: Null,
    IconButton: Null,
    NumberSizeableText: Text,
    Page: Object.assign(Passthrough, {
      Header: Null,
      Body: Passthrough,
      Footer: Passthrough,
    }),
    Pagination: Null,
    ScrollView: Passthrough,
    SizableText: Text,
    Skeleton: Object.assign(Null, {
      HeadingSm: Null,
      BodySm: Null,
    }),
    Stack: Container,
    XStack: Container,
    YStack: Container,
  };
});

jest.mock('@onekeyhq/shared/src/utils/dateUtils', () => ({
  formatDate: () => 'date',
}));

jest.mock('@onekeyhq/kit/src/components/NetworkAvatar', () => ({
  NetworkAvatar: () => null,
}));

jest.mock('./useSubsidyRecords', () => ({
  useSubsidyHistoryPage: () => mockUseSubsidyHistoryPage(),
  useSubsidyRecordsRefresh: () => undefined,
}));

const record: ISubsidyRecordRow = {
  id: 'tron_energy:attempt-1',
  icon: 'FlashOutline',
  titleId: ETranslations.subsidy_free_claim__title,
  networkId: 'tron--0x2b6653dc',
  createdAt: '2026-11-09T01:41:00.000Z',
  statusId: ETranslations.subsidy_claimed__title,
};

function historyQuery(
  data: Partial<ISubsidyHistoryView>,
  overrides: Partial<ISubsidyQuery<ISubsidyHistoryView>> = {},
): ISubsidyQuery<ISubsidyHistoryView> {
  return {
    data: {
      items: [record],
      isPartial: false,
      hasMore: false,
      total: 1,
      ...data,
    },
    isLoading: false,
    isError: false,
    isPreviousData: false,
    isFetching: false,
    isRefreshError: false,
    reload: jest.fn(),
    ...overrides,
  };
}

const PARTIAL_RETRY = 'subsidy-records-partial-retry';
const STALE_RETRY = 'subsidy-records-stale-retry';

const SUMMARY_RETRY = 'subsidy-summary-error-retry';

function summaryQuery(
  overrides: Partial<ISubsidyQuery<unknown>> = {},
): ISubsidyQuery<unknown> {
  return {
    data: { sponsorCostUsd: '1.2' },
    isLoading: false,
    isError: false,
    isPreviousData: false,
    isFetching: false,
    isRefreshError: false,
    reload: jest.fn(),
    ...overrides,
  };
}

describe('SubsidySummaryIssue', () => {
  it('shows nothing while the totals are current', () => {
    render(<SubsidySummaryIssue query={summaryQuery()} />);
    expect(screen.queryByTestId(SUMMARY_RETRY)).toBeNull();
  });

  it('offers a retry when the totals failed to load', () => {
    const query = summaryQuery({ data: undefined, isError: true });
    render(<SubsidySummaryIssue query={query} />);
    fireEvent.click(screen.getByTestId(SUMMARY_RETRY));
    expect(query.reload).toHaveBeenCalledTimes(1);
  });

  // The totals on screen are from an earlier request: after a claim they do
  // not count it yet, so the failed refresh must not pass silently.
  it.each([false, true])(
    'offers a retry when the totals on screen could not be refreshed (compact: %s)',
    (compact) => {
      const query = summaryQuery({ isRefreshError: true });
      render(<SubsidySummaryIssue query={query} compact={compact} />);
      fireEvent.click(screen.getByTestId(SUMMARY_RETRY));
      expect(query.reload).toHaveBeenCalledTimes(1);
    },
  );

  it('holds the retry while the totals are being refreshed again', () => {
    const query = summaryQuery({ isRefreshError: true, isFetching: true });
    render(<SubsidySummaryIssue query={query} compact />);
    const retry = screen.getByTestId(SUMMARY_RETRY);
    expect(retry).toHaveProperty('disabled', true);
    fireEvent.click(retry);
    expect(query.reload).not.toHaveBeenCalled();
  });
});

describe('SubsidyRecentRecords', () => {
  it('updates cached record titles and statuses when the locale changes', () => {
    const query = historyQuery({});
    const { rerender } = render(<SubsidyRecentRecords query={query} />);
    expect(
      screen.getByText(`en:${ETranslations.subsidy_free_claim__title}`),
    ).toBeTruthy();
    expect(
      screen.getByText(`en:${ETranslations.subsidy_claimed__title}`),
    ).toBeTruthy();
    mockLocale = 'zh';
    rerender(<SubsidyRecentRecords query={query} />);
    expect(
      screen.getByText(`zh:${ETranslations.subsidy_free_claim__title}`),
    ).toBeTruthy();
    expect(
      screen.getByText(`zh:${ETranslations.subsidy_claimed__title}`),
    ).toBeTruthy();
    expect(
      screen.queryByText(`en:${ETranslations.subsidy_free_claim__title}`),
    ).toBeNull();
  });
  it('offers no retry for a complete result', () => {
    render(<SubsidyRecentRecords query={historyQuery({})} />);
    expect(screen.getAllByTestId('subsidy-record-row')).toHaveLength(1);
    expect(screen.queryByTestId(PARTIAL_RETRY)).toBeNull();
  });

  it('keeps the loaded records and offers a retry for a partial result', () => {
    const query = historyQuery({ isPartial: true });
    render(<SubsidyRecentRecords query={query} />);
    expect(screen.getAllByTestId('subsidy-record-row')).toHaveLength(1);
    fireEvent.click(screen.getByTestId(PARTIAL_RETRY));
    expect(query.reload).toHaveBeenCalledTimes(1);
  });

  it('offers a retry for a partial result without records', () => {
    const query = historyQuery({ isPartial: true, items: [] });
    render(<SubsidyRecentRecords query={query} />);
    expect(screen.queryByTestId('subsidy-record-row')).toBeNull();
    fireEvent.click(screen.getByTestId(PARTIAL_RETRY));
    expect(query.reload).toHaveBeenCalledTimes(1);
  });

  it('holds the retry while a request is in flight', () => {
    const query = historyQuery({ isPartial: true }, { isFetching: true });
    render(<SubsidyRecentRecords query={query} />);
    const retry = screen.getByTestId(PARTIAL_RETRY);
    expect(retry).toHaveProperty('disabled', true);
    fireEvent.click(retry);
    expect(query.reload).not.toHaveBeenCalled();
  });

  it('keeps the records and offers a retry when their refresh failed', () => {
    const query = historyQuery({}, { isRefreshError: true });
    render(<SubsidyRecentRecords query={query} />);
    expect(screen.getAllByTestId('subsidy-record-row')).toHaveLength(1);
    fireEvent.click(screen.getByTestId(STALE_RETRY));
    expect(query.reload).toHaveBeenCalledTimes(1);
  });

  // An empty history, a claim, and a refresh that failed: the claim's record
  // exists, so "no history" would be wrong.
  it('does not report an empty result as no history when its refresh failed', () => {
    const query = historyQuery({ items: [] }, { isRefreshError: true });
    render(<SubsidyRecentRecords query={query} />);
    expect(
      screen.queryByText(`en:${ETranslations.subsidy_records_empty__msg}`),
    ).toBeNull();
    expect(
      screen.getByText(`en:${ETranslations.subsidy_records_failed__msg}`),
    ).toBeTruthy();
    fireEvent.click(screen.getByTestId(STALE_RETRY));
    expect(query.reload).toHaveBeenCalledTimes(1);
  });
});

describe('SubsidyRecordsPaged', () => {
  it('offers no retry for a complete page', () => {
    mockUseSubsidyHistoryPage.mockReturnValue(historyQuery({}));
    render(<SubsidyRecordsPaged compact identity="user-1" />);
    expect(screen.getAllByTestId('subsidy-record-row')).toHaveLength(1);
    expect(screen.queryByTestId(PARTIAL_RETRY)).toBeNull();
  });

  it('keeps the loaded page and offers a retry for a partial page', () => {
    const query = historyQuery({ isPartial: true });
    mockUseSubsidyHistoryPage.mockReturnValue(query);
    render(<SubsidyRecordsPaged compact identity="user-1" />);
    expect(screen.getAllByTestId('subsidy-record-row')).toHaveLength(1);
    fireEvent.click(screen.getByTestId(PARTIAL_RETRY));
    expect(query.reload).toHaveBeenCalledTimes(1);
  });

  it('offers a single retry for a partial page without records', () => {
    const query = historyQuery({ isPartial: true, items: [] });
    mockUseSubsidyHistoryPage.mockReturnValue(query);
    render(<SubsidyRecordsPaged compact identity="user-1" />);
    expect(screen.getAllByTestId(PARTIAL_RETRY)).toHaveLength(1);
    fireEvent.click(screen.getByTestId(PARTIAL_RETRY));
    expect(query.reload).toHaveBeenCalledTimes(1);
  });

  // A second press would send the same page again, and the answer of the
  // later request replaces the earlier one even when it is the worse one.
  it('holds the retry of an empty partial page while a request is in flight', () => {
    const query = historyQuery(
      { isPartial: true, items: [] },
      { isFetching: true },
    );
    mockUseSubsidyHistoryPage.mockReturnValue(query);
    render(<SubsidyRecordsPaged compact identity="user-1" />);
    const retry = screen.getByTestId(PARTIAL_RETRY);
    expect(retry).toHaveProperty('disabled', true);
    fireEvent.click(retry);
    expect(query.reload).not.toHaveBeenCalled();
  });

  it('keeps the page and offers a retry when its refresh failed', () => {
    const query = historyQuery({}, { isRefreshError: true });
    mockUseSubsidyHistoryPage.mockReturnValue(query);
    render(<SubsidyRecordsPaged compact identity="user-1" />);
    expect(screen.getAllByTestId('subsidy-record-row')).toHaveLength(1);
    fireEvent.click(screen.getByTestId(STALE_RETRY));
    expect(query.reload).toHaveBeenCalledTimes(1);
  });

  it('offers a single retry instead of the empty state when the refresh of an empty page failed', () => {
    const query = historyQuery({ items: [] }, { isRefreshError: true });
    mockUseSubsidyHistoryPage.mockReturnValue(query);
    render(<SubsidyRecordsPaged compact identity="user-1" />);
    expect(screen.getAllByTestId(STALE_RETRY)).toHaveLength(1);
    fireEvent.click(screen.getByTestId(STALE_RETRY));
    expect(query.reload).toHaveBeenCalledTimes(1);
  });
});
