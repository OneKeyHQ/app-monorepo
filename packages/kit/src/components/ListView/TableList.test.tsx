/* eslint-disable import/first */

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual(
    'react-native',
  );

  return {
    Icon: View,
    ListView: ({
      ListHeaderComponent,
    }: {
      ListHeaderComponent?: import('react').ReactNode;
    }) => React.createElement(View, null, ListHeaderComponent),
    SizableText: Text,
    Skeleton: View,
    Stack: View,
    XStack: ({
      children,
      onPress,
      role,
      ...props
    }: {
      children?: import('react').ReactNode;
      onPress?: () => void;
      role?: string;
    }) =>
      React.createElement(
        Pressable,
        {
          ...props,
          accessibilityRole: role === 'button' ? 'button' : undefined,
          onPress,
        },
        children,
      ),
    YStack: View,
    useMedia: () => ({ gtSm: true, gtMd: true, gtLg: true }),
  };
});

jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const { View } = jest.requireActual(
    'react-native',
  );

  return { ListItem: View };
});

import { act, render } from '@testing-library/react-native';

import { TableList } from './TableList';

import type { ITableColumn } from './TableList';

type IRow = {
  value: number;
};

const columns: ITableColumn<IRow>[] = [
  {
    key: 'plainDefault',
    label: 'Plain default',
    render: () => null,
  },
  {
    key: 'plainSingleLine',
    label: 'Plain single line',
    headerNumberOfLines: 1,
    render: () => null,
  },
  {
    key: 'sortableDefault',
    label: 'Sortable default',
    sortable: true,
    comparator: (a, b) => a.value - b.value,
    render: () => null,
  },
  {
    key: 'sortableSingleLine',
    label: 'Sortable single line',
    headerNumberOfLines: 1,
    sortable: true,
    comparator: (a, b) => a.value - b.value,
    render: () => null,
  },
];

describe('TableList headers', () => {
  it('wraps by default and applies explicit line limits to plain and sortable headers', () => {
    const onSortChange = jest.fn();
    const view = render(
      <TableList
        columns={columns}
        data={[]}
        tableLayout
        sortKey="sortableDefault"
        sortDirection="desc"
        onSortChange={onSortChange}
      />,
    );

    const getHeaderText = (label: string) =>
      view.UNSAFE_root.find((node) => node.props.children === label);

    expect(getHeaderText('Plain default').props.numberOfLines).toBeUndefined();
    expect(
      getHeaderText('Sortable default').props.numberOfLines,
    ).toBeUndefined();
    expect(getHeaderText('Plain single line').props.numberOfLines).toBe(1);
    expect(getHeaderText('Sortable single line').props.numberOfLines).toBe(1);

    const sortButtons = view.UNSAFE_root.findAll(
      (node) => node.props.accessibilityRole === 'button',
    );
    const pressActiveSortButton = sortButtons[0].props.onPress as () => void;
    act(() => {
      pressActiveSortButton();
    });
    expect(onSortChange).toHaveBeenCalledWith('sortableDefault', 'asc');

    view.rerender(
      <TableList
        columns={columns}
        data={[]}
        tableLayout
        sortKey="sortableDefault"
        sortDirection="asc"
        onSortChange={onSortChange}
      />,
    );
    const updatedSortButton = view.UNSAFE_root.findAll(
      (node) => node.props.accessibilityRole === 'button',
    )[0];
    const pressUpdatedSortButton = updatedSortButton.props
      .onPress as () => void;
    act(() => {
      pressUpdatedSortButton();
    });
    expect(onSortChange).toHaveBeenLastCalledWith('sortableDefault', 'desc');
  });
});
