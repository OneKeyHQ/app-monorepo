/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { MobileMarketStockListItem } from './MobileMarketStockListItem';

jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    // The price shares this component; the volume is the `marketCap` one.
    NumberSizeableText: ({
      children,
      formatter,
    }: PropsWithChildren<{ formatter?: string }>) => (
      <span
        data-testid={formatter === 'marketCap' ? 'stock-volume' : 'stock-price'}
      >
        {children}
      </span>
    ),
    SizableText: ({ children }: PropsWithChildren) => <span>{children}</span>,
    XStack: Container,
    YStack: Container,
  };
});

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));

jest.mock('../../../components/PerpsBadges', () => ({
  SubtitleText: ({
    subtitle,
    maxWidth,
  }: {
    subtitle: string;
    maxWidth?: number;
  }) => (
    <span data-testid="stock-name" data-max-width={maxWidth}>
      {subtitle}
    </span>
  ),
}));

jest.mock('../PriceChangeBadge', () => ({
  PriceChangeBadge: () => null,
}));

const stock: IMarketStockPublicItem = {
  stockId: 'NVDA',
  symbol: 'NVDA',
  name: 'NVIDIA',
  logoUrl: '',
  assetType: 'stock',
  currency: 'USD',
  price: '210.96',
  priceChange24hPercent: '-3.36',
  volume24h: '38000000000',
};

describe('MobileMarketStockListItem', () => {
  it('shows the capped company name and the volume on the second line', () => {
    render(<MobileMarketStockListItem item={stock} onPress={jest.fn()} />);

    expect(screen.getByTestId('stock-name').textContent).toBe('NVIDIA');
    expect(
      screen.getByTestId('stock-name').getAttribute('data-max-width'),
    ).toBe('66');
    expect(screen.getByTestId('stock-volume').textContent).toBe('38000000000');
  });

  it.each([undefined, '0', 'not-a-number'])(
    'leaves the volume out when it is %s',
    (volume24h) => {
      render(
        <MobileMarketStockListItem
          item={{ ...stock, volume24h }}
          onPress={jest.fn()}
        />,
      );

      expect(screen.getByTestId('stock-name').textContent).toBe('NVIDIA');
      expect(screen.queryByTestId('stock-volume')).toBeNull();
    },
  );
});
