/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ETableSortType, type ITableColumn, type ITableProps } from '../types';

import { HeaderColumn } from './HeaderColumn';

jest.mock('../../../primitives', () => ({
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock('../hooks', () => ({
  useSortIcon: () => ({ renderSortIcon: () => null }),
}));

// Both reach platformEnv through the overlay stack, which this environment
// does not stand up; the tooltip's wiring is what these cases assert, not its
// rendering.
jest.mock('../../../actions/Tooltip', () => ({
  Tooltip: ({
    renderTrigger,
    renderContent,
    onPress,
  }: {
    renderTrigger?: ReactNode;
    renderContent?: ReactNode;
    onPress?: () => void;
  }) => (
    <span data-testid="title-tooltip" onClick={onPress} role="presentation">
      {renderTrigger}
      {renderContent}
    </span>
  ),
}));

jest.mock('../../../content/DashText', () => ({
  DashText: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

jest.mock('./Column', () => ({
  Column: ({
    children,
    name,
    onPress,
    order,
  }: {
    children?: ReactNode;
    name: string;
    onPress?: () => void;
    order?: string;
  }) => (
    <button
      type="button"
      data-testid={name}
      data-order={order ?? ''}
      onClick={onPress}
    >
      {children}
    </button>
  ),
}));

type IRow = { change24h: number };

const column: ITableColumn<IRow> = {
  dataIndex: 'change24h',
  title: '24h Change',
};

describe('HeaderColumn', () => {
  test('clears its visual sort order when external sort state moves away', () => {
    let externalOrder: ETableSortType | undefined = ETableSortType.DESC;
    const onHeaderRow: ITableProps<IRow>['onHeaderRow'] = () => ({
      initialSortOrder: externalOrder,
      onSortTypeChange: jest.fn(),
    });
    const props = {
      column,
      index: 0,
      selectedColumnName: 'change24h',
      onChangeSelectedName: jest.fn(),
      onHeaderRow,
    };
    const { rerender } = render(<HeaderColumn {...props} />);

    expect(screen.getByTestId('change24h').getAttribute('data-order')).toBe(
      'desc',
    );

    externalOrder = undefined;
    rerender(<HeaderColumn {...props} />);

    expect(screen.getByTestId('change24h').getAttribute('data-order')).toBe('');
  });

  test('shows an external sort order when the selected column is stale', () => {
    const getExternalOrder = jest.fn<ETableSortType | undefined, []>();
    const onHeaderRow: ITableProps<IRow>['onHeaderRow'] = () => ({
      initialSortOrder: getExternalOrder(),
      onSortTypeChange: jest.fn(),
    });
    const props = {
      column,
      index: 0,
      selectedColumnName: 'previousColumn',
      onChangeSelectedName: jest.fn(),
      onHeaderRow,
    };
    const { rerender } = render(<HeaderColumn {...props} />);

    expect(screen.getByTestId('change24h').getAttribute('data-order')).toBe('');

    getExternalOrder.mockReturnValue(ETableSortType.DESC);
    rerender(<HeaderColumn {...props} />);

    expect(screen.getByTestId('change24h').getAttribute('data-order')).toBe(
      'desc',
    );
  });

  test('shows the locally cycled order while the external initial order stays fixed', async () => {
    const onSortTypeChange = jest.fn();
    const onHeaderRow: ITableProps<IRow>['onHeaderRow'] = () => ({
      initialSortOrder: ETableSortType.DESC,
      onSortTypeChange,
    });
    const props = {
      column,
      index: 0,
      selectedColumnName: 'change24h',
      onChangeSelectedName: jest.fn(),
      onHeaderRow,
    };

    render(<HeaderColumn {...props} />);

    expect(screen.getByTestId('change24h').getAttribute('data-order')).toBe(
      'desc',
    );

    fireEvent.click(screen.getByTestId('change24h'));

    expect(screen.getByTestId('change24h').getAttribute('data-order')).toBe(
      'asc',
    );
    await waitFor(() => {
      expect(onSortTypeChange).toHaveBeenCalledWith(ETableSortType.ASC);
    });
  });
  it('sorts from the tooltip trigger, which owns the press', () => {
    const onSortTypeChange = jest.fn();
    const onHeaderRow: ITableProps<IRow>['onHeaderRow'] = () => ({
      onSortTypeChange,
    });
    const tooltipColumn: ITableColumn<IRow> = {
      dataIndex: 'price',
      title: 'Price',
      titleTooltip: 'The underlying share price.',
    };
    const props = {
      column: tooltipColumn,
      index: 0,
      selectedColumnName: '',
      onChangeSelectedName: jest.fn(),
      onHeaderRow,
    };
    render(<HeaderColumn {...props} />);

    // A trigger nested in the title would consume this click and the column
    // would never sort.
    fireEvent.click(screen.getByTestId('title-tooltip'));

    return waitFor(() =>
      expect(onSortTypeChange).toHaveBeenCalledWith(ETableSortType.DESC),
    );
  });
});
