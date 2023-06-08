import { getAddress } from '@ethersproject/address';
import { keccak256 } from '@ethersproject/keccak256';
import {
  getEncryptionPublicKey,
  decrypt as mmSigUtilDecrypt,
} from '@metamask/eth-sig-util';
import BigNumber from 'bignumber.js';
import {
  addHexPrefix,
  ecrecover,
  pubToAddress,
  toBuffer,
} from 'ethereumjs-util';

import type {
  AddressValidation,
  TypedMessage,
  UnsignedTx,
} from '@onekeyhq/engine/src/types/provider';
import type { Signer } from '@onekeyhq/engine/src/types/secret';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { check, checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';

import { hashMessage } from './sdk';

import type { Verifier } from '../../../proxy';
import type { MessageTypes } from './sdk';
import type { UnsignedTransaction } from '@ethersproject/transactions';

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

export function buildEtherUnSignedTx(
  unsignedTx: UnsignedTx,
  chainId: string,
): UnsignedTransaction {
  const output = unsignedTx.outputs[0];
  const isERC20Transfer = !!output.tokenAddress;
  const toAddress = isERC20Transfer ? output.tokenAddress : output.address;
  const value = isERC20Transfer ? '0x0' : toBigIntHex(output.value);
  const nonce = checkIsDefined(unsignedTx.nonce);

  const baseTx = {
    to: toAddress || undefined, // undefined is for deploy contract calls.
    value,
    gasLimit: toBigIntHex(checkIsDefined(unsignedTx.feeLimit)),
    nonce: `0x${nonce.toString(16)}`, // some RPC do not accept nonce as number
    data: unsignedTx.payload?.data || '0x',
    chainId: parseInt(checkIsDefined(chainId)),
  };

  if (unsignedTx.payload?.EIP1559Enabled === true) {
    Object.assign(baseTx, {
      type: 2,
      maxFeePerGas: toBigIntHex(
        new BigNumber(checkIsDefined(unsignedTx.payload?.maxFeePerGas)),
      ),
      maxPriorityFeePerGas: toBigIntHex(
        new BigNumber(checkIsDefined(unsignedTx.payload?.maxPriorityFeePerGas)),
      ),
    });
  } else {
    Object.assign(baseTx, {
      gasPrice: toBigIntHex(checkIsDefined(unsignedTx.feePricePerUnit)),
    });
  }

  // @ts-ignore
  return baseTx;
}

export async function pubkeyToAddress(verifier: Verifier): Promise<string> {
  const pubkey = await verifier.getPubkey(false);
  return `0x${keccak256(pubkey.slice(-64)).slice(-40)}`;
}
