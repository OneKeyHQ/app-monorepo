import { getAddress } from '@ethersproject/address';
import BigNumber from 'bignumber.js';

import { secp256k1 } from '@onekeyhq/core/src/secret';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IAddressValidation } from '@onekeyhq/shared/types/address';

import type { IEncodedTxEvm } from '../types';
import type { UnsignedTransaction } from '@ethersproject/transactions';

export async function getPublicKeyFromPrivateKey({
  privateKeyRaw,
}: {
  privateKeyRaw: string;
}): Promise<{ publicKey: string }> {
  const privateKey = bufferUtils.toBuffer(privateKeyRaw);
  if (privateKey.length !== 32) {
    throw new OneKeyInternalError('Invalid private key.');
  }
  const publicKey = secp256k1.publicFromPrivate(privateKey).toString('hex');
  return Promise.resolve({ publicKey });
}

export function packTransaction(encodedTx: IEncodedTxEvm): UnsignedTransaction {
  const baseTx: UnsignedTransaction = {
    // undefined is for deploy contract calls.
    to: encodedTx.to || undefined,

    // some RPC do not accept nonce as number
    nonce: toBigIntHex(
      new BigNumber(checkIsDefined(encodedTx.nonce)),
    ) as unknown as number,

    gasLimit: toBigIntHex(
      new BigNumber(checkIsDefined(encodedTx.gasLimit ?? encodedTx.gas)),
    ),

    data: encodedTx?.data || '0x',
    value: encodedTx?.value || '0x0',

    // update chainId at: buildUnsignedTxFromEncodedTx
    chainId: checkIsDefined(encodedTx.chainId),
  };

  if (!baseTx.to) {
    console.error('may be EVM contract deploy, always set value to 0');
    baseTx.value = '0x0';
  }

  const isEIP1559 = encodedTx?.maxFeePerGas || encodedTx?.maxPriorityFeePerGas;

  if (isEIP1559) {
    Object.assign(baseTx, {
      type: 2,
      maxFeePerGas: toBigIntHex(
        new BigNumber(checkIsDefined(encodedTx?.maxFeePerGas)),
      ),
      maxPriorityFeePerGas: toBigIntHex(
        new BigNumber(checkIsDefined(encodedTx?.maxPriorityFeePerGas)),
      ),
    });
  } else {
    Object.assign(baseTx, {
      gasPrice: toBigIntHex(new BigNumber(checkIsDefined(encodedTx.gasPrice))),
    });
  }

  return baseTx;
}

export function validateEvmAddress(
  address: string,
): Promise<IAddressValidation> {
  let isValid = false;
  let checksumAddress = '';

  try {
    checksumAddress = getAddress(address);
    isValid = checksumAddress.length === 42;
  } catch {
    return Promise.resolve({
      isValid: false,
      normalizedAddress: '',
      displayAddress: '',
    });
  }

  return Promise.resolve({
    normalizedAddress: checksumAddress.toLowerCase() || '',
    displayAddress: checksumAddress || '',
    isValid,
  });
}
