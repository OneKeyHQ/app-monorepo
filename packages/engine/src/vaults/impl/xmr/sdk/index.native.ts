/* eslint-disable @typescript-eslint/no-unsafe-return */
import webembedApiProxy from '@onekeyhq/kit-bg/src/webembeds/instance/webembedApiProxy';

import * as moneroAddress from './moneroAddress';
import { privateSpendKeyToWords } from './moneroWords';

import type { IMoneroApi, IMoneroApiWebembed } from './types';

// auto check webembedApi ready by calling each method
const ensureSDKReady = async () => Promise.resolve(true);

async function getMoneroApi(): Promise<IMoneroApi> {
  const embedApi: IMoneroApiWebembed = await Promise.resolve(
    webembedApiProxy.chainXmrLegacy,
  );

  return {
    ...embedApi,
    privateSpendKeyToWords,
    pubKeysToAddress: moneroAddress.pubKeysToAddress,
  };
}
export { ensureSDKReady, getMoneroApi };
