/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { BalanceRow } from './BalanceRow';

import type { IBalanceDisplayItem } from '../List/SpotBalanceList';

jest.mock('@onekeyhq/components', () => {
  const Stack = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    XStack: Stack,
    YStack: Stack,
    SizableText: ({
      children,
      numberOfLines,
      flexShrink,
      maxWidth,
    }: {
      children?: ReactNode;
      numberOfLines?: number;
      flexShrink?: number;
      maxWidth?: string;
    }) => (
      <span
        data-lines={numberOfLines}
        data-shrink={flexShrink}
        data-max-width={maxWidth}
      >
        {children}
      </span>
    ),
    Tooltip: ({
      renderContent,
      renderTrigger,
    }: {
      renderContent: string;
      renderTrigger: ReactNode;
    }) => (
      <div data-testid="balance-cell" title={renderContent}>
        {renderTrigger}
      </div>
    ),
  };
});
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({ ListItem: () => null }));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('@onekeyhq/kit/src/utils/explorerUtils', () => ({
  openHyperLiquidTokenExplorerUrl: jest.fn(),
}));
jest.mock('../../../hooks/useShowPositionShare', () => ({
  useShowPositionShare: () => ({ showPositionShare: jest.fn() }),
}));

describe('desktop holding balance cells', () => {
  it.each([
    ['1.123456789012345678', '0.0000000123456789'],
    ['1234567890123.123456789', '9876543210.987654321'],
    ['0', '4580253.4166670004'],
  ])('preserves exact total %s and available %s', (total, available) => {
    const item: IBalanceDisplayItem = {
      coin: 'MAX',
      rawCoin: 'MAX',
      type: 'spot',
      total,
      available,
      usdcValue: '0',
      usdcValueNum: 0,
      hasPriceSource: false,
      needsSuffix: false,
    };
    const { getAllByTestId } = render(
      <BalanceRow
        item={item}
        index={0}
        columnConfigs={[
          { key: 'total', title: 'Total', width: 100 },
          { key: 'available', title: 'Available', width: 100 },
        ]}
      />,
    );

    getAllByTestId('balance-cell').forEach((cell, index) => {
      const expected = `${[total, available][index]} MAX`;
      expect(cell.textContent).toBe(expected);
      expect(cell.title).toBe(expected);
      const text = cell.querySelector('span');
      expect(text?.getAttribute('data-lines')).toBe('1');
      expect(text?.getAttribute('data-shrink')).toBe('1');
      expect(text?.getAttribute('data-max-width')).toBe('100%');
    });
  });
});
