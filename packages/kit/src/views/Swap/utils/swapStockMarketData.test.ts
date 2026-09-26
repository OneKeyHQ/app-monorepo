import type {
  IMarketStockPublicItem,
  IMarketStockTokenVariant,
  IMarketStockTokenVariantsResponse,
  IMarketTokenDetail,
  IMarketTokenDetailResponse,
} from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  fetchSwapStockSelection,
  fetchSwapStockVariantToken,
  resolveSwapStockAvailability,
  resolveSwapStockLoadingScopes,
  resolveSwapStockTokenSelectionKind,
  selectSwapStockVariant,
} from './swapStockMarketData';

const fetchVariantsMock = jest.fn<
  Promise<IMarketStockTokenVariantsResponse>,
  [{ stockId: string }]
>();
const fetchDetailMock = jest.fn<
  Promise<IMarketTokenDetailResponse>,
  [string, string, { autoHandleError: boolean; skipConvertCurrency: boolean }]
>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketStockTokenVariants: (
        ...args: Parameters<typeof fetchVariantsMock>
      ) => fetchVariantsMock(...args),
      fetchMarketTokenDetailByTokenAddress: (
        ...args: Parameters<typeof fetchDetailMock>
      ) => fetchDetailMock(...args),
    },
  },
}));

const EVM_ADDRESS = '0xabcdef1234567890abcdef1234567890abcdef12';
const SOLANA_ADDRESS = 'AbCdEfGhJkMnPqRsTuVwXyZ23456789AB';

function buildVariant(
  overrides: Partial<IMarketStockTokenVariant> = {},
): IMarketStockTokenVariant {
  return {
    tokenId: 'apple-ondo-ethereum',
    issuer: 'ondo',
    symbol: 'AAPLon',
    networkId: 'evm--1',
    networkLogoUrl: 'https://example.com/ethereum.png',
    contractAddress: EVM_ADDRESS,
    currency: 'USD',
    status: 'active',
    tradingEnabled: true,
    ...overrides,
  };
}

describe('resolveSwapStockLoadingScopes', () => {
  const allLoading = { stock: true, tradeTarget: true, amountInput: true };
  const tradeLoading = { stock: false, tradeTarget: true, amountInput: true };
  const noLoading = { stock: false, tradeTarget: false, amountInput: false };

  it('loads stock and trade surfaces while a ticker resolves', () => {
    expect(
      resolveSwapStockLoadingScopes({
        operation: { phase: 'resolving', kind: 'ticker' },
        currentTokenKey: 'old-token',
        isTokenVariantPending: false,
      }),
    ).toEqual(allLoading);
    expect(
      resolveSwapStockLoadingScopes({
        operation: {
          phase: 'applying',
          kind: 'ticker',
          tokenKey: 'new-token',
        },
        currentTokenKey: 'new-token',
        isTokenVariantPending: true,
      }),
    ).toEqual(allLoading);
  });

  it('loads only the trade target and input while a variant changes', () => {
    expect(
      resolveSwapStockLoadingScopes({
        operation: { phase: 'resolving', kind: 'variant' },
        currentTokenKey: 'old-token',
        isTokenVariantPending: false,
      }),
    ).toEqual(tradeLoading);
    expect(
      resolveSwapStockLoadingScopes({
        operation: {
          phase: 'applying',
          kind: 'variant',
          tokenKey: 'new-token',
        },
        currentTokenKey: 'new-token',
        isTokenVariantPending: true,
      }),
    ).toEqual(tradeLoading);
    expect(
      resolveSwapStockLoadingScopes({
        operation: { phase: 'resolving', kind: 'token' },
        currentTokenKey: 'old-token',
        isTokenVariantPending: false,
      }),
    ).toEqual(tradeLoading);
  });

  it('stops selection loading when the matching variant settles or fails', () => {
    expect(
      resolveSwapStockLoadingScopes({
        operation: {
          phase: 'applying',
          kind: 'ticker',
          tokenKey: 'new-token',
        },
        currentTokenKey: 'new-token',
        isTokenVariantPending: false,
      }),
    ).toEqual(noLoading);
    expect(
      resolveSwapStockLoadingScopes({
        operation: { phase: 'failed', kind: 'variant' },
        currentTokenKey: 'old-token',
        isTokenVariantPending: false,
      }),
    ).toEqual(noLoading);
    expect(
      resolveSwapStockAvailability({ pending: false, failed: false }),
    ).toBe('unavailable');
  });

  it('does not let a background variant refresh reload stock surfaces', () => {
    expect(
      resolveSwapStockLoadingScopes({
        operation: { phase: 'idle' },
        currentTokenKey: 'current-token',
        isTokenVariantPending: true,
      }),
    ).toEqual(noLoading);
  });
});

