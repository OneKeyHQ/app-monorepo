export interface SubstrateCompatAddress {
  getValue(): string;
  compare(other: SubstrateAccountId<this>): number;
  getBufferBytes(): Buffer;
  getHexBytes(): string;
}

export type SubstrateAccountId<T extends SubstrateCompatAddress> = string | T;
