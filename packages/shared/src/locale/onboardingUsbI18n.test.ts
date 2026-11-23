import { ETranslations } from './enum/translations';
import enUS from './json/en_US.json';
import zhCN from './json/zh_CN.json';
import zhHK from './json/zh_HK.json';
import zhTW from './json/zh_TW.json';

describe('Android USB onboarding translations', () => {
  const requiredKeys = [
    ETranslations.onboarding_usb_connect_help_text,
    ETranslations.onboarding_usb_not_detected,
    ETranslations.onboarding_usb_permission_denied,
    ETranslations.onboarding_usb_permission_denied_help_text,
    ETranslations.onboarding_usb_prepare_to_connect,
    ETranslations.onboarding_usb_prepare_to_connect_help_text,
    ETranslations.onboarding_usb_try_bluetooth,
  ];

  it.each(requiredKeys)(
    'contains non-empty translations for %s in en_US and zh locales',
    (key) => {
      expect((enUS as Record<string, string>)[key]?.trim()).toBeTruthy();
      expect((zhCN as Record<string, string>)[key]?.trim()).toBeTruthy();
      expect((zhHK as Record<string, string>)[key]?.trim()).toBeTruthy();
      expect((zhTW as Record<string, string>)[key]?.trim()).toBeTruthy();
    },
  );
});