describe('resolveSwapStockTokenSelectionKind', () => {
  it('treats another stock selected from positions as a ticker transition', () => {
    expect(
      resolveSwapStockTokenSelectionKind(
        { stock: { stockId: 'MSFT' } } as ISwapToken,
        'AAPL',
      ),
    ).toBe('ticker');
  });

  it('keeps a position on the current stock scoped to the trade ticket', () => {
    expect(
      resolveSwapStockTokenSelectionKind(
        { stock: { underlyingAssetTicker: 'aapl' } } as ISwapToken,
        'AAPL',
      ),
    ).toBe('token');
  });
});

describe('resolveSwapStockAvailability', () => {
  it('keeps unresolved selections pending instead of declaring them unsupported', () => {
    expect(resolveSwapStockAvailability({ pending: true, failed: false })).toBe(
      'pending',
    );
  });

  it('distinguishes a failed lookup from an authoritative missing variant', () => {
    expect(resolveSwapStockAvailability({ pending: false, failed: true })).toBe(
      'error',
    );
    expect(
      resolveSwapStockAvailability({ pending: false, failed: false }),
    ).toBe('unavailable');
  });

  it.each([false, true])(
    'retains an established active variant when refresh failed=%s',
    (failed) => {
      expect(
        resolveSwapStockAvailability({
          pending: false,
          failed,
          selectedVariant: buildVariant(),
        }),
      ).toBe('ready');
    },
  );

  it.each([false, true])(
    'keeps an established paused variant unavailable when refresh failed=%s',
    (failed) => {
      expect(
        resolveSwapStockAvailability({
          pending: false,
          failed,
          selectedVariant: buildVariant({ isPaused: true }),
        }),
      ).toBe('unavailable');
    },
  );
});

const defaultVariant = buildVariant({
  tokenId: 'apple-xstocks-solana',
  symbol: 'AAPLx',
  issuer: 'xstocks',
  networkId: 'sol--101',
  contractAddress: SOLANA_ADDRESS,
});

const stock: IMarketStockPublicItem = {
  stockId: 'apple',
  symbol: 'AAPL',
  name: 'Apple',
  logoUrl: 'https://example.com/apple.png',
  assetType: 'stock',
  currency: 'USD',
};

function buildDetail(
  overrides: Partial<IMarketTokenDetail> = {},
): IMarketTokenDetail {
  return {
    networkId: 'evm--1',
    address: EVM_ADDRESS,
    logoUrl: 'https://example.com/apple-ondo.png',
    name: 'Apple Ondo',
    symbol: 'AAPLon',
    decimals: 18,
    price: '311.25',
    priceConverted: '2210.15',
    stock: {
      stockId: 'apple',
      subtitle: 'Apple',
      source: 'ondo',
      sourceLogoUri: 'https://example.com/ondo.png',
      isOpen: false,
    },
    ...overrides,
  };
}

function buildDetailResponse(
  token = buildDetail(),
): IMarketTokenDetailResponse {
  return {
    code: 0,
    message: '',
    data: { token, websocket: { txs: false, kline: false } },
  };
}

