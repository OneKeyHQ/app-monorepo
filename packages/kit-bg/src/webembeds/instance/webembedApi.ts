/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable new-cap */
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { buildCallRemoteApiMethod } from '../../apis/RemoteApiProxyBase';

import type { IWebembedApiKeys } from './IWebembedApi';
import type { IBackgroundApiWebembedCallMessage } from '../../apis/IBackgroundApi';

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

    if (platformEnv.isDev) {
      if (name === 'test') {
        return {
          test1: (...params: any[]) => Promise.resolve(params),
        };
      }
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
