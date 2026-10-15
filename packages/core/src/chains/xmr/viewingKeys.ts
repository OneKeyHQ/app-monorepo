import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IXmrDerivedAccount } from './sdkXmrRuntime/address';

export type IXmrViewingKeyPair = Pick<
  IXmrDerivedAccount,
  'spendPublicKeyHex' | 'viewPrivateKeyHex'
>;

export function parseXmrViewingKeyPair(stored: string): IXmrViewingKeyPair {
  const match = /^([\da-f]{64}):([\da-f]{64})$/i.exec(stored);
  if (!match) {
    throw new OneKeyLocalError('xmr: invalid stored viewing material');
  }
  return {
    spendPublicKeyHex: match[1].toLowerCase(),
    viewPrivateKeyHex: match[2].toLowerCase(),
  };
}

export function serializeXmrViewingKeyPair(pair: IXmrViewingKeyPair): string {
  const parsed = parseXmrViewingKeyPair(
    `${pair.spendPublicKeyHex}:${pair.viewPrivateKeyHex}`,
  );
  return `${parsed.spendPublicKeyHex}:${parsed.viewPrivateKeyHex}`;
}
