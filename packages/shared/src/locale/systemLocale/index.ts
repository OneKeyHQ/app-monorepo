import { locale as LocalizationLocale } from '@onekeyhq/shared/src/modules3rdParty/localization';

import type { ISystemLocaleMethods } from './type';

const methods: ISystemLocaleMethods = {
  getSystemLocale: () => LocalizationLocale,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  initSystemLocale: async () => {},
};

export default methods;
