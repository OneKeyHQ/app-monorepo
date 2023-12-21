import type * as moneroAddress from './moneroAddress';
import type { privateSpendKeyToWords } from './moneroWords';
import type { ISignedTx } from '../../../types';

type IHexString = string;

export type IMoneroApiWebembed = {
  getKeyPairFromRawPrivatekey: (params: {
    rawPrivateKey: IHexString;
    index?: number;
    isPrivateSpendKey?: boolean;
  }) => Promise<{
    privateSpendKey: IHexString;
    privateViewKey: IHexString;
    publicSpendKey: IHexString | null;
    publicViewKey: IHexString | null;
  }>;
  generateKeyImage: (params: {
    txPublicKey: string;
    privateViewKey: string;
    privateSpendKey: string;
    publicSpendKey: string;
    outputIndex: string;
    address: string;
  }) => Promise<string | undefined>;
  seedAndkeysFromMnemonic: (params: {
    mnemonic: string;
    netType: string;
  }) => Promise<{
    err_msg?: string | undefined;
    seed: string;
    address: string;
    publicViewKey: string;
    publicSpendKey: string;
    privateViewKey: string;
    privateSpendKey: string;
  }>;
  decodeAddress: (params: {
    address: string;
    netType: string;
  }) => Promise<{ err_msg?: string }>; // TODO decodeAddress response type
  estimatedTxFee: (params: {
    priority: string;
    feePerByte: string;
  }) => Promise<string | undefined>;
  sendFunds: (args: any, scanUrl: string) => Promise<ISignedTx>;
};

export type IMoneroApi = IMoneroApiWebembed & {
  privateSpendKeyToWords: typeof privateSpendKeyToWords;
  pubKeysToAddress: typeof moneroAddress.pubKeysToAddress;
};
