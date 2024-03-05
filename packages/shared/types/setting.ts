export type IBitcoinAccountDerivationType =
  | 'Taproot'
  | 'Nested SegWit'
  | 'Native SegWit'
  | 'Legacy';

export type IEvmAccountDerivationType = 'BIP44' | 'Ledger Live';

export type ISolanaAccountDerivationType = 'BIP44' | 'Ledger Live';

export type ILtcAccountDerivationType =
  | 'Nested SegWit'
  | 'Native SegWit'
  | 'Legacy';

export type IEthereumClassicAccountDerivation =
  | 'BIP44'
  | "BIP44(CoinType 61')"
  | 'Ledger Live';
