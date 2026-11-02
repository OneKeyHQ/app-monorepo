/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import { getPopularTradingColumns } from './metricColumns';

import type { IFavoriteTokenDisplay } from './types';
import type { IntlShape } from 'react-intl';

jest.mock('@onekeyhq/components', () => {
  const Stack = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return { NumberSizeableText: Stack, Stack, XStack: Stack, YStack: Stack };
});
jest.mock('@onekeyhq/kit/src/views/Market/components/PerpsBadges', () => ({
  StockSourceLogo: () => null,
  SubtitleBadge: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/components/TokenIdentityItem',
  () => ({
    TokenIdentityItem: ({ name }: { name?: string }) => <span>{name}</span>,
  }),
);

const record: IFavoriteTokenDisplay = {
  symbol: 'TSM',
  name: '台积电',
  stockId: 'TSM',
  chainId: '',
  contractAddress: '',
  isNative: false,
  logoUrl: '',
  price: 419.99,
  priceChange24h: -0.54,
  marketCap: 0,
  volume24h: 56_010_000,
};
const intl = {
  formatMessage: ({ id }: { id: string }) => id,
} as IntlShape;

it.each([true, false])(
  'supplies the name only for desktop layout %p',
  (desktop) => {
    const columns = getPopularTradingColumns({
      intl,
      shouldUseTableLayout: desktop,
      renderStarButton: () => null,
    });
    render(<>{columns[0].render?.(undefined, record, 0)}</>);

    expect(Boolean(screen.queryByText('台积电'))).toBe(desktop);
  },
);

it.each([true, false])(
  'uses the localized perps name only for desktop layout %p',
  (desktop) => {
    const columns = getPopularTradingColumns({
      intl,
      shouldUseTableLayout: desktop,
      renderStarButton: () => null,
    });
    render(
      <>
        {columns[0].render?.(
          undefined,
          {
            ...record,
            name: 'TSM',
            perpsCoin: 'xyz:TSM',
            perpsSubtitle: '台积电',
          },
          0,
        )}
      </>,
    );

    expect(Boolean(screen.queryByText('台积电'))).toBe(desktop);
    expect(screen.queryByText('TSM')).toBeNull();
  },
);

it('does not repeat the perps symbol when there is no localized name', () => {
  const columns = getPopularTradingColumns({
    intl,
    shouldUseTableLayout: true,
    renderStarButton: () => null,
  });
  render(
    <>{columns[0].render?.(undefined, { ...record, perpsCoin: 'TSM' }, 0)}</>,
  );

  expect(screen.queryByText('台积电')).toBeNull();
});
