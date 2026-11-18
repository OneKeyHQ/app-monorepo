/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import {
  CategoryFilterItem,
  MARKET_MOBILE_CATEGORY_CHIP_PROPS,
} from './CategoryFilterItem';

jest.mock('@onekeyhq/components', () => ({
  Icon: () => null,
  Image: () => null,
  SizableText: ({ children }: PropsWithChildren) => <span>{children}</span>,
  Stack: () => null,
  XStack: ({
    children,
    borderRadius,
    minWidth,
  }: PropsWithChildren<{ borderRadius?: string; minWidth?: number }>) => (
    <div
      data-testid="chip"
      data-border-radius={borderRadius}
      data-min-width={minWidth}
    >
      {children}
    </div>
  ),
  useMedia: () => ({ md: true }),
}));

jest.mock('@onekeyhq/kit/src/components/ScrollableFilterBar', () => ({
  useScrollableFilterBar: () => ({ handleItemLayout: jest.fn() }),
}));

describe('CategoryFilterItem', () => {
  it('keeps the pill shape by default on mobile', () => {
    render(<CategoryFilterItem name="All" isSelected />);

    expect(screen.getByTestId('chip').getAttribute('data-border-radius')).toBe(
      '$full',
    );
    expect(
      screen.getByTestId('chip').getAttribute('data-min-width'),
    ).toBeNull();
  });

  it('takes the native sub-header chip frame from the Market mobile props', () => {
    render(
      <CategoryFilterItem
        name="All"
        isSelected
        {...MARKET_MOBILE_CATEGORY_CHIP_PROPS}
      />,
    );

    expect(screen.getByTestId('chip').getAttribute('data-border-radius')).toBe(
      '$full',
    );
    expect(screen.getByTestId('chip').getAttribute('data-min-width')).toBe(
      '44',
    );
  });
});
