/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable new-cap */
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

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

async function callWebEmbedApiMethod(
  message: IBackgroundApiWebembedCallMessage,
) {
  const { module, method, params = [] } = message;
  const moduleInstance: any = await getOrCreateWebEmbedApiModule(module);
  if (moduleInstance && moduleInstance[method]) {
    // TODO await offscreenApi.createOffscreenApiModule
    // TODO check params is object or array
    const result = await moduleInstance[method](...(params as any[]));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result;
  }
  throw new Error(`WebEmbed module method not found: ${module}.${method}()`);
}

export default { callWebEmbedApiMethod };
