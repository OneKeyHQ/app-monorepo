/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
import { memo, useCallback, useEffect } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

const LibLoader = async () => import('@onekeyfe/cardano-coin-selection-asmjs');

const getCardanoApi = async () => {
  const Loader = await LibLoader();
  return {
    composeTxPlan: Loader.onekeyUtils.composeTxPlan,
    signTransaction: Loader.onekeyUtils.signTransaction,
    hwSignTransaction: Loader.trezorUtils.signTransaction,
    txToOneKey: Loader.onekeyUtils.txToOneKey,
    dAppUtils: Loader.dAppUtils,
  };
};

const ProvideResponseMethod = 'chainWebEmbedResponse';

enum ECardanoEvent {
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

let testCallingCount = 1;
let testCallingInterval: ReturnType<typeof setInterval> | undefined;
function WebEmbedWebviewAgentCardano() {
  const sendResponse = useCallback((promiseId: number, result: any) => {
    window.$onekey.$private.request({
      method: ProvideResponseMethod,
      promiseId,
      data: result,
    });
  }, []);

  const handler = useCallback(
    async (payload: IJsonRpcRequest) => {
      console.log('WebEmbedWebviewAgentCardano Recive Message: ', payload);
      console.log('params: ', JSON.stringify(payload.params));
      const { method, params } = payload;

      if (method !== 'callChainWebEmbedMethod') {
        return;
      }

      const { params: eventParams, promiseId, event } = params as any;

      const CardanoApi = await getCardanoApi();
      switch (event) {
        case ECardanoEvent.composeTxPlan: {
          console.log('Cardano_composeTxPlan');
          const { transferInfo, xpub, utxos, changeAddress, outputs } =
            eventParams;
          try {
            const txPlan = await CardanoApi.composeTxPlan(
              transferInfo,
              xpub,
              utxos,
              changeAddress,
              outputs,
            );
            sendResponse(promiseId, { error: null, result: txPlan });
          } catch (error: any) {
            sendResponse(promiseId, {
              error: error?.code || error,
              result: null,
            });
          }
          break;
        }

        case ECardanoEvent.signTransaction: {
          console.log('Cardano_signTransaction');
          const { txBodyHex, address, accountIndex, utxos, xprv, partialSign } =
            eventParams;
          try {
            const result = await CardanoApi.signTransaction(
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

        case ECardanoEvent.hwSignTransaction: {
          const { txBodyHex, signedWitnesses, options } = eventParams;
          try {
            const result = await CardanoApi.hwSignTransaction(
              txBodyHex,
              signedWitnesses,
              options,
            );
            sendResponse(promiseId, { error: null, result });
          } catch (error) {
            sendResponse(promiseId, { error, result: null });
          }
          break;
        }

        case ECardanoEvent.txToOneKey: {
          const { rawTx, network, initKeys, xpub, changeAddress } = eventParams;
          try {
            const result = await CardanoApi.txToOneKey(
              rawTx,
              network,
              initKeys,
              xpub,
              changeAddress,
            );
            sendResponse(promiseId, { error: null, result });
          } catch (error) {
            sendResponse(promiseId, { error, result: null });
          }
          break;
        }

        case ECardanoEvent.dAppGetBalance: {
          const { balances } = eventParams;
          try {
            const result = await CardanoApi.dAppUtils.getBalance(balances);
            sendResponse(promiseId, { error: null, result });
          } catch (error) {
            sendResponse(promiseId, { error, result: null });
          }
          break;
        }

        case ECardanoEvent.dAppGetUtxos: {
          const { address, utxos, amount } = eventParams;
          try {
            const result = await CardanoApi.dAppUtils.getUtxos(
              address,
              utxos,
              amount,
            );
            sendResponse(promiseId, { error: null, result });
          } catch (error) {
            sendResponse(promiseId, { error, result: null });
          }
          break;
        }

        case ECardanoEvent.dAppGetAddresses: {
          const { addresses } = eventParams;
          try {
            const result = await CardanoApi.dAppUtils.getAddresses(addresses);
            sendResponse(promiseId, { error: null, result });
          } catch (error) {
            sendResponse(promiseId, { error, result: null });
          }
          break;
        }

        case ECardanoEvent.dAppConvertCborTxToEncodeTx: {
          const { txHex, utxos, addresses, changeAddress } = eventParams;
          try {
            const result = await CardanoApi.dAppUtils.convertCborTxToEncodeTx(
              txHex,
              utxos,
              addresses,
              changeAddress,
            );
            sendResponse(promiseId, { error: null, result });
          } catch (error) {
            sendResponse(promiseId, { error, result: null });
          }
          break;
        }

        case ECardanoEvent.dAppSignData: {
          const {
            address,
            payload: signPayload,
            xprv,
            accountIndex,
          } = eventParams;
          try {
            const result = await CardanoApi.dAppUtils.signData(
              address,
              signPayload,
              xprv,
              accountIndex,
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

  return (
    <div>
      <button
        onClick={() => {
          if (platformEnv.isDev) {
            clearInterval(testCallingInterval);
            testCallingInterval = setInterval(() => {
              // eslint-disable-next-line no-plusplus
              const content = `call private method interval::::   ${testCallingCount++}  `;
              console.log(content);
              window.$onekey.$private.request({
                method: ProvideResponseMethod,
                data: content,
              });
            }, 3000);
          }
        }}
      >
        Cardano web-embed Webview Agent
      </button>
    </div>
  );
}

export default memo(WebEmbedWebviewAgentCardano);
