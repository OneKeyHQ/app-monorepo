import type { IBtcUTXO } from '../vaults/utils/btcForkChain/types';

export type CoinControlItem = CoinControlBase & CoinControlOption;

export type CoinControlBase = {
  id: string; // networkId_key
  networkId: string;
  xpub: string;
  key: string; // txid_vout
};

export type CoinControlOption = {
  label: string;
  frozen: boolean;
};

export type ICoinControlListItem = IBtcUTXO & {
  height: number;
  dustSeparator?: boolean;
  hideFrozenOption?: boolean;
} & Partial<CoinControlOption>;
