import { composePrivacyChainBalance } from './privacyChainBalanceUtils';

describe('composePrivacyChainBalance', () => {
  it('adds the indexer public half to the local private half', () => {
    const r = composePrivacyChainBalance({
      privateSide: '1000',
      publicSideIndexer: '250',
      spendable: '1000',
    });
    expect(r.total).toBe('1250');
    expect(r.balanceStatus).toBe('complete');
  });

  it('reports an incomplete total when the indexer could not be asked', () => {
    const r = composePrivacyChainBalance({
      privateSide: '1000',
      publicSideIndexer: undefined,
      spendable: '1000',
    });
    // The known half, marked partial so it does not read as the whole.
    expect(r.total).toBe('1000');
    expect(r.balanceStatus).toBe('partial');
    expect(r.frozen).toBe('');
  });

  it('shows the public half when the private side could not be read', () => {
    const r = composePrivacyChainBalance({
      privateSide: undefined,
      privateSideComplete: false,
      publicSideIndexer: '250',
      spendable: undefined,
    });
    expect(r.total).toBe('250');
    expect(r.balanceStatus).toBe('partial');
  });

  it('distinguishes an indexer zero from an indexer failure', () => {
    const zero = composePrivacyChainBalance({
      privateSide: '1000',
      publicSideIndexer: '0',
      spendable: '1000',
    });
    expect(zero.total).toBe('1000');
    expect(zero.balanceStatus).toBe('complete');
  });

  it('never lets an indexer inflate what can be spent', () => {
    const r = composePrivacyChainBalance({
      privateSide: '0',
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
      publicSideIndexer: '300',
      spendable: '500',
    });
    expect(r.total).toBe('800');
    expect(r.frozen).toBe('300');
  });

  it('clamps a negative spendable instead of propagating it', () => {
    const r = composePrivacyChainBalance({
      privateSide: '100',
      publicSideIndexer: '0',
      spendable: '-5',
    });
    expect(r.spendable).toBe('0');
    expect(r.frozen).toBe('100');
  });

  it('never reports negative frozen when spendable exceeds the total', () => {
    const r = composePrivacyChainBalance({
      privateSide: '100',
      publicSideIndexer: '0',
      spendable: '999',
    });
    expect(r.frozen).toBe('0');
  });
});

describe('privacy balance completeness', () => {
  it('distinguishes an unscanned wallet from a confirmed empty wallet', () => {
    expect(
      composePrivacyChainBalance({
        privateSide: undefined,
        publicSideIndexer: undefined,
        spendable: undefined,
        privateSideComplete: false,
      }),
    ).toMatchObject({
      total: '',
      spendable: '',
      frozen: '',
      balanceStatus: 'unavailable',
    });
    expect(
      composePrivacyChainBalance({
        privateSide: '0',
        publicSideIndexer: '0',
        spendable: '0',
      }),
    ).toMatchObject({
      total: '0',
      spendable: '0',
      frozen: '0',
      balanceStatus: 'complete',
    });
  });
  // A backfill can take days; the total shows what has been found so far plus
  // the public side, marked partial, instead of nothing.
  it('shows a partial total while the private side is still backfilling', () => {
    expect(
      composePrivacyChainBalance({
        privateSide: '100',
        publicSideIndexer: '50',
        spendable: '120',
        privateSideComplete: false,
      }),
    ).toMatchObject({
      total: '150',
      spendable: '120',
      frozen: '',
      balanceStatus: 'partial',
    });
  });
});
