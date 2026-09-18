/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import type { IMarketDetailTicker } from '@onekeyhq/shared/types/market';

import { PairDetailDialog } from './PairDetailDialog';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  XStack: ({ children }: PropsWithChildren) => <div>{children}</div>,
  YStack: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SizableText: ({ children }: PropsWithChildren) => <span>{children}</span>,
  NumberSizeableText: ({
    children,
    formatterOptions,
  }: PropsWithChildren<{ formatterOptions?: { currency?: string } }>) => (
    <span>
      {formatterOptions?.currency}
      {children}
    </span>
  ),
  IconButton: () => null,
  useDialogInstance: () => ({ close: jest.fn() }),
}));
jest.mock('./MarketPoolIcon', () => ({ MarketPoolIcon: () => null }));
jest.mock('./MarketTokenAddress', () => ({ MarketTokenAddress: () => null }));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlInApp: jest.fn(),
}));

it('preserves BTC quote and ETH volume units instead of dollar labels', () => {
  render(
    <PairDetailDialog
      item={
        {
          base: 'ETH',
          target: 'BTC',
          last: 0.04,
          volume: 123,
          market: { name: 'Exchange' },
          last_updated_at: '2026-09-01T00:00:00Z',
          bid_ask_spread_percentage: 0.1,
        } as IMarketDetailTicker
      }
    />,
  );
  expect(screen.getByText('0.04').parentElement?.textContent).toBe('0.04BTC');
  expect(screen.getByText('123').parentElement?.textContent).toBe('123ETH');
  expect(screen.queryByText('$0.04')).toBeNull();
});
