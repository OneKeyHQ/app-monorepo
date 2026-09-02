const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  assertDeviceId,
  getGhAttestationVerifyArgs,
  restoreMobileDevShell,
  verifyArtifactManifest,
  verifyOciManifest,
} = require('../mobile-dev-shell-resource');

function hashValues(namespace, values) {
  const hash = crypto.createHash('sha256');
  hash.update(namespace);
  hash.update('\0');
  for (const value of values) {
    hash.update(String(value));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function createRemoteShell({ compatibility, exactMissing = false, inputKey }) {
  const artifact = Buffer.from(`remote-shell-${inputKey}`);
  const artifactSha256 = crypto
    .createHash('sha256')
    .update(artifact)
    .digest('hex');
  const sidecar = Buffer.from(
    JSON.stringify({
      architecture: compatibility.architecture,
      artifact: {
        bytes: artifact.length,
        file: compatibility.artifactFile,
        sha256: artifactSha256,
      },
      nativeContractKey: compatibility.nativeContractKey,
      platform: compatibility.platform,
      schemaVersion: 3,
      shellArtifactKey: hashValues('onekey-mobile-dev-shell-artifact-v3', [
        inputKey,
        artifactSha256,
        artifact.length,
      ]),
      shellCompatibilityKey: compatibility.shellCompatibilityKey,
      shellInputKey: inputKey,
      webEmbed: {
        inputKey: compatibility.webEmbedInputKey,
        ociDigest: `sha256:${'6'.repeat(64)}`,
        outputTreeDigest: '7'.repeat(64),
      },
    }),
  );
  const attestation = Buffer.from('attestation');
  const sidecarFile = compatibility.artifactFile.replace(/\.apk$/u, '.json');
  const layers = new Map();
  const descriptor = (title, bytes) => {
    const digest = `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
    layers.set(digest, bytes);
    return {
      annotations: { 'org.opencontainers.image.title': title },
      digest,
      mediaType: 'application/octet-stream',
      size: bytes.length,
    };
  };
  const manifestBytes = Buffer.from(
    JSON.stringify({
      annotations: {
        'com.onekey.mobile.architecture': compatibility.architecture,
        'com.onekey.mobile.native-contract-key':
          compatibility.nativeContractKey,
        'com.onekey.mobile.platform': compatibility.resourcePlatform,
        'com.onekey.mobile.shell-compatibility-key':
          compatibility.shellCompatibilityKey,
        'com.onekey.mobile.shell-input-key': inputKey,
        'org.opencontainers.image.revision': '9'.repeat(40),
        'org.opencontainers.image.source':
          'https://github.com/OneKeyHQ/app-monorepo',
      },
      artifactType: 'application/vnd.onekey.mobile-dev-shell.v1',
      config: {
        digest: `sha256:${'5'.repeat(64)}`,
        mediaType: 'application/vnd.oci.empty.v1+json',
        size: 2,
      },
      layers: [
        descriptor(compatibility.artifactFile, artifact),
        descriptor(sidecarFile, sidecar),
        descriptor('mobile-dev-shell-attestations.jsonl', attestation),
      ],
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      schemaVersion: 2,
    }),
  );
  const manifestDigest = `sha256:${crypto
    .createHash('sha256')
    .update(manifestBytes)
    .digest('hex')}`;
  return {
    artifact,
    fetchImpl: jest.fn(async (url) => {
      const requestUrl = new URL(url);
      if (requestUrl.pathname.includes('/manifests/')) {
        const tag = decodeURIComponent(requestUrl.pathname.split('/').at(-1));
        if (exactMissing && tag === compatibility.exactTag) {
          return new Response('missing', { status: 404 });
        }
        return new Response(manifestBytes, {
          headers: { 'docker-content-digest': manifestDigest },
          status: 200,
        });
      }
      const digest = requestUrl.pathname.split('/').at(-1);
      const bytes = layers.get(digest);
      return bytes
        ? new Response(bytes, { status: 200 })
        : new Response('missing', { status: 404 });
    }),
  };
}

describe('mobile-dev-shell-resource', () => {
  const nativeContractKey = '1'.repeat(64);
  const webEmbedInputKey = '3'.repeat(64);
  const shellCompatibilityKey = hashValues(
    'onekey-mobile-dev-shell-compatibility-v3',
    [
      'platform=android',
      'architecture=arm64-v8a',
      `native-contract=${nativeContractKey}`,
      `web-embed=${webEmbedInputKey}`,
    ],
  );
  const shellInputKey = '2'.repeat(64);
  const compatibility = {
    architecture: 'arm64-v8a',
    artifactFile: 'OneKeyWallet-DevShell-android-arm64-v8a.apk',
    compatibilityTag: `mobile-dev-shell-contract-v3-android-arm64-v8a-${shellCompatibilityKey}`,
    exactTag: `mobile-dev-shell-input-v3-android-arm64-v8a-${shellInputKey}`,
    nativeContractKey,
    platform: 'android',
    resourcePlatform: 'android',
    shellCompatibilityKey,
    shellInputKey,
    webEmbedInputKey,
  };

  it('requires an explicit device ID for isolated installation', () => {
    expect(assertDeviceId('emulator-5554')).toBe('emulator-5554');
    expect(() => assertDeviceId()).toThrow('explicit device ID');
    expect(() => assertDeviceId('bad\ndevice')).toThrow('explicit device ID');
  });

  it('binds shell attestations to the x branch', () => {
    const args = getGhAttestationVerifyArgs({
      artifactPath: '/tmp/shell.apk',
      bundlePath: '/tmp/attestation.jsonl',
      compatibility,
      sourceCommit: '9'.repeat(40),
    });
    expect(
      args.slice(
        args.indexOf('--source-ref'),
        args.indexOf('--source-ref') + 2,
      ),
    ).toEqual(['--source-ref', 'refs/heads/x']);
  });

  it('accepts a locator manifest for the exact compatibility key', () => {
    const sidecarFile = compatibility.artifactFile.replace(/\.apk$/u, '.json');
    const descriptor = (title) => ({
      annotations: { 'org.opencontainers.image.title': title },
      digest: `sha256:${'4'.repeat(64)}`,
      mediaType: 'application/octet-stream',
      size: 10,
    });
    const layers = verifyOciManifest({
      compatibility,
      locator: 'exact',
      manifest: {
        annotations: {
          'com.onekey.mobile.architecture': compatibility.architecture,
          'com.onekey.mobile.platform': compatibility.resourcePlatform,
          'com.onekey.mobile.native-contract-key':
            compatibility.nativeContractKey,
          'com.onekey.mobile.shell-compatibility-key':
            compatibility.shellCompatibilityKey,
          'com.onekey.mobile.shell-input-key': compatibility.shellInputKey,
          'org.opencontainers.image.source':
            'https://github.com/OneKeyHQ/app-monorepo',
        },
        artifactType: 'application/vnd.onekey.mobile-dev-shell.v1',
        config: {
          digest: `sha256:${'5'.repeat(64)}`,
          mediaType: 'application/vnd.oci.empty.v1+json',
          size: 2,
        },
        layers: [
          descriptor(compatibility.artifactFile),
          descriptor(sidecarFile),
          descriptor('mobile-dev-shell-attestations.jsonl'),
        ],
        mediaType: 'application/vnd.oci.image.manifest.v1+json',
        schemaVersion: 2,
      },
    });

    expect([...layers.keys()].toSorted()).toEqual(
      [
        compatibility.artifactFile,
        sidecarFile,
        'mobile-dev-shell-attestations.jsonl',
      ].toSorted(),
    );
  });

  it('binds the sidecar to the downloaded artifact bytes', async () => {
    const temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-shell-resource-test-'),
    );
    try {
      const artifactPath = path.join(
        temporaryDirectory,
        compatibility.artifactFile,
      );
      const artifact = Buffer.from('android-arm64-shell');
      fs.writeFileSync(artifactPath, artifact);
      const artifactSha256 = crypto
        .createHash('sha256')
        .update(artifact)
        .digest('hex');
      const shellArtifactKey = hashValues(
        'onekey-mobile-dev-shell-artifact-v3',
        [compatibility.shellInputKey, artifactSha256, artifact.length],
      );
      const manifest = {
        architecture: compatibility.architecture,
        artifact: {
          bytes: artifact.length,
          file: compatibility.artifactFile,
          sha256: artifactSha256,
        },
        nativeContractKey: compatibility.nativeContractKey,
        platform: compatibility.platform,
        schemaVersion: 3,
        shellArtifactKey,
        shellCompatibilityKey: compatibility.shellCompatibilityKey,
        shellInputKey: compatibility.shellInputKey,
        webEmbed: {
          inputKey: compatibility.webEmbedInputKey,
          ociDigest: `sha256:${'6'.repeat(64)}`,
          outputTreeDigest: '7'.repeat(64),
        },
      };

      await expect(
        verifyArtifactManifest({
          artifactPath,
          compatibility,
          locator: 'exact',
          manifest,
        }),
      ).resolves.toBe(manifest);
      await expect(
        verifyArtifactManifest({
          artifactPath,
          compatibility,
          locator: 'exact',
          manifest: {
            ...manifest,
            nativeContractKey: '8'.repeat(64),
          },
        }),
      ).rejects.toThrow('does not match this checkout');
    } finally {
      fs.rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it('reuses an attested compatible shell from the local OCI cache', async () => {
    const cacheRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-shell-cache-test-'),
    );
    try {
      const cacheDirectory = path.join(cacheRoot, compatibility.exactTag);
      fs.mkdirSync(cacheDirectory);
      const artifactPath = path.join(
        cacheDirectory,
        compatibility.artifactFile,
      );
      const artifact = Buffer.from('cached-android-arm64-shell');
      fs.writeFileSync(artifactPath, artifact);
      const artifactSha256 = crypto
        .createHash('sha256')
        .update(artifact)
        .digest('hex');
      const shellArtifactKey = hashValues(
        'onekey-mobile-dev-shell-artifact-v3',
        [compatibility.shellInputKey, artifactSha256, artifact.length],
      );
      const sidecarPath = path.join(
        cacheDirectory,
        compatibility.artifactFile.replace(/\.apk$/u, '.json'),
      );
      fs.writeFileSync(
        sidecarPath,
        JSON.stringify({
          architecture: compatibility.architecture,
          artifact: {
            bytes: artifact.length,
            file: compatibility.artifactFile,
            sha256: artifactSha256,
          },
          nativeContractKey: compatibility.nativeContractKey,
          platform: compatibility.platform,
          schemaVersion: 3,
          shellArtifactKey,
          shellCompatibilityKey: compatibility.shellCompatibilityKey,
          shellInputKey: compatibility.shellInputKey,
          webEmbed: {
            inputKey: compatibility.webEmbedInputKey,
            ociDigest: `sha256:${'6'.repeat(64)}`,
            outputTreeDigest: '7'.repeat(64),
          },
        }),
      );
      fs.writeFileSync(
        path.join(cacheDirectory, 'mobile-dev-shell-attestations.jsonl'),
        'attestation',
      );
      fs.writeFileSync(
        path.join(cacheDirectory, 'mobile-dev-shell-oci-receipt.json'),
        JSON.stringify({
          ociDigest: `sha256:${'8'.repeat(64)}`,
          sourceCommit: '9'.repeat(40),
          tag: compatibility.exactTag,
        }),
      );
      const attestationVerifier = jest.fn().mockResolvedValue(undefined);

      await expect(
        restoreMobileDevShell({
          attestationVerifier,
          cacheRoot,
          compatibility,
        }),
      ).resolves.toMatchObject({
        artifactPath,
        cacheHit: true,
        source: 'remote-cache',
        compatibilityFallback: false,
      });
      expect(attestationVerifier).toHaveBeenCalledTimes(2);
    } finally {
      fs.rmSync(cacheRoot, { force: true, recursive: true });
    }
  });

  it('returns the final cache artifact path after a cold remote restore', async () => {
    const cacheRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-shell-cold-cache-test-'),
    );
    try {
      const remote = createRemoteShell({
        compatibility,
        inputKey: compatibility.shellInputKey,
      });
      const result = await restoreMobileDevShell({
        attestationVerifier: jest.fn().mockResolvedValue(undefined),
        cacheRoot,
        compatibility,
        fetchImpl: remote.fetchImpl,
      });

      expect(result).toMatchObject({
        artifactPath: path.join(
          cacheRoot,
          compatibility.exactTag,
          compatibility.artifactFile,
        ),
        cacheHit: false,
        compatibilityFallback: false,
        source: 'remote',
      });
      expect(fs.readFileSync(result.artifactPath)).toEqual(remote.artifact);
      expect(
        fs.readdirSync(cacheRoot).some((entry) => entry.includes('.download-')),
      ).toBe(false);
    } finally {
      fs.rmSync(cacheRoot, { force: true, recursive: true });
    }
  });

  it('removes an incomplete cache directory before restoring it', async () => {
    const cacheRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-shell-partial-cache-test-'),
    );
    try {
      const cacheDirectory = path.join(cacheRoot, compatibility.exactTag);
      fs.mkdirSync(cacheDirectory);
      fs.writeFileSync(
        path.join(cacheDirectory, compatibility.artifactFile),
        'partial',
      );
      const remote = createRemoteShell({
        compatibility,
        inputKey: compatibility.shellInputKey,
      });

      const result = await restoreMobileDevShell({
        attestationVerifier: jest.fn().mockResolvedValue(undefined),
        cacheRoot,
        compatibility,
        fetchImpl: remote.fetchImpl,
      });

      expect(fs.readFileSync(result.artifactPath)).toEqual(remote.artifact);
      expect(result.cacheHit).toBe(false);
    } finally {
      fs.rmSync(cacheRoot, { force: true, recursive: true });
    }
  });

  it('falls back to an ABI-compatible remote shell with a user notice', async () => {
    const cacheRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-shell-compatible-cache-test-'),
    );
    const compatibleInputKey = 'a'.repeat(64);
    const remote = createRemoteShell({
      compatibility,
      exactMissing: true,
      inputKey: compatibleInputKey,
    });
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const result = await restoreMobileDevShell({
        attestationVerifier: jest.fn().mockResolvedValue(undefined),
        cacheRoot,
        compatibility,
        fetchImpl: remote.fetchImpl,
      });

      expect(result).toMatchObject({
        compatibilityFallback: true,
        fallbackReason: expect.stringContaining('HTTP 404'),
        userNotice: expect.stringContaining('ABI-compatible shell'),
      });
      expect(result.manifest.shellInputKey).toBe(compatibleInputKey);
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('[ONEKEY_USER_NOTICE]'),
      );
    } finally {
      consoleError.mockRestore();
      fs.rmSync(cacheRoot, { force: true, recursive: true });
    }
  });
});
