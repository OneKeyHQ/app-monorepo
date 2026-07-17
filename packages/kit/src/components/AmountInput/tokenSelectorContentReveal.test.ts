import {
  getTokenSelectorContentRevealStage,
  shouldShowTokenSelectorFallbackNetworkBadge,
} from './tokenSelectorContentReveal';

const baseReveal = {
  degraded: false,
  identityKey: 'evm--56:usdc',
  onNetworkImageDisplay: jest.fn(),
  onTokenImageDisplay: jest.fn(),
  reveal: false,
  showNetworkBadge: true,
};

describe('token selector content reveal', () => {
  it('keeps callers without an atomic gate on the direct render path', () => {
    expect(getTokenSelectorContentRevealStage()).toBe('direct');
  });

  it('moves from one pending placeholder to the complete live row', () => {
    expect(getTokenSelectorContentRevealStage(baseReveal)).toBe('pending');
    expect(
      getTokenSelectorContentRevealStage({ ...baseReveal, reveal: true }),
    ).toBe('ready');
  });

  it('freezes the degraded fallback even when reveal is open', () => {
    expect(
      getTokenSelectorContentRevealStage({
        ...baseReveal,
        degraded: true,
        reveal: true,
      }),
    ).toBe('degraded');
  });

  it('keeps a neutral badge for a known network without a logo URI', () => {
    expect(
      shouldShowTokenSelectorFallbackNetworkBadge({
        contentReveal: baseReveal,
      }),
    ).toBe(true);
    expect(
      shouldShowTokenSelectorFallbackNetworkBadge({
        contentReveal: { ...baseReveal, showNetworkBadge: false },
      }),
    ).toBe(false);
  });
});
