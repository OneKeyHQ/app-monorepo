/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import { MarketListColumnHeader } from '../MarketListColumnHeader';

import { MarketFilterBarSmall } from './MarketFilterBarSmall';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => ({
  Icon: () => null,
  SizableText: ({ children }: PropsWithChildren) => <span>{children}</span>,
  XStack: ({
    children,
    justifyContent,
  }: PropsWithChildren<{ justifyContent?: string }>) => (
    <div data-justify={justifyContent}>{children}</div>
  ),
  YStack: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

jest.mock('../MobileNetworkDropdown', () => ({
  MobileNetworkDropdown: () => <span data-testid="network-filter" />,
}));

jest.mock('../TimeRangeDropdown', () => ({
  TimeRangeDropdown: () => <span data-testid="time-range-filter" />,
}));

describe('MarketFilterBarSmall', () => {
  test('lines the time range up after the network selector on the left', () => {
    render(<MarketFilterBarSmall onTimeRangeChange={jest.fn()} />);

    const timeRange = screen.getByTestId('time-range-filter');
    const row = timeRange.parentElement;
    expect(row?.getAttribute('data-justify')).toBe('flex-start');
    expect(
      screen.getByTestId('network-filter').compareDocumentPosition(timeRange) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test('keeps the time range on the left when the network selector is hidden', () => {
    render(
      <MarketFilterBarSmall
        showNetworkSelector={false}
        onTimeRangeChange={jest.fn()}
      />,
    );

    expect(
      screen
        .getByTestId('time-range-filter')
        .parentElement?.getAttribute('data-justify'),
    ).toBe('flex-start');
  });
});

describe('MarketListColumnHeader', () => {
  test('titles the first column Name / Volume', () => {
    render(<MarketListColumnHeader />);

    expect(
      screen.getByText('global.name / market.stock_volume__title'),
    ).toBeTruthy();
  });
});
