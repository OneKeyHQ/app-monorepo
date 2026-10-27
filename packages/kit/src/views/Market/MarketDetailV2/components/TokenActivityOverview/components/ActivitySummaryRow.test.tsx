/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { ActivitySummaryRow } from './ActivitySummaryRow';

const mockBuySellRatioBar = jest.fn((_props: unknown) => <div />);

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  function StackComponent({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  }

  return {
    NumberSizeableText: StackComponent,
    SizableText: StackComponent,
    Stack: StackComponent,
    XStack: StackComponent,
    YStack: StackComponent,
  };
});

jest.mock('./BuySellRatioBar', () => ({
  BuySellRatioBar: (props: unknown) => mockBuySellRatioBar(props),
}));

describe('ActivitySummaryRow', () => {
  beforeEach(() => {
    mockBuySellRatioBar.mockClear();
  });

  it('marks an empty activity period as no data', () => {
    render(
      <ActivitySummaryRow
        timeRange="24h"
        buyCount={0}
        sellCount={0}
        buyVolume={0}
        sellVolume={0}
        totalVolume={0}
      />,
    );

    expect(mockBuySellRatioBar.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        buyPercentage: 0,
        noData: true,
      }),
    );
  });

  it('keeps a positive activity period available', () => {
    render(
      <ActivitySummaryRow
        timeRange="24h"
        buyCount={1}
        sellCount={3}
        buyVolume={25}
        sellVolume={75}
        totalVolume={100}
      />,
    );

    expect(mockBuySellRatioBar.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        buyPercentage: 25,
        noData: false,
      }),
    );
  });
});
