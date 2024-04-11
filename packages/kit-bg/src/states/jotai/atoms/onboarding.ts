import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export const {
  target: onboardingConnectWalletLoadingAtom,
  use: useOnboardingConnectWalletLoadingAtom,
} = globalAtom<boolean>({
  name: EAtomNames.onboardingConnectWalletLoadingAtom,
  initialValue: false,
});
