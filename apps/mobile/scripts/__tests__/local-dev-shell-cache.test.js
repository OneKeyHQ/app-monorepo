const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  cacheLocalShellBuild,
  getIosSigningCacheOptions,
  readLocalShellCache,
} = require('../local-dev-shell-cache');
const { getShellCompatibility } = require('../native-dev-shell');

describe('local shell artifact cache', () => {
  let directory;
  let options;
  beforeEach(() => {
    directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-local-shell-cache-'),
    );
    options = {
      artifactPath: path.join(directory, 'built.zip'),
      cacheRoot: path.join(directory, 'cache'),
      compatibility: {
        artifactFile: 'OneKeyWallet-DevShell-ios-simulator-arm64.zip',
        platform: 'ios',
        shellInputKey: 'a'.repeat(64),
      },
    };
    fs.writeFileSync(options.artifactPath, 'complete shell archive');
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  it('keeps a complete validated package independent of the build output', async () => {
    await cacheLocalShellBuild(options);
    fs.rmSync(options.artifactPath);
    const cached = await readLocalShellCache(options);
    expect(cached.source).toBe('local-cache');
    expect(fs.readFileSync(cached.artifactPath, 'utf8')).toBe(
      'complete shell archive',
    );
    expect(await readLocalShellCache(options)).toEqual(cached);
  });

  it('changes the exact remote key for native implementation edits even when the ABI is unchanged', () => {
    expect(spawnSync('git', ['init', '-q', directory]).status).toBe(0);
    for (const relativePath of [
      'scripts/build-mobile-dev-shell.js',
      'scripts/mobile-dev-shell-resource.js',
      'ios/AppDelegate.swift',
      'ios/Podfile.lock',
      'ios/Podfile.properties.json',
      'ios/OneKeyWallet.xcodeproj/project.pbxproj',
      'ios/OneKeyWallet/OneKeyWallet.entitlements',
      'ios/Podfile',
    ]) {
      const file = path.join(directory, 'apps/mobile', relativePath);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, 'native build input');
    }
    const inputs = {
      nativeContractKey: 'a'.repeat(64),
      platform: 'ios',
      repoRoot: directory,
    };
    const before = getShellCompatibility(inputs);
    fs.writeFileSync(
      path.join(directory, 'apps/mobile/ios/AppDelegate.swift'),
      'changed native implementation',
    );
    const after = getShellCompatibility(inputs);
    expect(after.nativeContractKey).toBe(before.nativeContractKey);
    expect(after.shellInputKey).not.toBe(before.shellInputKey);
    expect(after.requireExactInput).toBe(true);
    const jsPath = path.join(directory, 'apps/mobile/index.js');
    fs.writeFileSync(jsPath, 'changed application JavaScript');
    expect(getShellCompatibility(inputs).shellInputKey).toBe(
      after.shellInputKey,
    );
  });

  it.each([
    'native-input',
    'build-rules',
    'bytes',
    'missing',
    'symlink',
    'receipt',
  ])('invalidates a package after %s changes', async (change) => {
    await cacheLocalShellBuild(options);
    const cached = await readLocalShellCache(options);
    const receiptPath = path.join(
      path.dirname(cached.artifactPath),
      'receipt.json',
    );
    if (change === 'native-input')
      options.compatibility.shellInputKey = 'b'.repeat(64);
    if (change === 'build-rules') {
      const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
      receipt.buildDigest = '0'.repeat(64);
      fs.writeFileSync(receiptPath, JSON.stringify(receipt));
    }
    if (change === 'bytes')
      fs.writeFileSync(cached.artifactPath, 'mutated shell archive');
    if (change === 'missing' || change === 'symlink')
      fs.rmSync(cached.artifactPath);
    if (change === 'symlink')
      fs.symlinkSync(options.artifactPath, cached.artifactPath);
    if (change === 'receipt') fs.writeFileSync(receiptPath, '{');
    expect(await readLocalShellCache(options)).toBeUndefined();
  });

  it('does not replace a good cache when the next build output is missing', async () => {
    await cacheLocalShellBuild(options);
    const cached = await readLocalShellCache(options);
    fs.rmSync(options.artifactPath);
    await expect(cacheLocalShellBuild(options)).rejects.toThrow();
    expect(await readLocalShellCache(options)).toEqual(cached);
  });

  it('does not cache a build whose signing inputs changed during compilation', async () => {
    await cacheLocalShellBuild({ ...options, buildDigest: '0'.repeat(64) });
    expect(await readLocalShellCache(options)).toBeUndefined();
  });

  it('keys a repaired shell to the original archive bytes', async () => {
    const original = await getIosSigningCacheOptions(options);
    fs.writeFileSync(options.artifactPath, 'different remote shell');
    const changed = await getIosSigningCacheOptions(options);
    expect(changed.compatibility.shellInputKey).not.toBe(
      original.compatibility.shellInputKey,
    );
  });
});
