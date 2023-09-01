/* eslint-disable react/button-has-type */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { useCallback, useEffect, useState } from 'react';

import type { IBackgroundApiWebembedCallMessage } from '@onekeyhq/kit-bg/src/IBackgroundApi';
import webembedApi from '@onekeyhq/kit-bg/src/webembeds/instance/webembedApi';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

const storageKey = '$$Onekey_WebEmbedApi_showJsBridgeMessage';
const showJsBridgeMessage = Boolean(localStorage.getItem(storageKey));

// @ts-ignore
global.$$webembedApi = webembedApi;

function WebEmbedApiWebPage() {
  const [msg, setMsg] = useState<any>('');
  const handler = useCallback(async (payload: IJsBridgeMessagePayload) => {
    if (showJsBridgeMessage) {
      setMsg(payload);
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

      // Not working when window reload(), as bridge is destroyed first
      window.$onekey.$private.request({
        method: 'webEmbedApiNotReady',
      });
      window.$onekey.$private.webembedReceiveHandler = undefined;
    };
  }, [handler]);

  const toggleShowJsBridgeMessageAndReload = useCallback(() => {
    localStorage.setItem(storageKey, showJsBridgeMessage ? '' : '1');
    window.location.reload();
  }, []);

  const reloadButton = (
    <button
      onClick={() => {
        alert(window.location.href);
        toggleShowJsBridgeMessageAndReload();
      }}
    >
      Reload
    </button>
  );

  return (
    <div style={{ fontSize: 12, padding: 4 }}>
      {reloadButton}
      <div
        style={{
          wordBreak: 'break-all',
          overflow: 'auto',
          whiteSpace: 'normal',
        }}
      >
        {msg
          ? JSON.stringify(msg)
          : `WebEmbedApiWebPage(verbose=${showJsBridgeMessage.toString()})`}
      </div>

      {process.env.NODE_ENV !== 'production' && (
        <button
          onClick={async () => {
            console.log(
              await webembedApi.callWebEmbedApiMethod({
                module: 'secret',
                method: 'testShow',
                params: [{ name: `Hi-${Date.now()}`, random: Math.random() }],
              }),
            );
          }}
        >
          test methods
        </button>
      )}
    </div>
  );
}

export { WebEmbedApiWebPage };
