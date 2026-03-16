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

export type IAccountSelectorValuesMap = Partial<
  Record<number, Record<string, IAccountSelectorValueItem>>
>;
export type IAccountSelectorDeFiMap = Partial<
  Record<number, Record<string, IAccountSelectorDeFiItem>>
>;

// Outer key is selector instance `num`, inner key is accountId.
// Use plain objects here because extension BG<->UI bridge only accepts
// JSON-serializable payloads.
export const {
  target: accountSelectorValuesMapAtom,
  use: useAccountSelectorValuesMapAtom,
} = globalAtom<IAccountSelectorValuesMap>({
  name: EAtomNames.accountSelectorValuesMapAtom,
  initialValue: {},
});

export const {
  target: accountSelectorDeFiMapAtom,
  use: useAccountSelectorDeFiMapAtom,
} = globalAtom<IAccountSelectorDeFiMap>({
  name: EAtomNames.accountSelectorDeFiMapAtom,
  initialValue: {},
});
