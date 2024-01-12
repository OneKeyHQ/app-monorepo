import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IAddressBookPersistAtom = {
  encoded?: string;
};

export const {
  target: addressBookPersistAtom,
  use: useAddressBookPersistAtom,
} = globalAtom<IAddressBookPersistAtom>({
  persist: true,
  name: EAtomNames.addressBookPersistAtom,
  initialValue: {},
});
