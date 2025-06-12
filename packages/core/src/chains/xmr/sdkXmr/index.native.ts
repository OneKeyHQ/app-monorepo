/* eslint-disable @typescript-eslint/no-unsafe-return */

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IMoneroApi } from './types';

// auto check webembedApi ready by calling each method
const ensureSDKReady = async () => Promise.resolve(true);

async function getMoneroApi(): Promise<IMoneroApi> {
  throw new OneKeyLocalError('webembedApiProxy not ok');
  // import webembedApiProxy from '@onekeyhq/kit-bg/src/webembeds/instance/webembedApiProxy';
  // const embedApi: IMoneroApiWebembed = await Promise.resolve(
  //   webembedApiProxy.chainXmrLegacy,
  // );

  // const embedApi: IMoneroApiWebembed = {} as any;

  // return {
  //   ...embedApi,
  //   privateSpendKeyToWords,
  //   pubKeysToAddress: moneroAddress.pubKeysToAddress,
  // };
}
export { ensureSDKReady, getMoneroApi };
