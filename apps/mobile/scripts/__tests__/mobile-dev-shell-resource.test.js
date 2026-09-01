const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
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

describe('mobile-dev-shell-resource', () => {
  const compatibility = {
    architecture: 'arm64-v8a',
    artifactFile: 'OneKeyWallet-DevShell-android-arm64-v8a.apk',
    nativeContractKey: '1'.repeat(64),
    platform: 'android',
    resourcePlatform: 'android',
    shellCompatibilityKey: '2'.repeat(64),
    tag: `mobile-dev-shell-compat-v2-android-arm64-v8a-${'2'.repeat(64)}`,
    webEmbedInputKey: '3'.repeat(64),
  };

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
      manifest: {
        annotations: {
          'com.onekey.mobile.architecture': compatibility.architecture,
          'com.onekey.mobile.platform': compatibility.resourcePlatform,
          'com.onekey.mobile.shell-compatibility-key':
            compatibility.shellCompatibilityKey,
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
        'onekey-mobile-dev-shell-artifact-v2',
        [compatibility.shellCompatibilityKey, artifactSha256, artifact.length],
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
        schemaVersion: 2,
        shellArtifactKey,
        shellCompatibilityKey: compatibility.shellCompatibilityKey,
        webEmbed: {
          inputKey: compatibility.webEmbedInputKey,
          ociDigest: `sha256:${'6'.repeat(64)}`,
          outputTreeDigest: '7'.repeat(64),
        },
      };

      await expect(
        verifyArtifactManifest({ artifactPath, compatibility, manifest }),
      ).resolves.toBe(manifest);
      await expect(
        verifyArtifactManifest({
          artifactPath,
          compatibility,
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
      const cacheDirectory = path.join(cacheRoot, compatibility.tag);
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
        'onekey-mobile-dev-shell-artifact-v2',
        [compatibility.shellCompatibilityKey, artifactSha256, artifact.length],
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
          schemaVersion: 2,
          shellArtifactKey,
          shellCompatibilityKey: compatibility.shellCompatibilityKey,
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
          tag: compatibility.tag,
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
      });
      expect(attestationVerifier).toHaveBeenCalledTimes(2);
    } finally {
      fs.rmSync(cacheRoot, { force: true, recursive: true });
    }
  });
});
