/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { IJsBridgeMessagePayload, IJsonRpcRequest } from '../types';

import ProviderBase from './ProviderBase';

function injectedProviderReceiveHandler(payload: IJsBridgeMessagePayload) {
  // ethereum, solana, conflux
  const providerHub = window.$onekey;

  // TODO providerName check
  const providerName = payload.scope;
  console.log(
    `injectedProviderReceiveHandler onMessage from (${providerName as string})`,
    payload,
  );
  const payloadData = payload.data as IJsonRpcRequest;

  if (!providerName) {
    throw new Error(
      'providerName is required in injectedProviderReceiveHandler',
    );
  }

  // @ts-expect-error
  const provider = providerHub[providerName] as ProviderBase;
  if (!provider) {
    return;
  }
  provider.bridge.emit('notification', payloadData);
}

export default injectedProviderReceiveHandler;
