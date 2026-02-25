import {
  getOnChainHistoryTxStatus,
  getOnChainHistoryTxAssetInfo,
  buildHistorySectionHeaderTitle,
} from './historyUtils';
import { EOnChainHistoryTxStatus } from '../../types/history';
import { EDecodedTxStatus } from '../../types/tx';

describe('historyUtils', () => {
  describe('getOnChainHistoryTxStatus', () => {
    it('should return Failed for failed status', () => {
      const result = getOnChainHistoryTxStatus(EOnChainHistoryTxStatus.Failed);
      expect(result).toBe(EDecodedTxStatus.Failed);
    });

    it('should return Confirmed for success status', () => {
      const result = getOnChainHistoryTxStatus(EOnChainHistoryTxStatus.Success);
      expect(result).toBe(EDecodedTxStatus.Confirmed);
    });

    it('should return Pending for pending status', () => {
      const result = getOnChainHistoryTxStatus(EOnChainHistoryTxStatus.Pending);
      expect(result).toBe(EDecodedTxStatus.Pending);
    });

    it('should return Pending for unknown status', () => {
      const result = getOnChainHistoryTxStatus('unknown' as any);
      expect(result).toBe(EDecodedTxStatus.Pending);
    });
  });

  describe('getOnChainHistoryTxAssetInfo', () => {
    it('should return token info for token asset', () => {
      const tokens = {
        '0x123': {
          info: {
            name: 'Test Token',
            symbol: 'TEST',
            logoURI: 'https://example.com/icon.png',
            address: '0x123',
          },
        },
      };

      const result = getOnChainHistoryTxAssetInfo({
        key: '0x123',
        tokenAddress: '0x123',
        tokens,
        nfts: {},
      });

      expect(result.name).toBe('Test Token');
      expect(result.symbol).toBe('TEST');
      expect(result.isNFT).toBe(false);
      expect(result.address).toBe('0x123');
    });

    it('should return NFT info for NFT asset', () => {
      const nfts = {
        '0x456': {
          metadata: { name: 'Test NFT', image: 'https://example.com/nft.png' },
          collectionName: 'Test Collection',
          collectionSymbol: 'TESTNFT',
          collectionAddress: '0x456',
        },
      };

      const result = getOnChainHistoryTxAssetInfo({
        key: '0x456',
        tokenAddress: '0x456',
        tokens: {},
        nfts,
      });

      expect(result.name).toBe('Test NFT');
      expect(result.isNFT).toBe(true);
      expect(result.isNative).toBe(false);
    });

    it('should return native token info when tokenAddress is empty', () => {
      const tokens = {
        native: {
          info: {
            name: 'Ethereum',
            symbol: 'ETH',
            logoURI: '',
            address: '',
          },
        },
      };

      const result = getOnChainHistoryTxAssetInfo({
        key: '',
        tokenAddress: '',
        tokens,
        nfts: {},
      });

      expect(result.name).toBe('Ethereum');
      expect(result.isNative).toBe(true);
    });
  });

  describe('buildHistorySectionHeaderTitle', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-01-15');
      const result = buildHistorySectionHeaderTitle(date.toISOString());
      expect(result).toContain('2024');
    });

    it('should handle today', () => {
      const today = new Date();
      const result = buildHistorySectionHeaderTitle(today.toISOString());
      // Should contain "Today" or today's date
      expect(result).toBeTruthy();
    });
  });
});
