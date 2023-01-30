/* eslint-disable @typescript-eslint/no-unsafe-return */
import type { ITransferInfo } from '@onekeyhq/engine/src/vaults/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import type { IAdaOutputs, IAdaUTXO, IChangeAddress } from '../../types';
import type BigNumber from 'bignumber.js';

const ProvideMethod = 'callCardanoWebEmbedMethod';
enum CardanoEvent {
  composeTxPlan = 'Cardano_composeTxPlan',
  signTransaction = 'Cardano_signTransaction',
  hwSignTransaction = 'Cardano_hwSignTransaction',
  dAppGetBalance = 'Cardano_DAppGetBalance',
  dAppGetAddresses = 'Cardano_DAppGetAddresses',
  dAppGetUtxos = 'Cardano_DAppGetUtxos',
  dAppConvertCborTxToEncodeTx = 'Cardano_DAppConvertCborTxToEncodeTx',
  dAppSignData = 'Cardano_DAppSignData',
}

type IResult = { error: any; result: any };

/**
 * ensure web-embed is created successfully
 */
const ensureSDKReady = async () =>
  new Promise((resolve) => {
    appUIEventBus.emit(AppUIEventBusNames.EnsureChainWebEmbed, () => {
      debugLogger.common.debug('ensure web embed exist resolve callback');
      resolve(true);
    });
  });

const composeTxPlan = async (
  transferInfo: ITransferInfo,
  xpub: string,
  utxos: IAdaUTXO[],
  changeAddress: string,
  outputs: IAdaOutputs[],
) => {
  await ensureSDKReady();
  debugLogger.common.debug('ensure web embed exist');
  const result = (await backgroundApiProxy.serviceDapp.sendWebEmbedMessage({
    method: ProvideMethod,
    event: CardanoEvent.composeTxPlan,
    params: {
      transferInfo,
      xpub,
      utxos,
      changeAddress,
      outputs,
    },
  })) as IResult;

  if (result.error) {
    debugLogger.providerApi.error(
      'cardano web-embed composeTxPlan error: ',
      result.error,
    );
    throw new Error(result.error);
  }
  debugLogger.providerApi.error(
    'cardano web-embed composeTxPlan success: ',
    result.result,
  );
  return result.result;
};

const signTransaction = async (
  txBodyHex: string,
  address: string,
  accountIndex: number,
  utxos: IAdaUTXO[],
  xprv: string,
  partialSign?: boolean,
) => {
  const result = (await backgroundApiProxy.serviceDapp.sendWebEmbedMessage({
    method: ProvideMethod,
    event: CardanoEvent.signTransaction,
    params: {
      txBodyHex,
      address,
      accountIndex,
      utxos,
      xprv,
      partialSign,
    },
  })) as IResult;

  if (result.error) {
    debugLogger.providerApi.error(
      'cardano web-embed signTransaction error: ',
      result.error,
    );
    throw new Error(result.error);
  }
  debugLogger.providerApi.error(
    'cardano web-embed signTransaction success: ',
    result.result,
  );
  return result.result;
};

enum CardanoTxWitnessType {
  BYRON_WITNESS = 0,
  SHELLEY_WITNESS = 1,
}

type CardanoSignedTxWitness = {
  type: CardanoTxWitnessType;
  pubKey: string;
  signature: string;
  chainCode?: string | null;
};

const hwSignTransaction = async (
  txBodyHex: string,
  signedWitnesses: CardanoSignedTxWitness[],
  options: Record<string, any>,
) => {
  const result = (await backgroundApiProxy.serviceDapp.sendWebEmbedMessage({
    method: ProvideMethod,
    event: CardanoEvent.hwSignTransaction,
    params: {
      txBodyHex,
      signedWitnesses,
      options,
    },
  })) as IResult;

  if (result.error) {
    debugLogger.providerApi.error(
      'cardano web-embed CardanoSignedTxWitness error: ',
      result.error,
    );
    throw new Error(result.error);
  }
  debugLogger.providerApi.error(
    'cardano web-embed hwSignTransaction success: ',
    result.result,
  );
  return result.result;
};

// DApp Function
const getBalance = async (balance: BigNumber) => {
  await ensureSDKReady();
  debugLogger.common.debug('ensure web embed exist');
  const result = (await backgroundApiProxy.serviceDapp.sendWebEmbedMessage({
    method: ProvideMethod,
    event: CardanoEvent.dAppGetBalance,
    params: { balance: balance.toFixed() },
  })) as IResult;

  if (result.error) {
    throw result.error;
  }
  return result.result;
};

const getUtxos = async (
  address: string,
  utxos: IAdaUTXO[],
  amount?: string | undefined,
) => {
  await ensureSDKReady();
  debugLogger.common.debug('ensure web embed exist');
  const result = (await backgroundApiProxy.serviceDapp.sendWebEmbedMessage({
    method: ProvideMethod,
    event: CardanoEvent.dAppGetUtxos,
    params: {
      address,
      utxos,
      amount,
    },
  })) as IResult;

  if (result.error) {
    throw result.error;
  }
  return result.result;
};

const getAddresses = async (addresses: string[]) => {
  await ensureSDKReady();
  debugLogger.common.debug('ensure web embed exist');
  const result = (await backgroundApiProxy.serviceDapp.sendWebEmbedMessage({
    method: ProvideMethod,
    event: CardanoEvent.dAppGetAddresses,
    params: { addresses },
  })) as IResult;

  if (result.error) {
    throw result.error;
  }
  return result.result;
};

const convertCborTxToEncodeTx = async (
  txHex: string,
  utxos: IAdaUTXO[],
  addresses: string[],
  changeAddress: IChangeAddress,
) => {
  await ensureSDKReady();
  debugLogger.common.debug('ensure web embed exist');
  const result = (await backgroundApiProxy.serviceDapp.sendWebEmbedMessage({
    method: ProvideMethod,
    event: CardanoEvent.dAppConvertCborTxToEncodeTx,
    params: { txHex, utxos, addresses, changeAddress },
  })) as IResult;

  if (result.error) {
    throw result.error;
  }
  return result.result;
};

const signData = async (
  address: string,
  payload: string,
  xprv: string,
  accountIndex: number,
) => {
  await ensureSDKReady();
  debugLogger.common.debug('ensure web embed exist');
  const result = (await backgroundApiProxy.serviceDapp.sendWebEmbedMessage({
    method: ProvideMethod,
    event: CardanoEvent.dAppSignData,
    params: { address, payload, xprv, accountIndex },
  })) as IResult;

  if (result.error) {
    throw result.error;
  }
  return result.result;
};

const dAppUtils = {
  getBalance,
  getAddresses,
  getUtxos,
  convertCborTxToEncodeTx,
  signData,
};

const getCardanoApi = async () =>
  Promise.resolve({
    composeTxPlan,
    signTransaction,
    hwSignTransaction,
    dAppUtils,
  });

export { getCardanoApi, ensureSDKReady };
