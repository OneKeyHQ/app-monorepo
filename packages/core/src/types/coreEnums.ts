export enum EAddressEncodings {
  P2PKH = 'P2PKH', // Legacy BIP-44 (Legacy)
  P2SH_P2WPKH = 'P2SH_P2WPKH', // BIP-49 P2WPKH nested in P2SH (Nested SegWit)
  P2WPKH = 'P2WPKH', // BIP-84 P2WPKH (Native SegWit)
  P2WSH = 'P2WSH', // BIP-84 P2WSH (Native SegWit with script, app not support yet)
  P2TR = 'P2TR', // BIP-86 P2TR (Taproot)

  ENCODED_PUBKEY = 'ENCODED_PUBKEY', // Encoded public key
  REGISTER_ACCOUNT = 'REGISTER_ACCOUNT', // Near account
  IMPLICIT_ACCOUNT = 'IMPLICIT_ACCOUNT', // Near account

  ALPH_P2PKH = 'P2PKH',
  ALPH_P2MPKH = 'P2MPKH',
  ALPH_P2SH = 'P2SH',
  ALPH_P2C = 'P2C',

  TON_V4R2 = 'v4R2',
}
// export enum AddressEncodings = EAddressEncodings
