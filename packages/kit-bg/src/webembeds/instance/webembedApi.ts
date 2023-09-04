/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable new-cap */
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { buildCallRemoteApiMethod } from '../../RemoteApiProxyBase';

import type { IBackgroundApiWebembedCallMessage } from '../../IBackgroundApi';
import type { IWebembedApiKeys } from './IWebembedApi';

const getOrCreateWebEmbedApiModule = memoizee(
  async (name: IWebembedApiKeys) => {
    if (name === 'secret') {
      return new (await import('../WebEmbedApiSecret')).default();
    }
    if (name === 'chainAdaLegacy') {
      return new (await import('../WebEmbedApiChainAdaLegacy')).default();
    }
    if (name === 'chainXmrLegacy') {
      return new (await import('../WebEmbedApiChainXmrLegacy')).default();
    }
    throw new Error(`Unknown WebEmbed API module: ${name as string}`);
  },
  {
    promise: true,
  },
);

const callWebEmbedApiMethod =
  buildCallRemoteApiMethod<IBackgroundApiWebembedCallMessage>(
    getOrCreateWebEmbedApiModule,
  );

export default { callWebEmbedApiMethod };
