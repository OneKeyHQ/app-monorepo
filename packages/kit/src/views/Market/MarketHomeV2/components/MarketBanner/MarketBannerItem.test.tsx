/** @jest-environment jsdom */

import { fireEvent, render, screen, within } from '@testing-library/react';

import {
  EMarketBannerType,
  type IMarketBannerItem,
  type IMarketBannerTokenPreview,
} from '@onekeyhq/shared/types/marketV2';

import { MarketBannerItem } from './MarketBannerItem';

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  type IProps = import('react').PropsWithChildren<{
    testID?: string;
    onPress?: () => void;
    role?: string;
    'aria-label'?: string;
    color?: string;
    name?: string;
    fallback?: import('react').ReactNode;
  }>;
  const Component = ({
    children,
    testID,
    onPress,
    role,
    'aria-label': accessibilityLabel,
    color,
    fallback,
  }: IProps) =>
    React.createElement(
      'div',
      {
        'data-testid': testID,
        'data-color': color,
        onClick: onPress,
        role,
        'aria-label': accessibilityLabel,
      },
      fallback ?? children,
    );
  return {
    Stack: Component,
    XStack: Component,
    YStack: Component,
    SizableText: Component,
    NumberSizeableText: Component,
    Image: ({ fallback }: { fallback?: import('react').ReactNode }) =>
      fallback ?? null,
    Icon: ({ name }: { name?: string }) =>
      React.createElement('span', { 'data-icon-name': name }),
  };
});

jest.mock('@onekeyhq/kit/src/views/Market/components/PerpsBadges', () => ({
  LeverageBadge: () => null,
}));

const makeToken = (
  symbol: string,
  change?: string | null,
  price?: string | null,
): IMarketBannerTokenPreview => ({
  symbol,
  name: symbol,
  logo: '',
  price,
  priceChange24hPercent: change,
});

const makeBanner = (
  tokens?: IMarketBannerTokenPreview[],
): IMarketBannerItem => ({
  _id: 'banner',
  title: 'Robinhood Meme',
  rank: 1,
  mode: 4,
  payload: '',
  miniBundlerVersion: '',
  backgroundColor: 'bg/subdued',
  tokenListId: 'theme-list',
  type: EMarketBannerType.Ticker,
  tokens,
});

describe('Market theme banner', () => {
  it('renders index quotes using the Figma labels, order, and unitless prices', () => {
    render(
      <MarketBannerItem
        item={{
          ...makeBanner([
            makeToken('^DJI', '1', '52573.29'),
            makeToken('^GSPC', '0.8', '7656.98'),
            makeToken('^IXIC', '0.9', '26333.04'),
          ]),
          type: EMarketBannerType.StockIndex,
        }}
      />,
    );

    const rows = screen.getAllByTestId('market-banner-token-row');
    expect(rows.map((row) => row.textContent)).toEqual([
      'S&P 5007656.980.8',
      'NASDAQ26333.040.9',
      'Dow Jones52573.291',
    ]);
    expect(rows[0].querySelector('[data-icon-name]')).toBeNull();
  });

  it('shows at most three supplied tokens in numeric gain order without mutating the response', () => {
    const tokens = [
      makeToken('LOW', '2'),
      makeToken('TOP', '10'),
      makeToken('LOSS', '-1'),
      makeToken('SECOND', '3'),
    ];
    render(<MarketBannerItem item={makeBanner(tokens)} />);
    const rows = screen.getAllByTestId('market-banner-token-row');
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.textContent)).toEqual([
      'TOP--10',
      'SECOND--3',
      'LOW--2',
    ]);
    expect(tokens.map((token) => token.symbol)).toEqual([
      'LOW',
      'TOP',
      'LOSS',
      'SECOND',
    ]);
  });

  it('keeps missing quotes behind losses and preserves actual zero values', () => {
    render(
      <MarketBannerItem
        item={makeBanner([
          makeToken('MISSING', '--', ''),
          makeToken('LOSS', '-2.5', '0.12655'),
          makeToken('ZERO', '0', '0'),
        ])}
      />,
    );
    const rows = screen.getAllByTestId('market-banner-token-row');
    expect(rows.map((row) => row.textContent)).toEqual([
      'ZERO00',
      'LOSS0.12655-2.5',
      'MISSING----',
    ]);
    expect(
      within(rows[0])
        .getByTestId('market-banner-token-change')
        .getAttribute('data-color'),
    ).toBe('$text');
    expect(
      within(rows[1])
        .getByTestId('market-banner-token-change')
        .getAttribute('data-color'),
    ).toBe('$textCritical');
    expect(
      within(rows[2])
        .getByTestId('market-banner-token-change')
        .getAttribute('data-color'),
    ).toBe('$textSubdued');
  });

  it.each([undefined, null, '', ' ', '--', 'NaN', 'Infinity'])(
    'renders unavailable quotes as -- (%s)',
    (value) => {
      render(
        <MarketBannerItem
          item={makeBanner([makeToken('TOKEN', value, value)])}
        />,
      );
      expect(screen.getByTestId('market-banner-token-price').textContent).toBe(
        '--',
      );
      expect(screen.getByTestId('market-banner-token-change').textContent).toBe(
        '--',
      );
    },
  );

  it.each([EMarketBannerType.Ticker, EMarketBannerType.Perps])(
    'opens the original %s list from anywhere in the card',
    (type) => {
      const onPress = jest.fn();
      const item = { ...makeBanner([makeToken('TOKEN', '1', '2')]), type };
      render(<MarketBannerItem item={item} onPress={onPress} />);
      fireEvent.click(screen.getByTestId('market-banner-token-row'));
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onPress).toHaveBeenCalledWith(item);
    },
  );

  it('keeps empty themes reachable without inventing token rows', () => {
    const onPress = jest.fn();
    const item = makeBanner([]);
    render(<MarketBannerItem item={item} onPress={onPress} />);
    expect(screen.queryAllByTestId('market-banner-token-row')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: item.title }));
    expect(onPress).toHaveBeenCalledWith(item);
  });

  it('retains the legacy banner for API responses without token previews', () => {
    const item = {
      ...makeBanner(),
      description: { text: '+1%', fontColor: 'text/success' },
    };
    render(<MarketBannerItem item={item} />);
    expect(screen.getByText('+1%')).toBeTruthy();
    expect(screen.queryAllByTestId('market-banner-token-row')).toHaveLength(0);
  });
});