describe('selectSwapStockVariant', () => {
  it.each([undefined, '', '  ', 'Apple', 'AAPL'])(
    'honors the backend default for a stock-level query %p',
    (query) => {
      expect(
        selectSwapStockVariant({
          items: [buildVariant(), defaultVariant],
          defaultTokenId: defaultVariant.tokenId,
          query,
        }),
      ).toBe(defaultVariant);
    },
  );

  it('limits an explicit token symbol to matching variants across networks', () => {
    const ethereum = buildVariant();
    const bsc = buildVariant({
      tokenId: 'apple-ondo-bsc',
      networkId: 'evm--56',
    });
    const items = [defaultVariant, ethereum, bsc];

    expect(
      selectSwapStockVariant({
        items,
        defaultTokenId: defaultVariant.tokenId,
        query: '  aaplon  ',
      }),
    ).toBe(ethereum);
    expect(
      selectSwapStockVariant({
        items,
        defaultTokenId: bsc.tokenId,
        query: 'AAPLon',
      }),
    ).toBe(bsc);
  });

  it.each(['AAPLon', EVM_ADDRESS])(
    'does not select an unrelated default when the explicit match %s is paused',
    (query) => {
      expect(
        selectSwapStockVariant({
          items: [defaultVariant, buildVariant({ isPaused: true })],
          defaultTokenId: defaultVariant.tokenId,
          query,
        }),
      ).toBeUndefined();
    },
  );

  it('matches EVM contracts without changing case-sensitive chain behavior', () => {
    const ethereum = buildVariant();
    expect(
      selectSwapStockVariant({
        items: [defaultVariant, ethereum],
        defaultTokenId: defaultVariant.tokenId,
        query: EVM_ADDRESS.toUpperCase(),
      }),
    ).toBe(ethereum);
    expect(
      selectSwapStockVariant({
        items: [ethereum, defaultVariant],
        defaultTokenId: ethereum.tokenId,
        query: SOLANA_ADDRESS,
      }),
    ).toBe(defaultVariant);
    expect(
      selectSwapStockVariant({
        items: [ethereum, defaultVariant],
        defaultTokenId: ethereum.tokenId,
        query: SOLANA_ADDRESS.toLowerCase(),
      }),
    ).toBeUndefined();
  });

  it.each(['0x1111111111111111111111111111111111111111', 'B'.repeat(32)])(
    'does not fall back from an unmatched contract %s',
    (query) => {
      expect(
        selectSwapStockVariant({
          items: [defaultVariant],
          defaultTokenId: defaultVariant.tokenId,
          query,
        }),
      ).toBeUndefined();
    },
  );

  it.each<Partial<IMarketStockTokenVariant>>([
    { tradingEnabled: false },
    { status: 'inactive' },
    { isPaused: true },
    { tradingHours: { isPaused: true } },
  ])('skips an unavailable backend default %p', (unavailable) => {
    const fallback = buildVariant();
    const blocked = buildVariant({ ...defaultVariant, ...unavailable });

    expect(
      selectSwapStockVariant({
        items: [blocked, fallback],
        defaultTokenId: blocked.tokenId,
      }),
    ).toBe(fallback);
    expect(
      selectSwapStockVariant({
        items: [blocked],
        defaultTokenId: blocked.tokenId,
      }),
    ).toBeUndefined();
  });

  it('allows active tokens outside market hours and normalizes backend status', () => {
    const variant = buildVariant({
      status: ' ACTIVE ',
      tradingHours: { isMarketOpen: false },
    });
    expect(selectSwapStockVariant({ items: [variant] })).toBe(variant);
    expect(selectSwapStockVariant({ items: [] })).toBeUndefined();
  });
});

