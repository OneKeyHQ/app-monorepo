const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  addFallbackNotice,
  addFailureNotice,
  acquireMetroPort,
  acquireWorktreePreparationLock,
  createSessionId,
  createRunReport,
  getContractManifest,
  getShellArtifactTag,
  getShellCompatibility,
  parseAndroidDevices,
  parseArgs,
  parseIosSimulators,
  parseMetroBaseUrl,
  parseMetroPort,
  printRunSummary,
  pruneSessionDirectories,
  selectTargetDevice,
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
        '--device',
        'emulator-5554',
        '--metro-url',
        'http://10.0.2.2:8081',
        '--metro-port',
        '8082',
      ]),
    ).toMatchObject({
      command: 'launch',
      device: 'emulator-5554',
      metroPort: '8082',
      metroUrl: 'http://10.0.2.2:8081',
      platform: 'android',
      shell: 'remote',
      vendor: 'local',
    });
  });

  it('keeps worktree and device identity in a unique runtime session ID', () => {
    const sessionId = createSessionId({
      deviceId: 'emulator-5554',
      randomBytes: () => Buffer.from('0011223344556677', 'hex'),
    });

    expect(sessionId).toMatch(
      /^wk-[0-9a-f]{12}-dev-[0-9a-f]{12}-0011223344556677$/u,
    );
  });

  it('selects a sole device and rejects ambiguous implicit selection', () => {
    const candidates = [
      { id: 'emulator-5554', name: 'Pixel A' },
      { id: 'emulator-5556', name: 'Pixel B' },
    ];

    expect(
      selectTargetDevice({
        candidates: [candidates[0]],
        platform: 'android',
      }),
    ).toEqual(candidates[0]);
    expect(() =>
      selectTargetDevice({ candidates, platform: 'android' }),
    ).toThrow('--device is required');
    expect(
      selectTargetDevice({
        candidates,
        platform: 'android',
        requestedDevice: 'emulator-5556',
      }),
    ).toEqual(candidates[1]);
  });

  it('parses only usable Android and booted iOS devices', () => {
    expect(
      parseAndroidDevices(
        'List of devices attached\nemulator-5554 device product:sdk\nemulator-5556 offline\n',
      ),
    ).toEqual([{ id: 'emulator-5554', name: 'emulator-5554' }]);
    expect(
      parseIosSimulators(
        JSON.stringify({
          devices: {
            runtime: [
              {
                isAvailable: true,
                name: 'iPhone A',
                state: 'Booted',
                udid: 'A',
              },
              {
                isAvailable: true,
                name: 'iPhone B',
                state: 'Shutdown',
                udid: 'B',
              },
            ],
          },
        }),
      ),
    ).toEqual([{ id: 'A', name: 'iPhone A' }]);
  });

  it('separates and locks the local Metro port from the device-visible URL', async () => {
    expect(parseMetroPort('8188')).toBe(8188);
    expect(() => parseMetroPort('443.5')).toThrow('Invalid --metro-port');

    const first = await acquireMetroPort({
      deviceId: 'device-a',
      sessionId: 'session-a',
    });
    try {
      await expect(
        acquireMetroPort({
          deviceId: 'device-b',
          requestedPort: String(first.port),
          sessionId: 'session-b',
        }),
      ).rejects.toThrow('already locked');
    } finally {
      first.lock.release();
    }
  });

  it('serializes shared worktree preparation across device sessions', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const firstReport = {
      deviceId: 'device-a',
      sessionId: 'session-preparation-a',
      userNoticeRequired: false,
      userNotices: [],
      worktreeId: 'worktree-test',
    };
    const secondReport = {
      deviceId: 'device-b',
      sessionId: 'session-preparation-b',
      userNoticeRequired: false,
      userNotices: [],
      worktreeId: 'worktree-test',
    };
    const first = await acquireWorktreePreparationLock({
      report: firstReport,
      waitIntervalMs: 5,
    });
    let second;
    try {
      const waiting = acquireWorktreePreparationLock({
        report: secondReport,
        waitIntervalMs: 5,
      });
      setTimeout(() => first.release(), 20);
      second = await waiting;
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('action=wait-worktree-preparation'),
      );
    } finally {
      first.release();
      second?.release();
      consoleError.mockRestore();
    }
  });

  it('keeps host session staging directories bounded', async () => {
    const sessionIds = [
      'wk-111111111111-dev-222222222222-0000000000000001',
      'wk-111111111111-dev-222222222222-0000000000000002',
      'wk-111111111111-dev-222222222222-0000000000000003',
      'wk-111111111111-dev-222222222222-0000000000000004',
    ];
    for (const [index, sessionId] of sessionIds.entries()) {
      const directory = path.join(temporaryDirectory, sessionId);
      fs.mkdirSync(directory);
      const modifiedAt = new Date(1000 + index * 1000);
      fs.utimesSync(directory, modifiedAt, modifiedAt);
    }

    await pruneSessionDirectories(temporaryDirectory, {
      maxSessions: 2,
      preserveSessionId: sessionIds[0],
    });

    expect(fs.readdirSync(temporaryDirectory).toSorted()).toEqual(
      [sessionIds[0], sessionIds[3]].toSorted(),
    );
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

  it('keeps clean summaries informational and failures actionable', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    try {
      const report = createRunReport({
        deviceId: 'device-a',
        metroPort: 8081,
        metroUrl: 'http://127.0.0.1:8081',
        platform: 'ios',
        sessionId: 'wk-111111111111-dev-222222222222-3333333333333333',
        shell: 'auto',
        vendor: 'auto',
        worktreeId: '111111111111',
      });
      report.status = 'finished';
      printRunSummary(report);
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('[ONEKEY_RUN_SUMMARY]'),
      );
      expect(consoleError).not.toHaveBeenCalledWith(
        expect.stringContaining('[ONEKEY_USER_NOTICE]'),
      );

      addFailureNotice(report, 'Metro stopped');
      expect(report.userNoticeRequired).toBe(true);
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining(
          '[ONEKEY_USER_NOTICE] worktree=111111111111 device=device-a session=wk-111111111111-dev-222222222222-3333333333333333 action=run-failed',
        ),
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

  it('validates an explicit Metro URL before acquiring runtime locks', () => {
    const nativeDevShell = fs.readFileSync(
      path.join(__dirname, '../native-dev-shell.js'),
      'utf8',
    );
    const launchSource = nativeDevShell.slice(
      nativeDevShell.indexOf('async function launchDevShell('),
      nativeDevShell.indexOf('\nasync function main()'),
    );

    expect(launchSource.indexOf('parseMetroBaseUrl(metroUrl)')).toBeLessThan(
      launchSource.indexOf('const deviceLock = acquireNamedLock({'),
    );
    expect(launchSource.indexOf('const metroAllocation =')).toBeGreaterThan(
      launchSource.indexOf('try {'),
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

  it('keeps dev session bootstrap private and session-scoped on both platforms', () => {
    const nativeDevShell = fs.readFileSync(
      path.join(__dirname, '../native-dev-shell.js'),
      'utf8',
    );
    const androidApplication = fs.readFileSync(
      path.join(
        __dirname,
        '../../android/app/src/main/java/so/onekey/app/wallet/MainApplication.java',
      ),
      'utf8',
    );
    const androidActivity = fs.readFileSync(
      path.join(
        __dirname,
        '../../android/app/src/main/java/so/onekey/app/wallet/MainActivity.java',
      ),
      'utf8',
    );
    const iosDelegate = fs.readFileSync(
      path.join(__dirname, '../../ios/AppDelegate.swift'),
      'utf8',
    );
    const metroConfig = fs.readFileSync(
      path.join(__dirname, '../../metro.config.js'),
      'utf8',
    );

    expect(androidActivity).not.toContain('ONEKEY_DEV_SESSION_URL');
    expect(androidApplication).toContain(
      'new File(sessionRoot, "current.json")',
    );
    expect(androidApplication).toContain(
      '!deviceId.equals(session.optString("deviceId"))',
    );
    expect(iosDelegate).not.toContain('ONEKEY_DEV_SESSION_URL');
    expect(iosDelegate).toContain(
      'session["worktreeId"] as? String == worktreeId',
    );
    expect(iosDelegate).toContain('let host = components.host');
    expect(iosDelegate).toContain('!host.isEmpty');
    expect(iosDelegate).toContain('components.path = ""');
    expect(metroConfig).not.toContain('/onekey-dev/');
    expect(nativeDevShell).toContain(
      "['workspace', '@onekeyhq/web-embed', 'prebundle:build']",
    );
    expect(nativeDevShell).not.toContain("['app:web-embed:build']");
    expect(nativeDevShell.indexOf('await stagePrivateSession({')).toBeLessThan(
      nativeDevShell.indexOf('preparationLock.release();'),
    );
    expect(nativeDevShell.indexOf('await waitForMetro(')).toBeLessThan(
      nativeDevShell.indexOf('preparationLock.release();'),
    );
  });

  it('creates an input-bound ARM shell artifact manifest', async () => {
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
      schemaVersion: 3,
      webEmbed: {
        inputKey: '1'.repeat(64),
        ociDigest: `sha256:${'2'.repeat(64)}`,
        outputTreeDigest: '3'.repeat(64),
      },
    });
    expect(manifest.nativeContractKey).toMatch(/^[0-9a-f]{64}$/u);
    const computeExpectedArtifactKey = (shellInputKey) =>
      crypto
        .createHash('sha256')
        .update('onekey-mobile-dev-shell-artifact-v3')
        .update('\0')
        .update(shellInputKey)
        .update('\0')
        .update(manifest.artifact.sha256)
        .update('\0')
        .update(String(artifact.length))
        .update('\0')
        .digest('hex');
    expect(manifest.shellArtifactKey).toBe(
      computeExpectedArtifactKey(manifest.shellInputKey),
    );
    expect(computeExpectedArtifactKey('f'.repeat(64))).not.toBe(
      manifest.shellArtifactKey,
    );
    expect(manifest.shellCompatibilityKey).toMatch(/^[0-9a-f]{64}$/u);
    expect(manifest.shellInputKey).toMatch(/^[0-9a-f]{64}$/u);
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
    expect(compatibility.shellInputKey).toMatch(/^[0-9a-f]{64}$/u);
    expect(compatibility.compatibilityTag).toBe(
      `mobile-dev-shell-contract-v3-ios-simulator-arm64-${compatibility.shellCompatibilityKey}`,
    );
    expect(compatibility.exactTag).toBe(
      `mobile-dev-shell-input-v3-ios-simulator-arm64-${compatibility.shellInputKey}`,
    );
    expect(
      getShellArtifactTag({
        platform: 'ios',
        shellArtifactKey: '6'.repeat(64),
      }),
    ).toBe(
      `mobile-dev-shell-artifact-v3-ios-simulator-arm64-${'6'.repeat(64)}`,
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
