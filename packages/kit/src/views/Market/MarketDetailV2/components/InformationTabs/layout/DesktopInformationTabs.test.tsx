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
let mockHoldersTabSupported = false;
const mockTokenDetailState = {
  tokenAddress: '0xabc',
  networkId: 'evm--1',
  tokenDetail: undefined,
  isNative: false,
  isStockToken: false,
};

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
  const React = jest.requireActual<typeof import('react')>('react');
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
    Icon: ({ color, name }: { color?: string; name: string }) => (
      <span data-testid={`icon-${name}`} data-color={color}>
        icon
      </span>
    ),
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Tabs: {
      Container: ({
        children,
        renderTabBar,
      }: {
        children?: ReactNode;
        renderTabBar: (props: {
          tabNames: string[];
          focusedTab: { value: string };
          onTabPress: (name: string) => void;
        }) => ReactNode;
      }) => {
        const tabNames = React.Children.toArray(children).flatMap((child) =>
          React.isValidElement<{ name?: string }>(child) && child.props.name
            ? [child.props.name]
            : [],
        );
        return (
          <div>
            {renderTabBar({
              tabNames,
              focusedTab: { value: tabNames[0] ?? '' },
              onTabPress: jest.fn(),
            })}
            {children}
          </div>
        );
      },
      Tab: ({ children }: { children?: ReactNode; name: string }) => (
        <div>{children}</div>
      ),
      TabBar: ({
        renderItem,
        tabNames,
      }: {
        renderItem: (props: {
          name: string;
          isFocused: boolean;
          onPress: (name: string) => void;
        }) => ReactNode;
        tabNames: string[];
      }) => (
        <div data-testid="tab-bar">
          {tabNames.map((name, index) =>
            React.createElement(
              React.Fragment,
              { key: name },
              renderItem({
                name,
                isFocused: index === 0,
                onPress: jest.fn(),
              }),
            ),
          )}
        </div>
      ),
      TabBarItem: ({ label, name }: { label?: string; name: string }) => (
        <span data-testid={`tab-bar-item-${name}`} data-name={name}>
          {label ?? name}
        </span>
      ),
      ScrollView: ({ children }: { children?: ReactNode }) => (
        <div>{children}</div>
      ),
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
  isHoldersTabSupported: () => mockHoldersTabSupported,
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
  useTokenDetail: () => mockTokenDetailState,
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

jest.mock('../../TokenLiquidityPools', () => ({
  TokenLiquidityPools: () => <div>liquidity-pools</div>,
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
    Object.assign(mockTokenDetailState, {
      tokenAddress: '0xabc',
      networkId: 'evm--1',
      tokenDetail: undefined,
      isNative: false,
      isStockToken: false,
    });
    mockResumeRealtimeUpdates.mockReset();
    mockFlushBufferedTransactions.mockReset();
    mockScrollTransactionsToTop.mockReset();
    mockHandleTabChange.mockReset();
    mockHandleRealtimePauseHoverIn.mockReset();
    mockHandleRealtimePauseHoverOut.mockReset();
    mockHoldersTabSupported = false;
  });

  it('resumes realtime updates and scrolls to top when the updates pill is clicked', () => {
    render(<DesktopInformationTabs portfolioData={[]} />);

    fireEvent.click(screen.getByText('marketdex.new_updates:2'));

    expect(mockResumeRealtimeUpdates).toHaveBeenCalledTimes(1);
    expect(mockScrollTransactionsToTop).toHaveBeenCalledTimes(1);
  });

  it('uses the inverse icon color for the updates arrow', () => {
    render(<DesktopInformationTabs portfolioData={[]} />);

    expect(
      screen.getByTestId('icon-ArrowTopSolid').getAttribute('data-color'),
    ).toBe('$iconInverse');
  });

  it('uses the shared max buffer size in the overflow updates label', () => {
    mockRealtimePauseState.hasBufferOverflow = true;

    render(<DesktopInformationTabs portfolioData={[]} />);

    expect(
      screen.getByText(new RegExp(`${MAX_BUFFERED_TRANSACTIONS}\\+$`)),
    ).toBeTruthy();
  });

  it('does not render liquidity pools for native tokens', () => {
    mockTokenDetailState.isNative = true;

    render(<DesktopInformationTabs portfolioData={[]} />);

    expect(screen.queryByText('liquidity-pools')).toBeNull();
  });

  it('keeps the holders tab identity stable when its count label loads', () => {
    mockHoldersTabSupported = true;
    Object.assign(mockTokenDetailState, { tokenDetail: { holders: 123 } });

    render(<DesktopInformationTabs portfolioData={[]} />);

    const holdersTab = screen.getByTestId('tab-bar-item-dexmarket.holders');
    expect(holdersTab.getAttribute('data-name')).toBe('dexmarket.holders');
    expect(holdersTab.textContent).toBe('dexmarket.holders (123)');
  });
});
