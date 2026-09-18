const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  cacheLocalShellBuild,
  readLocalShellCache,
} = require('../local-dev-shell-cache');
const {
  IosSimulatorEntitlementsError,
} = require('../mobile-dev-shell-resource');
const { resolveAndInstallShell } = require('../native-dev-shell');

describe('simulator shell local rebuild', () => {
  let directory;
  let report;
  let consoleError;

  beforeEach(() => {
    directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-shell-install-test-'),
    );
    report = {
      runReportPath: path.join(directory, 'run-result.json'),
      userNotices: [],
    };
    consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
    fs.rmSync(directory, { force: true, recursive: true });
  });

  it('releases the remote cache lease and rebuilds a shell with missing simulator permissions', async () => {
    const releaseCacheLease = jest.fn().mockResolvedValue(undefined);
    const restore = jest.fn().mockResolvedValue({
      artifactPath: '/tmp/remote.zip',
      ociDigest: 'remote-digest',
      releaseCacheLease,
      source: 'remote-cache',
    });
    const install = jest
      .fn()
      .mockRejectedValueOnce(new IosSimulatorEntitlementsError())
      .mockResolvedValueOnce(undefined);
    const build = jest.fn(async () => {
      expect(releaseCacheLease).toHaveBeenCalledTimes(1);
      return '/tmp/local.zip';
    });
    await resolveAndInstallShell(
      { deviceId: 'SIMULATOR-A', platform: 'ios', report, shell: 'auto' },
      { build, install, restore, getCache: jest.fn(), cacheBuild: jest.fn() },
    );
    expect(install.mock.calls.map(([args]) => args.artifactPath)).toEqual([
      '/tmp/remote.zip',
      '/tmp/local.zip',
    ]);
    expect(report.shell).toMatchObject({
      artifactPath: '/tmp/local.zip',
      source: 'local-build',
      status: 'ready',
      fallbackReason: expect.stringContaining('embedded entitlements'),
    });
    expect(report.shell.ociDigest).toBeUndefined();
    expect(report.userNoticeRequired).toBe(true);
  }, 15_000);

  it.each([
    ['remote', new IosSimulatorEntitlementsError()],
    ['auto', new Error('Simulator installation failed')],
  ])(
    'preserves %s mode and unrelated installation errors',
    async (shell, error) => {
      const build = jest.fn();
      const releaseCacheLease = jest.fn().mockResolvedValue(undefined);
      await expect(
        resolveAndInstallShell(
          { deviceId: 'SIMULATOR-A', platform: 'ios', report, shell },
          {
            build,
            getCache: jest.fn(),
            install: jest.fn().mockRejectedValue(error),
            restore: jest.fn().mockResolvedValue({
              artifactPath: '/tmp/remote.zip',
              source: 'remote-cache',
              releaseCacheLease,
            }),
          },
        ),
      ).rejects.toBe(error);
      expect(build).not.toHaveBeenCalled();
      expect(releaseCacheLease).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['missing-entitlements', 'missing-native-inputs'])(
    'builds once and reuses the local archive after %s',
    async (reason) => {
      const artifactPath = path.join(directory, 'built.zip');
      const cacheRoot = path.join(directory, 'cache');
      const build = jest.fn(async () => {
        fs.writeFileSync(artifactPath, 'built simulator archive');
        return artifactPath;
      });
      const restore = jest.fn().mockResolvedValue({
        artifactPath: '/tmp/old.zip',
        source: 'remote-cache',
      });
      const install = jest.fn().mockResolvedValue(undefined);
      if (reason === 'missing-entitlements')
        install.mockRejectedValueOnce(new IosSimulatorEntitlementsError());
      else
        restore.mockRejectedValue(
          new Error('Matching native input shell: HTTP 404'),
        );
      const dependencies = {
        build,
        install,
        restore,
        getCache: (options) => readLocalShellCache({ ...options, cacheRoot }),
        cacheBuild: (options) =>
          cacheLocalShellBuild({ ...options, cacheRoot }),
      };
      const options = {
        deviceId: 'SIMULATOR-A',
        platform: 'ios',
        shell: 'auto',
      };
      await resolveAndInstallShell({ ...options, report }, dependencies);
      expect(report.userNoticeRequired).toBe(true);
      const nextReport = {
        runReportPath: path.join(directory, 'next.json'),
        userNotices: [],
      };
      await resolveAndInstallShell(
        { ...options, report: nextReport },
        dependencies,
      );
      expect(build).toHaveBeenCalledTimes(1);
      expect(restore).toHaveBeenCalledTimes(1);
      expect(nextReport.shell).toMatchObject({
        source: 'local-cache',
        status: 'ready',
      });
      expect(nextReport.userNotices).toEqual([]);
      expect(fs.readFileSync(nextReport.shell.artifactPath, 'utf8')).toBe(
        'built simulator archive',
      );
    },
  );
});
