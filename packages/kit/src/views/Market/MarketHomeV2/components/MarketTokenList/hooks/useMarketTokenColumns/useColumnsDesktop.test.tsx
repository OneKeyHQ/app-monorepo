/** @jest-environment jsdom */

import { Children } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { renderHook } from '@testing-library/react';

import { Token } from '@onekeyhq/kit/src/components/Token';

import { useColumnsDesktop } from './useColumnsDesktop';

import type { IMarketToken } from '../../MarketTokenData';

jest.mock('@onekeyhq/components', () => {
  const components = jest.requireActual<typeof import('@onekeyhq/components')>(
    '@onekeyhq/components',
  );
  return {
    ...components,
    useMedia: () => ({ gtLg: true, gtXl: true }),
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));

jest.mock('@onekeyhq/kit/src/views/Market/components/MarketStarV2', () => ({
  MarketPerpsStarV2: () => null,
  MarketStarV2: () => null,
}));

jest.mock('@onekeyhq/kit/src/views/Market/components/PerpsBadges', () => ({
  LeverageBadge: () => null,
  PerpDexBadge: () => null,
  SubtitleText: () => null,
}));

jest.mock('../../components/TokenIdentityItem', () => ({
  TokenIdentityItem: () => null,
}));

jest.mock('../../components/Txns', () => ({
  Txns: () => null,
}));

const token: IMarketToken = {
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
  tokenImageUri: 'https://img.test/token.png',
  tokenImageUris: ['https://img.test/token.png'],
  networkLogoUri: 'https://img.test/network.png',
  networkId: 'evm--1',
};

describe('useColumnsDesktop', () => {
  function renderLightweightNameCell(isWatchlistMode: boolean) {
    const { result } = renderHook(() =>
      useColumnsDesktop(
        undefined,
        isWatchlistMode,
        undefined,
        undefined,
        undefined,
        false,
        true,
        undefined,
        undefined,
        false,
        4,
      ),
    );
    const nameColumn = result.current.find(
      (column) => column.dataIndex === 'name',
    );
    const cell = nameColumn?.render?.(undefined, token, 4) as ReactElement<{
      children: ReactNode;
    }>;

    return Children.toArray(cell.props.children)[0] as ReactElement<{
      tokenImageUri?: string;
      tokenImageUris?: string[];
      networkImageUri?: string;
      width?: number;
      height?: number;
    }>;
  }

  test('renders token images in lightweight watchlist rows', () => {
    const tokenElement = renderLightweightNameCell(true);

    expect(tokenElement.type).toBe(Token);
    expect(tokenElement.props.tokenImageUri).toBe(token.tokenImageUri);
    expect(tokenElement.props.tokenImageUris).toBe(token.tokenImageUris);
    expect(tokenElement.props.networkImageUri).toBe(token.networkLogoUri);
  });

  test('keeps lightweight non-watchlist rows image-free', () => {
    const placeholderElement = renderLightweightNameCell(false);

    expect(placeholderElement.type).not.toBe(Token);
    expect(placeholderElement.props.width).toBe(40);
    expect(placeholderElement.props.height).toBe(40);
    expect(placeholderElement.props.tokenImageUri).toBeUndefined();
  });
});
