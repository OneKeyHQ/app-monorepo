import { EAccountSelectorSceneName } from '../../types';

export const ACCOUNT_SELECTOR_CONSTS = {
  NO_PERSIST: [
    EAccountSelectorSceneName.discover,
    EAccountSelectorSceneName.addressInput,
  ],
  NO_AUTO_SELECT: [EAccountSelectorSceneName.addressInput],
  NO_GLOBAL_DERIVE_TYPE: [EAccountSelectorSceneName.discover],
};
