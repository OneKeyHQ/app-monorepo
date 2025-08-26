export enum EMessageTypesEth {
  ETH_SIGN = 'ETH_SIGN', // 0
  PERSONAL_SIGN = 'PERSONAL_SIGN', // 1
  TYPED_DATA_V1 = 'TYPED_DATA_V1', // 2
  TYPED_DATA_V3 = 'TYPED_DATA_V3', // 3
  TYPED_DATA_V4 = 'TYPED_DATA_V4', // 4
}

export enum ESigningScheme {
  EIP712 = 'eip712',
  ETHSIGN = 'ethsign',
}

export enum EMessageTypesAptos {
  SIGN_MESSAGE = 'aptosSignMessage',
  SIGN_IN = 'aptosSignIn',
}

export enum EMessageTypesCommon {
  SIGN_MESSAGE = 'commonSignMessage',
  SIMPLE_SIGN = 'commonSimpleSign',
  HEX_MESSAGE = 'commonHexMessage',
}

export enum EMessageTypesSolana {
  SIGN_OFFCHAIN_MESSAGE = 'solanaSignOffchainMessage',
}

export enum EMessageTypesAda {
  SIGN_MESSAGE = 'adaSignMessage',
}

export enum EMessageTypesBtc {
  ECDSA = 'ecdsa',
  BIP322_SIMPLE = 'bip322-simple',
}

export enum EMessageTypesTon {
  SIGN_DATA = 'tonSignData',
  SIGN_PROOF = 'tonSignProof',
}

export enum EMessageTypesAlph {
  ALEPHIUM = 'alephium',
  SHA256 = 'sha256',
  BLAKE2B = 'blake2b',
  IDENTITY = 'identity',
}

export enum EMessageTypesTron {
  SIGN_MESSAGE = 'tronSignMessage',
  SIGN_MESSAGE_V2 = 'tronSignMessageV2',
}
