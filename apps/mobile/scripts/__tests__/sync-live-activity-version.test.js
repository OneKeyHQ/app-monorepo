const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const plist = require('@expo/plist').default;

const { syncLiveActivityVersion } = require('../sync-live-activity-version');

describe('syncLiveActivityVersion', () => {
  let directory;
  let appPlistPath;
  let activityPlistPath;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-plist-'));
    appPlistPath = path.join(directory, 'app.plist');
    activityPlistPath = path.join(directory, 'activity.plist');
    fs.writeFileSync(
      appPlistPath,
      plist.build({
        CFBundleShortVersionString: '6.8.0',
        CFBundleVersion: '10523',
      }),
    );
    fs.writeFileSync(
      activityPlistPath,
      plist.build({
        CFBundleShortVersionString: '1.0.0',
        CFBundleVersion: '1',
        NSExtension: {
          NSExtensionPointIdentifier: 'com.apple.widgetkit-extension',
        },
      }),
    );
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  it('copies both iOS versions without changing extension configuration', () => {
    syncLiveActivityVersion({
      platform: 'ios',
      appPlistPath,
      activityPlistPath,
    });

    expect(plist.parse(fs.readFileSync(activityPlistPath, 'utf8'))).toEqual({
      CFBundleShortVersionString: '6.8.0',
      CFBundleVersion: '10523',
      NSExtension: {
        NSExtensionPointIdentifier: 'com.apple.widgetkit-extension',
      },
    });
    expect(fs.readdirSync(directory).toSorted()).toEqual([
      'activity.plist',
      'app.plist',
    ]);
  });

  it.each([
    { CFBundleShortVersionString: '6.8.0' },
    {
      CFBundleShortVersionString: '$(MARKETING_VERSION)',
      CFBundleVersion: '1',
    },
    { CFBundleShortVersionString: '6.8.0', CFBundleVersion: '' },
  ])('rejects invalid app versions without changing the extension', (app) => {
    fs.writeFileSync(appPlistPath, plist.build(app));
    const original = fs.readFileSync(activityPlistPath, 'utf8');

    expect(() =>
      syncLiveActivityVersion({
        platform: 'ios',
        appPlistPath,
        activityPlistPath,
      }),
    ).toThrow(/Invalid CFBundle/);
    expect(fs.readFileSync(activityPlistPath, 'utf8')).toBe(original);
  });

  it('rejects a missing extension version without writing partial output', () => {
    fs.writeFileSync(activityPlistPath, plist.build({ CFBundleVersion: '1' }));
    const original = fs.readFileSync(activityPlistPath, 'utf8');

    expect(() =>
      syncLiveActivityVersion({
        platform: 'ios',
        appPlistPath,
        activityPlistPath,
      }),
    ).toThrow('Missing CFBundleShortVersionString');
    expect(fs.readFileSync(activityPlistPath, 'utf8')).toBe(original);
  });

  it('does not access iOS plists on Android', () => {
    expect(() =>
      syncLiveActivityVersion({
        platform: 'android',
        appPlistPath: path.join(directory, 'missing-app'),
        activityPlistPath: path.join(directory, 'missing-activity'),
      }),
    ).not.toThrow();
  });

  it('runs the Android hook from another working directory', () => {
    const result = spawnSync(
      process.execPath,
      [path.resolve(__dirname, '../sync-live-activity-version.js')],
      {
        cwd: directory,
        env: { ...process.env, EAS_BUILD_PLATFORM: 'android' },
        encoding: 'utf8',
      },
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('rejects an unknown EAS platform', () => {
    expect(() => syncLiveActivityVersion({ platform: undefined })).toThrow(
      'EAS_BUILD_PLATFORM must be ios or android',
    );
  });
});
