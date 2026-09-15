/** @jest-environment jsdom */

import type { ReactElement } from 'react';

import { renderHook } from '@testing-library/react';

import { ECopyFrom } from '@onekeyhq/shared/src/logger/scopes/dex';

import { useTrendingColumnsDesktop } from './useTrendingColumnsDesktop';
import { WatchlistTokenIdentity } from './useWatchlistColumnsDesktop';

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
  MarketPerpsStarV2: () => null,
}));

// The watchlist columns module (for its spot-token cell) pulls these in.
jest.mock('@onekeyhq/kit/src/views/Market/components/PerpsBadges', () => ({
  LeverageBadge: () => null,
  PerpDexBadge: () => null,
  StockSourceLogo: () => null,
  SubtitleText: () => null,
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketVariantLogoGroup',
  () => ({ MarketVariantLogoGroup: () => null }),
);

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

  test('titles the column "Name" and renders the watchlist token cell when hideTokenAge is set', () => {
    const { result } = renderHook(() =>
      useTrendingColumnsDesktop({
        sort: {},
        onSort: jest.fn(),
        hideTokenAge: true,
        copyFrom: ECopyFrom.BannerList,
      }),
    );
    expect(result.current[1]?.title).toBe('global.name');
    const record = {
      ...tokenWithoutAge,
      firstTradeTime: Date.now() - 86_400_000,
    };
    const identityCell = result.current[1]?.render?.(
      undefined,
      record,
      0,
    ) as ReactElement<{ record: IMarketToken; copyFrom: ECopyFrom }>;
    // Name at rest, contract address on hover — the watchlist's spot rows.
    expect(identityCell.type).toBe(WatchlistTokenIdentity);
    expect(identityCell.props.record).toBe(record);
    expect(identityCell.props.copyFrom).toBe(ECopyFrom.BannerList);
  });
});
