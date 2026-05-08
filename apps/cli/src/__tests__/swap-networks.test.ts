import {
  _resetSwapNetworksCache,
  fetchSwapNetworks,
} from '../commands/swap/swap-networks';
import { apiClient } from '../infra';

jest.mock('../infra', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    setEnv: jest.fn(),
  },
}));

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

describe('swap-networks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetSwapNetworksCache();
  });

  describe('fetchSwapNetworks', () => {
    it('returns API-supported EVM and BTC swap networks from preset metadata', async () => {
      mockGet.mockResolvedValueOnce([
        {
          networkId: 'evm--1',
          supportSingleSwap: true,
          supportCrossChainSwap: true,
          supportLimit: true,
        },
        {
          networkId: 'evm--56',
          supportSingleSwap: true,
          supportCrossChainSwap: false,
          supportLimit: false,
        },
        {
          networkId: 'btc--0',
          supportSingleSwap: true,
          supportCrossChainSwap: true,
          supportLimit: false,
        },
        {
          networkId: 'tbtc--0',
          supportSingleSwap: false,
          supportCrossChainSwap: true,
          supportLimit: false,
        },
      ]);

      const networks = await fetchSwapNetworks();
      expect(networks).toHaveLength(3);
      expect(networks[0].networkId).toBe('evm--1');
      expect(networks[0].supportSingleSwap).toBe(true);
      expect(networks[0].supportCrossChainSwap).toBe(true);
      expect(networks[1].networkId).toBe('evm--56');
      expect(networks[2]).toMatchObject({
        networkId: 'btc--0',
        name: 'Bitcoin',
        chainId: '0',
        nativeSymbol: 'BTC',
        supportSingleSwap: true,
        supportCrossChainSwap: true,
        supportLimit: false,
      });
      expect(networks.map((n) => n.networkId)).not.toContain('tbtc--0');
    });

    it('skips malformed, unsupported, and non-preset networks', async () => {
      mockGet.mockResolvedValueOnce([
        {
          networkId: '',
          supportSingleSwap: true,
          supportCrossChainSwap: false,
          supportLimit: false,
        },
        {
          networkId: 'sol--101',
          supportSingleSwap: true,
          supportCrossChainSwap: false,
          supportLimit: false,
        },
        {
          networkId: 'evm--999999',
          supportSingleSwap: true,
          supportCrossChainSwap: false,
          supportLimit: false,
        },
      ]);

      const networks = await fetchSwapNetworks();
      expect(networks).toHaveLength(0);
    });

    it('returns empty array on API failure', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'));

      const networks = await fetchSwapNetworks();
      expect(networks).toHaveLength(0);
    });

    it('caches results after first successful call', async () => {
      mockGet.mockResolvedValueOnce([
        {
          networkId: 'evm--1',
          supportSingleSwap: true,
          supportCrossChainSwap: true,
          supportLimit: true,
        },
      ]);

      await fetchSwapNetworks();
      const second = await fetchSwapNetworks();

      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(second).toHaveLength(1);
      expect(second[0].networkId).toBe('evm--1');
    });

    it('enriches results with preset network metadata', async () => {
      mockGet.mockResolvedValueOnce([
        {
          networkId: 'evm--1',
          supportSingleSwap: true,
          supportCrossChainSwap: true,
          supportLimit: true,
        },
      ]);

      const networks = await fetchSwapNetworks();
      expect(networks[0].name).toBe('Ethereum');
      expect(networks[0].chainId).toBe('1');
      expect(networks[0].nativeSymbol).toBe('ETH');
    });
  });
});
