import {
  buildInitialTradeInstrumentSwitchParams,
  resolveInitialPreferredInstrument,
  shouldCheckPerpsAccountStatusOnFocus,
  shouldRunPerpsAccountSelect,
} from './PerpsGlobalEffects.utils';

describe('resolveInitialPreferredInstrument', () => {
  const restored = {
    mode: 'perp' as const,
    coin: 'BTC',
    assetId: 0,
    universe: { name: 'BTC' } as never,
  };

  // OK-60543: the restored coin predates the tap, and the event carrying the
  // tapped one cannot reach a page that has not mounted yet.
  it('opens the market a context-less caller asked for', () => {
    expect(
      resolveInitialPreferredInstrument({
        pendingInstrument: { mode: 'perp', coin: 'para:SMCI' },
        restoredInstrument: restored,
      }),
    ).toEqual({
      mode: 'perp',
      coin: 'para:SMCI',
      assetId: undefined,
      universe: undefined,
    });
  });

  it('carries a spot pick across as spot', () => {
    expect(
      resolveInitialPreferredInstrument({
        pendingInstrument: { mode: 'spot', coin: '@107' },
        restoredInstrument: restored,
      }),
    ).toMatchObject({ mode: 'spot', coin: '@107' });
  });

  // The ordinary cold start, and what keeps #12680's restore intact.
  it('restores the persisted instrument when nothing was picked', () => {
    expect(
      resolveInitialPreferredInstrument({
        pendingInstrument: undefined,
        restoredInstrument: restored,
      }),
    ).toBe(restored);
  });

  it('ignores a pick with no coin', () => {
    expect(
      resolveInitialPreferredInstrument({
        pendingInstrument: { mode: 'perp', coin: '' },
        restoredInstrument: restored,
      }),
    ).toBe(restored);
  });
});

describe('buildInitialTradeInstrumentSwitchParams', () => {
  // The optimistic instrument is written synchronously when a switch starts,
  // while the mode and asset atoms are written near the end and can be skipped
  // by a superseding request. Restoring anything else flips the pair the first
  // frame already rendered.
  it('restores the rendered instrument over a half-written spot mode', () => {
    expect(
      buildInitialTradeInstrumentSwitchParams({
        mode: 'spot',
        spotAsset: { coin: '' },
        perpAsset: { coin: 'xyz:SKHX' },
        preferredInstrument: { mode: 'spot', coin: 'SOL' },
        force: true,
        allowPerpFallback: true,
      }),
    ).toEqual({
      mode: 'spot',
      coin: 'SOL',
      spotUniverse: undefined,
      force: true,
    });
  });

  // The mode atom is written after the instrument, so a superseded switch can
  // leave it on 'perp' while the user is looking at a spot pair.
  it('restores the rendered instrument over a stale perp mode', () => {
    expect(
      buildInitialTradeInstrumentSwitchParams({
        mode: 'perp',
        perpAsset: { coin: 'xyz:SKHX' },
        preferredInstrument: { mode: 'spot', coin: 'SOL' },
        allowPerpFallback: true,
      }),
    ).toMatchObject({ mode: 'spot', coin: 'SOL' });
  });

  // A completed earlier switch leaves the spot atom on that older pair.
  it('restores the rendered instrument over an older completed spot asset', () => {
    expect(
      buildInitialTradeInstrumentSwitchParams({
        mode: 'spot',
        spotAsset: { coin: 'HYPE' },
        preferredInstrument: { mode: 'spot', coin: 'SOL' },
      }),
    ).toMatchObject({ mode: 'spot', coin: 'SOL' });
  });

  it('falls through to the atoms when nothing was rendered yet', () => {
    expect(
      buildInitialTradeInstrumentSwitchParams({
        mode: 'spot',
        spotAsset: { coin: '@107' },
        preferredInstrument: { mode: 'perp', coin: '' },
      }),
    ).toMatchObject({ mode: 'spot', coin: '@107' });
  });

  it('restores the persisted spot mode and asset after restart', () => {
    expect(
      buildInitialTradeInstrumentSwitchParams({
        mode: 'spot',
        perpAsset: { coin: 'BTC' },
        spotAsset: { coin: '@107' },
        force: true,
      }),
    ).toEqual({
      mode: 'spot',
      coin: '@107',
      spotUniverse: undefined,
      force: true,
    });
  });

  it('restores the persisted perp mode and asset after restart', () => {
    expect(
      buildInitialTradeInstrumentSwitchParams({
        mode: 'perp',
        perpAsset: { coin: 'xyz:SKHX' },
        spotAsset: { coin: '@107' },
      }),
    ).toEqual({
      mode: 'perp',
      coin: 'xyz:SKHX',
    });
  });

  // The initial symbol latch is process-wide and already consumed by then, so
  // bailing out here strands the page for the rest of the session.
  it('falls back to the perp asset when the restored spot mode has no coin', () => {
    expect(
      buildInitialTradeInstrumentSwitchParams({
        mode: 'spot',
        perpAsset: { coin: 'BTC' },
        allowPerpFallback: true,
      }),
    ).toEqual({
      mode: 'perp',
      coin: 'BTC',
    });
  });

  it('treats an empty spot coin as unusable, matching the atom default', () => {
    expect(
      buildInitialTradeInstrumentSwitchParams({
        mode: 'spot',
        perpAsset: { coin: 'BTC' },
        spotAsset: { coin: '' },
        force: true,
        allowPerpFallback: true,
      }),
    ).toEqual({
      mode: 'perp',
      coin: 'BTC',
      force: true,
    });
  });

  // A resync firing inside that same window would abort the user's in-flight
  // spot switch.
  it('stays a no-op for the spot write window unless the fallback is opted in', () => {
    expect(
      buildInitialTradeInstrumentSwitchParams({
        mode: 'spot',
        perpAsset: { coin: 'BTC' },
        spotAsset: { coin: '' },
      }),
    ).toBeUndefined();
  });

  it('does not switch when neither mode has a usable asset', () => {
    expect(
      buildInitialTradeInstrumentSwitchParams({
        mode: 'spot',
        perpAsset: { coin: '' },
        allowPerpFallback: true,
      }),
    ).toBeUndefined();
  });
});

