export enum AddressEncodings {
  P2PKH = 'P2PKH', // Legacy BIP-44 (Legacy)
  P2SH_P2WPKH = 'P2SH_P2WPKH', // BIP-49 P2WPKH nested in P2SH (Nested SegWit)
  P2WPKH = 'P2WPKH', // BIP-84 P2WPKH (Native SegWit)
  P2WSH = 'P2WSH', // BIP-84 P2WSH (Native SegWit with script, app not support yet)
  P2TR = 'P2TR', // BIP-86 P2TR (Taproot)
}

export enum EMessageTypesEth {
  ETH_SIGN = 0,
  PERSONAL_SIGN = 1,
  TYPED_DATA_V1 = 2,
  TYPED_DATA_V3 = 3,
  TYPED_DATA_V4 = 4,
}

export enum EMessageTypesAptos {
  SIGN_MESSAGE = 'aptosSignMessage',
}

export enum EMessageTypesCommon {
  SIGN_MESSAGE = 'commonSignMessage',
  SIMPLE_SIGN = 'commonSimpleSign',
}

export enum EMessageTypesAda {
  SIGN_MESSAGE = 'adaSignMessage',
}

export enum EMessageTypesBtc {
  ECDSA = 'ecdsa',
  BIP322_SIMPLE = 'bip322-simple',
}
