import { shouldMountHomeForegroundEffects } from './homeLaunchVisibility';

describe('shouldMountHomeForegroundEffects', () => {
  it('does not mount portal or maintenance owners during hidden prewarm', () => {
    expect(shouldMountHomeForegroundEffects({ isHomeVisible: false })).toBe(
      false,
    );
  });

  it('mounts foreground side effects after the Home generation is visible', () => {
    expect(shouldMountHomeForegroundEffects({ isHomeVisible: true })).toBe(
      true,
    );
  });
});
