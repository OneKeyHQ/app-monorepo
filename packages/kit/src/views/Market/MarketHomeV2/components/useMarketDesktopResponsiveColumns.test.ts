import {
  MARKET_LIST_FIRST_COLUMN_MAX_WIDTH,
  MARKET_LIST_FIRST_COLUMN_MIN_WIDTH,
  MARKET_LIST_METRIC_COLUMN_MIN_WIDTH,
  MARKET_LIST_STAR_COLUMN_WIDTH,
} from '../../marketDesktopLayoutConstants';

import {
  buildMarketDesktopResponsiveColumns,
  getMarketDesktopResponsiveLayout,
} from './useMarketDesktopResponsiveColumns';

describe('getMarketDesktopResponsiveLayout', () => {
  const metricColumnCount = 5;
  const allColumnsMinimumWidth =
    MARKET_LIST_FIRST_COLUMN_MIN_WIDTH +
    metricColumnCount * MARKET_LIST_METRIC_COLUMN_MIN_WIDTH;

  it('keeps the first column at 320px when every metric has enough room', () => {
    expect(
      getMarketDesktopResponsiveLayout({
        containerWidth:
          MARKET_LIST_FIRST_COLUMN_MAX_WIDTH +
          metricColumnCount * MARKET_LIST_METRIC_COLUMN_MIN_WIDTH,
        metricColumnCount,
      }),
    ).toEqual({
      firstColumnWidth: MARKET_LIST_FIRST_COLUMN_MAX_WIDTH,
      visibleMetricColumnCount: metricColumnCount,
    });
  });

  it('shrinks the first column before hiding metric columns', () => {
    expect(
      getMarketDesktopResponsiveLayout({
        containerWidth: allColumnsMinimumWidth + 32,
        metricColumnCount,
      }),
    ).toEqual({
      firstColumnWidth: MARKET_LIST_FIRST_COLUMN_MIN_WIDTH + 32,
      visibleMetricColumnCount: metricColumnCount,
    });
  });

  it('reaches 256px while all metric columns remain visible', () => {
    expect(
      getMarketDesktopResponsiveLayout({
        containerWidth: allColumnsMinimumWidth,
        metricColumnCount,
      }),
    ).toEqual({
      firstColumnWidth: MARKET_LIST_FIRST_COLUMN_MIN_WIDTH,
      visibleMetricColumnCount: metricColumnCount,
    });
  });

  it('hides metric columns from the right after the first column reaches 256px', () => {
    expect(
      getMarketDesktopResponsiveLayout({
        containerWidth: allColumnsMinimumWidth - 1,
        metricColumnCount,
      }),
    ).toEqual({
      firstColumnWidth: MARKET_LIST_FIRST_COLUMN_MIN_WIDTH,
      visibleMetricColumnCount: metricColumnCount - 1,
    });
  });

  it('always leaves the leading metric column visible', () => {
    expect(
      getMarketDesktopResponsiveLayout({
        containerWidth: 100,
        metricColumnCount,
      }),
    ).toEqual({
      firstColumnWidth: MARKET_LIST_FIRST_COLUMN_MIN_WIDTH,
      visibleMetricColumnCount: 1,
    });
  });

  it('uses the stable wide layout before the container is measured', () => {
    expect(
      getMarketDesktopResponsiveLayout({
        containerWidth: 0,
        metricColumnCount,
      }),
    ).toEqual({
      firstColumnWidth: MARKET_LIST_FIRST_COLUMN_MAX_WIDTH,
      visibleMetricColumnCount: metricColumnCount,
    });
  });
});

describe('buildMarketDesktopResponsiveColumns', () => {
  it('resizes the name column and removes metric columns from the right', () => {
    const columns = [
      {
        title: '#',
        dataIndex: 'star',
        columnWidth: MARKET_LIST_STAR_COLUMN_WIDTH,
      },
      { title: 'Name', dataIndex: 'name', columnWidth: 278 },
      { title: 'Price', dataIndex: 'price' },
      { title: 'Change', dataIndex: 'change' },
      { title: 'Volume', dataIndex: 'volume' },
    ];

    const result = buildMarketDesktopResponsiveColumns({
      columns,
      firstColumnCount: 2,
      firstColumnWidth: MARKET_LIST_FIRST_COLUMN_MIN_WIDTH,
      visibleMetricColumnCount: 2,
    });

    expect(result.map((column) => column.dataIndex)).toEqual([
      'star',
      'name',
      'price',
      'change',
    ]);
    expect(result[1]?.columnWidth).toBe(
      MARKET_LIST_FIRST_COLUMN_MIN_WIDTH - MARKET_LIST_STAR_COLUMN_WIDTH,
    );
    expect(result[2]?.columnProps?.minWidth).toBe(
      MARKET_LIST_METRIC_COLUMN_MIN_WIDTH,
    );
  });
});
