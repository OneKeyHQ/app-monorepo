import { getAddress } from '@ethersproject/address';
import { splitSignature } from '@ethersproject/bytes';
import { keccak256 } from '@ethersproject/keccak256';
import { TransactionTypes, serialize } from '@ethersproject/transactions';
import BigNumber from 'bignumber.js';

import { secp256k1 } from '@onekeyhq/core/src/secret';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IAddressValidation } from '@onekeyhq/shared/types/address';

import type { IUnsignedTxPro } from '../../../types';
import type { IEncodedTxEvm } from '../types';
import type { UnsignedTransaction } from '@ethersproject/transactions';

export async function getPublicKeyFromPrivateKey({
  privateKeyRaw,
}: {
  privateKeyRaw: string;
}): Promise<{ publicKey: string }> {
  if (!hexUtils.isHexString(privateKeyRaw)) {
    throw new OneKeyInternalError('Invalid private key.');
  }
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
    chainId: new BigNumber(checkIsDefined(encodedTx.chainId)).toNumber(),
  };

  if (!baseTx.to) {
    console.error('may be EVM contract deploy, always set value to 0');
    baseTx.value = '0x0';
  }

  const isEIP1559 = encodedTx?.maxFeePerGas || encodedTx?.maxPriorityFeePerGas;

  if (isEIP1559) {
    Object.assign(baseTx, {
      type: TransactionTypes.eip1559,
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

export function packUnsignedTxForSignEvm(unsignedTx: IUnsignedTxPro) {
  const tx = packTransaction(unsignedTx.encodedTx as IEncodedTxEvm);
  const serializedTx = serialize(tx);
  const digest = keccak256(serializedTx);
  return {
    // used for HD wallet sign
    digest,
    tx,
    serializedTx,
    // used for QR wallet sign
    serializedTxWithout0x: hexUtils.stripHexPrefix(serializedTx),
  };
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

export function buildSignedTxFromSignatureEvm({
  tx,
  signature,
}: {
  tx: UnsignedTransaction;
  signature: {
    v: string | number; // '0x11' , '17', 17
    r: string; // prefix 0x
    s: string; // prefix 0x
  };
}) {
  const { r, s, v } = signature;
  /**
   * sdk legacy return {v,r,s}; eip1559 return {recoveryParam,r,s}
   * splitSignature auto convert v to recoveryParam
   */
  const sig = splitSignature({
    v: Number(v),
    r,
    s,
  });
  const rawTx = serialize(tx, sig);
  const txid = keccak256(rawTx);
  return {
    rawTx,
    txid,
  };
}