describe('shouldCheckPerpsAccountStatusOnFocus', () => {
  const staleMs = 60 * 60 * 1000;
  const nowMs = 2 * staleMs;

  it('skips before the first account selection has produced status params', () => {
    expect(
      shouldCheckPerpsAccountStatusOnFocus({
        isFocused: true,
        hasSelectedAccountParams: false,
        isSelectingAccount: false,
        lastCheckTimeMs: 0,
        nowMs,
        staleMs,
      }),
    ).toBe(false);
  });

  it('skips while account selection is already going to check status', () => {
    expect(
      shouldCheckPerpsAccountStatusOnFocus({
        isFocused: true,
        hasSelectedAccountParams: true,
        isSelectingAccount: true,
        lastCheckTimeMs: 0,
        nowMs,
        staleMs,
      }),
    ).toBe(false);
  });

  it('runs when focused and the previous status check is stale', () => {
    expect(
      shouldCheckPerpsAccountStatusOnFocus({
        isFocused: true,
        hasSelectedAccountParams: true,
        isSelectingAccount: false,
        lastCheckTimeMs: 0,
        nowMs,
        staleMs,
      }),
    ).toBe(true);
  });
});

describe('shouldRunPerpsAccountSelect', () => {
  const addrA = '0xaaa';
  const addrB = '0xbbb';

  it('runs when the id-based params key changes (account switch by id)', () => {
    expect(
      shouldRunPerpsAccountSelect({
        lastParams: '{"accountId":"a"}',
        currentParams: '{"accountId":"b"}',
        isExternalAccount: false,
        lastAddress: addrA,
        currentAddress: addrA,
      }),
    ).toBe(true);
  });

  it('skips when params are unchanged and nothing else applies', () => {
    expect(
      shouldRunPerpsAccountSelect({
        lastParams: '{"accountId":"a"}',
        currentParams: '{"accountId":"a"}',
        isExternalAccount: true,
        lastAddress: addrA,
        currentAddress: addrA,
      }),
    ).toBe(false);
  });

  it('forces a run when an external account address mutates in place (OK-56744)', () => {
    expect(
      shouldRunPerpsAccountSelect({
        lastParams: '{"accountId":"a"}',
        currentParams: '{"accountId":"a"}',
        isExternalAccount: true,
        lastAddress: addrA,
        currentAddress: addrB,
      }),
    ).toBe(true);
  });

  it('does not force a run for a non-external account even if the address differs (HD address follows id)', () => {
    expect(
      shouldRunPerpsAccountSelect({
        lastParams: '{"indexedAccountId":"a"}',
        currentParams: '{"indexedAccountId":"a"}',
        isExternalAccount: false,
        lastAddress: addrA,
        currentAddress: addrB,
      }),
    ).toBe(false);
  });

  it('ignores the undefined->defined mount transition (no previous address)', () => {
    expect(
      shouldRunPerpsAccountSelect({
        lastParams: '{"accountId":"a"}',
        currentParams: '{"accountId":"a"}',
        isExternalAccount: true,
        lastAddress: null,
        currentAddress: addrA,
      }),
    ).toBe(false);
  });

  it('ignores a defined->undefined transition (address temporarily unresolved)', () => {
    expect(
      shouldRunPerpsAccountSelect({
        lastParams: '{"accountId":"a"}',
        currentParams: '{"accountId":"a"}',
        isExternalAccount: true,
        lastAddress: addrA,
        currentAddress: null,
      }),
    ).toBe(false);
  });
});
