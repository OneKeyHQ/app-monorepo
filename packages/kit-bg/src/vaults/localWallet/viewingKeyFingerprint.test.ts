import { getViewingKeyFingerprint } from './viewingKeyFingerprint';

describe('getViewingKeyFingerprint', () => {
  // Fixed vectors: a change here re-identifies every stored viewing key.
  it.each([
    ['zec--0', 'uview1example', 'df3456db2437dc0ec767170fb5149373'],
    ['xmr--0', 'aa:bb', '6a2f31f7b1636cc2634778766abc64ea'],
    ['zec--0', 'uview1é', '1f55b2ead1e5aafb11362e3cb786dac0'],
  ])('%s %s', (networkId, viewingKey, expected) => {
    expect(getViewingKeyFingerprint({ networkId, viewingKey })).toBe(expected);
  });

  it('binds the network', () => {
    expect(
      getViewingKeyFingerprint({ networkId: 'zec--0', viewingKey: 'k' }),
    ).not.toBe(
      getViewingKeyFingerprint({ networkId: 'xmr--0', viewingKey: 'k' }),
    );
  });
});
