/* eslint-disable import/first */

const mockTableList = jest.fn();

jest.mock('@onekeyhq/components', () => {
  const { View } = jest.requireActual(
    'react-native',
  );

  return { Empty: View };
});

jest.mock('@onekeyhq/kit/src/components/ListView/TableList', () => ({
  TableList: (props: unknown) => {
    mockTableList(props);
    return null;
  },
}));

jest.mock('./ActionField', () => ({ ActionField: () => null }));
jest.mock('./AmountField', () => ({ AmountField: () => null }));
jest.mock('./AssetField', () => ({ AssetField: () => null }));
jest.mock('./AssetWithAmountField', () => ({
  AssetWithAmountField: () => null,
}));
jest.mock('./BorrowAPYField', () => ({ BorrowAPYField: () => null }));
jest.mock('./BorrowListSkeleton', () => ({
  BorrowListSkeleton: () => null,
  EmptyStateSkeleton: () => null,
}));
jest.mock('./CollateralBadge', () => ({ CollateralBadge: () => null }));
jest.mock('./FieldWrapper', () => ({ FieldWrapper: () => null }));

import { BorrowTableList } from '.';

import { render } from '@testing-library/react-native';

import type { ITableColumn } from '@onekeyhq/kit/src/components/ListView/TableList';

type IRow = {
  id: string;
};

describe('BorrowTableList headers', () => {
  beforeEach(() => {
    mockTableList.mockClear();
  });

  it('defaults Borrow columns to single-line headers without mutating them', () => {
    const renderHeader = () => null;
    const columns: ITableColumn<IRow>[] = [
      {
        key: 'asset',
        label: 'Asset',
        render: () => null,
      },
      {
        key: 'custom',
        headerNumberOfLines: 2,
        renderHeader,
        render: () => null,
      },
    ];
    const data = [{ id: '1' }];
    const view = render(
      <BorrowTableList
        columns={columns}
        data={data}
        emptyContent="No assets"
      />,
    );

    const firstTableColumns = (
      mockTableList.mock.calls[0][0] as {
        columns: ITableColumn<IRow>[];
      }
    ).columns;

    expect(firstTableColumns).not.toBe(columns);
    expect(firstTableColumns).toEqual([
      expect.objectContaining({
        key: 'asset',
        headerNumberOfLines: 1,
      }),
      expect.objectContaining({
        key: 'custom',
        headerNumberOfLines: 2,
        renderHeader,
      }),
    ]);
    expect(columns[0].headerNumberOfLines).toBeUndefined();
    expect(columns[1].headerNumberOfLines).toBe(2);

    view.rerender(
      <BorrowTableList
        columns={columns}
        data={data}
        emptyContent="No assets"
      />,
    );

    const rerenderedTableColumns = (
      mockTableList.mock.calls[1][0] as {
        columns: ITableColumn<IRow>[];
      }
    ).columns;
    expect(rerenderedTableColumns).toBe(firstTableColumns);
  });
});
