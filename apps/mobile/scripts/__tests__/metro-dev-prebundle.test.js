/* cspell:words prebundle */
const os = require('os');
const path = require('path');

const fs = require('fs-extra');

const devVendorConfig = require('../../dev-vendor.config');
const {
  computeConfigInputsDigest,
  computeFingerprint,
  computeModulesDigest,
  getPlatformOutputDirectory,
  sha256,
} = require('../../plugins/devVendor');
const { REPO_ROOT, loadRegistry } = require('../../plugins/moduleIdRegistry');
const {
  PACKAGE_INVENTORY_NAME,
  PUBLIC_RELEASE_LICENSE_OVERRIDES,
  RELEASE_MANIFEST_NAME,
  THIRD_PARTY_NOTICES_NAME,
  assertPublicRedistributionPolicy,
  assertSafeOutputDirectory,
  collectPackageInventory,
  downloadReleaseAsset,
  getPlatformCacheDirectory,
  getSharedCacheRoot,
  getTagCacheLockDirectory,
  packagePrebundleRelease,
  parseArgs,
  restorePlatformFromRelease,
  runGhCommand,
  touchAndPruneSharedCache,
  verifyArtifactAttestation,
  verifyReleaseManifest,
  withCacheLock,
} = require('../metro-dev-prebundle');

function createTemporaryRepo() {
  const repoRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'onekey-metro-dev-prebundle-'),
  );
  const fixtureFiles = new Set([
    ...devVendorConfig.fingerprintFiles,
    ...devVendorConfig.releaseFingerprintFiles,
  ]);
  for (const relativePath of fixtureFiles) {
    const destination = path.join(repoRoot, relativePath);
    fs.ensureDirSync(path.dirname(destination));
    fs.copyFileSync(path.join(REPO_ROOT, relativePath), destination);
  }
  for (const relativeDirectory of devVendorConfig.fingerprintDirectories) {
    fs.ensureDirSync(path.join(repoRoot, relativeDirectory));
  }
  const modulePath = 'node_modules/react/index.js';
  const moduleId = loadRegistry().modules[modulePath];
  if (!moduleId) {
    throw new TypeError(`Missing test registry module: ${modulePath}`);
  }
  const packageRoot = path.join(repoRoot, 'node_modules/react');
  fs.ensureDirSync(packageRoot);
  fs.writeJsonSync(path.join(packageRoot, 'package.json'), {
    license: 'MIT',
    name: 'react',
    repository: 'https://github.com/facebook/react',
    version: 'test',
  });
  fs.writeFileSync(path.join(packageRoot, 'LICENSE'), 'Test MIT license.\n');
  fs.writeFileSync(path.join(repoRoot, modulePath), 'module.exports = {};\n');

  const prependModulePath =
    'node_modules/metro-runtime/src/polyfills/require.js';
  const prependModuleId = loadRegistry().modules[prependModulePath];
  if (!prependModuleId) {
    throw new TypeError(`Missing test registry module: ${prependModulePath}`);
  }
  const prependPackageRoot = path.join(repoRoot, 'node_modules/metro-runtime');
  fs.ensureDirSync(path.dirname(path.join(repoRoot, prependModulePath)));
  fs.writeJsonSync(path.join(prependPackageRoot, 'package.json'), {
    license: 'MIT',
    name: 'metro-runtime',
    version: 'test',
  });
  fs.writeFileSync(
    path.join(prependPackageRoot, 'LICENSE'),
    'Test Metro MIT license.\n',
  );
  fs.writeFileSync(
    path.join(repoRoot, prependModulePath),
    'module.exports = {};\n',
  );

  const projectRoot = path.join(repoRoot, 'apps/mobile');
  const modules = [{ id: moduleId, path: modulePath }];
  const prependModules = [{ id: prependModuleId, path: prependModulePath }];
  for (const platform of ['ios', 'android']) {
    const artifactDirectory = getPlatformOutputDirectory(projectRoot, platform);
    fs.ensureDirSync(path.join(artifactDirectory, 'stubs'));
    const source = Buffer.from(`common source for ${platform}`);
    const bytecode = Buffer.from(`common bytecode for ${platform}`);
    fs.writeFileSync(path.join(artifactDirectory, 'common.js'), source);
    fs.writeFileSync(path.join(artifactDirectory, 'common.hbc'), bytecode);
    fs.writeFileSync(
      path.join(artifactDirectory, 'stubs', `${moduleId}.js`),
      '',
    );
    const fingerprintFields = {
      configInputsDigest: computeConfigInputsDigest(repoRoot),
      modules,
      modulesDigest: computeModulesDigest(modules, repoRoot),
      platform,
      prependModules,
      registryEpoch: loadRegistry().registryEpoch,
      schemaVersion: devVendorConfig.SCHEMA_VERSION,
      strategyVersion: devVendorConfig.STRATEGY_VERSION,
    };
    fs.writeJsonSync(
      path.join(artifactDirectory, 'manifest.json'),
      {
        ...fingerprintFields,
        common: {
          bytecode: {
            bytes: bytecode.length,
            file: 'common.hbc',
            sha256: sha256(bytecode),
          },
          source: {
            bytes: source.length,
            file: 'common.js',
            sha256: sha256(source),
          },
        },
        fingerprint: computeFingerprint(fingerprintFields),
      },
      { spaces: 2 },
    );
  }
  return { moduleId, projectRoot, repoRoot };
}

