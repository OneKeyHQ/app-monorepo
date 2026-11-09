/**
 * @jest-environment jsdom
 */

import {
  EAppUpdateStatus,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';
import type {
  IAppUpdateInfo,
  IFeaturedChangelog,
} from '@onekeyhq/shared/src/appUpdate';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { showFeaturedChangelogDialog } from './showFeaturedChangelogDialog';
import { tryShowFeaturedDialog } from './tryShowFeaturedDialog';

// The gate runs in the UI runtime and reads the background atom through the
// proxy. Mock that boundary (and the lazily imported dialog) so the test
// asserts routing, not rendering.
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAppUpdate: {
      getUpdateInfo: jest.fn(),
    },
  },
}));

jest.mock('./showFeaturedChangelogDialog', () => ({
  showFeaturedChangelogDialog: jest.fn(),
}));

const serviceAppUpdateMock = backgroundApiProxy.serviceAppUpdate as unknown as {
  getUpdateInfo: jest.Mock;
};
const getUpdateInfo = serviceAppUpdateMock.getUpdateInfo;
const showDialog = showFeaturedChangelogDialog as unknown as jest.Mock;

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

const info = (patch: Partial<IAppUpdateInfo> = {}): IAppUpdateInfo => ({
  latestVersion: '1.0.0',
  updateAt: Date.now(),
  status: EAppUpdateStatus.done,
  updateStrategy: EUpdateStrategy.manual,
  ...patch,
});

describe('tryShowFeaturedDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('skips the overlay when no featured changelog is persisted', async () => {
    getUpdateInfo.mockResolvedValue(info());

    await expect(tryShowFeaturedDialog(false)).resolves.toBe(false);
    expect(showDialog).not.toHaveBeenCalled();
  });

  test('OK-54862: a cleared update cache cannot resurface the old release carousel', async () => {
    // After "clear app update cache" the atom is reset to the installed
    // version. A leftover 9906.15.1 payload (e.g. re-served or kept by the
    // split runtime) must not replace the About tab's current changelog.
    getUpdateInfo.mockResolvedValue(
      info({
        latestVersion: '1.0.0',
        featuredChangelog: featured('9906.15.1'),
      }),
    );

    await expect(tryShowFeaturedDialog(false)).resolves.toBe(false);
    expect(showDialog).not.toHaveBeenCalled();
  });

  test('shows the installed version carousel after an update', async () => {
    const featuredChangelog = featured('1.0.0');
    getUpdateInfo.mockResolvedValue(info({ featuredChangelog }));

    await expect(tryShowFeaturedDialog(false)).resolves.toBe(true);
    expect(showDialog).toHaveBeenCalledWith({
      isPreInstall: false,
      featuredChangelog,
    });
  });

  test('shows the pending target carousel for the pre-install update flow', async () => {
    const featuredChangelog = featured('2.0.0');
    getUpdateInfo.mockResolvedValue(
      info({
        latestVersion: '2.0.0',
        status: EAppUpdateStatus.notify,
        featuredChangelog,
      }),
    );

    await expect(tryShowFeaturedDialog(true)).resolves.toBe(true);
    expect(showDialog).toHaveBeenCalledWith({
      isPreInstall: true,
      featuredChangelog,
    });
  });

  test('does not open the pre-install carousel without a pending update', async () => {
    getUpdateInfo.mockResolvedValue(
      info({ latestVersion: '1.0.0', featuredChangelog: featured('1.0.0') }),
    );

    await expect(tryShowFeaturedDialog(true)).resolves.toBe(false);
    expect(showDialog).not.toHaveBeenCalled();
  });
});
