/* eslint-disable @typescript-eslint/no-unsafe-return */
import { ITransferInfo } from '@onekeyhq/engine/src/vaults/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { IAdaOutputs, IAdaUTXO } from '../../types';

const ProvideMethod = 'callCardanoWebEmbedMethod';
enum CardanoEvent {
  composeTxPlan = 'Cardano_composeTxPlan',
  signTransaction = 'Cardano_signTransaction',
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

const CardanoApi = {
  composeTxPlan,
};

export { CardanoApi };
