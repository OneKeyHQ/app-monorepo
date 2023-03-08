/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
import { memo, useCallback, useEffect } from 'react';

import { Box } from '@onekeyhq/components';
import { getMoneroCoreInstance } from '@onekeyhq/engine/src/vaults/impl/xmr/sdk/moneroCore/instance';
import { getMoneroUtilInstance } from '@onekeyhq/engine/src/vaults/impl/xmr/sdk/moneroUtil/instance';

import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

const getMoneroInstance = async () => {
  const moneroUtilInstance = await getMoneroUtilInstance();
  const moneroCoreInstance = await getMoneroCoreInstance();
  return {
    moneroUtilInstance,
    moneroCoreInstance,
  };
};

const ProvideResponseMethod = 'cardanoWebEmbedResponse';

enum CardanoEvent {
  composeTxPlan = 'Cardano_composeTxPlan',
  signTransaction = 'Cardano_signTransaction',
  hwSignTransaction = 'Cardano_hwSignTransaction',
  txToOneKey = 'Cardano_txToOneKey',
  dAppGetBalance = 'Cardano_DAppGetBalance',
  dAppGetAddresses = 'Cardano_DAppGetAddresses',
  dAppGetUtxos = 'Cardano_DAppGetUtxos',
  dAppConvertCborTxToEncodeTx = 'Cardano_DAppConvertCborTxToEncodeTx',
  dAppSignData = 'Cardano_DAppSignData',
}

function CardanoProvider() {
  const sendResponse = useCallback((promiseId: number, result: any) => {
    window.$onekey.$private.request({
      method: ProvideResponseMethod,
      promiseId,
      data: result,
    });
  }, []);

  const handler = useCallback(
    async (payload: IJsonRpcRequest) => {
      console.log('CardanoProvider Recive Message: ', payload);
      console.log('params: ', JSON.stringify(payload.params));
      const { method, params } = payload;

      if (method !== 'callCardanoWebEmbedMethod') {
        return;
      }

      const { params: eventParams, promiseId, event } = params as any;

      const { moneroCoreInstance, moneroUtilInstance } =
        await getMoneroInstance();
      switch (event) {
        case CardanoEvent.composeTxPlan: {
          console.log('Cardano_composeTxPlan');
          const { transferInfo, xpub, utxos, changeAddress, outputs } =
            eventParams;
          try {
            sendResponse(promiseId, { error: null, result: {} });
          } catch (error: any) {
            sendResponse(promiseId, {
              error: error?.code || error,
              result: null,
            });
          }
          break;
        }

        default:
          break;
      }
    },
    [sendResponse],
  );

  useEffect(() => {
    if (!window.$onekey) {
      return;
    }
    window.$onekey.$private.on('message_low_level', handler);
    return () => {
      window.$onekey.$private.off('message_low_level', handler);
    };
  }, [handler]);

  return <Box />;
}

export default memo(CardanoProvider);
