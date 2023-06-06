import { getAddress } from '@ethersproject/address';
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

import type {
  AddressValidation,
  TypedMessage,
} from '@onekeyhq/engine/src/types/provider';
import type { Signer } from '@onekeyhq/engine/src/types/secret';
import { check } from '@onekeyhq/shared/src/utils/assertUtils';

import { hashMessage } from './sdk';

import type { MessageTypes } from './sdk';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

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

export function verifyAddress(address: string): AddressValidation {
  let isValid = false;
  let checksumAddress = '';

  try {
    checksumAddress = getAddress(address);
    isValid = checksumAddress.length === 42;
  } catch (error) {
    debugLogger.common.error(error);
  }

  return {
    normalizedAddress: checksumAddress.toLowerCase() || undefined,
    displayAddress: checksumAddress || undefined,
    isValid,
  };
}
