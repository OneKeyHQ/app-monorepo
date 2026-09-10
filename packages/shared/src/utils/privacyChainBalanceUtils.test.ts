import { composePrivacyChainBalance } from './privacyChainBalanceUtils';

describe('composePrivacyChainBalance', () => {
  it('adds the indexer public half to the local private half', () => {
    const r = composePrivacyChainBalance({
      privateSide: '1000',
      publicSideLocal: '0',
      publicSideIndexer: '250',
      spendable: '1000',
    });
    expect(r.total).toBe('1250');
    expect(r.publicSideSource).toBe('indexer');
  });

  it('falls back to the local view when the indexer could not be asked', () => {
    const r = composePrivacyChainBalance({
      privateSide: '1000',
      publicSideLocal: '700',
      publicSideIndexer: undefined,
      spendable: '1000',
    });
    // Not 1000: a third party being down must not shrink the balance.
    expect(r.total).toBe('1700');
    expect(r.publicSideSource).toBe('local');
  });

  it('distinguishes an indexer zero from an indexer failure', () => {
    const zero = composePrivacyChainBalance({
      privateSide: '1000',
      publicSideLocal: '700',
      publicSideIndexer: '0',
      spendable: '1000',
    });
    expect(zero.total).toBe('1000');
    expect(zero.publicSideSource).toBe('indexer');
  });

  it('never lets an indexer inflate what can be spent', () => {
    const r = composePrivacyChainBalance({
      privateSide: '0',
      publicSideLocal: '0',
      publicSideIndexer: '900000',
      spendable: '0',
    });
    expect(r.spendable).toBe('0');
    // The whole indexer balance shows up as not-yet-spendable, not as spendable.
    expect(r.frozen).toBe('900000');
    expect(r.total).toBe('900000');
  });

  it('reports the gap as frozen when the indexer runs ahead of the scan', () => {
    const r = composePrivacyChainBalance({
      privateSide: '500',
      publicSideLocal: '0',
      publicSideIndexer: '300',
      spendable: '500',
    });
    expect(r.total).toBe('800');
    expect(r.frozen).toBe('300');
  });

  it('clamps a negative spendable instead of propagating it', () => {
    const r = composePrivacyChainBalance({
      privateSide: '100',
      publicSideLocal: '0',
      publicSideIndexer: '0',
      spendable: '-5',
    });
    expect(r.spendable).toBe('0');
    expect(r.frozen).toBe('100');
  });

  it('never reports negative frozen when spendable exceeds the total', () => {
    const r = composePrivacyChainBalance({
      privateSide: '100',
      publicSideLocal: '0',
      publicSideIndexer: '0',
      spendable: '999',
    });
    expect(r.frozen).toBe('0');
  });
});
