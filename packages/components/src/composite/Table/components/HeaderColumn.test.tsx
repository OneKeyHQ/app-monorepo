/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

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

jest.mock('./Column', () => ({
  Column: ({
    children,
    name,
    order,
  }: {
    children?: ReactNode;
    name: string;
    order?: string;
  }) => (
    <div data-testid={name} data-order={order ?? ''}>
      {children}
    </div>
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
});
