import {
  resolveSystemBarsOverride,
  upsertSystemBarsOverridePin,
} from './resolveSystemBarsOverride';

describe('resolveSystemBarsOverride', () => {
  it('prefers dark when any owner pins dark', () => {
    expect(resolveSystemBarsOverride(['light', 'dark'])).toBe('dark');
  });

  it('returns light when only light pins remain', () => {
    expect(resolveSystemBarsOverride(['light'])).toBe('light');
  });

  it('returns null when no pins remain', () => {
    expect(resolveSystemBarsOverride([])).toBeNull();
  });
});

describe('upsertSystemBarsOverridePin', () => {
  it('keeps dark after releasing one of two dark owners', () => {
    const pins = new Map<string, 'light' | 'dark'>();
    upsertSystemBarsOverridePin(pins, 'onboarding', 'dark');
    upsertSystemBarsOverridePin(pins, 'PrimeGiftModal', 'dark');
    upsertSystemBarsOverridePin(pins, 'onboarding', null);
    expect(resolveSystemBarsOverride(pins.values())).toBe('dark');
  });

  it('returns to the app theme after the last dark owner is released', () => {
    const pins = new Map<string, 'light' | 'dark'>();
    upsertSystemBarsOverridePin(pins, 'onboarding', 'dark');
    upsertSystemBarsOverridePin(pins, 'PrimeGiftModal', 'dark');
    upsertSystemBarsOverridePin(pins, 'onboarding', null);
    upsertSystemBarsOverridePin(pins, 'PrimeGiftModal', null);
    expect(resolveSystemBarsOverride(pins.values())).toBeNull();
  });

  it('stays dark if the gift pin is released while onboarding still holds', () => {
    const pins = new Map<string, 'light' | 'dark'>();
    upsertSystemBarsOverridePin(pins, 'onboarding', 'dark');
    upsertSystemBarsOverridePin(pins, 'PrimeGiftModal', 'dark');
    upsertSystemBarsOverridePin(pins, 'PrimeGiftModal', null);
    expect(resolveSystemBarsOverride(pins.values())).toBe('dark');
  });

  it('does not report a change when the same owner re-pins the same variant', () => {
    const pins = new Map<string, 'light' | 'dark'>();
    expect(upsertSystemBarsOverridePin(pins, 'onboarding', 'dark')).toBe(true);
    expect(upsertSystemBarsOverridePin(pins, 'onboarding', 'dark')).toBe(false);
  });
});
