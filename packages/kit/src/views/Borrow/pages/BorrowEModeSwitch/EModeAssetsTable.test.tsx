/* eslint-disable import/first */

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const { Text, View } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');

  return {
    Alert: View,
    Icon: View,
    SizableText: Text,
    Stack: View,
    XStack: View,
    YStack: View,
  };
});

jest.mock('@onekeyhq/kit/src/components/InfoIcon', () => {
  const { View } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');

  return { InfoIcon: View };
});

jest.mock('@onekeyhq/kit/src/components/Token', () => {
  const { View } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');

  return { Token: View };
});

jest.mock('@onekeyhq/kit/src/views/Borrow/components/BorrowTableList', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { Text, View } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');

  return {
    BorrowTableList: ({
      columns,
      data,
    }: {
      columns: {
        key: string;
        label?: string;
        renderHeader?: () => import('react').ReactNode;
        render: (item: unknown) => import('react').ReactNode;
      }[];
      data: unknown[];
    }) =>
      React.createElement(
        View,
        null,
        columns.map((column) =>
          React.createElement(
            View,
            { key: column.key },
            column.renderHeader?.() ??
              React.createElement(Text, null, column.label),
            data.map((item, index) =>
              React.createElement(
                View,
                { key: `${column.key}-${index}` },
                column.render(item),
              ),
            ),
          ),
        ),
      ),
  };
});

import { render } from '@testing-library/react-native';

import { EModeAssetsTable } from './EModeAssetsTable';

import type { IEModeRow } from './emodeUtils';

describe('EModeAssetsTable', () => {
  it('labels the capability columns by their backend field semantics', () => {
    const row: IEModeRow = {
      eModeId: 1,
      label: 'ETH correlated',
      displayLabel: 'ETH correlated',
      disabled: false,
      selected: false,
      isOff: false,
      assets: [
        {
          reserveAddress: '0xweth',
          boostedLTV: true,
          borrowable: false,
          token: {
            address: '0xweth',
            decimals: 18,
            isNative: false,
            logoURI: '',
            name: 'Wrapped Ether',
            symbol: 'WETH',
          },
        },
      ],
    };

    const output = JSON.stringify(
      render(<EModeAssetsTable row={row} />).toJSON(),
    );

    expect(output).toContain('defi.max_ltv');
    expect(output).toContain('defi.borrowable');
    expect(output).not.toContain('defi.collateral');
  });
});
