/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
import { memo, useCallback, useEffect } from 'react';

import { Center, Text } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

const LibLoader = async () => import('@onekeyfe/cardano-coin-selection-asmjs');

const getMoneroApi = async () => {
  const Loader = await LibLoader();
  return {
    composeTxPlan: Loader.onekeyUtils.composeTxPlan,
    signTransaction: Loader.onekeyUtils.signTransaction,
    hwSignTransaction: Loader.trezorUtils.signTransaction,
    txToOneKey: Loader.onekeyUtils.txToOneKey,
    dAppUtils: Loader.dAppUtils,
  };
};

const ProvideResponseMethod = 'moneroWebEmbedResponse';

enum MoneroEvent {
  composeTxPlan = 'Cardano_composeTxPlan',
}

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

      if (method !== 'callMoneroWebEmbedMethod') {
        return;
      }

      const { params: eventParams, promiseId, event } = params as any;

      const MoneroApi = await getMoneroApi();
      switch (event) {
        case MoneroEvent.composeTxPlan: {
          console.log('Monero_composeTxPlan');

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
