export enum AddressEncodings {
  P2PKH = 'P2PKH', // Legacy BIP-44
  P2SH_P2WPKH = 'P2SH_P2WPKH', // BIP-49 P2WPKH nested in P2SH
  P2WPKH = 'P2WPKH', // BIP-84 P2WPKH
  // P2TR = "P2TR",  // BIP-86 P2TR
}

export type ChainInfo = {
  code: string;
  feeCode: string;
  impl: string;
  curve: 'secp256k1' | 'ed25519';
  implOptions: { [key: string]: any };
  clients: Array<{ name: string; args: Array<any> }>;
};
