import { isExternalEntry, resolveOverlayDisplay } from '../displayPolicy';

describe('isExternalEntry', () => {
  it('marks deeplink and notification as external', () => {
    expect(isExternalEntry('deeplink')).toBe(true);
    expect(isExternalEntry('notification')).toBe(true);
  });

  it('does NOT mark in-app as external', () => {
    expect(isExternalEntry('in-app')).toBe(false);
  });

  it('treats unknown / undefined as in-app (default-safe for callers that omit it)', () => {
    expect(isExternalEntry(undefined)).toBe(false);
  });
});

describe('resolveOverlayDisplay — external entries (deeplink / notification)', () => {
  it.each(['deeplink' as const, 'notification' as const])(
    '%s forces the header to be visible regardless of hideHeader=true',
    (source) => {
      const result = resolveOverlayDisplay({
        source,
        hideHeader: true,
        title: 'OneKey Wallet',
        showAddressBar: false,
      });
      expect(result.hideHeader).toBe(false);
    },
  );

  it.each(['deeplink' as const, 'notification' as const])(
    '%s forces the address bar to be visible regardless of showAddressBar=false/undefined',
    (source) => {
      expect(
        resolveOverlayDisplay({
          source,
          showAddressBar: false,
        }).showAddressBar,
      ).toBe(true);

      expect(
        resolveOverlayDisplay({
          source,
          showAddressBar: undefined,
        }).showAddressBar,
      ).toBe(true);
    },
  );

  it.each(['deeplink' as const, 'notification' as const])(
    '%s ignores the caller-supplied title so it cannot spoof a trusted brand',
    (source) => {
      // Classic phishing combo: trusted-looking title + attacker-controlled
      // https host. The page is allowed to load (URL passed safety policy)
      // but the user must see the real address — never the injected title.
      const result = resolveOverlayDisplay({
        source,
        title: 'OneKey Wallet',
        hideHeader: true,
        showAddressBar: false,
      });
      expect(result.fallbackTitle).toBeUndefined();
    },
  );

  it('locks all three policy outputs at once for a fully-hostile deeplink', () => {
    expect(
      resolveOverlayDisplay({
        source: 'deeplink',
        title: 'Connect your wallet',
        hideHeader: true,
        showAddressBar: false,
      }),
    ).toEqual({
      hideHeader: false,
      showAddressBar: true,
      fallbackTitle: undefined,
    });
  });
});

describe('resolveOverlayDisplay — in-app entries', () => {
  it('keeps caller-controlled hideHeader / showAddressBar / title verbatim', () => {
    expect(
      resolveOverlayDisplay({
        source: 'in-app',
        title: 'Earn',
        hideHeader: true,
        showAddressBar: true,
      }),
    ).toEqual({
      hideHeader: true,
      showAddressBar: true,
      fallbackTitle: 'Earn',
    });
  });

  it('coerces undefined hideHeader/showAddressBar to safe defaults', () => {
    expect(
      resolveOverlayDisplay({
        source: 'in-app',
      }),
    ).toEqual({
      hideHeader: false,
      showAddressBar: false,
      fallbackTitle: undefined,
    });
  });

  it('treats missing source as in-app (no enforcement)', () => {
    // A caller that forgets to set `source` should not accidentally get
    // external-entry behavior — but they also don't get sanitized, so
    // callers wiring up external entries must remember to set the source.
    expect(
      resolveOverlayDisplay({
        title: 'whatever',
        hideHeader: true,
      }),
    ).toEqual({
      hideHeader: true,
      showAddressBar: false,
      fallbackTitle: 'whatever',
    });
  });
});
