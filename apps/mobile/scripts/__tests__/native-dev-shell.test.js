const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  addFallbackNotice,
  createRunReport,
  getContractManifest,
  getShellArtifactTag,
  getShellCompatibility,
  parseArgs,
  parseMetroBaseUrl,
  writeArtifactManifest,
} = require('../native-dev-shell');

describe('native-dev-shell', () => {
  let temporaryDirectory;

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-native-dev-shell-test-'),
    );
  });

  afterEach(() => {
    fs.rmSync(temporaryDirectory, { force: true, recursive: true });
  });

  it('normalizes an external Metro origin', () => {
    expect(parseMetroBaseUrl('http://192.168.1.5:8081/')).toBe(
      'http://192.168.1.5:8081',
    );
    expect(parseMetroBaseUrl('https://metro.example.com')).toBe(
      'https://metro.example.com',
    );
  });

  it('parses the unified app command resource policies', () => {
    expect(
      parseArgs([
        'launch',
        '--platform',
        'android',
        '--shell',
        'remote',
        '--vendor',
        'local',
        '--metro-url',
        'http://10.0.2.2:8081',
      ]),
    ).toMatchObject({
      command: 'launch',
      metroUrl: 'http://10.0.2.2:8081',
      platform: 'android',
      shell: 'remote',
      vendor: 'local',
    });
  });

  it('marks successful local fallback as a required user notice', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    try {
      const report = createRunReport({
        metroUrl: 'http://127.0.0.1:8081',
        platform: 'ios',
        shell: 'auto',
        vendor: 'auto',
      });
      addFallbackNotice(report, {
        reason: 'remote artifact missing',
        resource: 'shell',
      });

      expect(report.userNoticeRequired).toBe(true);
      expect(report.userNotices).toEqual([
        expect.objectContaining({
          reason: 'remote artifact missing',
          resource: 'shell',
        }),
      ]);
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('[ONEKEY_USER_NOTICE]'),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it.each([
    'ftp://metro.example.com',
    'http://user:password@metro.example.com',
    'http://metro.example.com/path',
    'http://metro.example.com?query=true',
  ])('rejects a Metro URL that is not an origin: %s', (url) => {
    expect(() => parseMetroBaseUrl(url)).toThrow(
      '--metro-url must be an HTTP(S) origin',
    );
  });

  it('binds each shell platform to its native contract', () => {
    const android = getContractManifest('android');
    const ios = getContractManifest('ios');

    expect(android.nativeContractKey).toMatch(/^[0-9a-f]{64}$/u);
    expect(ios.nativeContractKey).toMatch(/^[0-9a-f]{64}$/u);
    expect(ios.nativeContractKey).not.toBe(android.nativeContractKey);
    expect(android).toMatchObject({ platform: 'android', schemaVersion: 1 });
    expect(ios).toMatchObject({ platform: 'ios', schemaVersion: 1 });
  });

  it('creates an ARM shell artifact manifest bound to web-embed', async () => {
    const artifactPath = path.join(temporaryDirectory, 'OneKeyWallet.apk');
    const receiptPath = path.join(temporaryDirectory, 'receipt.json');
    const outputPath = path.join(temporaryDirectory, 'artifact.json');
    const artifact = Buffer.from('android-shell');
    fs.writeFileSync(artifactPath, artifact);
    fs.writeFileSync(
      receiptPath,
      JSON.stringify({
        inputKey: '1'.repeat(64),
        ociDigest: `sha256:${'2'.repeat(64)}`,
        outputTreeDigest: '3'.repeat(64),
        reference: 'ghcr.io/onekeyhq/web-embed-prebundle:test',
      }),
    );

    const manifest = await writeArtifactManifest({
      artifact: artifactPath,
      expectedWebEmbedInputKey: '1'.repeat(64),
      output: outputPath,
      platform: 'android',
      webEmbedReceipt: receiptPath,
    });

    expect(manifest).toMatchObject({
      architecture: 'arm64-v8a',
      artifact: {
        bytes: artifact.length,
        file: 'OneKeyWallet.apk',
        sha256: crypto.createHash('sha256').update(artifact).digest('hex'),
      },
      platform: 'android',
      schemaVersion: 2,
      webEmbed: {
        inputKey: '1'.repeat(64),
        ociDigest: `sha256:${'2'.repeat(64)}`,
        outputTreeDigest: '3'.repeat(64),
      },
    });
    expect(manifest.nativeContractKey).toMatch(/^[0-9a-f]{64}$/u);
    expect(manifest.shellArtifactKey).toMatch(/^[0-9a-f]{64}$/u);
    expect(manifest.shellCompatibilityKey).toMatch(/^[0-9a-f]{64}$/u);
    expect(JSON.parse(fs.readFileSync(outputPath, 'utf8'))).toEqual(manifest);
  });

  it('derives a discoverable compatibility tag before building the shell', () => {
    const compatibility = getShellCompatibility({
      nativeContractKey: '4'.repeat(64),
      platform: 'ios',
      webEmbedInputKey: '5'.repeat(64),
    });

    expect(compatibility).toMatchObject({
      architecture: 'arm64',
      artifactFile: 'OneKeyWallet-DevShell-ios-simulator-arm64.zip',
      nativeContractKey: '4'.repeat(64),
      platform: 'ios',
      resourcePlatform: 'ios-simulator',
      webEmbedInputKey: '5'.repeat(64),
    });
    expect(compatibility.shellCompatibilityKey).toMatch(/^[0-9a-f]{64}$/u);
    expect(compatibility.tag).toBe(
      `mobile-dev-shell-compat-v2-ios-simulator-arm64-${compatibility.shellCompatibilityKey}`,
    );
    expect(
      getShellArtifactTag({
        platform: 'ios',
        shellArtifactKey: '6'.repeat(64),
      }),
    ).toBe(
      `mobile-dev-shell-artifact-v2-ios-simulator-arm64-${'6'.repeat(64)}`,
    );
  });

  it('rejects a directory as a shell artifact', async () => {
    const receiptPath = path.join(temporaryDirectory, 'receipt.json');
    fs.writeFileSync(
      receiptPath,
      JSON.stringify({
        inputKey: '1'.repeat(64),
        ociDigest: `sha256:${'2'.repeat(64)}`,
        outputTreeDigest: '3'.repeat(64),
      }),
    );

    await expect(
      writeArtifactManifest({
        artifact: temporaryDirectory,
        expectedWebEmbedInputKey: '1'.repeat(64),
        output: path.join(temporaryDirectory, 'artifact.json'),
        platform: 'ios',
        webEmbedReceipt: receiptPath,
      }),
    ).rejects.toThrow('Artifact must be a regular file');
  });
});
