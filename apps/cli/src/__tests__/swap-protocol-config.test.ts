import {
  BRIDGE_CONFIG,
  SWAP_CONFIG,
  getProtocolConfig,
} from '../commands/swap/swap-protocol-config';

describe('swap-protocol-config', () => {
  describe('getProtocolConfig', () => {
    it('returns SWAP_CONFIG when fromNetworkId equals toNetworkId', () => {
      const config = getProtocolConfig('evm--1', 'evm--1');
      expect(config.protocol).toBe('Swap');
      expect(config).toBe(SWAP_CONFIG);
    });

    it('returns BRIDGE_CONFIG when fromNetworkId differs from toNetworkId', () => {
      const config = getProtocolConfig('evm--1', 'evm--42161');
      expect(config.protocol).toBe('Bridge');
      expect(config).toBe(BRIDGE_CONFIG);
    });
  });

  describe('SWAP_CONFIG', () => {
    it('has correct protocol', () => {
      expect(SWAP_CONFIG.protocol).toBe('Swap');
    });

    it('has 5 minute pending expiry', () => {
      expect(SWAP_CONFIG.pendingExpiryMs).toBe(5 * 60_000);
    });

    it('has correct final states', () => {
      expect(SWAP_CONFIG.finalStates.has('success')).toBe(true);
      expect(SWAP_CONFIG.finalStates.has('failed')).toBe(true);
      expect(SWAP_CONFIG.finalStates.has('canceled')).toBe(true);
    });

    it('mapApiState maps success to final', () => {
      const result = SWAP_CONFIG.mapApiState('success');
      expect(result.isFinal).toBe(true);
      expect(result.label).toContain('ompleted');
    });

    it('mapApiState maps pending to non-final', () => {
      const result = SWAP_CONFIG.mapApiState('pending');
      expect(result.isFinal).toBe(false);
    });
  });

  describe('BRIDGE_CONFIG', () => {
    it('has correct protocol', () => {
      expect(BRIDGE_CONFIG.protocol).toBe('Bridge');
    });

    it('has 30 minute pending expiry', () => {
      expect(BRIDGE_CONFIG.pendingExpiryMs).toBe(30 * 60_000);
    });

    it('has 3 progress stages', () => {
      expect(BRIDGE_CONFIG.progressStages).toEqual(['from', 'bridge', 'to']);
    });

    it('has all 8 final states from ESwapCrossChainStatus', () => {
      const expected = [
        'FROM_FAILED',
        'BRIDGE_FAILED',
        'TO_FAILED',
        'TO_SUCCESS',
        'REFUNDED',
        'REFUND_FAILED',
        'EXPIRED',
        'PROVIDER_ERROR',
      ];
      for (const s of expected) {
        expect(BRIDGE_CONFIG.finalStates.has(s)).toBe(true);
      }
      expect(BRIDGE_CONFIG.finalStates.size).toBe(expected.length);
    });

    it('mapApiState maps all 14 ESwapCrossChainStatus values', () => {
      const allStates = [
        'FROM_PENDING',
        'FROM_SUCCESS',
        'FROM_FAILED',
        'BRIDGE_PENDING',
        'BRIDGE_SUCCESS',
        'BRIDGE_FAILED',
        'TO_PENDING',
        'TO_SUCCESS',
        'TO_FAILED',
        'REFUNDING',
        'REFUNDED',
        'REFUND_FAILED',
        'EXPIRED',
        'PROVIDER_ERROR',
      ];
      for (const state of allStates) {
        const result = BRIDGE_CONFIG.mapApiState(state);
        expect(result.label).toBeTruthy();
        expect(typeof result.stage).toBe('number');
        expect(typeof result.total).toBe('number');
        expect(typeof result.isFinal).toBe('boolean');
      }
    });

    it('mapApiState returns correct stage numbers', () => {
      expect(BRIDGE_CONFIG.mapApiState('FROM_PENDING').stage).toBe(1);
      expect(BRIDGE_CONFIG.mapApiState('BRIDGE_PENDING').stage).toBe(2);
      expect(BRIDGE_CONFIG.mapApiState('TO_PENDING').stage).toBe(3);
    });

    it('mapApiState returns isFinal=true for terminal states', () => {
      expect(BRIDGE_CONFIG.mapApiState('TO_SUCCESS').isFinal).toBe(true);
      expect(BRIDGE_CONFIG.mapApiState('FROM_FAILED').isFinal).toBe(true);
      expect(BRIDGE_CONFIG.mapApiState('EXPIRED').isFinal).toBe(true);
    });

    it('mapApiState returns isFinal=false for in-progress states', () => {
      expect(BRIDGE_CONFIG.mapApiState('FROM_PENDING').isFinal).toBe(false);
      expect(BRIDGE_CONFIG.mapApiState('BRIDGE_PENDING').isFinal).toBe(false);
      expect(BRIDGE_CONFIG.mapApiState('REFUNDING').isFinal).toBe(false);
    });
  });
});
