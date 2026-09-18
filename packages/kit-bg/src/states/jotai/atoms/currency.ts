import type { ICurrencyItem } from '@onekeyhq/shared/types';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type ICurrencyPersistAtom = {
  currencyMap: Record<string, ICurrencyItem>;
};
export const currencyPersistAtomInitialValue: ICurrencyPersistAtom = {
  currencyMap: {},
};
export const { target: currencyPersistAtom, use: useCurrencyPersistAtom } =
  globalAtom<ICurrencyPersistAtom>({
    persist: true,
    name: EAtomNames.currencyPersistAtom,
    initialValue: currencyPersistAtomInitialValue,
  });
