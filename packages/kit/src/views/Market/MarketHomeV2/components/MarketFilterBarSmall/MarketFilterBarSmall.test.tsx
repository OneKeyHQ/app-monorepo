/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import { MarketListColumnHeader } from '../MarketListColumnHeader';

import { MarketFilterBarSmall } from './MarketFilterBarSmall';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

// Every `@onekeyhq/components/...` path resolves to this mock, including the
// `scale` helper the Market layout constants use.
jest.mock('@onekeyhq/components', () => ({
  Icon: () => null,
  SizableText: ({ children }: PropsWithChildren) => <span>{children}</span>,
  XStack: ({
    children,
    justifyContent,
    height,
  }: PropsWithChildren<{ justifyContent?: string; height?: number }>) => (
    <div data-justify={justifyContent} data-height={height}>
      {children}
    </div>
  ),
  s: (value: number) => value,
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
    // Fills the category chip row so its labels line up with the chips.
    expect(row?.getAttribute('data-height')).toBe('56');
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
