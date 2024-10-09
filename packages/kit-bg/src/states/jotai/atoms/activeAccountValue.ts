import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IAccountValueAtom =
  | {
      accountId: string;
      value: Record<string, string> | string;
      currency: string;
    }
  | undefined;

export const {
  target: activeAccountValueAtom,
  use: useActiveAccountValueAtom,
} = globalAtom<IAccountValueAtom>({
  name: EAtomNames.activeAccountValueAtom,
  initialValue: undefined,
});
