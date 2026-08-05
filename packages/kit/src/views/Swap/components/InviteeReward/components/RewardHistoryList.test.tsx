/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

const mockFormatDate = jest.fn(() => '08/03/2026');

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Primitive = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);

  return {
    Icon: Primitive,
    NumberSizeableText: Primitive,
    SizableText: Primitive,
    Skeleton: Primitive,
    XStack: Primitive,
    YStack: Primitive,
  };
});

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => <div />,
}));

jest.mock('@onekeyhq/kit/src/hooks/useFormatDate', () => ({
  __esModule: true,
  default: () => ({ formatDate: mockFormatDate }),
}));

jest.mock('@onekeyhq/kit/src/utils/explorerUtils', () => ({
  openTransactionDetailsUrl: jest.fn(),
}));

import { RewardHistoryList } from './RewardHistoryList';

describe('RewardHistoryList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('formats the server date with the active app locale', () => {
    render(
      <RewardHistoryList
        history={[
          {
            date: '2026-08-03',
            tx: '',
            amount: '1',
            token: {
              networkId: 'evm--42161',
              address: '0xtoken',
              logoURI: 'https://example.com/token.png',
              name: 'USD Coin',
              symbol: 'USDC',
            },
          },
        ]}
      />,
    );

    expect(mockFormatDate).toHaveBeenCalledWith('2026-08-03', {
      hideTimeForever: true,
    });
    expect(screen.getByText('08/03/2026')).toBeTruthy();
  });
});
