import { resolveToken } from '../core/token-resolver';
import { ERROR_CODES } from '../errors';
import { apiClient } from '../infra';

jest.mock('../infra', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

describe('token-resolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Path 1: Native token ---

  it('resolves native ETH without API call', async () => {
    const result = await resolveToken('ETH', 'eth');
    expect(result.isNative).toBe(true);
    expect(result.symbol).toBe('ETH');
    expect(result.decimals).toBe(18);
    expect(result.contractAddress).toBe('');
    expect(result.networkId).toBe('evm--1');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('resolves native ETH case-insensitively', async () => {
    const result = await resolveToken('eth', 'eth');
    expect(result.isNative).toBe(true);
    expect(result.symbol).toBe('ETH');
  });

  it('resolves native BNB on bsc', async () => {
    const result = await resolveToken('BNB', 'bsc');
    expect(result.isNative).toBe(true);
    expect(result.symbol).toBe('BNB');
    expect(result.decimals).toBe(18);
    expect(result.networkId).toBe('evm--56');
  });

  it('resolves native BTC without API call', async () => {
    const result = await resolveToken('BTC', 'btc');
    expect(result.isNative).toBe(true);
    expect(result.symbol).toBe('BTC');
    expect(result.decimals).toBe(8);
    expect(result.contractAddress).toBe('');
    expect(result.networkId).toBe('btc--0');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('resolves native TBTC without API call', async () => {
    const result = await resolveToken('TBTC', 'tbtc');
    expect(result.isNative).toBe(true);
    expect(result.symbol).toBe('TBTC');
    expect(result.decimals).toBe(8);
    expect(result.contractAddress).toBe('');
    expect(result.networkId).toBe('tbtc--0');
    expect(mockGet).not.toHaveBeenCalled();
  });

  // --- Path 2: Contract address ---

  it('resolves contract address via V2 market search', async () => {
    mockGet.mockResolvedValueOnce([
      {
        name: 'USD Coin',
        price: '1.0',
        symbol: 'USDC',
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        network: 'evm--1',
        logoUrl: 'https://logo.url/usdc.png',
        isNative: false,
        decimals: 6,
        liquidity: '1000000',
        volume24h: '500000',
        communityRecognized: true,
      },
    ]);

    const result = await resolveToken(
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      'eth',
    );
    expect(result.isNative).toBe(false);
    expect(result.symbol).toBe('USDC');
    expect(result.decimals).toBe(6);
    expect(result.contractAddress).toBe(
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    );
    expect(result.communityRecognized).toBe(true);
    expect(mockGet).toHaveBeenCalledWith(
      'utility',
      '/utility/v2/market/search',
      { query: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    );
  });

  it('graceful degradation when V2 search API fails for contract address', async () => {
    mockGet.mockRejectedValueOnce(new Error('API down'));
    const result = await resolveToken(
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      'eth',
    );
    expect(result.isNative).toBe(false);
    expect(result.contractAddress).toBe(
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    );
    expect(result.decimals).toBeNull();
    expect(result.name).toBeNull();
  });

  it('graceful degradation when contract address not in search results', async () => {
    mockGet.mockResolvedValueOnce([
      {
        name: 'Other Token',
        price: '1.0',
        symbol: 'OTH',
        address: '0x1111111111111111111111111111111111111111',
        network: 'evm--1',
        logoUrl: '',
        isNative: false,
        decimals: 18,
        liquidity: '100',
        communityRecognized: false,
      },
    ]);
    const result = await resolveToken(
      '0xDEAD000000000000000000000000000000000000',
      'eth',
    );
    expect(result.decimals).toBeNull();
    expect(result.contractAddress).toBe(
      '0xDEAD000000000000000000000000000000000000',
    );
  });

  // --- Path 3: Symbol search ---

  it('resolves symbol via V2 market search + networkId filter', async () => {
    mockGet.mockResolvedValueOnce([
      {
        symbol: 'USDT',
        address: '0x55d398326f99059ff775485246999027b3197955',
        network: 'evm--56',
        decimals: 18,
        name: 'Tether USD',
        price: '1.0',
        logoUrl: '',
        isNative: false,
        liquidity: '1000',
        communityRecognized: true,
      },
      {
        symbol: 'USDT',
        address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        network: 'evm--1',
        decimals: 6,
        name: 'Tether USD',
        price: '1.0',
        logoUrl: '',
        isNative: false,
        liquidity: '2000',
        communityRecognized: true,
      },
    ]);

    const result = await resolveToken('USDT', 'eth');
    expect(result.symbol).toBe('USDT');
    expect(result.decimals).toBe(6);
    expect(result.networkId).toBe('evm--1');
  });

  it('handles price "--" as null', async () => {
    mockGet.mockResolvedValueOnce([
      {
        symbol: 'TEST',
        address: '0xtest',
        network: 'evm--1',
        decimals: 18,
        name: 'Test Token',
        price: '--',
        logoUrl: '',
        isNative: false,
        liquidity: '',
        communityRecognized: false,
      },
    ]);
    const result = await resolveToken('TEST', 'eth');
    expect(result.price).toBeNull();
  });

  it('handles volume_24h fallback field', async () => {
    mockGet.mockResolvedValueOnce([
      {
        symbol: 'TEST',
        address: '0xtest',
        network: 'evm--1',
        decimals: 18,
        name: 'Test Token',
        price: '1.0',
        logoUrl: '',
        isNative: false,
        liquidity: '100',
        volume_24h: '99999',
        communityRecognized: false,
      },
    ]);
    const result = await resolveToken('TEST', 'eth');
    expect(result.volume24h).toBe('99999');
  });

  // --- Error cases ---

  it('throws BIZ_TOKEN_NOT_FOUND when no match on target chain', async () => {
    mockGet.mockResolvedValueOnce([
      {
        symbol: 'USDT',
        address: '0x...',
        network: 'evm--56',
        decimals: 18,
        name: '',
        price: '',
        logoUrl: '',
        isNative: false,
        liquidity: '',
        communityRecognized: false,
      },
    ]);
    await expect(resolveToken('USDT', 'eth')).rejects.toMatchObject({
      code: ERROR_CODES.BIZ_TOKEN_NOT_FOUND.code,
    });
  });

  it('throws BIZ_TOKEN_NOT_FOUND when search returns empty', async () => {
    mockGet.mockResolvedValueOnce([]);
    await expect(resolveToken('NONEXISTENT', 'eth')).rejects.toMatchObject({
      code: ERROR_CODES.BIZ_TOKEN_NOT_FOUND.code,
    });
  });

  it('throws PARAM_INVALID_CHAIN for unsupported chain', async () => {
    await expect(resolveToken('ETH', 'solana')).rejects.toMatchObject({
      code: ERROR_CODES.PARAM_INVALID_CHAIN.code,
    });
  });

  it('rethrows API error for symbol search (no graceful degradation)', async () => {
    mockGet.mockRejectedValueOnce(new Error('API down'));
    await expect(resolveToken('USDT', 'eth')).rejects.toThrow('API down');
  });

  // --- P1 fixes: invalid 0x prefix, duplicate symbol, malformed response ---

  it('treats invalid 0x prefix as symbol search (not contract address)', async () => {
    // "0xabc" is not a valid 40-char hex address — should go through symbol path
    mockGet.mockResolvedValueOnce([]);
    await expect(resolveToken('0xabc', 'eth')).rejects.toMatchObject({
      code: ERROR_CODES.BIZ_TOKEN_NOT_FOUND.code,
    });
  });

  it('prefers communityRecognized token when same symbol appears multiple times', async () => {
    mockGet.mockResolvedValueOnce([
      {
        symbol: 'USDT',
        address: '0xfake_usdt_scam_token_on_eth_not_recognized',
        network: 'evm--1',
        decimals: 18,
        name: 'Fake USDT',
        price: '0.9',
        logoUrl: '',
        isNative: false,
        liquidity: '50000',
        communityRecognized: false,
      },
      {
        symbol: 'USDT',
        address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        network: 'evm--1',
        decimals: 6,
        name: 'Tether USD',
        price: '1.0',
        logoUrl: '',
        isNative: false,
        liquidity: '2000000',
        communityRecognized: true,
      },
    ]);
    const result = await resolveToken('USDT', 'eth');
    expect(result.communityRecognized).toBe(true);
    expect(result.decimals).toBe(6);
    expect(result.contractAddress).toBe(
      '0xdac17f958d2ee523a2206206994597c13d831ec7',
    );
  });

  it('picks highest liquidity when multiple communityRecognized tokens match', async () => {
    mockGet.mockResolvedValueOnce([
      {
        symbol: 'TEST',
        address: '0x1111111111111111111111111111111111111111',
        network: 'evm--1',
        decimals: 18,
        name: 'Test A',
        price: '1.0',
        logoUrl: '',
        isNative: false,
        liquidity: '100',
        communityRecognized: true,
      },
      {
        symbol: 'TEST',
        address: '0x2222222222222222222222222222222222222222',
        network: 'evm--1',
        decimals: 18,
        name: 'Test B',
        price: '1.0',
        logoUrl: '',
        isNative: false,
        liquidity: '999999',
        communityRecognized: true,
      },
    ]);
    const result = await resolveToken('TEST', 'eth');
    expect(result.contractAddress).toBe(
      '0x2222222222222222222222222222222222222222',
    );
  });

  it('throws NET_HTTP_ERROR when API returns non-array for symbol search', async () => {
    mockGet.mockResolvedValueOnce('not an array');
    await expect(resolveToken('USDT', 'eth')).rejects.toMatchObject({
      code: ERROR_CODES.NET_HTTP_ERROR.code,
    });
  });

  it('graceful degradation when API returns non-array for contract address', async () => {
    mockGet.mockResolvedValueOnce({ unexpected: true });
    const result = await resolveToken(
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      'eth',
    );
    expect(result.decimals).toBeNull();
  });

  it('filters out malformed items from API response', async () => {
    mockGet.mockResolvedValueOnce([
      { bad: 'item' },
      null,
      {
        symbol: 'USDT',
        address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        network: 'evm--1',
        decimals: 6,
        name: 'Tether USD',
        price: '1.0',
        logoUrl: '',
        isNative: false,
        liquidity: '2000',
        communityRecognized: true,
      },
    ]);
    const result = await resolveToken('USDT', 'eth');
    expect(result.symbol).toBe('USDT');
    expect(result.decimals).toBe(6);
  });
});
