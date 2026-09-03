const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { withCacheLock } = require('../metro-dev-prebundle');
const {
  MAX_CACHED_SHELLS,
  assertDeviceId,
  createMobileShellCacheLease,
  getGhAttestationVerifyArgs,
  installMobileDevShell,
  restoreMobileDevShell,
  runWithCacheLeaseCleanup,
  touchAndPruneMobileShellCache,
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

  it('allows an Android shell downgrade during replacement', async () => {
    const spawnCommand = jest.fn(() => ({ status: 0 }));

    await installMobileDevShell({
      artifactPath: '/tmp/dev-shell.apk',
      deviceId: 'emulator-5554',
      platform: 'android',
      spawnCommand,
    });

    expect(spawnCommand).toHaveBeenCalledTimes(1);
    expect(spawnCommand).toHaveBeenCalledWith(
      'adb',
      ['-s', 'emulator-5554', 'install', '-r', '-d', '/tmp/dev-shell.apk'],
      { encoding: 'utf8' },
    );
  });

  it.each([
    ['a signing conflict', 'INSTALL_FAILED_UPDATE_INCOMPATIBLE'],
    ['a blocked version downgrade', 'INSTALL_FAILED_VERSION_DOWNGRADE'],
  ])('reinstalls an Android shell after %s', async (_reason, failureCode) => {
    const spawnCommand = jest
      .fn()
      .mockReturnValueOnce({
        status: 1,
        stderr: `Failure [${failureCode}]`,
      })
      .mockReturnValueOnce({ status: 0, stdout: '1\n' })
      .mockReturnValue({ status: 0 });
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      await installMobileDevShell({
        artifactPath: '/tmp/dev-shell.apk',
        deviceId: 'emulator-5554',
        platform: 'android',
        spawnCommand,
      });
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('emulator app data will be cleared'),
      );
    } finally {
      consoleError.mockRestore();
    }

    expect(spawnCommand.mock.calls).toEqual([
      [
        'adb',
        ['-s', 'emulator-5554', 'install', '-r', '-d', '/tmp/dev-shell.apk'],
        { encoding: 'utf8' },
      ],
      [
        'adb',
        ['-s', 'emulator-5554', 'shell', 'getprop', 'ro.kernel.qemu'],
        { encoding: 'utf8' },
      ],
      [
        'adb',
        ['-s', 'emulator-5554', 'uninstall', 'so.onekey.app.wallet'],
        { stdio: 'inherit' },
      ],
      [
        'adb',
        ['-s', 'emulator-5554', 'install', '/tmp/dev-shell.apk'],
        { stdio: 'inherit' },
      ],
    ]);
  });

  it('refuses to uninstall an incompatible app from a physical device', async () => {
    const spawnCommand = jest
      .fn()
      .mockReturnValueOnce({
        status: 1,
        stderr: 'Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE]',
      })
      .mockReturnValueOnce({ status: 0, stdout: '0\n' });

    await expect(
      installMobileDevShell({
        artifactPath: '/tmp/dev-shell.apk',
        deviceId: 'physical-device',
        platform: 'android',
        spawnCommand,
      }),
    ).rejects.toThrow('Refusing to uninstall');
    expect(spawnCommand.mock.calls).toEqual([
      [
        'adb',
        ['-s', 'physical-device', 'install', '-r', '-d', '/tmp/dev-shell.apk'],
        { encoding: 'utf8' },
      ],
      [
        'adb',
        ['-s', 'physical-device', 'shell', 'getprop', 'ro.kernel.qemu'],
        { encoding: 'utf8' },
      ],
    ]);
  });

  it('does not uninstall an Android app for unrelated install failures', async () => {
    const spawnCommand = jest.fn(() => ({
      status: 1,
      stderr: 'Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]',
    }));

    await expect(
      installMobileDevShell({
        artifactPath: '/tmp/dev-shell.apk',
        deviceId: 'emulator-5554',
        platform: 'android',
        spawnCommand,
      }),
    ).rejects.toThrow('INSTALL_FAILED_INSUFFICIENT_STORAGE');
    expect(spawnCommand).toHaveBeenCalledTimes(1);
  });

  it('preserves the operation error when cache lease cleanup also fails', async () => {
    const operationError = new Error('device installation failed');
    const cleanupError = new Error('lease lock failed');
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      await expect(
        runWithCacheLeaseCleanup({
          operation: async () => {
            throw operationError;
          },
          releaseCacheLease: async () => {
            throw cleanupError;
          },
        }),
      ).rejects.toBe(operationError);
      expect(consoleError).toHaveBeenCalledWith(
        '[ONEKEY_USER_NOTICE] Mobile shell cache lease cleanup failed: lease lock failed',
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it('keeps a successful operation successful when cleanup fails', async () => {
    const cleanupError = new Error('lease lock failed');
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      await expect(
        runWithCacheLeaseCleanup({
          operation: async () => 'installed',
          releaseCacheLease: async () => {
            throw cleanupError;
          },
        }),
      ).resolves.toBe('installed');
      expect(consoleError).toHaveBeenCalledWith(
        '[ONEKEY_USER_NOTICE] Mobile shell cache lease cleanup failed: lease lock failed',
      );
    } finally {
      consoleError.mockRestore();
    }
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
      const localWebEmbedManifest = {
        ...manifest,
        webEmbed: {
          inputKey: compatibility.webEmbedInputKey,
          outputTreeDigest: '7'.repeat(64),
          source: 'local-build',
        },
      };
      await expect(
        verifyArtifactManifest({
          artifactPath,
          compatibility,
          locator: 'exact',
          manifest: localWebEmbedManifest,
        }),
      ).resolves.toBe(localWebEmbedManifest);
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

  it('restores an incomplete cache after a stale lease pid is reused', async () => {
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
      const leaseDirectory = path.join(cacheDirectory, '.leases');
      fs.mkdirSync(leaseDirectory);
      fs.writeFileSync(
        path.join(leaseDirectory, `${String(process.pid)}-stale.json`),
        `${JSON.stringify({ pid: process.pid, processStartedAtMs: 1 })}\n`,
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

  it('preserves an active cache when verification transiently fails', async () => {
    const cacheRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-shell-active-cache-test-'),
    );
    let releaseCacheLease;
    try {
      const remote = createRemoteShell({
        compatibility,
        inputKey: compatibility.shellInputKey,
      });
      const initialRestore = await restoreMobileDevShell({
        attestationVerifier: jest.fn().mockResolvedValue(undefined),
        cacheRoot,
        compatibility,
        fetchImpl: remote.fetchImpl,
      });
      releaseCacheLease = initialRestore.releaseCacheLease;
      remote.fetchImpl.mockClear();

      await expect(
        restoreMobileDevShell({
          attestationVerifier: jest
            .fn()
            .mockRejectedValue(new Error('temporary verifier failure')),
          cacheRoot,
          compatibility,
          fetchImpl: remote.fetchImpl,
        }),
      ).rejects.toThrow('verification failed while the shell is in use');
      expect(fs.readFileSync(initialRestore.artifactPath)).toEqual(
        remote.artifact,
      );
      expect(remote.fetchImpl).not.toHaveBeenCalled();
    } finally {
      await releaseCacheLease?.();
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

  it('bounds cache entries without pruning the current or actively leased shell', async () => {
    const cacheRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-shell-prune-test-'),
    );
    const tags = Array.from(
      { length: MAX_CACHED_SHELLS + 3 },
      (_, index) =>
        `mobile-dev-shell-input-v3-android-arm64-v8a-${index.toString(16).padStart(64, '0')}`,
    );
    const leasedTag = tags[0];
    const lockedTag = tags[1];
    const currentTag = tags.at(-1);
    try {
      for (const [index, tag] of tags.entries()) {
        const directory = path.join(cacheRoot, tag);
        fs.mkdirSync(directory);
        fs.writeFileSync(path.join(directory, 'shell.apk'), 'shell');
        const timestamp = new Date(1000 + index * 1000);
        fs.utimesSync(directory, timestamp, timestamp);
      }
      const releaseCacheLease = await createMobileShellCacheLease({
        cacheRoot,
        tag: leasedTag,
      });
      const oldestTimestamp = new Date(1000);
      fs.utimesSync(
        path.join(cacheRoot, leasedTag),
        oldestTimestamp,
        oldestTimestamp,
      );

      await withCacheLock(
        path.join(cacheRoot, '.locks', `${lockedTag}.lock`),
        async () => {
          await touchAndPruneMobileShellCache(cacheRoot, currentTag);
          expect(fs.existsSync(path.join(cacheRoot, currentTag))).toBe(true);
          expect(fs.existsSync(path.join(cacheRoot, leasedTag))).toBe(true);
          expect(fs.existsSync(path.join(cacheRoot, lockedTag))).toBe(true);
        },
      );

      const leasedDirectory = path.join(cacheRoot, leasedTag);
      const leaseDirectory = path.join(leasedDirectory, '.leases');
      let leasePresentDuringPrune = false;
      const originalUtimes = fs.promises.utimes;
      const utimes = jest
        .spyOn(fs.promises, 'utimes')
        .mockImplementation(async (targetPath, ...args) => {
          if (targetPath === leasedDirectory) {
            leasePresentDuringPrune =
              fs.existsSync(leaseDirectory) &&
              fs.readdirSync(leaseDirectory).length > 0;
          }
          return originalUtimes(targetPath, ...args);
        });
      try {
        await releaseCacheLease();
      } finally {
        utimes.mockRestore();
      }
      expect(leasePresentDuringPrune).toBe(true);
      const retainedTags = fs
        .readdirSync(cacheRoot, { withFileTypes: true })
        .filter(
          (entry) =>
            entry.isDirectory() && entry.name.startsWith('mobile-dev-shell-'),
        )
        .map(({ name }) => name);
      expect(retainedTags).toHaveLength(MAX_CACHED_SHELLS);
      expect(retainedTags).toEqual(
        expect.arrayContaining([currentTag, leasedTag]),
      );
    } finally {
      fs.rmSync(cacheRoot, { force: true, recursive: true });
    }
  });

  it('removes its lease immediately when the tag lock is busy', async () => {
    const cacheRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-shell-busy-release-test-'),
    );
    const tag = `mobile-dev-shell-input-v3-android-arm64-v8a-${'a'.repeat(64)}`;
    const cacheDirectory = path.join(cacheRoot, tag);
    const leaseDirectory = path.join(cacheDirectory, '.leases');
    try {
      fs.mkdirSync(cacheDirectory);
      const releaseCacheLease = await createMobileShellCacheLease({
        cacheRoot,
        tag,
      });

      await withCacheLock(
        path.join(cacheRoot, '.locks', `${tag}.lock`),
        async () => {
          await expect(releaseCacheLease()).resolves.toBeUndefined();
          expect(fs.existsSync(leaseDirectory)).toBe(false);
          expect(fs.existsSync(cacheDirectory)).toBe(true);
        },
      );
    } finally {
      fs.rmSync(cacheRoot, { force: true, recursive: true });
    }
  });
});
