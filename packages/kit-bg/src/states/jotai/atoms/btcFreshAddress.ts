import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

type IBTCFreshAddressAtom = {
  lastUpdateTime: Record<string, number>; // networkId__xpub : timestamp
};

export const {
  target: btcFreshAddressLastUpdateAtom,
  use: useBtcFreshAddressLastUpdateAtom,
} = globalAtom<IBTCFreshAddressAtom>({
  persist: true,
  name: EAtomNames.btcFreshAddressLastUpdateAtom,
  initialValue: {
    lastUpdateTime: {},
  },
});

type IBTCFreshAddressTxCountAtom = {
  txCount: Record<string, number>; // networkId__xpub : txCount
};

export const {
  target: btcFreshAddressTxCountAtom,
  use: useBtcFreshAddressTxCountAtom,
} = globalAtom<IBTCFreshAddressTxCountAtom>({
  persist: true,
  name: EAtomNames.btcFreshAddressTxCountAtom,
  initialValue: {
    txCount: {},
  },
});
