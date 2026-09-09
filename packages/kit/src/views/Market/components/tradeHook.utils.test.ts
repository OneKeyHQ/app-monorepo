import type { IMarketDetailPlatform } from '@onekeyhq/shared/types/market';

import { resolveMarketTradeNetwork } from './tradeHook.utils';

const KATANA = 'evm--747474';
const ETH = 'evm--1';
const BASE = 'evm--8453';
const VB_USDC = '0x203a662b0bd271a6ed5a60edfbd04bfce608fd36';

const ethPlatform = {
  contract_address: '0xeth',
  onekeyNetworkId: ETH,
  tokenAddress: '0xeth',
};
const basePlatform = {
  contract_address: '0xbase',
  onekeyNetworkId: BASE,
  tokenAddress: '0xbase',
};
const nativePlatform = {
  contract_address: '',
  onekeyNetworkId: ETH,
  isNative: true as const,
};

describe('resolveMarketTradeNetwork', () => {
  describe('with the asset the caller launched Market from', () => {
    it('prefers the market entry mapped to that network over the hint', () => {
      const detailPlatforms: IMarketDetailPlatform = {
        ethereum: ethPlatform,
        base: basePlatform,
      };
      expect(
        resolveMarketTradeNetwork({
          detailPlatforms,
          preferredToken: { networkId: BASE, tokenAddress: '0xstale' },
        }),
      ).toBe(basePlatform);
    });

    it('rebuilds the entry from the full identity when the network is unmapped', () => {
      // Katana vbUSDC: the market service has not mapped the Katana platform.
      // The rebuilt entry must carry the contract address, otherwise Swap is
      // opened on a non-native token with no address.
      const detailPlatforms: IMarketDetailPlatform = {
        ethereum: ethPlatform,
      };
      expect(
        resolveMarketTradeNetwork({
          detailPlatforms,
          preferredToken: { networkId: KATANA, tokenAddress: VB_USDC },
        }),
      ).toEqual({
        contract_address: VB_USDC,
        tokenAddress: VB_USDC,
        onekeyNetworkId: KATANA,
      });
    });

    it('marks a rebuilt native entry as native with an empty address', () => {
      expect(
        resolveMarketTradeNetwork({
          preferredToken: {
            networkId: KATANA,
            tokenAddress: '',
            isNative: true,
          },
        }),
      ).toEqual({
        contract_address: '',
        tokenAddress: '',
        onekeyNetworkId: KATANA,
        isNative: true,
      });
    });

    it('does not tag a rebuilt ERC-20 entry as native', () => {
      const entry = resolveMarketTradeNetwork({
        preferredToken: { networkId: KATANA, tokenAddress: VB_USDC },
      });
      expect(entry).not.toHaveProperty('isNative');
    });

    it('still resolves when market data carries no platforms at all', () => {
      expect(
        resolveMarketTradeNetwork({
          preferredToken: { networkId: KATANA, tokenAddress: VB_USDC },
        }),
      ).toMatchObject({ onekeyNetworkId: KATANA, tokenAddress: VB_USDC });
    });

    it('lets the hint pick a mapped entry the native-first heuristic would skip', () => {
      const detailPlatforms: IMarketDetailPlatform = {
        ethereum: nativePlatform,
        base: basePlatform,
      };
      expect(
        resolveMarketTradeNetwork({
          detailPlatforms,
          preferredToken: { networkId: BASE, tokenAddress: '0xbase' },
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
