/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { useCallback, useEffect, useState } from 'react';

import { Button, Center, Typography } from '@onekeyhq/components';
import type { IBackgroundApiWebembedCallMessage } from '@onekeyhq/kit-bg/src/IBackgroundApi';
import webembedApi from '@onekeyhq/kit-bg/src/webembeds/instance/webembedApi';
import { wait } from '@onekeyhq/kit/src/utils/helper';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

function CoreWalletAgent() {
  const [msg, setMsg] = useState<any>('');
  const handler = useCallback(async (payload: IJsBridgeMessagePayload) => {
    setMsg(payload);

    await wait(1000);

    return webembedApi.callWebEmbedApiMethod(
      payload.data as IBackgroundApiWebembedCallMessage,
    );

    // return {
    //   hello: '8888',
    //   payload,
    // };

    // coreWalletAgentBridge.receive(payload);

    // window.$onekey.$private.request({
    //   method: 'resolveCoreWalletAgentCall',
    //   // @ts-ignore
    //   promiseId: payload.promiseId,
    //   data: { payload, hello: '111333444' },
    // });
  }, []);

  useEffect(() => {
    if (window.$onekey) {
      window.$onekey.$private.webembedReceiveHandler = handler;
    }
    if (!window.$onekey) {
      return;
    }
    // window.$onekey.$private.on('message_payload_raw', handler);
    return () => {
      // window.$onekey.$private.off('message_payload_raw', handler);
    };
  }, [handler]);
  return (
    <Center height="full">
      <Typography.Body1
        whiteSpace="normal"
        wordBreak="break-all"
        overflowWrap="anywhere"
      >
        {msg ? JSON.stringify(msg) : 'CoreWalletAgent'}
      </Typography.Body1>
      <Button onPress={() => window.location.reload()}>Reload</Button>
    </Center>
  );
}

export { CoreWalletAgent };
