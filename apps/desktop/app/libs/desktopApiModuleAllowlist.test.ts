import {
  DESKTOP_API_ALLOWED_MODULES,
  isDesktopApiModuleAllowed,
} from './desktopApiModuleAllowlist';

describe('desktop API module allowlist', () => {
  it('allows the firmware artifact module required by desktop upgrades', () => {
    expect(DESKTOP_API_ALLOWED_MODULES).toContain('firmwareArtifact');
    expect(isDesktopApiModuleAllowed('firmwareArtifact')).toBe(true);
  });

  it('rejects modules outside the explicit allowlist', () => {
    expect(isDesktopApiModuleAllowed('__proto__')).toBe(false);
  });
});
