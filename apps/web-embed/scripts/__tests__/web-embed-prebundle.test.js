/* cspell:words POSTBUILD prebundle */

const { execFile, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');

const tar = require('tar');

jest.mock('child_process', () => ({
  execFile: jest.fn(),
  spawnSync: jest.fn(),
}));

execFile[promisify.custom] = (...args) =>
  new Promise((resolve, reject) => {
    execFile(...args, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve({ stderr, stdout });
    });
  });

const {
  ARCHIVE_NAME,
  ATTESTATION_BUNDLE_NAME,
  INPUT_PATHS,
  MAX_EXTRACTED_BYTES,
  OCI_ARTIFACT_TYPE,
  OCI_REGISTRY,
  OCI_REPOSITORY,
  RELEASE_MANIFEST_NAME,
  assertCanonicalBuildReceipt,
  buildCanonicalWebEmbed,
  createArchiveEntryFilter,
  getCanonicalBuildEnvironment,
  getInputKey,
  getReleaseTag,
  hashFiles,
  restoreRelease,
} = require('../web-embed-prebundle');

describe('web-embed-prebundle', () => {
  const repoRoot = path.resolve(__dirname, '../../../..');
  let temporaryDirectory;

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-web-embed-test-'),
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
    fs.rmSync(temporaryDirectory, { force: true, recursive: true });
  });

  it('derives a stable immutable tag from the checkout inputs', () => {
    const inputKey = getInputKey();

    expect(inputKey).toMatch(/^[0-9a-f]{64}$/u);
    expect(getInputKey()).toBe(inputKey);
    expect(getReleaseTag()).toBe(`web-embed-prebundle-v1-${inputKey}`);
  });

  it('filters x pushes to possible dependency graph inputs', () => {
    const workflow = fs.readFileSync(
      path.join(repoRoot, '.github/workflows/web-embed-prebundle.yml'),
      'utf8',
    );

    expect(workflow).toContain('push:\n    branches:\n      - x\n    paths:');
    for (const triggerPath of [
      'apps/web-embed/**',
      'development/**',
      'packages/components/**',
      'packages/core/**',
      'packages/kit/**',
      'packages/kit-bg/**',
      'packages/shared/**',
      'patches/**',
      'yarn.lock',
    ]) {
      expect(workflow).toContain(`- '${triggerPath}'`);
    }
    expect(workflow).toContain("cron: '30 18 * * 0'");
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain(
      "(github.ref == 'refs/heads/x' || github.event_name == 'workflow_dispatch')",
    );
    expect(workflow).toContain(
      "github.ref == 'refs/heads/x' &&\n      needs.build.result == 'success'",
    );
  });

  it('fails closed when the publish tag lookup has a registry error', () => {
    const workflow = fs.readFileSync(
      path.join(repoRoot, '.github/workflows/web-embed-prebundle.yml'),
      'utf8',
    );
    const lookupIndex = workflow.indexOf(
      'if oras manifest fetch --descriptor "$reference" >/dev/null 2>"$descriptor_error"; then',
    );
    const missingIndex = workflow.indexOf(
      `elif grep -Eiq 'manifest unknown|not found' "$descriptor_error"; then`,
      lookupIndex,
    );
    const pushIndex = workflow.indexOf('oras push', missingIndex);
    const errorIndex = workflow.indexOf(
      'cat "$descriptor_error" >&2',
      pushIndex,
    );

    expect(workflow).toContain(
      'descriptor_error="$RUNNER_TEMP/web-embed-prebundle-descriptor-error.txt"',
    );
    expect(lookupIndex).toBeGreaterThan(-1);
    expect(missingIndex).toBeGreaterThan(lookupIndex);
    expect(pushIndex).toBeGreaterThan(missingIndex);
    expect(errorIndex).toBeGreaterThan(pushIndex);
    expect(workflow.indexOf('exit 1', errorIndex)).toBeGreaterThan(errorIndex);
    expect(workflow).not.toContain(
      'if ! oras manifest fetch --descriptor "$reference"',
    );
  });

  it('publishes for anonymous access and lets native shells build when absent', () => {
    const workflow = fs.readFileSync(
      path.join(repoRoot, '.github/workflows/web-embed-prebundle.yml'),
      'utf8',
    );
    const action = fs.readFileSync(
      path.join(repoRoot, '.github/actions/restore-web-embed/action.yml'),
      'utf8',
    );
    const nativeShellWorkflows = [
      'mobile-dev-shell-android.yml',
      'mobile-dev-shell-ios-simulator.yml',
    ].map((fileName) =>
      fs.readFileSync(
        path.join(repoRoot, '.github/workflows', fileName),
        'utf8',
      ),
    );
    const bootstrapLoginIndex = workflow.indexOf(
      '- name: Log in to GHCR for bootstrap lookup',
    );
    const resolveIndex = workflow.indexOf(
      '- name: Resolve immutable OCI tag',
      bootstrapLoginIndex,
    );
    const anonymousVerifyIndex = workflow.indexOf(
      '- name: Verify public anonymous access',
    );
    const restoreIndex = action.indexOf('prebundle:restore');
    const unavailableIndex = action.indexOf(
      `manifest unknown|not found|denied: requested access to the resource is denied`,
    );
    const localBuildIndex = action.indexOf('prebundle:build', unavailableIndex);

    expect(bootstrapLoginIndex).toBeGreaterThan(-1);
    expect(resolveIndex).toBeGreaterThan(bootstrapLoginIndex);
    expect(workflow.slice(resolveIndex)).toContain(
      'oras logout "$OCI_REGISTRY"',
    );
    expect(anonymousVerifyIndex).toBeGreaterThan(resolveIndex);
    expect(workflow.slice(anonymousVerifyIndex)).toContain(
      'not publicly readable',
    );
    expect(action).not.toContain('oras login');
    expect(restoreIndex).toBeGreaterThan(-1);
    expect(unavailableIndex).toBeGreaterThan(restoreIndex);
    expect(localBuildIndex).toBeGreaterThan(unavailableIndex);
    expect(action).toContain('web-embed-prebundle-build.json');
    for (const nativeShellWorkflow of nativeShellWorkflows) {
      expect(nativeShellWorkflow).toContain(
        'uses: ./.github/actions/restore-web-embed',
      );
    }
  });

  it('ignores dynamic .env.expo values but hashes real build inputs', () => {
    const buildInputPath = path.join(temporaryDirectory, 'build-input.txt');
    const dynamicEnvPath = path.join(temporaryDirectory, '.env.expo');
    const options = {
      inputPaths: ['build-input.txt'],
      root: temporaryDirectory,
    };
    fs.writeFileSync(buildInputPath, 'stable build input');
    fs.writeFileSync(dynamicEnvPath, 'GITHUB_SHA=first\nSENTRY_TOKEN=first\n');

    expect(INPUT_PATHS).not.toContain('.env.expo');
    expect(INPUT_PATHS).not.toContain('apps/web-embed/package.json');
    const inputKey = getInputKey(options);

    fs.writeFileSync(
      dynamicEnvPath,
      'GITHUB_SHA=second\nSENTRY_TOKEN=second\n',
    );
    expect(getInputKey(options)).toBe(inputKey);

    fs.writeFileSync(buildInputPath, 'changed build input');
    expect(getInputKey(options)).not.toBe(inputKey);
  });

  it('ignores generated postinstall inputs', () => {
    const sourcePath = path.join(
      temporaryDirectory,
      'packages/kit/src/source.ts',
    );
    const generatedPath = path.join(
      temporaryDirectory,
      'packages/kit/src/components/WebViewWebEmbed/injectedWebEmbed.text-js',
    );
    const options = {
      inputPaths: ['packages/kit'],
      root: temporaryDirectory,
    };
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.mkdirSync(path.dirname(generatedPath), { recursive: true });
    fs.writeFileSync(sourcePath, 'stable source');
    const inputKey = getInputKey(options);

    fs.writeFileSync(generatedPath, 'first generated output');
    expect(getInputKey(options)).toBe(inputKey);
    fs.writeFileSync(generatedPath, 'second generated output');
    expect(getInputKey(options)).toBe(inputKey);

    fs.writeFileSync(sourcePath, 'changed source');
    expect(getInputKey(options)).not.toBe(inputKey);
  });

  it('uses one canonical environment for every prebundle build', async () => {
    const inputKey = 'c'.repeat(64);
    const webBuildDirectory = path.join(
      temporaryDirectory,
      'canonical-web-build',
    );
    const receiptPath = path.join(
      temporaryDirectory,
      'receipts/canonical-build.json',
    );
    const outputPath = path.join(webBuildDirectory, 'index.html');
    fs.mkdirSync(webBuildDirectory, { recursive: true });
    fs.writeFileSync(outputPath, '<html>canonical</html>');
    const canonicalEnv = getCanonicalBuildEnvironment({
      env: {
        BUILD_NUMBER: '123',
        BUILD_TIME: 'dynamic',
        BUNDLE_VERSION: '456',
        GITHUB_SHA: 'dynamic-sha',
        NODE_OPTIONS: '--max-old-space-size=8192',
        PATH: '/test/bin',
        PUBLIC_URL: 'https://dynamic.example',
        SENTRY_TOKEN: 'secret',
        VERSION: 'host-version',
        WALLETCONNECT_PROJECT_ID: 'dynamic-project',
        WORKFLOW_GITHUB_SHA: 'dynamic-workflow-sha',
      },
      inputKey,
    });

    expect(canonicalEnv).toMatchObject({
      BUILD_NUMBER: '0',
      BUILD_TIME: '0',
      BUNDLE_VERSION: '0',
      GITHUB_SHA: inputKey,
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=8192',
      ONEKEY_WEB_EMBED_BUILD_INPUT_KEY: inputKey,
      ONEKEY_WEB_EMBED_CANONICAL_BUILD: 'true',
      PATH: '/test/bin',
      PUBLIC_URL: '',
      SENTRY_TOKEN: '',
      WALLETCONNECT_PROJECT_ID: '',
      WEB_EMBED_SKIP_POSTBUILD: 'true',
      WORKFLOW_GITHUB_SHA: inputKey,
    });
    expect(canonicalEnv.VERSION).toBeUndefined();

    spawnSync.mockReturnValue({ status: 0 });
    await expect(
      buildCanonicalWebEmbed({
        env: { PATH: '/test/bin' },
        inputKey,
        receiptPath,
        webBuildDirectory,
      }),
    ).resolves.toBe(inputKey);
    expect(spawnSync).toHaveBeenCalledWith(
      'yarn',
      ['workspace', '@onekeyhq/web-embed', 'build'],
      expect.objectContaining({
        env: expect.objectContaining({
          GITHUB_SHA: inputKey,
          WORKFLOW_GITHUB_SHA: inputKey,
        }),
        stdio: 'inherit',
      }),
    );
    const outputTreeDigest = hashFiles([outputPath], webBuildDirectory);
    expect(JSON.parse(fs.readFileSync(receiptPath, 'utf8'))).toEqual({
      inputKey,
      outputTreeDigest,
      schemaVersion: 1,
    });
    expect(() =>
      assertCanonicalBuildReceipt({
        inputKey,
        outputTreeDigest,
        receiptPath,
      }),
    ).not.toThrow();

    fs.writeFileSync(outputPath, '<html>changed after build</html>');
    expect(() =>
      assertCanonicalBuildReceipt({
        inputKey,
        outputTreeDigest: hashFiles([outputPath], webBuildDirectory),
        receiptPath,
      }),
    ).toThrow('was not produced by the canonical prebundle build');
  });

  it('binds a tree digest to relative paths and file contents', () => {
    const firstPath = path.join(temporaryDirectory, 'first.txt');
    const secondPath = path.join(temporaryDirectory, 'nested/second.txt');
    fs.mkdirSync(path.dirname(secondPath), { recursive: true });
    fs.writeFileSync(firstPath, 'first');
    fs.writeFileSync(secondPath, 'second');

    const digest = hashFiles([firstPath, secondPath], temporaryDirectory);
    expect(hashFiles([firstPath, secondPath], temporaryDirectory)).toBe(digest);

    fs.writeFileSync(secondPath, 'changed');
    expect(hashFiles([firstPath, secondPath], temporaryDirectory)).not.toBe(
      digest,
    );
  });

  it('rejects unsafe archive entries and extraction limit overflows', () => {
    const regularEntry = {
      size: 1,
      type: 'File',
    };

    expect(
      createArchiveEntryFilter()('web-embed/index.html', regularEntry),
    ).toBe(true);
    expect(() => createArchiveEntryFilter()('../escape', regularEntry)).toThrow(
      'Unsafe archive entry',
    );
    expect(() =>
      createArchiveEntryFilter()('web-embed/link', {
        ...regularEntry,
        type: 'SymbolicLink',
      }),
    ).toThrow('Unsafe archive entry');
    expect(() =>
      createArchiveEntryFilter()('web-embed/large.bin', {
        ...regularEntry,
        size: MAX_EXTRACTED_BYTES + 1,
      }),
    ).toThrow('Archive exceeds extraction limits');
    expect(() =>
      createArchiveEntryFilter()('web-embed/negative.bin', {
        ...regularEntry,
        size: -1,
      }),
    ).toThrow('Archive exceeds extraction limits');
  });

  it('writes a verified receipt on a cold restore', async () => {
    const sourceDirectory = path.join(temporaryDirectory, 'source');
    const releaseDirectory = path.join(temporaryDirectory, 'release');
    const outputDirectory = path.join(temporaryDirectory, 'cold/web-build');
    const receiptPath = path.join(
      temporaryDirectory,
      'cold/receipt/web-embed-restored.json',
    );
    fs.mkdirSync(sourceDirectory, { recursive: true });
    fs.mkdirSync(releaseDirectory, { recursive: true });
    const sourceFile = path.join(sourceDirectory, 'index.html');
    fs.writeFileSync(sourceFile, '<html>restored</html>');
    const archivePath = path.join(releaseDirectory, ARCHIVE_NAME);
    await tar.create.asyncFile(
      {
        cwd: sourceDirectory,
        file: archivePath,
        gzip: true,
        prefix: 'web-embed',
      },
      ['index.html'],
    );

    const archive = fs.readFileSync(archivePath);
    const inputKey = getInputKey();
    const sourceCommit = 'a'.repeat(40);
    const manifest = {
      archive: {
        bytes: archive.length,
        file: ARCHIVE_NAME,
        sha256: crypto.createHash('sha256').update(archive).digest('hex'),
      },
      artifactRepository: `${OCI_REGISTRY}/${OCI_REPOSITORY}`,
      inputKey,
      outputTreeDigest: hashFiles([sourceFile], sourceDirectory),
      repository: 'OneKeyHQ/app-monorepo',
      schemaVersion: 1,
      sourceCommit,
      tagName: getReleaseTag(),
    };
    fs.writeFileSync(
      path.join(releaseDirectory, RELEASE_MANIFEST_NAME),
      JSON.stringify(manifest),
    );
    fs.writeFileSync(
      path.join(releaseDirectory, ATTESTATION_BUNDLE_NAME),
      '{}\n',
    );

    const layerBytes = new Map(
      [ARCHIVE_NAME, ATTESTATION_BUNDLE_NAME, RELEASE_MANIFEST_NAME].map(
        (fileName) => [
          fileName,
          fs.readFileSync(path.join(releaseDirectory, fileName)),
        ],
      ),
    );
    const blobs = new Map();
    const layers = [...layerBytes].map(([fileName, bytes]) => {
      const digest = `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
      blobs.set(digest, bytes);
      return {
        annotations: { 'org.opencontainers.image.title': fileName },
        digest,
        mediaType: 'application/octet-stream',
        size: bytes.length,
      };
    });
    const ociManifest = Buffer.from(
      JSON.stringify({
        annotations: {
          'org.opencontainers.image.source':
            'https://github.com/OneKeyHQ/app-monorepo',
        },
        artifactType: OCI_ARTIFACT_TYPE,
        config: {
          digest: `sha256:${'c'.repeat(64)}`,
          mediaType: 'application/vnd.oci.empty.v1+json',
          size: 2,
        },
        layers,
        mediaType: 'application/vnd.oci.image.manifest.v1+json',
        schemaVersion: 2,
      }),
    );
    const ociDigest = `sha256:${crypto
      .createHash('sha256')
      .update(ociManifest)
      .digest('hex')}`;
    const immutableReference = `${OCI_REGISTRY}/${OCI_REPOSITORY}@${ociDigest}`;
    const archiveDigest = layers.find(
      (layer) =>
        layer.annotations['org.opencontainers.image.title'] === ARCHIVE_NAME,
    ).digest;
    const attestationDigest = layers.find(
      (layer) =>
        layer.annotations['org.opencontainers.image.title'] ===
        ATTESTATION_BUNDLE_NAME,
    ).digest;
    const blobAttempts = new Map();
    const fetchImpl = jest.fn(async (input, options) => {
      const url = new URL(input);
      if (url.pathname === '/token') {
        return new Response(JSON.stringify({ token: 'test-token' }), {
          status: 200,
        });
      }
      if (url.pathname.includes('/manifests/')) {
        if (options?.headers?.Authorization !== 'Bearer test-token') {
          return new Response('authentication required', {
            headers: {
              'www-authenticate':
                'Bearer realm="https://ghcr.io/token",service="ghcr.io",scope="repository:onekeyhq/web-embed-prebundle:pull"',
            },
            status: 401,
          });
        }
        return new Response(ociManifest, {
          headers: {
            'content-type': 'application/vnd.oci.image.manifest.v1+json',
            'docker-content-digest': ociDigest,
          },
          status: 200,
        });
      }
      const digest = url.pathname.split('/').at(-1);
      const attempt = (blobAttempts.get(digest) || 0) + 1;
      blobAttempts.set(digest, attempt);
      if (digest === archiveDigest && attempt === 1) {
        throw Object.assign(new TypeError('terminated'), {
          cause: Object.assign(new Error('connection reset'), {
            code: 'ECONNRESET',
          }),
        });
      }
      if (digest === attestationDigest && attempt === 1) {
        return new Response('service unavailable', { status: 503 });
      }
      const bytes = blobs.get(digest);
      return bytes
        ? new Response(bytes, { status: 200 })
        : new Response('missing', { status: 404 });
    });
    execFile.mockImplementation((command, args, _options, callback) => {
      if (command === 'gh') {
        callback(null, '', '');
        return;
      }
      callback(new Error(`Unexpected command: ${command}`));
    });

    expect(fs.existsSync(outputDirectory)).toBe(false);
    expect(fs.existsSync(receiptPath)).toBe(false);

    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    try {
      await restoreRelease({ fetchImpl, outputDirectory, receiptPath });
      expect(consoleError).toHaveBeenCalledTimes(2);
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('after a transient download failure'),
      );
    } finally {
      consoleError.mockRestore();
    }

    expect(fetchImpl).toHaveBeenCalledTimes(8);
    expect(execFile).not.toHaveBeenCalledWith(
      'oras',
      expect.any(Array),
      expect.any(Object),
      expect.any(Function),
    );

    expect(
      fs.readFileSync(path.join(outputDirectory, 'index.html'), 'utf8'),
    ).toBe('<html>restored</html>');
    expect(JSON.parse(fs.readFileSync(receiptPath, 'utf8'))).toEqual({
      ...manifest,
      ociDigest,
      reference: immutableReference,
    });
  }, 15_000);
});
