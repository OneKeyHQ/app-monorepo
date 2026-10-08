import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

import {
  UNKNOWN_SHARE_NETWORK_NAME,
  getNetworkIdByShareName,
  getShareNameByNetworkId,
  getShareNetworkParam,
} from './earnShareNetworkUtils';

describe('earnShareNetworkUtils', () => {
  describe('legacy names', () => {
    it.each([
      ['ethereum', 'eth'],
      ['solana', 'sol'],
      ['aptos', 'apt'],
      ['cosmos', 'cosmoshub'],
      ['btc', 'btc'],
      ['sui', 'sui'],
      ['sbtc', 'sbtc'],
      ['bsc', 'bsc'],
      ['base', 'base'],
    ] as const)(
      'keeps generating and resolving "%s"',
      (shareName, shortcode) => {
        const networkId = getNetworkIdsMap()[shortcode];
        expect(getShareNetworkParam(networkId)).toBe(shareName);
        expect(getNetworkIdByShareName(shareName)).toBe(networkId);
      },
    );

    it('resolves legacy names case-insensitively', () => {
      expect(getNetworkIdByShareName('Ethereum')).toBe(getNetworkIdsMap().eth);
    });

    it('still resolves the shortcode of a legacy network', () => {
      // Generation prefers "ethereum", but a hand-written /earn/eth/... link
      // must not 404.
      expect(getNetworkIdByShareName('eth')).toBe(getNetworkIdsMap().eth);
    });
  });

  describe('networks outside the legacy list (OK-61675)', () => {
    it('names Katana by its shortcode instead of unknown', () => {
      const katanaNetworkId = getNetworkIdsMap().katana;
      expect(getShareNetworkParam(katanaNetworkId)).toBe('katana');
      expect(getShareNetworkParam(katanaNetworkId)).not.toBe(
        UNKNOWN_SHARE_NETWORK_NAME,
      );
    });

    it('round-trips every preset network', () => {
      Object.values(getNetworkIdsMap()).forEach((networkId) => {
        const shareName = getShareNetworkParam(networkId);
        expect(shareName).not.toBe(UNKNOWN_SHARE_NETWORK_NAME);
        expect(getNetworkIdByShareName(shareName)).toBe(networkId);
      });
    });

    it('accepts a raw network id as the share segment', () => {
      const katanaNetworkId = getNetworkIdsMap().katana;
      expect(getNetworkIdByShareName(katanaNetworkId)).toBe(katanaNetworkId);
    });
  });

  describe('unresolvable input', () => {
    it.each(['', 'unknown', 'not-a-network', 'evm--999999'])(
      'returns undefined for %p',
      (networkName) => {
        expect(getNetworkIdByShareName(networkName)).toBeUndefined();
      },
    );

    it('falls back to unknown for a non-preset network id', () => {
      expect(getShareNameByNetworkId('evm--999999')).toBeUndefined();
      expect(getShareNetworkParam('evm--999999')).toBe(
        UNKNOWN_SHARE_NETWORK_NAME,
      );
    });
  });
});
