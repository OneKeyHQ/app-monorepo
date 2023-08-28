/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { useCallback, useEffect, useState } from 'react';

import { Button, Center, Typography } from '@onekeyhq/components';
import type { IBackgroundApiWebembedCallMessage } from '@onekeyhq/kit-bg/src/IBackgroundApi';
import webembedApi from '@onekeyhq/kit-bg/src/webembeds/instance/webembedApi';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

function WebEmbedApiScreen() {
  const [msg, setMsg] = useState<any>('');
  const handler = useCallback(async (payload: IJsBridgeMessagePayload) => {
    if (process.env.NODE_ENV !== 'production') {
      setMsg(payload.data);
    }
    return webembedApi.callWebEmbedApiMethod(
      payload.data as IBackgroundApiWebembedCallMessage,
    );
  }, []);

  useEffect(() => {
    if (!window.$onekey) {
      return;
    }
    window.$onekey.$private.webembedReceiveHandler = handler;
    window.$onekey.$private.request({
      method: 'webEmbedApiReady',
    });

    // window.$onekey.$private.on('message_payload_raw', handler);
    return () => {
      // window.$onekey.$private.off('message_payload_raw', handler);
      window.$onekey.$private.request({
        method: 'webEmbedApiNotReady',
      });
    };
  }, [handler]);

  if (process.env.NODE_ENV !== 'production') {
    return (
      <Center height="full">
        <Typography.Body1
          whiteSpace="normal"
          wordBreak="break-all"
          overflowWrap="anywhere"
        >
          {msg ? JSON.stringify(msg) : 'WebEmbedApiScreen'}
        </Typography.Body1>
        <Button onPress={() => window.location.reload()}>Reload</Button>
      </Center>
    );
  }

  return null;
}

export { WebEmbedApiScreen };
