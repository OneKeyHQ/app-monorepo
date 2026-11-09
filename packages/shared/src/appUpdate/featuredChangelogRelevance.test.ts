import { isFeaturedChangelogRelevantToAppUpdate } from '.';

import { EAppUpdateStatus, EUpdateStrategy } from './type';

import type { IAppUpdateInfo, IFeaturedChangelog } from '.';

// APP_VERSION falls back to 1.0.0 in jest (process.env.VERSION is unset).
const INSTALLED_VERSION = '1.0.0';

const featured = (version: string): IFeaturedChangelog => ({
  version,
  features: [
    {
      title: 'Feature',
      mediaUrl: 'https://cdn.onekey.so/a.png',
      mediaType: 'image',
    },
  ],
});

const appUpdateInfo = (
  patch: Partial<IAppUpdateInfo> = {},
): IAppUpdateInfo => ({
  latestVersion: INSTALLED_VERSION,
  updateAt: Date.now(),
  status: EAppUpdateStatus.done,
  updateStrategy: EUpdateStrategy.manual,
  ...patch,
});

describe('isFeaturedChangelogRelevantToAppUpdate', () => {
  test('rejects a payload authored for a release that is not installed', () => {
    // OK-54862: after a cancelled test-release push + clearing the app update
    // cache, a leftover 9906.15.1 payload must not replace the installed
    // version's changelog on the About tab.
    expect(
      isFeaturedChangelogRelevantToAppUpdate(
        featured('9906.15.1'),
        appUpdateInfo({ latestVersion: INSTALLED_VERSION }),
        false,
      ),
    ).toBe(false);
  });

  test('keeps the installed version featured changelog after an update', () => {
    expect(
      isFeaturedChangelogRelevantToAppUpdate(
        featured(INSTALLED_VERSION),
        appUpdateInfo({ latestVersion: INSTALLED_VERSION }),
        false,
      ),
    ).toBe(true);
  });

  test('suppresses cards when the update completed as a rollback', () => {
    expect(
      isFeaturedChangelogRelevantToAppUpdate(
        featured(INSTALLED_VERSION),
        appUpdateInfo({ isRollbackTarget: true }),
        false,
      ),
    ).toBe(false);
  });

  test('requires a really pending update before the pre-install carousel', () => {
    expect(
      isFeaturedChangelogRelevantToAppUpdate(
        featured('2.0.0'),
        appUpdateInfo({
          latestVersion: '2.0.0',
          status: EAppUpdateStatus.notify,
        }),
        true,
      ),
    ).toBe(true);

    // Same payload on an up-to-date device: no pending update, no carousel.
    expect(
      isFeaturedChangelogRelevantToAppUpdate(
        featured(INSTALLED_VERSION),
        appUpdateInfo({ latestVersion: INSTALLED_VERSION }),
        true,
      ),
    ).toBe(false);
  });

  test('pre-install payload must describe the pending target, not another release', () => {
    expect(
      isFeaturedChangelogRelevantToAppUpdate(
        featured('9906.15.1'),
        appUpdateInfo({
          latestVersion: '2.0.0',
          status: EAppUpdateStatus.notify,
        }),
        true,
      ),
    ).toBe(false);
  });

  test('accepts a pending hot update whose featured payload matches the app version', () => {
    expect(
      isFeaturedChangelogRelevantToAppUpdate(
        featured(INSTALLED_VERSION),
        appUpdateInfo({
          latestVersion: INSTALLED_VERSION,
          jsBundleVersion: '222',
          status: EAppUpdateStatus.notify,
        }),
        true,
      ),
    ).toBe(true);
  });

  test('rejects missing atom or empty payload', () => {
    expect(
      isFeaturedChangelogRelevantToAppUpdate(undefined, appUpdateInfo(), false),
    ).toBe(false);
    expect(
      isFeaturedChangelogRelevantToAppUpdate(
        { version: INSTALLED_VERSION, features: [] },
        appUpdateInfo(),
        false,
      ),
    ).toBe(false);
    expect(
      isFeaturedChangelogRelevantToAppUpdate(
        featured(INSTALLED_VERSION),
        undefined,
        false,
      ),
    ).toBe(false);
  });
});
