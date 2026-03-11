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
export type IAccountSelectorValueMapAtom = Record<
  string,
  Record<string, IAccountSelectorValueItem>
>;

export type IAccountSelectorDeFiMapAtom = Record<
  string,
  Record<string, IAccountSelectorDeFiItem>
>;

export const {
  target: accountSelectorValuesMapAtom,
  use: useAccountSelectorValuesMapAtom,
} = globalAtom<IAccountSelectorValueMapAtom>({
  name: EAtomNames.accountSelectorValuesMapAtom,
  initialValue: {},
});

export const {
  target: accountSelectorDeFiMapAtom,
  use: useAccountSelectorDeFiMapAtom,
} = globalAtom<IAccountSelectorDeFiMapAtom>({
  name: EAtomNames.accountSelectorDeFiMapAtom,
  initialValue: {},
});
