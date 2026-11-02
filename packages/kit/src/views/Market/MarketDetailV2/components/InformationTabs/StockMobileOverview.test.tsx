/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { StockEventsSection } from '../../layouts/components/StockEventsSection';
import { StockNewsSection } from '../../layouts/components/StockNewsSection';
import {
  StockAbout,
  StockAnalystRatings,
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
  StockEventsSection: jest.fn(() => <div data-testid="stock-events" />),
}));

jest.mock('../../layouts/components/StockNewsSection', () => ({
  StockNewsSection: jest.fn(() => <div data-testid="stock-news" />),
}));

describe('StockMobileOverview', () => {
  beforeEach(() => {
    jest.mocked(StockOverviewGrid).mockClear();
    jest.mocked(StockAbout).mockClear();
    jest.mocked(StockAnalystRatings).mockClear();
    jest.mocked(StockEventsSection).mockClear();
    jest.mocked(StockNewsSection).mockClear();
  });

  it('renders the mobile variants of the shared sections', () => {
    render(<StockMobileOverview />);

    expect(jest.mocked(StockAnalystRatings).mock.calls[0]?.[0]).toEqual({
      variant: 'compact',
    });
    expect(jest.mocked(StockEventsSection).mock.calls[0]?.[0]).toEqual({
      variant: 'mobile',
    });
    expect(jest.mocked(StockNewsSection).mock.calls[0]?.[0]).toEqual({
      variant: 'mobile',
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
