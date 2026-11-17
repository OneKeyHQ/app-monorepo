function loadManifest(channel) {
  process.env.EXT_CHANNEL = channel;
  let manifest;
  jest.isolateModules(() => {
    manifest = require('../../src/manifest');
  });
  return manifest;
}

describe('Firefox MV3 manifest', () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.EXT_MANIFEST_V3 = '1';
    delete process.env.EXT_INJECT_MODE;
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it('uses a DOM event page without Chromium-only APIs or metadata', () => {
    const manifest = loadManifest('firefox');
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background).toEqual({
      page: 'background.html',
    });
    expect(manifest.action.default_popup).toBe('ui-popup.html');
    expect(manifest.commands._execute_action).toBeDefined();
    expect(manifest.browser_specific_settings.gecko.strict_min_version).toBe(
      '128.0',
    );
    expect(manifest.permissions).not.toEqual(
      expect.arrayContaining(['offscreen']),
    );
    expect(manifest.permissions).not.toEqual(
      expect.arrayContaining(['sidePanel']),
    );
    expect(manifest.key).toBeUndefined();
    expect(manifest.side_panel).toBeUndefined();
    expect(manifest.minimum_chrome_version).toBeUndefined();
    expect(manifest.content_security_policy.extension_pages).toContain(
      "'wasm-unsafe-eval'",
    );
  });

  it('injects the provider in MAIN with the same origin exclusions as the bridge', () => {
    const manifest = loadManifest('firefox');
    const bridge = manifest.content_scripts.find((script) => !script.world);
    const provider = manifest.content_scripts.find(
      (script) => script.world === 'MAIN',
    );
    expect(provider.js).toEqual(['injected.js']);
    expect(provider.run_at).toBe('document_start');
    expect(provider.matches).toEqual(bridge.matches);
    expect(provider.exclude_matches).toEqual(bridge.exclude_matches);
    expect(bridge.injectImmediate).toBeUndefined();
    expect(bridge.injectInto).toBeUndefined();
    expect(bridge.exclude_matches).not.toEqual([]);
    expect(
      manifest.web_accessible_resources.every(
        (resource) => resource.matches.length > 0,
      ),
    ).toBe(true);
  });

  it('keeps the Chromium service worker and offscreen permission', () => {
    const manifest = loadManifest('chrome');
    expect(manifest.background).toEqual({
      service_worker: 'background.bootstrap.js',
    });
    expect(manifest.permissions).toContain('offscreen');
    expect(manifest.key).toBeDefined();
    expect(manifest.browser_specific_settings).toBeUndefined();
  });
});
