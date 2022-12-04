/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
import React, { useCallback, useEffect } from 'react';

import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import { onekeyUtils, trezorUtils } from 'cardano-coin-selection';

import { Box } from '@onekeyhq/components';

const ProvideResponseMethod = 'cardanoWebEmbedResponse';

enum CardanoEvent {
  composeTxPlan = 'Cardano_composeTxPlan',
  signTransaction = 'Cardano_signTransaction',
  hwSignTransaction = 'Cardano_hwSignTransaction',
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

      switch (event) {
        case CardanoEvent.composeTxPlan: {
          console.log('Cardano_composeTxPlan');
          const { transferInfo, xpub, utxos, changeAddress, outputs } =
            eventParams;
          try {
            const txPlan = onekeyUtils.composeTxPlan(
              transferInfo,
              xpub,
              utxos,
              changeAddress,
              outputs,
            );
            sendResponse(promiseId, { error: null, result: txPlan });
          } catch (error) {
            sendResponse(promiseId, { error, result: null });
          }
          break;
        }

        case CardanoEvent.signTransaction: {
          console.log('Cardano_signTransaction');
          const { txBodyHex, address, accountIndex, utxos, xprv, partialSign } =
            eventParams;
          try {
            const result = await onekeyUtils.signTransaction(
              txBodyHex,
              address,
              accountIndex,
              utxos,
              xprv,
              partialSign,
            );
            sendResponse(promiseId, { error: null, result });
          } catch (error) {
            sendResponse(promiseId, { error, result: null });
          }
          break;
        }

        case CardanoEvent.hwSignTransaction: {
          const { txBodyHex, signedWitnesses } = eventParams;
          try {
            const result = trezorUtils.signTransaction(
              txBodyHex,
              signedWitnesses,
            );
            sendResponse(promiseId, { error: null, result });
          } catch (error) {
            sendResponse(promiseId, { error, result: null });
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

export default React.memo(CardanoProvider);
