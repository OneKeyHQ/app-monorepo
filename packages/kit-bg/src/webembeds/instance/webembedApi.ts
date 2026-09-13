/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable new-cap */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { buildCallRemoteApiMethod } from '../../apis/RemoteApiProxyBase';

import type { IWebembedApiKeys } from './IWebembedApi';
import type { IBackgroundApiWebembedCallMessage } from '../../apis/IBackgroundApi';
import type WebEmbedApiChainKaspa from '../WebEmbedApiChainKaspa';

const getOrCreateWebEmbedApiModule = memoizee(
  async (name: IWebembedApiKeys) => {
    if (name === 'chainAdaLegacy') {
      return new (await import('../WebEmbedApiChainAdaLegacy')).default();
    }
    if (name === 'chainKaspa') {
      return new (await import('../WebEmbedApiChainKaspa')).default();
    }
    if (name === 'secret') {
      return new (await import('../WebEmbedApiSecret')).default();
    }
    if (name === 'test') {
      return new (await import('../WebEmbedApiTest')).default();
    }
    if (name === 'imageUtils') {
      return new (await import('../WebEmbedApiImageUtils')).default();
    }
    throw new OneKeyLocalError(
      `Unknown WebEmbed API module: ${
        name as string
      } , please run "yarn app:web-embed:build" again`,
    );
  },
  {
    promise: true,
  },
);

const callWebEmbedApiMethod =
  buildCallRemoteApiMethod<IBackgroundApiWebembedCallMessage>(
    getOrCreateWebEmbedApiModule,
    'webEmbedApi',
  );

const preloadKaspa = async (): Promise<void> => {
  const module = (await getOrCreateWebEmbedApiModule(
    'chainKaspa',
  )) as WebEmbedApiChainKaspa;
  await module.preload();
};

export default { callWebEmbedApiMethod, preloadKaspa };
