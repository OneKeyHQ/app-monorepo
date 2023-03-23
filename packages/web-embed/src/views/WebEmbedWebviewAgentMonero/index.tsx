/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
import { memo, useCallback, useEffect } from 'react';

import { Center, Text } from '@onekeyhq/components';
import { Helper } from '@onekeyhq/engine/src/vaults/impl/xmr/sdk/helper';
import { getMoneroCoreInstance } from '@onekeyhq/engine/src/vaults/impl/xmr/sdk/moneroCore/instance';
import { getMoneroUtilInstance } from '@onekeyhq/engine/src/vaults/impl/xmr/sdk/moneroUtil/instance';
import { MoneroEvent } from '@onekeyhq/shared/src/engine/xmrConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

const ProvideResponseMethod = 'chainWebEmbedResponse';

const getMoneroApi = async () => {
  const moneroCoreInstance = await getMoneroCoreInstance();
  const moneroUtilInstance = await getMoneroUtilInstance();

  const helper = new Helper(moneroUtilInstance, moneroCoreInstance);

  return helper;
};

let testCallingCount = 1;
let testCallingInterval: ReturnType<typeof setInterval> | undefined;
function WebEmbedWebviewAgentMonero() {
  const sendResponse = useCallback((promiseId: number, result: any) => {
    window.$onekey.$private.request({
      method: ProvideResponseMethod,
      promiseId,
      data: result,
    });
  }, []);

  const handler = useCallback(
    async (payload: IJsonRpcRequest) => {
      console.log('WebEmbedWebviewAgentMonero Recive Message: ', payload);
      console.log('params: ', JSON.stringify(payload.params));
      const { method, params } = payload;

      if (method !== 'callChainWebEmbedMethod') {
        return;
      }

      const { params: eventParams, promiseId, event } = params as any;
      const moneroApi = await getMoneroApi();
      switch (event) {
        case MoneroEvent.getKeyPairFromRawPrivatekey: {
          console.log('Monero_getKeyPairFromRawPrivatekey');
          const { rawPrivateKey, index, isPrivateSpendKey } = eventParams;
          const keys = moneroApi.getKeyPairFromRawPrivatekey({
            rawPrivateKey,
            isPrivateSpendKey,
            index,
          });
          sendResponse(promiseId, {
            error: null,
            result: {
              privateSpendKey: Buffer.from(keys.privateSpendKey).toString(
                'hex',
              ),
              privateViewKey: Buffer.from(keys.privateViewKey).toString('hex'),
              publicSpendKey: Buffer.from(keys.publicSpendKey || []).toString(
                'hex',
              ),
              publicViewKey: Buffer.from(keys.publicViewKey || []).toString(
                'hex',
              ),
            },
          });
          break;
        }

        case MoneroEvent.generateKeyImage: {
          console.log('Monero_generateKeyImage');
          const keyImage = moneroApi.generateKeyImage(eventParams);
          sendResponse(promiseId, { error: null, result: keyImage });
          break;
        }

        case MoneroEvent.seedAndkeysFromMnemonic: {
          console.log('Monero_seedAndkeysFromMnemonic');
          const seedAndKeys = moneroApi.seedAndkeysFromMnemonic(eventParams);
          sendResponse(promiseId, { error: null, result: seedAndKeys });
          break;
        }

        case MoneroEvent.decodeAddress: {
          console.log('Monero_decodeAddress');
          const decodedAddress = moneroApi.decodeAddress(eventParams);
          sendResponse(promiseId, { error: null, result: decodedAddress });
          break;
        }
        case MoneroEvent.estimatedTxFee: {
          console.log('Monero_estimatedTxFee');
          const fee = moneroApi.estimatedTxFee(eventParams);
          sendResponse(promiseId, { error: null, result: fee });
          break;
        }
        case MoneroEvent.sendFunds: {
          console.log('Monero_generateKeyImage');
          try {
            const { args, scanUrl } = eventParams;
            const signedTx = await moneroApi.sendFunds(args, scanUrl);
            sendResponse(promiseId, { error: null, result: signedTx });
          } catch (e) {
            sendResponse(promiseId, { error: e, result: null });
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
    <Center p={4} bgColor="surface-warning-subdued" minH="100%">
      <Text
        onPress={() => {
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
        Monero web-embed Webview Agent
      </Text>
    </Center>
  );
}

export default memo(WebEmbedWebviewAgentMonero);
