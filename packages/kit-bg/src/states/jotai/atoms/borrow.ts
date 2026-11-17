import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export interface IBorrowSelectedMarketAtom {
  /**
   * The market the user last picked, as the `provider:networkId:marketAddress`
   * key built in the UI layer. The key rather than the market object: that
   * object carries server-owned figures which would be stale by the time this
   * is read back.
   */
  marketKey: string;
}

export const {
  target: borrowSelectedMarketAtom,
  use: useBorrowSelectedMarketAtom,
} = globalAtom<IBorrowSelectedMarketAtom>({
  persist: true,
  name: EAtomNames.borrowSelectedMarketAtom,
  initialValue: { marketKey: '' },
});
