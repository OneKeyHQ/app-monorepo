import { locale as LocalizationLocale } from '@onekeyhq/shared/src/modules3rdParty/localization';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ISystemLocaleMethods } from './type';

let systemLocale: string | undefined;

const methods: ISystemLocaleMethods = {
  getSystemLocale: () => {
    if (!platformEnv.isExtensionBackground) {
      return LocalizationLocale;
    }
    return systemLocale ?? LocalizationLocale;
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  initSystemLocale: () =>
    new Promise<void>((resolve) => {
      try {
        if (
          platformEnv.isExtChrome &&
          platformEnv.isExtensionBackground &&
          chrome?.i18n?.getAcceptLanguages &&
          typeof chrome.i18n.getAcceptLanguages === 'function'
        ) {
          chrome.i18n.getAcceptLanguages((languages) => {
            if (languages && languages.length > 0) {
              systemLocale = languages[0];
            }
            resolve();
          });
        } else {
          resolve();
        }
      } catch (error) {
        resolve();
      }
    }),
};

export default methods;
