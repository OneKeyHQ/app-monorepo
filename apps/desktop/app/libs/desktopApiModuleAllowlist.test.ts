import {
  DESKTOP_API_ALLOWED_MODULES,
  isDesktopApiMethodAllowed,
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

  it.each([
    'getCapabilities',
    'download',
    'cancelDownloads',
    'materialize',
    'open',
    'read',
    'close',
    'createLease',
    'retain',
    'releaseLease',
    'sweepOrphans',
  ])('allows firmwareArtifact.%s', (method) => {
    expect(isDesktopApiMethodAllowed('firmwareArtifact', method)).toBe(true);
  });

  it.each([
    'validateDownloadInput',
    'downloadLocked',
    'streamResponseToFile',
    'writeResponseBody',
    'promoteArtifact',
    'resolveArtifactPath',
    '__proto__',
    'constructor',
  ])('rejects firmwareArtifact.%s', (method) => {
    expect(isDesktopApiMethodAllowed('firmwareArtifact', method)).toBe(false);
  });

  it('keeps the legacy method policy for existing modules', () => {
    expect(isDesktopApiMethodAllowed('system', 'getSystemInfo')).toBe(true);
    expect(isDesktopApiMethodAllowed('system', '_privateMethod')).toBe(false);
  });
});
