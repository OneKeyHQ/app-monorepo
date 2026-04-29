/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { MAX_BUFFERED_TRANSACTIONS } from '../components/TransactionsHistory/hooks/transactionBufferUtils';

import { DesktopInformationTabs } from './DesktopInformationTabs';

const mockResumeRealtimeUpdates = jest.fn();
const mockFlushBufferedTransactions = jest.fn();
const mockScrollTransactionsToTop = jest.fn();
const mockHandleTabChange = jest.fn();
const mockHandleRealtimePauseHoverIn = jest.fn();
const mockHandleRealtimePauseHoverOut = jest.fn();

const mockRealtimePauseState = {
  isPaused: true,
  bufferedCount: 2,
  hasBufferOverflow: false,
  resumeRealtimeUpdates: mockResumeRealtimeUpdates,
  flushBufferedTransactions: mockFlushBufferedTransactions,
  scrollTransactionsToTop: mockScrollTransactionsToTop,
  handleRealtimePauseHoverIn: mockHandleRealtimePauseHoverIn,
  handleRealtimePauseHoverOut: mockHandleRealtimePauseHoverOut,
};

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: ({ children }: { children?: ReactNode }) => <svg>{children}</svg>,
  Path: () => <path />,
}));

jest.mock('@onekeyhq/components', () => {
  const Box = ({
    children,
    onMouseEnter,
    onMouseLeave,
    onPress,
  }: {
    children?: ReactNode;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onPress?: () => void;
  }) =>
    onPress ? (
      <button
        type="button"
        onClick={onPress}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {children}
      </button>
    ) : (
      <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        {children}
      </div>
    );
  const Badge = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  function BadgeText({ children }: { children?: ReactNode }) {
    return <span>{children}</span>;
  }
  Badge.Text = BadgeText;

  return {
    Badge,
    Icon: () => <span>icon</span>,
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Tabs: {
      Container: ({
        children,
        renderTabBar,
      }: {
        children?: ReactNode;
        renderTabBar: (props: { tabNames: string[] }) => ReactNode;
      }) => (
        <div>
          {renderTabBar({ tabNames: ['Transactions', 'Portfolio'] })}
          {children}
        </div>
      ),
      Tab: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      TabBar: () => <div data-testid="tab-bar" />,
    },
    XStack: Box,
    YStack: Box,
  };
});

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useMarketTransactionsRealtimePauseAtom: () => [mockRealtimePauseState],
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: (
      { id }: { id: string },
      values?: {
        amount?: string;
      },
    ) => (values?.amount ? `${id}:${values.amount}` : id),
  }),
}));

jest.mock('@onekeyhq/shared/src/consts/marketConsts', () => ({
  isHoldersTabSupported: () => false,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/numberUtils', () => ({
  NUMBER_FORMATTER: {
    marketCap: (value: string) => value,
  },
  formatDisplayNumber: (value: string) => value,
}));

jest.mock('../../../hooks/useTokenDetail', () => ({
  useTokenDetail: () => ({
    tokenAddress: '0xabc',
    networkId: 'evm--1',
    tokenDetail: undefined,
    isNative: false,
  }),
}));

jest.mock('../components/Holders', () => ({
  Holders: () => <div>holders</div>,
}));

jest.mock('../components/Portfolio', () => ({
  Portfolio: () => <div>portfolio</div>,
}));

jest.mock('../components/TransactionsHistory', () => ({
  TransactionsHistory: () => <div>transactions</div>,
}));

jest.mock('../hooks/useBottomTabAnalytics', () => ({
  useBottomTabAnalytics: () => ({
    handleTabChange: mockHandleTabChange,
  }),
}));

jest.mock('../hooks/useNetworkAccountAddress', () => ({
  useNetworkAccountAddress: () => ({
    accountAddress: '0xwallet',
  }),
}));

jest.mock('./StickyHeader', () => ({
  StickyHeader: () => <div>sticky-header</div>,
}));

describe('DesktopInformationTabs', () => {
  beforeEach(() => {
    Object.assign(mockRealtimePauseState, {
      isPaused: true,
      bufferedCount: 2,
      hasBufferOverflow: false,
    });
    mockResumeRealtimeUpdates.mockReset();
    mockFlushBufferedTransactions.mockReset();
    mockScrollTransactionsToTop.mockReset();
    mockHandleTabChange.mockReset();
    mockHandleRealtimePauseHoverIn.mockReset();
    mockHandleRealtimePauseHoverOut.mockReset();
  });

  it('resumes realtime updates and scrolls to top when the updates pill is clicked', () => {
    render(<DesktopInformationTabs portfolioData={[]} />);

    fireEvent.click(screen.getByText('marketdex.new_updates:2'));

    expect(mockResumeRealtimeUpdates).toHaveBeenCalledTimes(1);
    expect(mockScrollTransactionsToTop).toHaveBeenCalledTimes(1);
  });

  it('uses the shared max buffer size in the overflow updates label', () => {
    mockRealtimePauseState.hasBufferOverflow = true;

    render(<DesktopInformationTabs portfolioData={[]} />);

    expect(
      screen.getByText(new RegExp(`${MAX_BUFFERED_TRANSACTIONS}\\+$`)),
    ).toBeTruthy();
  });
});
