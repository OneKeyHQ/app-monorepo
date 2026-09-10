/* cspell:words prebundle */
const { spawnSync } = require('child_process');
const os = require('os');
const path = require('path');

const fs = require('fs-extra');

const devVendorConfig = require('../../dev-vendor.config');
const {
  computeConfigInputsDigest,
  computeFingerprint,
  computeModulesDigest,
  computeNativeContractKey,
  getNativeContractInputPaths,
  getNativePackageAbiInputPaths,
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
  downloadOciAsset,
  getPlatformCacheDirectory,
  getSharedCacheRoot,
  getTagCacheLockDirectory,
  packagePrebundleRelease,
  parseArgs,
  resolveOciArtifact,
  restorePlatformFromRelease,
  runGhCommand,
  touchAndPruneSharedCache,
  verifyArtifactAttestation,
  verifyOciManifest,
  verifyReleaseManifest,
  withCacheLock,
} = require('../metro-dev-prebundle');

function createTemporaryRepo() {
  const repoRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'onekey-metro-dev-prebundle-'),
  );
  const fixtureFiles = new Set([
    ...devVendorConfig.fingerprintFiles,
    ...['android', 'ios'].flatMap((platform) =>
      getNativeContractInputPaths(platform, REPO_ROOT),
    ),
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
  const nativeDependencies = new Set([
    ...devVendorConfig.nativeContractDependencies.shared,
    ...devVendorConfig.nativeContractDependencies.android,
    ...devVendorConfig.nativeContractDependencies.ios,
  ]);
  const nativeAbiInputs = new Set();
  for (const platform of ['android', 'ios']) {
    for (const name of nativeDependencies) {
      for (const relativePath of getNativePackageAbiInputPaths(
        name,
        platform,
        REPO_ROOT,
      )) {
        nativeAbiInputs.add(relativePath);
      }
    }
  }
  for (const relativePath of nativeAbiInputs) {
    const destination = path.join(repoRoot, relativePath);
    fs.ensureDirSync(path.dirname(destination));
    fs.copyFileSync(path.join(REPO_ROOT, relativePath), destination);
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

  for (const args of [
    ['init', '--quiet'],
    ['add', '--all'],
  ]) {
    const result = spawnSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    if (result.status !== 0 || result.error) {
      throw new TypeError(
        `Unable to initialize fixture repository: ${result.stderr || result.error?.message || 'unknown error'}`,
      );
    }
  }

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
      nativeContractKey: computeNativeContractKey(platform, repoRoot),
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

function createOciFetch(outputDirectory, sourceCommit = 'a'.repeat(40)) {
  const registryBaseUrl = 'https://example.invalid';
  const config = Buffer.from('{}');
  const blobs = new Map();
  const layers = fs
    .readdirSync(outputDirectory)
    .toSorted()
    .map((fileName) => {
      const content = fs.readFileSync(path.join(outputDirectory, fileName));
      const digest = `sha256:${sha256(content)}`;
      blobs.set(digest, content);
      return {
        annotations: { 'org.opencontainers.image.title': fileName },
        digest,
        mediaType: 'application/octet-stream',
        size: content.length,
      };
    });
  const manifest = {
    annotations: {
      'org.opencontainers.image.revision': sourceCommit,
      'org.opencontainers.image.source':
        'https://github.com/OneKeyHQ/app-monorepo',
    },
    artifactType: devVendorConfig.OCI_ARTIFACT_TYPE,
    config: {
      digest: `sha256:${sha256(config)}`,
      mediaType: 'application/vnd.unknown.config.v1+json',
      size: config.length,
    },
    layers,
    mediaType: 'application/vnd.oci.image.manifest.v1+json',
    schemaVersion: 2,
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  const manifestDigest = `sha256:${sha256(manifestBytes)}`;
  const fetchImpl = jest.fn(async (url, options = {}) => {
    const requestUrl = new URL(url);
    if (requestUrl.pathname === '/token') {
      return new Response(JSON.stringify({ token: 'public-read-token' }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    if (options.headers?.Authorization !== 'Bearer public-read-token') {
      return new Response('authentication required', {
        headers: {
          'www-authenticate': `Bearer realm="${registryBaseUrl}/token",service="ghcr.io",scope="repository:${devVendorConfig.OCI_REPOSITORY}:pull"`,
        },
        status: 401,
      });
    }
    if (requestUrl.pathname.includes('/manifests/')) {
      return new Response(manifestBytes, {
        headers: {
          'content-type': 'application/vnd.oci.image.manifest.v1+json',
          'docker-content-digest': manifestDigest,
        },
      });
    }
    const digest = requestUrl.pathname.split('/').at(-1);
    const content = blobs.get(digest);
    return content
      ? new Response(content, { status: 200 })
      : new Response('missing', { status: 404 });
  });
  return { fetchImpl, manifest, registryBaseUrl };
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
  it('filters x pushes to declared vendor inputs', () => {
    const workflow = fs.readFileSync(
      path.join(REPO_ROOT, '.github/workflows/metro-dev-prebundle.yml'),
      'utf8',
    );

    expect(workflow).toContain('push:\n    branches:\n      - x\n    paths:');
    for (const inputPath of [
      ...devVendorConfig.fingerprintFiles,
      ...devVendorConfig.releaseFingerprintFiles,
      ...devVendorConfig.nativeContractFiles.shared,
      ...devVendorConfig.nativeContractFiles.android,
      ...devVendorConfig.nativeContractFiles.ios,
    ]) {
      expect(workflow).toContain(`- '${inputPath}'`);
    }
    for (const inputDirectory of [
      ...devVendorConfig.fingerprintDirectories,
      ...devVendorConfig.nativeContractDirectories.shared,
      ...devVendorConfig.nativeContractDirectories.android,
      ...devVendorConfig.nativeContractDirectories.ios,
    ]) {
      expect(workflow).toContain(`- '${inputDirectory}/**'`);
    }
    expect(workflow).toContain(
      "- 'apps/mobile/bundle-registry/module-id-registry.json'",
    );
    expect(workflow.indexOf('- name: Install dependencies')).toBeLessThan(
      workflow.indexOf('- name: Resolve immutable OCI tag'),
    );
  });

  it('does not create repository Git tags for CI artifacts', () => {
    for (const workflowName of [
      'metro-dev-prebundle.yml',
      'daily-build.yml',
      'daily-build-dev.yml',
      'release-desktop-all.yml',
    ]) {
      const workflow = fs.readFileSync(
        path.join(REPO_ROOT, '.github/workflows', workflowName),
        'utf8',
      );
      expect(workflow).not.toContain('gh release create');
      expect(workflow).not.toContain('/git/refs/tags');
    }

    for (const workflowName of ['daily-build.yml', 'daily-build-dev.yml']) {
      const workflow = fs.readFileSync(
        path.join(REPO_ROOT, '.github/workflows', workflowName),
        'utf8',
      );
      expect(workflow).toContain(`-f "ref=${'$'}{SOURCE_REF_NAME}"`);
    }
  });

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
    const content = Buffer.alloc(6);
    const ociArtifact = {
      client: {
        fetchBlob: jest.fn().mockResolvedValue(new Response(content)),
      },
      layersByFileName: new Map([
        [
          'asset.bin',
          {
            digest: `sha256:${sha256(content)}`,
            size: 5,
          },
        ],
      ]),
    };
    await expect(
      downloadOciAsset({
        fileName: 'asset.bin',
        maxBytes: 5,
        ociArtifact,
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
      expect(releaseManifest.tagName).toMatch(/^metro-dev-prebundle-v2-/);
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
      const oci = createOciFetch(outputDirectory);
      expect(verifyOciManifest(oci.manifest).size).toBe(10);
      expect(() =>
        verifyOciManifest({
          ...oci.manifest,
          layers: [...oci.manifest.layers.slice(0, -1), oci.manifest.layers[0]],
        }),
      ).toThrow('Invalid OCI artifact layer');

      await fs.remove(getPlatformOutputDirectory(fixture.projectRoot, 'ios'));
      await expect(
        restorePlatformFromRelease({
          attestationVerifier,
          cacheRoot,
          fetchImpl: oci.fetchImpl,
          platform: 'ios',
          projectRoot: fixture.projectRoot,
          registryBaseUrl: oci.registryBaseUrl,
          repoRoot: fixture.repoRoot,
        }),
      ).resolves.toEqual({
        fingerprint: expect.any(String),
        sharedCacheHit: false,
        tagName: releaseManifest.tagName,
      });
      expect(
        oci.fetchImpl.mock.calls.some(
          ([url]) => new URL(url).pathname === '/token',
        ),
      ).toBe(true);
      expect(
        oci.fetchImpl.mock.calls.some(
          ([url, options]) =>
            new URL(url).pathname.includes('/blobs/') &&
            options.headers.Authorization === 'Bearer public-read-token',
        ),
      ).toBe(true);
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
          registryBaseUrl: oci.registryBaseUrl,
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
      const refetchOci = createOciFetch(outputDirectory);
      await expect(
        restorePlatformFromRelease({
          attestationVerifier,
          cacheRoot,
          fetchImpl: refetchOci.fetchImpl,
          platform: 'ios',
          projectRoot: fixture.projectRoot,
          registryBaseUrl: refetchOci.registryBaseUrl,
          repoRoot: fixture.repoRoot,
        }),
      ).resolves.toEqual({
        fingerprint: expect.any(String),
        sharedCacheHit: false,
        tagName: releaseManifest.tagName,
      });
      expect(refetchOci.fetchImpl).toHaveBeenCalled();
    } finally {
      await fs.remove(fixture.repoRoot);
    }
  }, 30_000);

  it('rejects OCI bearer token realms containing credentials', async () => {
    const registryBaseUrl = 'https://example.invalid';
    const fetchImpl = jest.fn(
      async () =>
        new Response('authentication required', {
          headers: {
            'www-authenticate': `Bearer realm="https://user@example.invalid/token",service="ghcr.io",scope="repository:${devVendorConfig.OCI_REPOSITORY}:pull"`,
          },
          status: 401,
        }),
    );

    await expect(
      resolveOciArtifact({
        fetchImpl,
        registryBaseUrl,
        tagName: `${devVendorConfig.releaseTagPrefix}-${'a'.repeat(64)}`,
      }),
    ).rejects.toThrow('untrusted authentication realm');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
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

  it('allows only one cleaner to reclaim a stale lock generation', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'onekey-metro-cache-cleaners-'),
    );
    const lockDirectory = path.join(root, 'tag.lock');
    const ownerPath = path.join(lockDirectory, 'owner.json');
    let staleOwnerReads = 0;
    let releaseInitialReads;
    const initialReads = new Promise((resolve) => {
      releaseInitialReads = resolve;
    });
    let rootRenameCount = 0;
    const fileSystem = {
      ...fs.promises,
      async readFile(filePath, ...args) {
        const content = await fs.promises.readFile(filePath, ...args);
        if (
          filePath === ownerPath &&
          content.includes('stale-owner') &&
          staleOwnerReads < 2
        ) {
          staleOwnerReads += 1;
          if (staleOwnerReads === 2) releaseInitialReads();
          await initialReads;
        }
        return content;
      },
      async rename(sourcePath, targetPath) {
        if (sourcePath === lockDirectory) rootRenameCount += 1;
        return fs.promises.rename(sourcePath, targetPath);
      },
    };
    let activeCallbacks = 0;
    let maxActiveCallbacks = 0;
    try {
      await fs.ensureDir(lockDirectory);
      await fs.writeJson(ownerPath, {
        pid: 12_345,
        token: 'stale-owner',
      });
      const results = await Promise.all(
        ['first', 'second'].map((result) =>
          withCacheLock(
            lockDirectory,
            async () => {
              activeCallbacks += 1;
              maxActiveCallbacks = Math.max(
                maxActiveCallbacks,
                activeCallbacks,
              );
              await new Promise((resolve) => setTimeout(resolve, 10));
              activeCallbacks -= 1;
              return result;
            },
            {
              fileSystem,
              processIsRunning: (pid) => pid === process.pid,
              staleMs: 0,
              waitPollIntervalMs: 1,
              waitTimeoutMs: 1000,
            },
          ),
        ),
      );

      expect(results.toSorted()).toEqual(['first', 'second']);
      expect(staleOwnerReads).toBe(2);
      expect(rootRenameCount).toBe(1);
      expect(maxActiveCallbacks).toBe(1);
    } finally {
      await fs.remove(root);
    }
  });

  it('does not move or remove a new live owner during stale reclaim', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'onekey-metro-cache-replacement-'),
    );
    const lockDirectory = path.join(root, 'tag.lock');
    const ownerPath = path.join(lockDirectory, 'owner.json');
    let staleOwnerReads = 0;
    let releaseInitialReads;
    const initialReads = new Promise((resolve) => {
      releaseInitialReads = resolve;
    });
    let releaseLiveOwner;
    const holdLiveOwner = new Promise((resolve) => {
      releaseLiveOwner = resolve;
    });
    let notifyLiveOwner;
    const liveOwnerEntered = new Promise((resolve) => {
      notifyLiveOwner = resolve;
    });
    let liveOwnerPromise = Promise.resolve();
    let liveOwnerStarted = false;
    let liveOwnerToken;
    let rootRenameCount = 0;
    const fileSystem = {
      ...fs.promises,
      async readFile(filePath, ...args) {
        const content = await fs.promises.readFile(filePath, ...args);
        if (
          filePath === ownerPath &&
          content.includes('stale-owner') &&
          staleOwnerReads < 2
        ) {
          staleOwnerReads += 1;
          if (staleOwnerReads === 2) releaseInitialReads();
          await initialReads;
        }
        return content;
      },
      async rename(sourcePath, targetPath) {
        await fs.promises.rename(sourcePath, targetPath);
        if (sourcePath === lockDirectory) {
          rootRenameCount += 1;
          if (!liveOwnerStarted) {
            liveOwnerStarted = true;
            liveOwnerPromise = withCacheLock(lockDirectory, async () => {
              liveOwnerToken = (await fs.readJson(ownerPath)).token;
              notifyLiveOwner();
              await holdLiveOwner;
            });
            await liveOwnerEntered;
          }
        }
      },
    };
    try {
      await fs.ensureDir(lockDirectory);
      await fs.writeJson(ownerPath, {
        pid: 12_345,
        token: 'stale-owner',
      });
      const cleaners = ['first', 'second'].map((result) =>
        withCacheLock(lockDirectory, async () => result, {
          fileSystem,
          processIsRunning: (pid) => pid === process.pid,
          staleMs: 0,
          waitPollIntervalMs: 1,
          waitTimeoutMs: 1000,
        }),
      );

      await liveOwnerEntered;
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(await fs.pathExists(lockDirectory)).toBe(true);
      expect((await fs.readJson(ownerPath)).token).toBe(liveOwnerToken);
      expect(rootRenameCount).toBe(1);

      releaseLiveOwner();
      await liveOwnerPromise;
      await expect(Promise.all(cleaners)).resolves.toHaveLength(2);
      expect(rootRenameCount).toBe(1);
    } finally {
      releaseLiveOwner?.();
      await liveOwnerPromise.catch(() => undefined);
      await fs.remove(root);
    }
  });

  it('removes only its marker after root replacement reuses an inode', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'onekey-metro-cache-inode-reuse-'),
    );
    const lockDirectory = path.join(root, 'tag.lock');
    const ownerPath = path.join(lockDirectory, 'owner.json');
    const reclaimDirectory = path.join(lockDirectory, '.reclaim');
    const reclaimOwnerPath = path.join(reclaimDirectory, 'owner.json');
    const savedMarker = path.join(root, 'saved-reclaim');
    const callback = jest.fn();
    let replaced = false;
    let rootRenameCount = 0;
    try {
      await fs.ensureDir(lockDirectory);
      await fs.writeJson(ownerPath, {
        pid: 12_345,
        token: 'stale-owner',
      });
      const staleTimestamp = new Date(1000);
      await fs.utimes(lockDirectory, staleTimestamp, staleTimestamp);
      const initialStat = await fs.promises.lstat(lockDirectory);
      const fileSystem = {
        ...fs.promises,
        async lstat(filePath) {
          const stat = await fs.promises.lstat(filePath);
          if (filePath !== lockDirectory) return stat;
          return {
            dev: initialStat.dev,
            ino: initialStat.ino,
            isDirectory: () => stat.isDirectory(),
            isSymbolicLink: () => stat.isSymbolicLink(),
            mtimeMs: stat.mtimeMs,
          };
        },
        async rename(sourcePath, targetPath) {
          if (sourcePath === lockDirectory) rootRenameCount += 1;
          return fs.promises.rename(sourcePath, targetPath);
        },
        async writeFile(filePath, ...args) {
          const result = await fs.promises.writeFile(filePath, ...args);
          if (filePath === reclaimOwnerPath && !replaced) {
            replaced = true;
            await fs.promises.rename(reclaimDirectory, savedMarker);
            await fs.promises.rm(lockDirectory, {
              force: true,
              recursive: true,
            });
            await fs.promises.mkdir(lockDirectory);
            await fs.promises.writeFile(
              ownerPath,
              `${JSON.stringify({ pid: process.pid, token: 'live-replacement' })}\n`,
            );
            await fs.promises.rename(savedMarker, reclaimDirectory);
          }
          return result;
        },
      };

      await expect(
        withCacheLock(lockDirectory, callback, {
          fileSystem,
          processIsRunning: (pid) => pid === process.pid,
          staleMs: 0,
          waitTimeoutMs: 0,
        }),
      ).rejects.toThrow('Timed out waiting for shared cache lock');

      expect(replaced).toBe(true);
      expect(callback).not.toHaveBeenCalled();
      expect(rootRenameCount).toBe(0);
      expect(await fs.readJson(ownerPath)).toEqual({
        pid: process.pid,
        token: 'live-replacement',
      });
      expect(await fs.pathExists(reclaimDirectory)).toBe(false);
    } finally {
      await fs.remove(root);
    }
  });

  it('retries a snapshot when the root changes between stat and owner read', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'onekey-metro-cache-snapshot-'),
    );
    const lockDirectory = path.join(root, 'tag.lock');
    const replacedDirectory = path.join(root, 'replaced-tag.lock');
    const ownerPath = path.join(lockDirectory, 'owner.json');
    let replaced = false;
    const fileSystem = {
      ...fs.promises,
      async readFile(filePath, ...args) {
        if (filePath === ownerPath && !replaced) {
          replaced = true;
          await fs.promises.rename(lockDirectory, replacedDirectory);
          await fs.ensureDir(lockDirectory);
          await fs.writeJson(ownerPath, {
            pid: process.pid,
            token: 'live-replacement',
          });
        }
        return fs.promises.readFile(filePath, ...args);
      },
    };
    const callback = jest.fn();
    try {
      await fs.ensureDir(lockDirectory);
      await fs.writeJson(ownerPath, {
        pid: 12_345,
        token: 'stale-owner',
      });

      await expect(
        withCacheLock(lockDirectory, callback, {
          fileSystem,
          processIsRunning: (pid) => pid === process.pid,
          staleMs: 0,
          waitPollIntervalMs: 1,
          waitTimeoutMs: 10,
        }),
      ).rejects.toThrow('Timed out waiting for shared cache lock');

      expect(replaced).toBe(true);
      expect(callback).not.toHaveBeenCalled();
      expect(await fs.readJson(ownerPath)).toEqual({
        pid: process.pid,
        token: 'live-replacement',
      });
      expect(await fs.pathExists(path.join(lockDirectory, '.reclaim'))).toBe(
        false,
      );
    } finally {
      await fs.remove(root);
    }
  });

  it('treats a repeatedly unstable snapshot as busy without adding a marker', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'onekey-metro-cache-unstable-'),
    );
    const lockDirectory = path.join(root, 'tag.lock');
    const ownerPath = path.join(lockDirectory, 'owner.json');
    let rootStatCount = 0;
    const fileSystem = {
      ...fs.promises,
      async lstat(filePath) {
        const stat = await fs.promises.lstat(filePath);
        if (filePath !== lockDirectory) return stat;
        rootStatCount += 1;
        return {
          dev: stat.dev,
          ino: stat.ino + rootStatCount,
          isDirectory: () => stat.isDirectory(),
          isSymbolicLink: () => stat.isSymbolicLink(),
          mtimeMs: stat.mtimeMs,
        };
      },
    };
    try {
      await fs.ensureDir(lockDirectory);
      await fs.writeJson(ownerPath, {
        pid: 12_345,
        token: 'stale-owner',
      });

      await expect(
        withCacheLock(lockDirectory, async () => 'unexpected', {
          fileSystem,
          processIsRunning: () => false,
          staleMs: 0,
          waitTimeoutMs: 0,
        }),
      ).rejects.toThrow('Timed out waiting for shared cache lock');

      expect(rootStatCount).toBe(6);
      expect(await fs.readJson(ownerPath)).toEqual({
        pid: 12_345,
        token: 'stale-owner',
      });
      expect(await fs.pathExists(path.join(lockDirectory, '.reclaim'))).toBe(
        false,
      );
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
            artifactRepository: `${devVendorConfig.OCI_REGISTRY}/${devVendorConfig.OCI_REPOSITORY}`,
            compatibilityKey: 'different',
            repository: devVendorConfig.SOURCE_REPOSITORY,
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
