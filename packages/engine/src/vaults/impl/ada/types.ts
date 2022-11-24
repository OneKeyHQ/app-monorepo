export type BIP32Path = number[];

export const enum NetworkId {
  MAINNET = 1,
  TESTNET_OR_PREPROD = 0,
}

export type Address = string & { __typeAddress: any };
