import type { ICurrencyItem } from '@onekeyhq/kit/src/views/Setting/pages/Currency';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type ICurrencyPersistAtom = {
  currencyItems: ICurrencyItem[];
};
export const { target: currencyPersistAtom, use: useCurrencyPersistAtom } =
  globalAtom<ICurrencyPersistAtom>({
    persist: true,
    name: EAtomNames.currencyPersistAtom,
    initialValue: {
      currencyItems: [],
    },
  });
