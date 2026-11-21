/** @jest-environment jsdom */
/*
yarn jest packages/kit/src/views/RewardCenter/pages/SubsidyCenter/SubsidyRecords.test.tsx
*/
import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { SubsidyRecentRecords, SubsidyRecordsPaged } from './SubsidyRecords';

import type {
  ISubsidyHistoryView,
  ISubsidyQuery,
  ISubsidyRecordListItem,
} from './useSubsidyRecords';

const mockUseSubsidyHistoryPage: jest.Mock<
  ISubsidyQuery<ISubsidyHistoryView>,
  []
> = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

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

jest.mock('./useSubsidyRecords', () => ({
  useSubsidyHistoryPage: () => mockUseSubsidyHistoryPage(),
  useSubsidyRecordsRefresh: () => undefined,
}));

const record: ISubsidyRecordListItem = {
  id: 'tron_energy:attempt-1',
  icon: 'FlashOutline',
  title: 'TRON energy',
  networkId: 'tron--0x2b6653dc',
  networkName: 'Tron',
  createdAt: '2026-11-09T01:41:00.000Z',
  statusLabel: 'Issued',
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
    reload: jest.fn(),
    ...overrides,
  };
}

const PARTIAL_RETRY = 'subsidy-records-partial-retry';

describe('SubsidyRecentRecords', () => {
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
});