function createReleaseFetch(outputDirectory) {
  return async (url) => {
    const fileName = decodeURIComponent(
      new URL(url).pathname.split('/').at(-1),
    );
    const filePath = path.join(outputDirectory, fileName);
    if (!(await fs.pathExists(filePath))) {
      return new Response('missing', { status: 404 });
    }
    return new Response(await fs.readFile(filePath), { status: 200 });
  };
}

async function writeTestAttestationBundle(outputDirectory) {
  const digests = {};
  for (const fileName of await fs.readdir(outputDirectory)) {
    digests[fileName] = sha256(
      await fs.readFile(path.join(outputDirectory, fileName)),
    );
  }
  await fs.writeJson(
    path.join(outputDirectory, devVendorConfig.RELEASE_ATTESTATION_BUNDLE_NAME),
    digests,
  );
}

function createTestAttestationVerifier() {
  const attestationVerifier = jest.fn(async ({ artifactPath, bundlePath }) => {
    const bundle = await fs.readJson(bundlePath);
    const expectedDigest = bundle[path.basename(artifactPath)];
    expect(expectedDigest).toBeDefined();
    expect(sha256(await fs.readFile(artifactPath))).toBe(expectedDigest);
  });
  return attestationVerifier;
}

describe('metro-dev-prebundle release transport', () => {
  it('rejects protected release output directories', () => {
    const repoRoot = path.resolve('/tmp/example-repo');
    const projectRoot = path.join(repoRoot, 'apps/mobile');
    const allowedOutputRoot = path.join(projectRoot, 'out-dir-bundle');
    expect(() =>
      assertSafeOutputDirectory({
        outputDirectory: repoRoot,
        projectRoot,
      }),
    ).toThrow('Release output must be inside');
    expect(() =>
      assertSafeOutputDirectory({
        outputDirectory: allowedOutputRoot,
        projectRoot,
      }),
    ).toThrow('Release output must be inside');
    expect(
      assertSafeOutputDirectory({
        outputDirectory: path.join(allowedOutputRoot, 'release'),
        projectRoot,
      }),
    ).toBe(path.join(allowedOutputRoot, 'release'));
  });

  it('enforces download limits while streaming bodies without a length', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response(Buffer.alloc(6), {
        headers: { 'content-type': 'application/octet-stream' },
      }),
    );
    await expect(
      downloadReleaseAsset({
        fetchImpl,
        fileName: 'asset.bin',
        maxBytes: 5,
        releaseBaseUrl: 'https://example.invalid/release',
        tagName: 'test',
      }),
    ).rejects.toThrow('Downloaded asset is too large');
  });

  it('uses the dependency package root instead of nested package metadata', () => {
    const repoRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-metro-package-root-'),
    );
    const packageRoot = path.join(repoRoot, 'node_modules/@example/library');
    try {
      fs.ensureDirSync(path.join(packageRoot, 'dist/cjs'));
      fs.writeJsonSync(path.join(packageRoot, 'package.json'), {
        license: 'MIT',
        name: '@example/library',
        version: '1.0.0',
      });
      fs.writeJsonSync(path.join(packageRoot, 'dist/cjs/package.json'), {
        type: 'commonjs',
      });
      const packages = collectPackageInventory(
        {
          ios: {
            modules: [
              {
                id: 50_000,
                path: 'node_modules/@example/library/dist/cjs/index.js',
              },
            ],
          },
        },
        repoRoot,
      );
      expect(packages).toEqual([
        expect.objectContaining({
          license: 'MIT',
          licenseSource: 'package.json',
          name: '@example/library',
          packageRoot: 'node_modules/@example/library',
          private: false,
          version: '1.0.0',
        }),
      ]);
    } finally {
      fs.removeSync(repoRoot);
    }
  });

  it('accepts only reviewed license override contents', () => {
    for (const [packageKey, override] of Object.entries(
      PUBLIC_RELEASE_LICENSE_OVERRIDES,
    )) {
      const packageName = packageKey.slice(0, packageKey.lastIndexOf('@'));
      const packages = collectPackageInventory(
        {
          ios: {
            modules: [
              {
                id: 50_000,
                path: `node_modules/${packageName}/index.js`,
              },
            ],
          },
        },
        REPO_ROOT,
      );
      expect(packages).toEqual([
        expect.objectContaining({
          license: override.license,
          licenseSource: 'reviewed-override',
          name: packageName,
        }),
      ]);
    }

    const repoRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-metro-license-override-'),
    );
    try {
      const packageRoot = path.join(repoRoot, 'node_modules/buffer-compare');
      fs.ensureDirSync(packageRoot);
      fs.writeJsonSync(path.join(packageRoot, 'package.json'), {
        name: 'buffer-compare',
        version: '1.1.1',
      });
      fs.writeFileSync(path.join(packageRoot, 'LICENSE'), 'changed');
      expect(() =>
        collectPackageInventory(
          {
            ios: {
              modules: [
                {
                  id: 50_000,
                  path: 'node_modules/buffer-compare/index.js',
                },
              ],
            },
          },
          repoRoot,
        ),
      ).toThrow('Reviewed license file changed');
    } finally {
      fs.removeSync(repoRoot);
    }
  });

  it('rejects private and unlicensed packages from public releases', () => {
    expect(() =>
      assertPublicRedistributionPolicy([
        {
          license: 'MIT',
          name: '@example/private',
          private: true,
          version: '1.0.0',
        },
      ]),
    ).toThrow('without redistribution approval');
    expect(() =>
      assertPublicRedistributionPolicy([
        {
          license: 'UNLICENSED',
          name: '@example/unlicensed',
          private: false,
          version: '1.0.0',
        },
      ]),
    ).toThrow('without redistribution approval');
    expect(() =>
      assertPublicRedistributionPolicy([
        {
          license: 'UNKNOWN',
          name: '@example/unknown',
          private: false,
          version: '1.0.0',
        },
      ]),
    ).toThrow('without redistribution approval');
  });

  it('parses tag and package commands without ambiguous options', () => {
    expect(parseArgs(['tag']).command).toBe('tag');
    expect(
      parseArgs([
        'package',
        '--output',
        './release',
        '--source-commit',
        'a'.repeat(40),
      ]),
    ).toEqual({
      command: 'package',
      outputDirectory: path.resolve('./release'),
      sourceCommit: 'a'.repeat(40),
    });
    expect(() => parseArgs(['tag', '--output', './release'])).toThrow(
      'tag does not accept package options',
    );
  });

  it('uses an explicit shared cache override', () => {
    expect(
      getSharedCacheRoot(
        { ONEKEY_METRO_PREBUNDLE_CACHE_DIR: './shared-cache' },
        'darwin',
        '/Users/example',
      ),
    ).toBe(path.resolve('./shared-cache'));
  });

  it('pins repository provenance during offline attestation verification', async () => {
    const fixture = createTemporaryRepo();
    const artifactPath = path.join(fixture.repoRoot, 'artifact.bin');
    const bundlePath = path.join(
      fixture.repoRoot,
      'artifact.attestation.jsonl',
    );
    const runGh = jest.fn(async () => undefined);
    try {
      await fs.writeFile(artifactPath, 'artifact');
      await fs.writeFile(bundlePath, 'attestation');
      await verifyArtifactAttestation({
        artifactPath,
        bundlePath,
        repoRoot: fixture.repoRoot,
        runGh,
        sourceCommit: 'a'.repeat(40),
      });
      expect(runGh).toHaveBeenCalledWith([
        'attestation',
        'verify',
        artifactPath,
        '--repo',
        'OneKeyHQ/app-monorepo',
        '--bundle',
        bundlePath,
        '--custom-trusted-root',
        path.join(
          fixture.repoRoot,
          'apps/mobile/bundle-registry/metro-dev-prebundle-trusted-root.jsonl',
        ),
        '--signer-workflow',
        'OneKeyHQ/app-monorepo/.github/workflows/metro-dev-prebundle.yml',
        '--source-ref',
        'refs/heads/x',
        '--source-digest',
        'a'.repeat(40),
        '--deny-self-hosted-runners',
      ]);
    } finally {
      await fs.remove(fixture.repoRoot);
    }
  });

  it('bounds offline GitHub CLI verification time', async () => {
    const execFileImpl = jest.fn(async (_file, _args, options) => {
      expect(options.timeout).toBe(120_000);
      throw new TypeError('test failure');
    });
    await expect(
      runGhCommand(['attestation', 'verify'], { execFileImpl }),
    ).rejects.toThrow('GitHub CLI attestation command failed');
  });

  it('packages, verifies, and atomically restores a public prebundle', async () => {
    const fixture = createTemporaryRepo();
    const cacheRoot = path.join(fixture.repoRoot, 'shared-cache');
    const outputDirectory = path.join(
      fixture.projectRoot,
      'out-dir-bundle/test-release',
    );
    const attestationVerifier = createTestAttestationVerifier();
    try {
      const releaseManifest = await packagePrebundleRelease({
        outputDirectory,
        projectRoot: fixture.projectRoot,
        repoRoot: fixture.repoRoot,
        sourceCommit: 'a'.repeat(40),
      });
      expect(releaseManifest.platforms).toEqual({
        android: expect.any(Object),
        ios: expect.any(Object),
      });
      expect(releaseManifest.tagName).toMatch(/^metro-dev-prebundle-v1-/);
      expect(
        await fs.readFile(
          path.join(outputDirectory, THIRD_PARTY_NOTICES_NAME),
          'utf8',
        ),
      ).toContain('react@test');
      expect(
        await fs.readJson(path.join(outputDirectory, PACKAGE_INVENTORY_NAME)),
      ).toEqual(
        expect.objectContaining({
          packages: [
            expect.objectContaining({
              license: 'MIT',
              name: 'metro-runtime',
            }),
            expect.objectContaining({ license: 'MIT', name: 'react' }),
          ],
        }),
      );
      expect(
        await fs.pathExists(path.join(outputDirectory, RELEASE_MANIFEST_NAME)),
      ).toBe(true);
      await writeTestAttestationBundle(outputDirectory);

      await fs.remove(getPlatformOutputDirectory(fixture.projectRoot, 'ios'));
      await expect(
        restorePlatformFromRelease({
          attestationVerifier,
          cacheRoot,
          fetchImpl: createReleaseFetch(outputDirectory),
          platform: 'ios',
          projectRoot: fixture.projectRoot,
          releaseBaseUrl: 'https://example.invalid/release',
          repoRoot: fixture.repoRoot,
        }),
      ).resolves.toEqual({
        fingerprint: expect.any(String),
        sharedCacheHit: false,
        tagName: releaseManifest.tagName,
      });
      await expect(
        fs.readFile(
          path.join(
            getPlatformOutputDirectory(fixture.projectRoot, 'ios'),
            'common.js',
          ),
          'utf8',
        ),
      ).resolves.toBe('common source for ios');
      expect(
        await fs.pathExists(
          path.join(
            getPlatformOutputDirectory(fixture.projectRoot, 'ios'),
            'stubs',
            `${fixture.moduleId}.js`,
          ),
        ),
      ).toBe(true);

      await fs.remove(getPlatformOutputDirectory(fixture.projectRoot, 'ios'));
      const unexpectedFetch = jest.fn(async () => {
        throw new TypeError('Shared cache hits must not access the network.');
      });
      await expect(
        restorePlatformFromRelease({
          attestationVerifier,
          cacheRoot,
          fetchImpl: unexpectedFetch,
          platform: 'ios',
          projectRoot: fixture.projectRoot,
          releaseBaseUrl: 'https://example.invalid/release',
          repoRoot: fixture.repoRoot,
        }),
      ).resolves.toEqual({
        fingerprint: expect.any(String),
        sharedCacheHit: true,
        tagName: releaseManifest.tagName,
      });
      expect(unexpectedFetch).not.toHaveBeenCalled();
      expect(attestationVerifier).toHaveBeenCalled();
      expect(
        new Set(
          attestationVerifier.mock.calls.map(([{ bundlePath }]) =>
            path.basename(bundlePath),
          ),
        ),
      ).toEqual(new Set([devVendorConfig.RELEASE_ATTESTATION_BUNDLE_NAME]));

      const cacheDirectory = getPlatformCacheDirectory({
        cacheRoot,
        platform: 'ios',
        tagName: releaseManifest.tagName,
      });
      const tamperedAsset = Buffer.from('tampered');
      await fs.writeFile(
        path.join(cacheDirectory, 'metro-dev-prebundle-ios-common.js.gz'),
        tamperedAsset,
      );
      const cachedReleaseManifestPath = path.join(
        cacheDirectory,
        RELEASE_MANIFEST_NAME,
      );
      const cachedReleaseManifest = await fs.readJson(
        cachedReleaseManifestPath,
      );
      cachedReleaseManifest.platforms.ios.source.bytes = tamperedAsset.length;
      cachedReleaseManifest.platforms.ios.source.sha256 = sha256(tamperedAsset);
      await fs.writeJson(cachedReleaseManifestPath, cachedReleaseManifest);
      await fs.remove(getPlatformOutputDirectory(fixture.projectRoot, 'ios'));
      const refetch = jest.fn(createReleaseFetch(outputDirectory));
      await expect(
        restorePlatformFromRelease({
          attestationVerifier,
          cacheRoot,
          fetchImpl: refetch,
          platform: 'ios',
          projectRoot: fixture.projectRoot,
          releaseBaseUrl: 'https://example.invalid/release',
          repoRoot: fixture.repoRoot,
        }),
      ).resolves.toEqual({
        fingerprint: expect.any(String),
        sharedCacheHit: false,
        tagName: releaseManifest.tagName,
      });
      expect(refetch).toHaveBeenCalled();
    } finally {
      await fs.remove(fixture.repoRoot);
    }
  });

  it('keeps cache locks outside evictable tag directories', () => {
    const cacheRoot = path.resolve('/tmp/onekey-shared-cache');
    const tagName = `${devVendorConfig.releaseTagPrefix}-${'a'.repeat(64)}`;
    expect(getTagCacheLockDirectory(cacheRoot, tagName)).toBe(
      path.join(cacheRoot, 'v2/.locks', `${tagName}.lock`),
    );
  });

  it('only reclaims stale locks whose owner process has exited', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'onekey-metro-cache-lock-'),
    );
    const lockDirectory = path.join(root, 'tag.lock');
    try {
      await fs.ensureDir(lockDirectory);
      await fs.writeJson(path.join(lockDirectory, 'owner.json'), {
        pid: 12_345,
        token: 'stale-owner',
      });
      await expect(
        withCacheLock(lockDirectory, async () => 'recovered', {
          processIsRunning: () => false,
          staleMs: 0,
          waitTimeoutMs: 50,
        }),
      ).resolves.toBe('recovered');

      await fs.ensureDir(lockDirectory);
      await expect(
        withCacheLock(lockDirectory, async () => 'recovered-ownerless', {
          staleMs: 0,
          waitTimeoutMs: 50,
        }),
      ).resolves.toBe('recovered-ownerless');

      await fs.ensureDir(lockDirectory);
      await fs.writeJson(path.join(lockDirectory, 'owner.json'), {
        pid: 12_345,
        token: 'active-owner',
      });
      await expect(
        withCacheLock(lockDirectory, async () => 'unexpected', {
          processIsRunning: () => true,
          staleMs: 0,
          waitPollIntervalMs: 5,
          waitTimeoutMs: 10,
        }),
      ).rejects.toThrow('Timed out waiting for shared cache lock');
      expect(await fs.pathExists(lockDirectory)).toBe(true);
    } finally {
      await fs.remove(root);
    }
  });

  it('does not release a lock after its ownership token changes', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'onekey-metro-cache-owner-'),
    );
    const lockDirectory = path.join(root, 'tag.lock');
    try {
      await withCacheLock(lockDirectory, async () => {
        await fs.writeJson(path.join(lockDirectory, 'owner.json'), {
          pid: process.pid,
          token: 'replacement-owner',
        });
      });
      expect(await fs.pathExists(lockDirectory)).toBe(true);
    } finally {
      await fs.remove(root);
    }
  });

  it('does not prune a tag while its external lock is held', async () => {
    const cacheRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'onekey-metro-cache-prune-'),
    );
    const cacheVersionRoot = path.join(cacheRoot, 'v2');
    const tags = Array.from(
      { length: 6 },
      (_, index) =>
        `${devVendorConfig.releaseTagPrefix}-${index
          .toString(16)
          .padStart(64, '0')}`,
    );
    try {
      for (const [index, tagName] of tags.entries()) {
        const tagDirectory = path.join(cacheVersionRoot, tagName);
        await fs.ensureDir(tagDirectory);
        const mtime = new Date(Date.now() - (tags.length - index) * 1000);
        await fs.utimes(tagDirectory, mtime, mtime);
      }
      const oldestTagDirectory = path.join(cacheVersionRoot, tags[0]);
      await withCacheLock(
        getTagCacheLockDirectory(cacheRoot, tags[0]),
        async () => {
          await touchAndPruneSharedCache(cacheRoot, tags.at(-1));
          expect(await fs.pathExists(oldestTagDirectory)).toBe(true);
        },
      );
      await touchAndPruneSharedCache(cacheRoot, tags.at(-1));
      expect(await fs.pathExists(oldestTagDirectory)).toBe(false);
    } finally {
      await fs.remove(cacheRoot);
    }
  });

  it('rejects a release descriptor with a different compatibility key', () => {
    const fixture = createTemporaryRepo();
    try {
      expect(() =>
        verifyReleaseManifest({
          manifest: {
            compatibilityKey: 'different',
            repository: devVendorConfig.RELEASE_REPOSITORY,
            schemaVersion: devVendorConfig.RELEASE_SCHEMA_VERSION,
            tagName: 'different',
          },
          platform: 'ios',
          repoRoot: fixture.repoRoot,
        }),
      ).toThrow('incompatible with this checkout');
    } finally {
      fs.removeSync(fixture.repoRoot);
    }
  });
});
