/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useEffect, useState } from 'react';

import ReactDOM from 'react-dom/client';

import type { IBackgroundApiWebembedCallMessage } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import webembedApi from '@onekeyhq/kit-bg/src/webembeds/instance/webembedApi';

import WebEmbedWebviewAgentCardano from './src/views/WebEmbedWebviewAgentCardano';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

const NotFound = () => 'not found';

const getLatestHash = () => window.location.hash.split('#').pop();
const initHash = getLatestHash();

const routerConfig = {
  '/cardano': <WebEmbedWebviewAgentCardano />,
};

const handler = async (payload: IJsBridgeMessagePayload) =>
  webembedApi.callWebEmbedApiMethod(
    payload.data as IBackgroundApiWebembedCallMessage,
  );

window.$onekey.$private.webembedReceiveHandler = handler;
window.$onekey.$private.request({
  method: 'webEmbedApiReady',
});

function App() {
  const [hashPath, setHashPath] = useState(initHash);
  useEffect(() => {
    window.addEventListener('hashchange', () => {
      setHashPath(getLatestHash);
    });
  }, []);
  return routerConfig[hashPath as keyof typeof routerConfig] || <NotFound />;
}

const root = ReactDOM.createRoot(document.body);
root.render(<App />);
