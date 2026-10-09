/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import {
  StockAbout,
  StockOverviewGrid,
} from '../../layouts/StockDesktopLayout';

import { StockMobileOverview } from './StockMobileOverview';

jest.mock('@onekeyhq/components', () => {
  function StackComponent({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
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
