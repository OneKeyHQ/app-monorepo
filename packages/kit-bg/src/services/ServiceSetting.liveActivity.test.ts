import { settingsPersistAtom } from '../states/jotai/atoms';
import { jotaiDefaultStore } from '../states/jotai/utils/jotaiDefaultStore';

import ServiceSetting from './ServiceSetting';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');

it('does not block a language change on a stalled Live Activity bridge', async () => {
  const previousScope = globalThis.$onekeyIsInBackground;
  globalThis.$onekeyIsInBackground = true;
  jest.spyOn(settingsPersistAtom, 'get').mockResolvedValue({
    ...jotaiDefaultStore.get(settingsPersistAtom.atom()),
    locale: 'en-US',
  });
  jest.spyOn(settingsPersistAtom, 'set').mockResolvedValue(undefined);
  try {
    const refreshLanguage = jest.fn(() => new Promise<void>(() => {}));
    const resetPostConfig = jest.fn(async () => undefined);
    const service = Object.assign(
      Object.create(ServiceSetting.prototype) as InstanceType<
        typeof ServiceSetting
      >,
      {
        backgroundApi: {
          serviceLiveActivity: { refreshLanguage },
          serviceReferralCode: { resetPostConfig },
        },
      },
    );
    jest.spyOn(service, 'getCurrentLocale').mockResolvedValue('zh-CN');
    await service.setLocale('zh-CN');
    expect(refreshLanguage).toHaveBeenCalledTimes(1);
    expect(resetPostConfig).toHaveBeenCalledTimes(1);
  } finally {
    globalThis.$onekeyIsInBackground = previousScope;
    jest.restoreAllMocks();
  }
});
