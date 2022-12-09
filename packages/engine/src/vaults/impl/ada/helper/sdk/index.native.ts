/* eslint-disable @typescript-eslint/no-unsafe-return */
import BigNumber from 'bignumber.js';

import { ITransferInfo } from '@onekeyhq/engine/src/vaults/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { IAdaOutputs, IAdaUTXO } from '../../types';

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

type IResult = { error: Error; result: any };

const composeTxPlan = async (
  transferInfo: ITransferInfo,
  xpub: string,
  utxos: IAdaUTXO[],
  changeAddress: string,
  outputs: IAdaOutputs[],
) => {
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
    throw result.error;
  }
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
    throw result.error;
  }
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
) => {
  const result = (await backgroundApiProxy.serviceDapp.sendWebEmbedMessage({
    method: ProvideMethod,
    event: CardanoEvent.hwSignTransaction,
    params: {
      txBodyHex,
      signedWitnesses,
    },
  })) as IResult;

  if (result.error) {
    throw result.error;
  }
  return result.result;
};

const CardanoApi = {
  composeTxPlan,
  signTransaction,
  hwSignTransaction,
};

// DApp Function
const getBalance = async (balance: BigNumber) => {
  const result = (await backgroundApiProxy.serviceDapp.sendWebEmbedMessage({
    method: ProvideMethod,
    event: CardanoEvent.dAppGetBalance,
    params: { balance },
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
) => {
  const result = (await backgroundApiProxy.serviceDapp.sendWebEmbedMessage({
    method: ProvideMethod,
    event: CardanoEvent.dAppConvertCborTxToEncodeTx,
    params: { txHex, utxos, addresses },
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

export { CardanoApi, dAppUtils };
