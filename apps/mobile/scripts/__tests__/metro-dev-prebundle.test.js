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
  RELEASE_MANIFEST_NAME,
  THIRD_PARTY_NOTICES_NAME,
  assertSafeOutputDirectory,
  collectPackageInventory,
  downloadReleaseAsset,
  packagePrebundleRelease,
  parseArgs,
  restorePlatformFromRelease,
  verifyReleaseManifest,
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

  const projectRoot = path.join(repoRoot, 'apps/mobile');
  const modules = [{ id: moduleId, path: modulePath }];
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
          name: '@example/library',
          packageRoot: 'node_modules/@example/library',
          version: '1.0.0',
        }),
      ]);
    } finally {
      fs.removeSync(repoRoot);
    }
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

  it('packages, verifies, and atomically restores a public prebundle', async () => {
    const fixture = createTemporaryRepo();
    const outputDirectory = path.join(
      fixture.projectRoot,
      'out-dir-bundle/test-release',
    );
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
            expect.objectContaining({ license: 'MIT', name: 'react' }),
          ],
        }),
      );
      expect(
        await fs.pathExists(path.join(outputDirectory, RELEASE_MANIFEST_NAME)),
      ).toBe(true);

      await fs.remove(getPlatformOutputDirectory(fixture.projectRoot, 'ios'));
      await expect(
        restorePlatformFromRelease({
          fetchImpl: createReleaseFetch(outputDirectory),
          platform: 'ios',
          projectRoot: fixture.projectRoot,
          releaseBaseUrl: 'https://example.invalid/release',
          repoRoot: fixture.repoRoot,
        }),
      ).resolves.toEqual({
        fingerprint: expect.any(String),
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
    } finally {
      await fs.remove(fixture.repoRoot);
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
