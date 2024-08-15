import type TonWeb from 'tonweb';

export interface ISlice {
  loadUint(n: number): typeof TonWeb.utils.BN;
  loadCoins(): typeof TonWeb.utils.BN;
  loadAddress(): typeof TonWeb.Address;
  loadBit(): boolean;
  loadBits(bitLength: number): Uint8Array;
  loadRef(): ISlice;
  getFreeBits(): number;
}

export type ICell = typeof TonWeb.boc.Cell & {
  beginParse(): ISlice;
};

export type IAddressToString = (
  isUserFriendly?: boolean,
  isUrlSafe?: boolean,
  isBounceable?: boolean,
  isTestOnly?: boolean,
) => string;
