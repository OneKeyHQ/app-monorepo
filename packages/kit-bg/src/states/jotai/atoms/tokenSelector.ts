import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type ITokenSelectorFilterPersistAtom = {
  sendTokenShowLpTokensOnly: boolean;
  homeShowLpTokensOnly: boolean;
  swapShowLpTokensOnly: boolean;
};

export const {
  target: tokenSelectorFilterPersistAtom,
  use: useTokenSelectorFilterPersistAtom,
} = globalAtom<ITokenSelectorFilterPersistAtom>({
  name: EAtomNames.tokenSelectorFilterPersistAtom,
  persist: true,
  initialValue: {
    sendTokenShowLpTokensOnly: false,
    homeShowLpTokensOnly: false,
    swapShowLpTokensOnly: false,
  },
});
