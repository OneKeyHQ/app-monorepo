import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IReceiveAddressForm = 'public' | 'private';

export const {
  target: receivePreferencesPersistAtom,
  use: useReceivePreferencesPersistAtom,
} = globalAtom<{
  addressForms: Record<string, IReceiveAddressForm>;
}>({
  name: EAtomNames.receivePreferencesPersistAtom,
  persist: true,
  initialValue: { addressForms: {} },
});
