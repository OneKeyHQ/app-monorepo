import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IOsEndOfSupportNoticePersistAtom = {
  // Notice id -> timestamp (ms) of the last time the user closed it.
  dismissedAt: Record<string, number>;
};

export const osEndOfSupportNoticeAtomInitialValue: IOsEndOfSupportNoticePersistAtom =
  {
    dismissedAt: {},
  };

export const {
  target: osEndOfSupportNoticePersistAtom,
  use: useOsEndOfSupportNoticePersistAtom,
} = globalAtom<IOsEndOfSupportNoticePersistAtom>({
  persist: true,
  name: EAtomNames.osEndOfSupportNoticePersistAtom,
  initialValue: osEndOfSupportNoticeAtomInitialValue,
});
