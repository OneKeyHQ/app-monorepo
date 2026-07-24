/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('../dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {},
}));

import { EAppRestartMode } from '@onekeyhq/shared/src/modules3rdParty/appRestart/types';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import ServiceApp from './ServiceApp';

describe('ServiceApp.resetApp', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('continues the last-resort reset when identity cleanup fails', async () => {
    const prepareIdentityAuthForAppReset = jest
      .fn()
      .mockRejectedValue(new Error('identity recovery failed'));
    const service = new ServiceApp({
      backgroundApi: {
        serviceIdentityExit: {
          prepareIdentityAuthForAppReset,
        },
        serviceNotification: {
          unregisterClient: jest.fn().mockResolvedValue(undefined),
        },
      },
    });
    const resetData = jest
      .spyOn(
        service as unknown as {
          resetData: () => Promise<void>;
        },
        'resetData',
      )
      .mockResolvedValue(undefined);
    const restartApp = jest
      .spyOn(service, 'restartApp')
      .mockResolvedValue(undefined);
    const startResetting = jest.spyOn(resetUtils, 'startResetting');
    const endResetting = jest.spyOn(resetUtils, 'endResetting');
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);

    await service.resetApp();

    expect(prepareIdentityAuthForAppReset).toHaveBeenCalledTimes(1);
    expect(startResetting).toHaveBeenCalledTimes(1);
    expect(resetData).toHaveBeenCalledTimes(1);
    expect(endResetting).toHaveBeenCalledTimes(1);
    expect(restartApp).toHaveBeenCalledWith({
      mode: EAppRestartMode.All,
      reason: 'auth.resetData',
    });
  });
});
