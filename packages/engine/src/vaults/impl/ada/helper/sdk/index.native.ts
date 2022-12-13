/* eslint-disable @typescript-eslint/no-unsafe-return */
import { ITransferInfo } from '@onekeyhq/engine/src/vaults/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { IAdaOutputs, IAdaUTXO } from '../../types';

const ProvideMethod = 'callCardanoWebEmbedMethod';
enum CardanoEvent {
  composeTxPlan = 'Cardano_composeTxPlan',
  signTransaction = 'Cardano_signTransaction',
  hwSignTransaction = 'Cardano_hwSignTransaction',
}

type IResult = { error: any; result: any };

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

const getCardanoApi = async () =>
  Promise.resolve({
    composeTxPlan,
    signTransaction,
    hwSignTransaction,
  });

export { getCardanoApi };