describe('Swap stock selection response mapping', () => {
  beforeEach(() => {
    fetchVariantsMock.mockReset();
    fetchDetailMock.mockReset();
  });

  it('maps verified token details into an executable USD stock token', async () => {
    const variant = buildVariant();
    const detail = buildDetail({ address: EVM_ADDRESS.toUpperCase() });
    fetchDetailMock.mockResolvedValueOnce(buildDetailResponse(detail));

    await expect(
      fetchSwapStockVariantToken(variant, stock.stockId),
    ).resolves.toEqual({
      networkId: variant.networkId,
      contractAddress: detail.address,
      decimals: detail.decimals,
      symbol: detail.symbol,
      name: detail.name,
      logoURI: detail.logoUrl,
      networkLogoURI: variant.networkLogoUrl,
      isNative: false,
      price: '311.25',
      currency: 'usd',
      isStock: true,
      stock: detail.stock,
    });
    expect(fetchDetailMock).toHaveBeenCalledWith(
      variant.contractAddress,
      variant.networkId,
      { autoHandleError: false, skipConvertCurrency: true },
    );
  });

  it('uses the selected variant network when legacy details omit it', async () => {
    fetchDetailMock.mockResolvedValueOnce(
      buildDetailResponse(buildDetail({ networkId: undefined })),
    );
    await expect(
      fetchSwapStockVariantToken(buildVariant(), stock.stockId),
    ).resolves.toMatchObject({
      networkId: 'evm--1',
      stock: { stockId: 'apple' },
    });
  });

  it('matches stock identities without depending on backend casing', async () => {
    fetchDetailMock.mockResolvedValueOnce(
      buildDetailResponse(
        buildDetail({ stock: { ...buildDetail().stock!, stockId: 'APPLE' } }),
      ),
    );
    await expect(
      fetchSwapStockVariantToken(buildVariant(), 'apple'),
    ).resolves.toMatchObject({ stock: { stockId: 'APPLE' } });
  });

  it.each<Partial<IMarketTokenDetail>>([
    { networkId: 'evm--56' },
    { address: '0x1111111111111111111111111111111111111111' },
    { stock: undefined },
  ])('rejects mismatched or non-stock details %p', async (overrides) => {
    fetchDetailMock.mockResolvedValueOnce(
      buildDetailResponse(buildDetail(overrides)),
    );
    await expect(
      fetchSwapStockVariantToken(buildVariant(), stock.stockId),
    ).rejects.toThrow('Stock token detail does not match the selected variant');
  });

  it('rejects token details that belong to a different stock', async () => {
    const detail = buildDetail();
    fetchDetailMock.mockResolvedValueOnce(
      buildDetailResponse({
        ...detail,
        stock: { ...detail.stock!, stockId: 'tesla' },
      }),
    );
    await expect(
      fetchSwapStockVariantToken(buildVariant(), stock.stockId),
    ).rejects.toThrow('Stock token detail does not match the selected variant');
  });

  it('rejects Solana details with a different address case', async () => {
    fetchDetailMock.mockResolvedValueOnce(
      buildDetailResponse(
        buildDetail({
          networkId: defaultVariant.networkId,
          address: SOLANA_ADDRESS.toLowerCase(),
        }),
      ),
    );
    await expect(
      fetchSwapStockVariantToken(defaultVariant, stock.stockId),
    ).rejects.toThrow('Stock token detail does not match the selected variant');
  });

  it('rejects a non-success response even when it contains matching cached details', async () => {
    fetchDetailMock.mockResolvedValueOnce({
      ...buildDetailResponse(),
      code: 40_111,
    });
    await expect(
      fetchSwapStockVariantToken(buildVariant(), stock.stockId),
    ).rejects.toThrow('Stock token detail does not match the selected variant');
  });

  it('rejects unavailable variants before fetching their token details', async () => {
    await expect(
      fetchSwapStockVariantToken(
        buildVariant({ tradingEnabled: false }),
        stock.stockId,
      ),
    ).rejects.toThrow('Stock token is unavailable');
    expect(fetchDetailMock).not.toHaveBeenCalled();
  });

  it('carries an explicit issuer symbol through stock selection to the detail request', async () => {
    const variant = buildVariant();
    fetchVariantsMock.mockResolvedValueOnce({
      stockId: stock.stockId,
      items: [defaultVariant, variant],
      defaultTokenId: defaultVariant.tokenId,
    });
    fetchDetailMock.mockResolvedValueOnce(buildDetailResponse());

    await expect(
      fetchSwapStockSelection(stock, 'AAPLon'),
    ).resolves.toMatchObject({
      networkId: variant.networkId,
      contractAddress: variant.contractAddress,
      symbol: variant.symbol,
      isStock: true,
      stock: { stockId: stock.stockId },
    });
    expect(fetchVariantsMock).toHaveBeenCalledWith({ stockId: stock.stockId });
    expect(fetchDetailMock).toHaveBeenCalledWith(
      variant.contractAddress,
      variant.networkId,
      { autoHandleError: false, skipConvertCurrency: true },
    );
  });

  it('does not fetch an unrelated token when the explicit issuer match cannot trade', async () => {
    fetchVariantsMock.mockResolvedValueOnce({
      stockId: stock.stockId,
      items: [defaultVariant, buildVariant({ isPaused: true })],
      defaultTokenId: defaultVariant.tokenId,
    });
    await expect(fetchSwapStockSelection(stock, 'AAPLon')).rejects.toThrow(
      'No tradable stock token',
    );
    expect(fetchDetailMock).not.toHaveBeenCalled();
  });
});
