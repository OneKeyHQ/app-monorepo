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
    it('returns EVM swap networks from API', async () => {
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
          networkId: 'sol--101',
          supportSingleSwap: true,
          supportCrossChainSwap: false,
          supportLimit: false,
        },
      ]);

      const networks = await fetchSwapNetworks();
      // Should filter out non-EVM (sol--101)
      expect(networks).toHaveLength(2);
      expect(networks[0].networkId).toBe('evm--1');
      expect(networks[0].supportSingleSwap).toBe(true);
      expect(networks[0].supportCrossChainSwap).toBe(true);
      expect(networks[1].networkId).toBe('evm--56');
    });

    it('skips networks not in presetNetworks', async () => {
      mockGet.mockResolvedValueOnce([
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
