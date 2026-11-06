import {
  EAppUpdateStatus,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { appUpdatePersistAtom } from '../states/jotai/atoms';
import {
  settingsAtomInitialValue,
  settingsPersistAtom,
} from '../states/jotai/atoms/settings';

import ServiceSetting from './ServiceSetting';

const originalBackground = globalThis.$onekeyIsInBackground;
beforeAll(() => {
  globalThis.$onekeyIsInBackground = true;
});
afterAll(() => {
  globalThis.$onekeyIsInBackground = originalBackground;
});
afterEach(() => {
  jest.restoreAllMocks();
});

test.each([
  [EUpdateStrategy.manual, false],
  [EUpdateStrategy.force, false],
  [EUpdateStrategy.silent, true],
  [EUpdateStrategy.seamless, true],
])(
  'enabling automatic downloads respects release strategy %s',
  async (strategy, expected) => {
    jest.replaceProperty(platformEnv, 'isDesktop', true);
    jest.spyOn(settingsPersistAtom, 'get').mockResolvedValue({
      ...settingsAtomInitialValue,
      enableAutoDownloadAppUpdate: false,
    });
    jest.spyOn(settingsPersistAtom, 'set').mockResolvedValue(undefined);
    jest.spyOn(appUpdatePersistAtom, 'get').mockResolvedValue({
      latestVersion: '2.0.0',
      updateAt: 0,
      status: EAppUpdateStatus.notify,
      updateStrategy: strategy,
      downloadUrl: 'https://cdn.onekey.so/app.exe',
    });
    const emit = jest.spyOn(appEventBus, 'emit').mockImplementation(() => true);
    const service = new ServiceSetting({
      backgroundApi: {
        simpleDb: { appStatus: {} },
        serviceAppUpdate: {
          canDownloadCurrentTarget: jest.fn(async () => true),
        },
      },
    });
    await service.setEnableAutoDownloadAppUpdate(true);
    if (expected)
      expect(emit).toHaveBeenCalledWith(
        EAppEventBusNames.StartAutoDownloadUpdate,
        { decision: 'autoDownloadEnabled' },
      );
    else expect(emit).not.toHaveBeenCalled();
  },
);
