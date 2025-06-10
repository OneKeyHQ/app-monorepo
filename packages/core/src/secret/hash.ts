import { sha256 as sha256noble } from '@noble/hashes/sha256';
import { sha512 as sha512noble } from '@noble/hashes/sha512';

import { OneKeyPlainTextError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { hash160, hmacSHA256, hmacSHA512, sha256 } from './crypto-functions';

export type ISha512Params = {
  data: string;
  iterations?: number;
  iterationSalt?: string;
};

function sha512Sync({
  data,
  iterations = 1,
  iterationSalt,
}: ISha512Params): string {
  // eslint-disable-next-line no-param-reassign
  iterations = iterations ?? 1;
  if (iterations < 1) {
    throw new OneKeyPlainTextError('iterations must be greater than 0');
  }
  if (!data) {
    throw new OneKeyPlainTextError('data is required');
  }
  let hash: string = bufferUtils.bytesToHex(sha512noble(data));
  for (let i = 1; i < iterations; i += 1) {
    const nextHash = iterationSalt
      ? [hash, iterationSalt, data, i, iterations].join('')
      : hash;
    hash = bufferUtils.bytesToHex(sha512noble(nextHash));
  }
  return hash;
}

async function sha512Async(params: ISha512Params): Promise<string> {
  if (
    platformEnv.isNative &&
    !platformEnv.isJest &&
    !globalThis.$onekeyAppWebembedApiWebviewInitFailed
  ) {
    const webembedApiProxy = (
      await import('@onekeyhq/kit-bg/src/webembeds/instance/webembedApiProxy')
    ).default;
    const str = await webembedApiProxy.secret.sha512Async(params);
    return str;
  }
  return sha512Sync(params);
}

export {
  hash160,
  hmacSHA256,
  hmacSHA512,
  sha256,
  sha256noble,
  sha512Async,
  sha512Sync,
};
