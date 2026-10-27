/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import {
  StockAbout,
  StockAnalystRatings,
  StockOverviewGrid,
} from '../../layouts/StockDesktopLayout';

import { StockMobileOverview } from './StockMobileOverview';

let mockLayoutWidth = 375;

jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: 375, height: 812 }),
}));

jest.mock('@onekeyhq/components', () => {
  function StackComponent({
    children,
    onLayout,
  }: {
    children?: ReactNode;
    onLayout?: (event: { nativeEvent: { layout: { width: number } } }) => void;
  }) {
    return (
      <div>
        {onLayout ? (
          <button
            type="button"
            data-testid="measure-overview"
            onClick={() =>
              onLayout({ nativeEvent: { layout: { width: mockLayoutWidth } } })
            }
          >
            Measure
          </button>
        ) : null}
        {children}
      </div>
    );
  }

  return { YStack: StackComponent };
});

jest.mock('../../layouts/StockDesktopLayout', () => ({
  StockOverviewGrid: jest.fn(() => null),
  StockAnalystRatings: jest.fn(() => <div data-testid="stock-analyst" />),
  StockAbout: jest.fn(() => null),
}));

jest.mock('../../layouts/components/StockEventsSection', () => ({
  StockEventsSection: () => <div data-testid="stock-events" />,
}));

jest.mock('../../layouts/components/StockNewsSection', () => ({
  StockNewsSection: () => <div data-testid="stock-news" />,
}));

describe('StockMobileOverview', () => {
  beforeEach(() => {
    jest.mocked(StockOverviewGrid).mockClear();
    jest.mocked(StockAbout).mockClear();
    jest.mocked(StockAnalystRatings).mockClear();
    mockLayoutWidth = 375;
  });

  it('fits the analyst gauge to the content width after layout and resize', () => {
    const view = render(<StockMobileOverview />);
    expect(jest.mocked(StockAnalystRatings).mock.lastCall?.[0]).toEqual({
      gaugeWidth: 327,
    });

    mockLayoutWidth = 320;
    fireEvent.click(view.getByTestId('measure-overview'));
    expect(jest.mocked(StockAnalystRatings).mock.lastCall?.[0]).toEqual({
      gaugeWidth: 272,
    });

    mockLayoutWidth = 430;
    fireEvent.click(view.getByTestId('measure-overview'));
    expect(jest.mocked(StockAnalystRatings).mock.lastCall?.[0]).toEqual({
      gaugeWidth: 382,
    });
  });

  it('reuses the desktop overview sections in two columns', () => {
    const view = render(<StockMobileOverview />);

    expect(jest.mocked(StockOverviewGrid).mock.calls[0]?.[0]).toEqual({
      columns: 2,
    });
    expect(jest.mocked(StockAbout).mock.calls[0]?.[0]).toEqual({
      columns: 2,
    });
    expect(view.getByTestId('stock-events')).toBeTruthy();
    expect(view.getByTestId('stock-analyst')).toBeTruthy();
    expect(view.getByTestId('stock-news')).toBeTruthy();
    expect(view.queryByTestId('stock-financials')).toBeNull();
  });
});
