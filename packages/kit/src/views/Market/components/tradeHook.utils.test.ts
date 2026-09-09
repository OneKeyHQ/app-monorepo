import type { IMarketDetailPlatform } from '@onekeyhq/shared/types/market';

import { resolveMarketTradeNetwork } from './tradeHook.utils';

const KATANA = 'evm--747474';
const ETH = 'evm--1';

const ethPlatform = {
  contract_address: '0xeth',
  onekeyNetworkId: ETH,
  tokenAddress: '0xeth',
};
const basePlatform = {
  contract_address: '0xbase',
  onekeyNetworkId: 'evm--8453',
  tokenAddress: '0xbase',
};
const nativePlatform = {
  contract_address: '',
  onekeyNetworkId: ETH,
  isNative: true as const,
};

describe('resolveMarketTradeNetwork', () => {
  describe('with a preferred network from the caller', () => {
    it('picks the platform entry mapped to that network', () => {
      const detailPlatforms: IMarketDetailPlatform = {
        ethereum: ethPlatform,
        base: basePlatform,
      };
      expect(
        resolveMarketTradeNetwork({
          detailPlatforms,
          preferredNetworkId: 'evm--8453',
        }),
      ).toBe(basePlatform);
    });

    it('trusts the caller when market data has no entry for that network', () => {
      // Katana vbUSDC: the market service has not mapped the Katana platform,
      // so no entry carries its onekeyNetworkId. Guessing another chain here
      // is what made the DeFi button a silent no-op.
      const detailPlatforms: IMarketDetailPlatform = {
        ethereum: ethPlatform,
      };
      expect(
        resolveMarketTradeNetwork({
          detailPlatforms,
          preferredNetworkId: KATANA,
        }),
      ).toEqual({ contract_address: '', onekeyNetworkId: KATANA });
    });

    it('still resolves when market data carries no platforms at all', () => {
      expect(resolveMarketTradeNetwork({ preferredNetworkId: KATANA })).toEqual(
        { contract_address: '', onekeyNetworkId: KATANA },
      );
    });

    it('does not let the hint override an explicit match on another entry', () => {
      const detailPlatforms: IMarketDetailPlatform = {
        ethereum: nativePlatform,
        base: basePlatform,
      };
      // Native entry would win without a hint; the hint targets Base.
      expect(
        resolveMarketTradeNetwork({
          detailPlatforms,
          preferredNetworkId: 'evm--8453',
        }),
      ).toBe(basePlatform);
    });
  });

  describe('without a hint (original heuristic)', () => {
    it('returns undefined when there is no market platform data', () => {
      expect(resolveMarketTradeNetwork({})).toBeUndefined();
    });

    it('prefers the native entry', () => {
      const detailPlatforms: IMarketDetailPlatform = {
        base: basePlatform,
        ethereum: nativePlatform,
      };
      expect(resolveMarketTradeNetwork({ detailPlatforms })).toBe(
        nativePlatform,
      );
    });

    it('falls back to the entry matching the primary platform address', () => {
      const detailPlatforms: IMarketDetailPlatform = {
        ethereum: ethPlatform,
        base: basePlatform,
      };
      expect(
        resolveMarketTradeNetwork({
          detailPlatforms,
          platforms: { base: '0xbase' },
        }),
      ).toBe(basePlatform);
    });

    it('falls back to the first entry when nothing matches', () => {
      const detailPlatforms: IMarketDetailPlatform = {
        ethereum: ethPlatform,
        base: basePlatform,
      };
      expect(
        resolveMarketTradeNetwork({
          detailPlatforms,
          platforms: { polygon: '0xnope' },
        }),
      ).toBe(ethPlatform);
    });
  });
});
