/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable new-cap */
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { buildCallRemoteApiMethod } from '../../apis/RemoteApiProxyBase';

import type { IWebembedApiKeys } from './IWebembedApi';
import type { IBackgroundApiWebembedCallMessage } from '../../apis/IBackgroundApi';

const getOrCreateWebEmbedApiModule = memoizee(
  async (name: IWebembedApiKeys) => {
    if (name === 'chainAdaLegacy') {
      return new (await import('../WebEmbedApiChainAdaLegacy')).default();
    }
    if (name === 'test') {
      return new (await import('../WebEmbedApiTest')).default();
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
