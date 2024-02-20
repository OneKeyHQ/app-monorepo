import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IAddressBookPersistAtom = {
  updateTimestamp?: number;
};

export const {
  target: addressBookPersistAtom,
  use: useAddressBookPersistAtom,
} = globalAtom<IAddressBookPersistAtom>({
  persist: true,
  name: EAtomNames.addressBookPersistAtom,
  initialValue: {},
});
