import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export const {
  target: allNetworksPersistAtom,
  use: useAllNetworksPersistAtom,
} = globalAtom<{
  showEnabledNetworksOnlyInCopyAddressPanel: boolean;
}>({
  persist: true,
  name: EAtomNames.allNetworksPersistAtom,
  initialValue: {
    showEnabledNetworksOnlyInCopyAddressPanel: false,
  },
});
