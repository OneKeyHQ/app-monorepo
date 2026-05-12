import {
  BRIDGE_CONFIG,
  SWAP_CONFIG,
} from '../commands/swap/swap-protocol-config';

describe('bridge status protocol resolution', () => {
  it('uses Bridge protocol when pending order has protocolType Bridge', () => {
    expect(BRIDGE_CONFIG.protocol).toBe('Bridge');
  });

  it('defaults to Swap protocol for legacy orders', () => {
    expect(SWAP_CONFIG.protocol).toBe('Swap');
  });
});

describe('bridge status state mapping', () => {
  it('maps cross-chain states to multi-stage display', () => {
    const result = BRIDGE_CONFIG.mapApiState('BRIDGE_PENDING');
    expect(result.label).toBe('Bridge transfer in progress...');
    expect(result.stage).toBe(2);
    expect(result.total).toBe(3);
    expect(result.isFinal).toBe(false);
  });

  it('identifies terminal states', () => {
    expect(BRIDGE_CONFIG.finalStates.has('TO_SUCCESS')).toBe(true);
    expect(BRIDGE_CONFIG.finalStates.has('BRIDGE_PENDING')).toBe(false);
  });
});

describe('--watch mode final state detection', () => {
  it('stops polling on TO_SUCCESS', () => {
    expect(BRIDGE_CONFIG.finalStates.has('TO_SUCCESS')).toBe(true);
  });

  it('stops polling on FROM_FAILED', () => {
    expect(BRIDGE_CONFIG.finalStates.has('FROM_FAILED')).toBe(true);
  });

  it('does not stop on BRIDGE_PENDING', () => {
    expect(BRIDGE_CONFIG.finalStates.has('BRIDGE_PENDING')).toBe(false);
  });
});
