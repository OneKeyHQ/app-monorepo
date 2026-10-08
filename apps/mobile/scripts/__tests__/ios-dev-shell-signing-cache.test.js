const fs = require('fs');
const os = require('os');
const path = require('path');

const { getIosSigningCacheOptions } = require('../local-dev-shell-cache');
const {
  IosSimulatorEntitlementsError,
  installMobileDevShell,
} = require('../mobile-dev-shell-resource');

describe('iOS simulator shell signing cache', () => {
  let directory;
  let artifactPath;
  let signingCacheRoot;
  let spawnCommand;
  let signatureState;
  let embeddedEntitlements;
  let verificationFails;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-signing-cache-'));
    artifactPath = path.join(directory, 'remote.zip');
    signingCacheRoot = path.join(directory, 'cache');
    fs.writeFileSync(artifactPath, 'original remote archive');
    signatureState = { app: true, framework: true };
    embeddedEntitlements = true;
    verificationFails = false;
    let currentState;
    spawnCommand = jest.fn((command, args) => {
      if (command === 'ditto' && args[0] === '-x') {
        currentState =
          args[2] === artifactPath
            ? { ...signatureState }
            : { app: true, framework: true };
        fs.mkdirSync(
          path.join(args[3], 'OneKeyWallet.app/Frameworks/Example.framework'),
          { recursive: true },
        );
      }
      if (command === 'ditto' && args[0] === '-c')
        fs.writeFileSync(args.at(-1), 'signed derivative');
      if (command === 'xcrun' && args[0] === 'otool')
        return {
          status: 0,
          stdout: embeddedEntitlements
            ? 'sectname __entitlements\n  segname __TEXT\n'
            : '',
        };
      if (command === 'codesign') {
        const target = args.at(-1).endsWith('.framework') ? 'framework' : 'app';
        if (args.includes('--sign')) currentState[target] = true;
        if (args.includes('--verify'))
          return { status: !verificationFails && currentState[target] ? 0 : 1 };
      }
      return { status: 0 };
    });
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  const install = () =>
    installMobileDevShell({
      artifactPath,
      deviceId: 'SIMULATOR-A',
      platform: 'ios',
      signingCacheRoot,
      spawnCommand,
    });
  const signCalls = () =>
    spawnCommand.mock.calls.filter(
      ([command, args]) => command === 'codesign' && args.includes('--sign'),
    );

  it('only verifies already signed archives on repeated installations', async () => {
    await install();
    await install();
    expect(signCalls()).toEqual([]);
    expect(
      spawnCommand.mock.calls.filter(
        ([command, args]) => command === 'xcrun' && args[0] === 'simctl',
      ),
    ).toHaveLength(2);
    expect(fs.existsSync(signingCacheRoot)).toBe(false);
  });

  it.each(['app', 'framework'])(
    'repairs the %s signature once and reuses the derivative',
    async (target) => {
      signatureState[target] = false;
      await install();
      expect(signCalls()).toHaveLength(target === 'app' ? 1 : 2);
      spawnCommand.mockClear();
      await install();
      expect(signCalls()).toEqual([]);
      const extraction = spawnCommand.mock.calls.find(
        ([command]) => command === 'ditto',
      );
      expect(extraction[1][2]).not.toBe(artifactPath);
      expect(fs.readFileSync(artifactPath, 'utf8')).toBe(
        'original remote archive',
      );
    },
  );

  it.each(['remote', 'cached'])(
    'invalidates a repaired archive when %s bytes change',
    async (target) => {
      signatureState.app = false;
      await install();
      const cacheOptions = await getIosSigningCacheOptions({
        artifactPath,
        cacheRoot: signingCacheRoot,
      });
      const cachedPath = path.join(
        cacheOptions.cacheRoot,
        'ios/OneKeyWallet-DevShell-ios-simulator-arm64.zip',
      );
      fs.writeFileSync(
        target === 'remote' ? artifactPath : cachedPath,
        'changed bytes',
      );
      spawnCommand.mockClear();
      await install();
      expect(signCalls()).toHaveLength(1);
      expect(
        spawnCommand.mock.calls.find(([command]) => command === 'ditto')[1][2],
      ).toBe(artifactPath);
    },
  );

  it('rejects old shells missing simulator permissions before signing or installation', async () => {
    embeddedEntitlements = false;
    await expect(install()).rejects.toBeInstanceOf(
      IosSimulatorEntitlementsError,
    );
    expect(signCalls()).toEqual([]);
    expect(spawnCommand.mock.calls.map(([command]) => command)).toEqual([
      'ditto',
      'xcrun',
    ]);
  });

  it('does not cache or install a shell whose repaired signature still fails verification', async () => {
    verificationFails = true;
    await expect(install()).rejects.toThrow('Command failed: codesign');
    expect(fs.existsSync(signingCacheRoot)).toBe(false);
    expect(
      spawnCommand.mock.calls.some(
        ([command, args]) => command === 'xcrun' && args[0] === 'simctl',
      ),
    ).toBe(false);
  });
});
