/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-bitwise */

import { Helper } from './helper';
import * as moneroAddress from './moneroAddress';
import { getMoneroCoreInstance } from './moneroCore/instance';
import { getMoneroUtilInstance } from './moneroUtil/instance';
import { privateSpendKeyToWords } from './moneroWords';

import type { SignedTx } from '../../../../types/provider';

const getMoneroApi = async () => {
  const moneroCoreInstance = await getMoneroCoreInstance();
  const moneroUtilInstance = await getMoneroUtilInstance();

  const helper = new Helper(moneroUtilInstance, moneroCoreInstance);

  const getKeyPairFromRawPrivatekey = async (params: {
    rawPrivateKey: Buffer | string;
    index?: number;
    isPrivateSpendKey?: boolean;
  }) => {
    const keys = helper.getKeyPairFromRawPrivatekey(params);

    return Promise.resolve(keys);
  };

  const generateKeyImage = async (params: {
    txPublicKey: string;
    privateViewKey: string;
    privateSpendKey: string;
    publicSpendKey: string;
    outputIndex: string;
    address: string;
  }) => {
    const keyImage = helper.generateKeyImage(params);

    return Promise.resolve(keyImage);
  };

  const decodeAddress = async (params: {
    address: string;
    netType: string;
  }) => {
    const result = helper.decodeAddress(params);
    return Promise.resolve(result);
  };

  const estimatedTxFee = async (params: {
    priority: string;
    feePerByte: string;
  }) => {
    const fee = helper.estimatedTxFee(params);
    return Promise.resolve(fee);
  };

  const sendFunds = async (args: any, scanUrl: string): Promise<SignedTx> => {
    const signedTx = await helper.sendFunds(args, scanUrl);
    return signedTx;
  };

  const seedAndkeysFromMnemonic = async (params: {
    mnemonic: string;
    netType: string;
  }) => {
    const seedAndKeys = helper.seedAndkeysFromMnemonic(params);
    return Promise.resolve(seedAndKeys);
  };

  return {
    getKeyPairFromRawPrivatekey,
    privateSpendKeyToWords,
    pubKeysToAddress: moneroAddress.pubKeysToAddress,
    generateKeyImage,
    decodeAddress,
    estimatedTxFee,
    sendFunds,
    seedAndkeysFromMnemonic,
  };
};

/**
 * Web SDK is always successful
 */
const ensureSDKReady = async () => Promise.resolve(true);

export { getMoneroApi, ensureSDKReady };
