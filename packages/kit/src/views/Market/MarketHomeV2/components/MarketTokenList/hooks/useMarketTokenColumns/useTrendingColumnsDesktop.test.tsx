/** @jest-environment jsdom */

import type { ReactElement } from 'react';

import { renderHook } from '@testing-library/react';

import { useTrendingColumnsDesktop } from './useTrendingColumnsDesktop';

import type { IMarketToken } from '../../MarketTokenData';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/components/CommunityRecognizedBadge',
  () => ({ CommunityRecognizedBadge: () => null }),
);

jest.mock('@onekeyhq/kit/src/views/Market/components/MarketStarV2', () => ({
  MarketStarV2: () => null,
}));

const tokenWithoutAge: IMarketToken = {
  id: 'token-1',
  name: 'Token',
  symbol: 'TOKEN',
  address: '0x1234567890abcdef',
  decimals: 18,
  price: 1,
  change24h: 0,
  marketCap: 1,
  liquidity: 1,
  transactions: 1,
  uniqueTraders: 1,
  holders: 1,
  turnover: 1,
  tokenImageUri: '',
  networkLogoUri: '',
  networkId: 'evm--1',
};

describe('useTrendingColumnsDesktop', () => {
  test('keeps a missing age empty so the address is shown without hover', () => {
    const { result } = renderHook(() =>
      useTrendingColumnsDesktop({
        sort: {},
        onSort: jest.fn(),
      }),
    );
    const identityCell = result.current[1]?.render?.(
      undefined,
      tokenWithoutAge,
      0,
    ) as ReactElement<{
      secondary?: ReactElement<{ ageLabel?: string }>;
    }>;

    expect(identityCell.props.secondary?.props.ageLabel).toBeUndefined();
  });
});
