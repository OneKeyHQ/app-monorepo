import {
  buildInitialTradeInstrumentSwitchParams,
  shouldCheckPerpsAccountStatusOnFocus,
  shouldRunPerpsAccountSelect,
} from './PerpsGlobalEffects.utils';

describe('buildInitialTradeInstrumentSwitchParams', () => {
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
