/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { usePerpLatestTrade } from '../../hooks/usePerpLatestTrade';

import { MobilePerpLatestPrice } from './MobilePerpLatestPrice';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  SizableText: ({
    children,
    color,
    testID,
  }: {
    children?: ReactNode;
    color?: string;
    testID?: string;
  }) => (
    <span data-testid={testID} data-color={color}>
      {children}
    </span>
  ),
}));
jest.mock('../../hooks/usePerpLatestTrade', () => ({
  usePerpLatestTrade: jest.fn(),
}));
jest.mock('../../hooks/usePerpMarketForeground', () => ({
  usePerpMarketForeground: () => true,
}));

const latestTrade = jest.mocked(usePerpLatestTrade);

it('uses the latest trade side for color even when the price is unchanged', () => {
  const snapshot = {
    trade: {
      coin: 'HYPE',
      px: '64.38',
      side: 'B',
      sz: '1',
      time: 1000,
      tid: 1,
      hash: '0x123',
      users: ['0x1', '0x2'],
    },
    isInteractive: true,
    getSelectablePrice: () => '64.38',
  } satisfies ReturnType<typeof usePerpLatestTrade>;
  latestTrade.mockReturnValue(snapshot);
  const view = render(<MobilePerpLatestPrice coin="HYPE" />);
  expect(latestTrade).toHaveBeenLastCalledWith('HYPE', true);
  expect(view.getByText('perp.token_selector_last_price')).toBeTruthy();
  const price = view.getByTestId('perp-market-latest-price');
  expect(price.textContent).toBe('64.38');
  expect(price.getAttribute('data-color')).toBe('$bgAccent');
  latestTrade.mockReturnValue({
    ...snapshot,
    trade: { ...snapshot.trade, side: 'A', tid: 2 },
  });
  view.rerender(<MobilePerpLatestPrice coin="HYPE" />);
  expect(price.textContent).toBe('64.38');
  expect(price.getAttribute('data-color')).toBe('$bgCriticalStrong');

  latestTrade.mockReturnValue({
    trade: undefined,
    isInteractive: false,
    getSelectablePrice: () => undefined,
  });
  view.rerender(<MobilePerpLatestPrice coin="BTC" />);
  expect(latestTrade).toHaveBeenLastCalledWith('BTC', true);
  expect(price.textContent).toBe('--');
  expect(price.getAttribute('data-color')).toBe('$text');
});
