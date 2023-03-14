/* eslint-disable @typescript-eslint/no-unsafe-return */
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import * as moneroAddress from './moneroAddress';
import { privateSpendKeyToWords } from './moneroWords';

import type { SignedTx } from '../../../../types/provider';
import type { MoneroKeys } from '../types';

const ProvideMethod = 'callMoneroWebEmbedMethod';
enum MoneroEvent {
  getKeyPairFromRawPrivatekey = 'Monero_getKeyPairFromRawPrivatekey',
  generateKeyImage = 'Monero_generateKeyImage',
  decodeAddress = 'Monero_decodeAddress',
  estimatedTxFee = 'Monero_estimatedTxFee',
  sendFunds = 'Monero_sendFunds',
}

type IResult = { error: any; result: any };
/**
 * ensure web-embed is created successfully
 */
const ensureSDKReady = async () =>
  new Promise((resolve) => {
    appUIEventBus.emit(
      AppUIEventBusNames.EnsureChainWebEmbed,
      () => {
        debugLogger.common.debug('ensure web embed exist resolve callback');
        resolve(true);
      },
      OnekeyNetwork.xmr,
    );
  });

const getKeyPairFromRawPrivatekey = async (params: {
  rawPrivateKey: Buffer;
  index?: number;
}) => {
  await ensureSDKReady();
  debugLogger.common.debug('ensure web embed exist');
  const result = (await backgroundApiProxy.serviceDapp.sendWebEmbedMessage({
    method: ProvideMethod,
    event: MoneroEvent.getKeyPairFromRawPrivatekey,
    params: {
      rawPrivateKey: params.rawPrivateKey.toString('hex'),
      index: params.index,
    },
  })) as IResult;

  if (result.error) {
    debugLogger.providerApi.error(
      'moenro web-embed getKeyPairFromRawPrivatekey error: ',
      result.error,
    );
    throw new Error(result.error);
  }
  debugLogger.providerApi.info(
    'monero web-embed getKeyPairFromRawPrivatekey success: ',
    result.result,
  );

  const keys: MoneroKeys = result.result;

  return {
    privateSpendKey: Buffer.from(keys.privateSpendKey, 'hex'),
    privateViewKey: Buffer.from(keys.privateViewKey, 'hex'),
    publicSpendKey: Buffer.from(keys.publicSpendKey || '', 'hex'),
    publicViewKey: Buffer.from(keys.publicViewKey || '', 'hex'),
  };
};

const generateKeyImage = async (params: {
  txPublicKey: string;
  privateViewKey: string;
  privateSpendKey: string;
  publicSpendKey: string;
  outputIndex: string;
  address: string;
}) => {
  await ensureSDKReady();
  debugLogger.common.debug('ensure web embed exist');
  const result = (await backgroundApiProxy.serviceDapp.sendWebEmbedMessage({
    method: ProvideMethod,
    event: MoneroEvent.generateKeyImage,
    params,
  })) as IResult;

  if (result.error) {
    debugLogger.providerApi.error(
      'moenro web-embed generateKeyImage error: ',
      result.error,
    );
    throw new Error(result.error);
  }
  debugLogger.providerApi.info(
    'monero web-embed generateKeyImage success: ',
    result.result,
  );
  return result.result;
};

const decodeAddress = async (params: { address: string; netType: string }) => {
  await ensureSDKReady();
  debugLogger.common.debug('ensure web embed exist');
  const result = (await backgroundApiProxy.serviceDapp.sendWebEmbedMessage({
    method: ProvideMethod,
    event: MoneroEvent.decodeAddress,
    params,
  })) as IResult;

  if (result.error) {
    debugLogger.providerApi.error(
      'moenro web-embed decodeAddress error: ',
      result.error,
    );
    throw new Error(result.error);
  }
  debugLogger.providerApi.info(
    'monero web-embed decodeAddress success: ',
    result.result,
  );
  return result.result;
};

const estimatedTxFee = async (params: {
  priority: string;
  feePerByte: string;
}) => {
  await ensureSDKReady();
  debugLogger.common.debug('ensure web embed exist');
  const result = (await backgroundApiProxy.serviceDapp.sendWebEmbedMessage({
    method: ProvideMethod,
    event: MoneroEvent.estimatedTxFee,
    params,
  })) as IResult;

  if (result.error) {
    debugLogger.providerApi.error(
      'moenro web-embed estimatedTxFee error: ',
      result.error,
    );
    throw new Error(result.error);
  }
  debugLogger.providerApi.info(
    'monero web-embed estimatedTxFee success: ',
    result.result,
  );
  return result.result;
};

const sendFunds = async (args: any, scanUrl: string): Promise<SignedTx> => {
  await ensureSDKReady();
  debugLogger.common.debug('ensure web embed exist');
  const result = (await backgroundApiProxy.serviceDapp.sendWebEmbedMessage({
    method: ProvideMethod,
    event: MoneroEvent.sendFunds,
    params: {
      args,
      scanUrl,
    },
  })) as IResult;

  if (result.error) {
    debugLogger.providerApi.error(
      'moenro web-embed sendFunds error: ',
      result.error,
    );
    throw new Error(result.error);
  }
  debugLogger.providerApi.info(
    'monero web-embed sendFunds success: ',
    result.result,
  );
  return result.result;
};
const getMoneroApi = async () =>
  Promise.resolve({
    getKeyPairFromRawPrivatekey,
    privateSpendKeyToWords,
    pubKeysToAddress: moneroAddress.pubKeysToAddress,
    generateKeyImage,
    decodeAddress,
    estimatedTxFee,
    sendFunds,
  });

export { getMoneroApi, ensureSDKReady };
