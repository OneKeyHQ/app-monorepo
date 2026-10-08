/** @jest-environment jsdom */

import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { MobileInformationTabs } from './MobileInformationTabs';

import type { CollapsibleProps } from 'react-native-collapsible-tab-view';

const mockContainerProps = jest.fn();
const mockChartMount = jest.fn();
const mockChartUnmount = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    DelayedFreeze:
      jest.requireActual<typeof import('react-freeze')>('react-freeze').Freeze,
    HeaderScrollGestureWrapper: Box,
    YStack: Box,
    Tabs: {
      Container: (props: CollapsibleProps) => {
        mockContainerProps(props);
        const headerProps = {
          tabNames: ['transactions'],
          focusedTab: { value: 'transactions' },
        } as Parameters<NonNullable<CollapsibleProps['renderHeader']>>[0];
        return (
          <div>
            {props.renderHeader?.(headerProps)}
            {props.renderTabBar?.(headerProps)}
            {props.children}
          </div>
        );
      },
      Tab: Box,
      ScrollView: Box,
      TabBar: () => <div data-testid="information-tab-bar" />,
    },
  };
});
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { isBTCNetwork: () => false },
}));
jest.mock('@onekeyhq/kit/src/hooks/useTabContainerWidth', () => ({
  useTabContainerWidth: () => 390,
}));
jest.mock('../../../hooks/useTokenDetail', () => ({
  useTokenDetail: () => ({ networkId: 'evm--1', isNative: true }),
}));
jest.mock('../hooks/useNetworkAccountAddress', () => ({
  useNetworkAccountAddress: () => ({}),
}));
jest.mock('../hooks/useBottomTabAnalytics', () => ({
  useBottomTabAnalytics: () => ({ handleTabChange: jest.fn() }),
}));
jest.mock('../../TokenLiquidityPools', () => ({
  TokenLiquidityPools: () => null,
}));
jest.mock('../components/Holders', () => ({ Holders: () => null }));
jest.mock('../components/Portfolio', () => ({ Portfolio: () => null }));
jest.mock('../components/TransactionsHistory', () => ({
  TransactionsHistory: () => null,
}));
jest.mock('./StickyHeader', () => ({ StickyHeader: () => null }));

function Chart() {
  useEffect(() => {
    mockChartMount();
    return () => {
      mockChartUnmount();
    };
  }, []);
  return <input aria-label="chart viewport" defaultValue="latest" />;
}

describe('MobileInformationTabs chart fullscreen', () => {
  it('keeps the chart controller mounted while the hidden information content is frozen', async () => {
    const renderTabs = (isChartFullscreen: boolean) => (
      <MobileInformationTabs
        freezeContent={isChartFullscreen}
        containerWidth={390}
        scrollEnabled={!isChartFullscreen}
        renderHeader={() => <Chart />}
        onScrollEnd={jest.fn()}
        portfolioData={[]}
      />
    );
    const { rerender } = render(renderTabs(false));
    const chart = screen.getByRole('textbox', { name: 'chart viewport' });
    fireEvent.change(chart, { target: { value: 'historical candles' } });
    expect(screen.queryByTestId('information-tab-bar')).not.toBeNull();

    await act(async () => rerender(renderTabs(true)));
    expect(mockContainerProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        width: 390,
      }),
    );
    expect(screen.queryByTestId('information-tab-bar')).not.toBeNull();

    await act(async () => rerender(renderTabs(false)));
    expect(mockContainerProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        width: 390,
      }),
    );
    expect(screen.queryByTestId('information-tab-bar')).not.toBeNull();
    expect(screen.getByRole('textbox', { name: 'chart viewport' })).toBe(chart);
    expect((chart as HTMLInputElement).value).toBe('historical candles');
    expect(mockChartMount).toHaveBeenCalledTimes(1);
    expect(mockChartUnmount).not.toHaveBeenCalled();
  });
});
