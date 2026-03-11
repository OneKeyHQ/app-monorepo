import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IAccountSelectorValueItem = {
  accountId: string;
  value: Record<string, string> | string | undefined;
  currency: string | undefined;
};

export type IAccountSelectorDeFiItem =
  | {
      overview: Record<
        string,
        {
          totalValue: number;
          totalDebt: number;
          totalReward: number;
          netWorth: number;
          currency: string;
        }
      >;
    }
  | undefined;

// Outer key is selector instance `num`, inner key is accountId.
// This scoping prevents concurrent selectors from overwriting each other.
export const {
  target: accountSelectorValuesMapAtom,
  use: useAccountSelectorValuesMapAtom,
} = globalAtom<Map<number, Map<string, IAccountSelectorValueItem>>>({
  name: EAtomNames.accountSelectorValuesMapAtom,
  initialValue: new Map(),
});

export const {
  target: accountSelectorDeFiMapAtom,
  use: useAccountSelectorDeFiMapAtom,
} = globalAtom<Map<number, Map<string, IAccountSelectorDeFiItem>>>({
  name: EAtomNames.accountSelectorDeFiMapAtom,
  initialValue: new Map(),
});
