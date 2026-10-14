/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import { convertSearchTokenToMarketToken } from './constants';
import { SelectorTokenStar } from './selectorStar';

import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';

let mockWatchlist: IMarketWatchListItemV2[] = [];
const mockAdd = jest.fn(async (_items: IMarketWatchListItemV2[]) => true);
const mockRemove = jest.fn(
  async (_chainId: string, _address: string, _identity: unknown) => true,
);
jest.mock('@onekeyhq/components', () => ({
  IconButton: ({ icon, onPress }: { icon: string; onPress: () => void }) => (
    <button type="button" aria-label={icon} onClick={onPress} />
  ),
}));
jest.mock('../../../components/MarketListingStar', () => ({
  MarketListingStar: () => null,
}));
jest.mock('../../../components/watchListHooksV2', () => ({
  useWatchListV2Action: () => ({
    addIntoWatchListV2: mockAdd,
    removeFromWatchListV2: mockRemove,
  }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useMarketWatchListV2Atom: () => [{ data: mockWatchlist, isMounted: true }],
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    dex: {
      watchlist: {
        dexAddToWatchlist: jest.fn(),
        dexRemoveFromWatchlist: jest.fn(),
      },
    },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/tokenUtils', () => ({
  normalizeTokenContractAddress: ({
    contractAddress,
  }: {
    contractAddress: string;
  }) => contractAddress.toLowerCase(),
}));

const token: IMarketToken = {
  id: 'evm--1_0xaapl',
  name: 'Apple token',
  symbol: 'AAPL',
  stockId: 'AAPL',
  address: '0xAAPL',
  chainId: 'evm--1',
  networkId: 'evm--1',
  decimals: 18,
  price: 1,
  change24h: 0,
  marketCap: 0,
  liquidity: 0,
  transactions: 0,
  uniqueTraders: 0,
  holders: 0,
  turnover: 0,
  tokenImageUri: '',
  networkLogoUri: '',
};

describe('selector favorite identity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWatchlist = [];
  });

  it('favorites issuer tokens independently from the underlying stock and each other', async () => {
    mockWatchlist = [{ stockId: 'AAPL', chainId: '', contractAddress: '' }];
    const { rerender } = render(<SelectorTokenStar item={token} />);
    fireEvent.click(screen.getByRole('button', { name: 'StarOutline' }));
    await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(1));
    expect(mockAdd.mock.calls[0][0][0]).toMatchObject({
      chainId: 'evm--1',
      contractAddress: '0xAAPL',
      stockId: undefined,
    });
    mockWatchlist = [
      ...mockWatchlist,
      { chainId: 'evm--1', contractAddress: '0xaapl' },
    ];
    rerender(<SelectorTokenStar item={{ ...token, address: '0xOTHER' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'StarOutline' }));
    await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(2));
    expect(mockAdd.mock.calls[1][0][0]).toMatchObject({
      chainId: 'evm--1',
      contractAddress: '0xOTHER',
      stockId: undefined,
    });
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('shows and removes an existing issuer token favorite by its chain address', async () => {
    mockWatchlist = [{ chainId: 'evm--1', contractAddress: '0xaapl' }];
    render(<SelectorTokenStar item={token} />);
    fireEvent.click(screen.getByRole('button', { name: 'StarSolid' }));
    await waitFor(() =>
      expect(mockRemove).toHaveBeenCalledWith('evm--1', '0xAAPL', {
        assetId: undefined,
        stockId: undefined,
      }),
    );
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'favorites a chain search result with assetId by its chain identity (native token: %s)',
    async (isNative) => {
      const assetId = isNative ? 'solana' : 'usd-coin';
      mockWatchlist = [{ assetId, chainId: '', contractAddress: '' }];
      const address = isNative ? '' : 'SolanaUsdc';
      const item = convertSearchTokenToMarketToken({
        assetId,
        network: 'sol--101',
        address,
        isNative,
        name: isNative ? 'Solana' : 'USD Coin',
        symbol: isNative ? 'SOL' : 'USDC',
        price: '1',
        logoUrl: '',
        decimals: 6,
        liquidity: '0',
        volume_24h: '0',
        networkLogoURI: '',
      });
      render(<SelectorTokenStar item={item} />);
      fireEvent.click(screen.getByRole('button', { name: 'StarOutline' }));
      await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(1));
      expect(mockAdd.mock.calls[0][0][0]).toMatchObject({
        chainId: 'sol--101',
        contractAddress: address,
        isNative,
        assetId: undefined,
      });
      expect(mockRemove).not.toHaveBeenCalled();
    },
  );

  it('still favorites an asset-only search listing by assetId', async () => {
    const item = convertSearchTokenToMarketToken({
      assetId: 'bitcoin',
      network: '',
      address: '',
      isNative: true,
      name: 'Bitcoin',
      symbol: 'BTC',
      price: '1',
      logoUrl: '',
      decimals: 8,
      liquidity: '0',
      volume_24h: '0',
      networkLogoURI: '',
    });
    render(<SelectorTokenStar item={item} />);
    fireEvent.click(screen.getByRole('button', { name: 'StarOutline' }));
    await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(1));
    expect(mockAdd.mock.calls[0][0][0]).toMatchObject({
      chainId: '',
      contractAddress: '',
      assetId: 'bitcoin',
    });
  });

  it('keeps the stock identity for a bare stock listing', async () => {
    render(
      <SelectorTokenStar
        item={{ ...token, address: '', chainId: '', networkId: '' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'StarOutline' }));
    await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(1));
    expect(mockAdd.mock.calls[0][0][0]).toMatchObject({
      chainId: '',
      contractAddress: '',
      stockId: 'AAPL',
    });
  });
});
