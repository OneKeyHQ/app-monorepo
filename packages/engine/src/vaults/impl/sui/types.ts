import { ObjectId, SignableTransaction, SuiMoveObject } from '@mysten/sui.js';

export type IEncodedTxSUI = SignableTransaction;

export type CoinObject = {
  objectId: string;
  symbol: string;
  balance: bigint;
  object: SuiMoveObject;
};

export type NftObject = {
  objectId: string;
  name: string;
  description: string;
  url: string;
  previousTransaction?: string;
  objectType: string;
  fields: Record<string, any>;
  hasPublicTransfer: boolean;
};

export type CoinMetadata = {
  decimals: number;
  name: string;
  symbol: string;
  description: string;
  iconUrl: string | null;
  id: ObjectId | null;
};
