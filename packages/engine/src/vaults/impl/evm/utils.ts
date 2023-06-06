import {
  getEncryptionPublicKey,
  decrypt as mmSigUtilDecrypt,
} from '@metamask/eth-sig-util';
import {
  addHexPrefix,
  ecrecover,
  pubToAddress,
  toBuffer,
} from 'ethereumjs-util';

import type { TypedMessage } from '@onekeyhq/engine/src/types/provider';
import type { Signer } from '@onekeyhq/engine/src/types/secret';
import { check } from '@onekeyhq/shared/src/utils/assertUtils';

import { hashMessage } from './sdk';

import type { MessageTypes } from './sdk';

export async function mmDecrypt(
  serializedMessage: string,
  signer: Signer,
): Promise<string> {
  const encryptedData = JSON.parse(toBuffer(serializedMessage).toString());
  return mmSigUtilDecrypt({
    encryptedData,
    privateKey: (await signer.getPrvkey()).toString('hex'),
  });
}

export async function mmGetPublicKey(signer: Signer): Promise<string> {
  return getEncryptionPublicKey((await signer.getPrvkey()).toString('hex'));
}

export async function ecRecover(
  message: TypedMessage,
  signature: string,
): Promise<string> {
  const messageHash = hashMessage(
    message.type as MessageTypes,
    message.message,
  );
  const hashBuffer = toBuffer(messageHash);
  const sigBuffer = toBuffer(signature);
  check(hashBuffer.length === 32, 'Invalid message hash length');
  check(sigBuffer.length === 65, 'Invalid signature length');

  const [r, s, v] = [
    sigBuffer.slice(0, 32),
    sigBuffer.slice(32, 64),
    sigBuffer[64],
  ];
  const publicKey = ecrecover(hashBuffer, v, r, s);
  const hex = addHexPrefix(pubToAddress(publicKey).toString('hex'));
  return Promise.resolve(hex);
}
