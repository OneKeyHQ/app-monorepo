import {
  AddressSecp256k1,
  NetworkPrefix,
  Transaction,
} from '@zondax/izari-filecoin';
import base32Decode from 'base32-decode';
import blake from 'blakejs';

import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import type { SignedTx } from '@onekeyhq/engine/src/types/provider';

import { OneKeyInternalError } from '../../../errors';
import { IDecodedTxStatus } from '../../types';

import { ProtocolIndicator } from './types';

import type { Signer } from '../../../proxy';
import type { IUnsignedTxPro } from '../../types';
import type { IEncodedTxFil } from './types';

const CID_PREFIX = Buffer.from([0x01, 0x71, 0xa0, 0xe4, 0x02, 0x20]);
const CID_LEN = 32;

export function getCID(message: Buffer): Buffer {
  const blakeCtx = blake.blake2bInit(CID_LEN);
  blake.blake2bUpdate(blakeCtx, message);
  const hash = Buffer.from(blake.blake2bFinal(blakeCtx));
  return Buffer.concat([CID_PREFIX, hash]);
}

export function getDigest(message: Buffer): Buffer {
  const blakeCtx = blake.blake2bInit(32);
  blake.blake2bUpdate(blakeCtx, getCID(message));
  return Buffer.from(blake.blake2bFinal(blakeCtx));
}

export const validateNetworkPrefix = (
  networkPrefix: string,
): networkPrefix is NetworkPrefix =>
  Object.values(NetworkPrefix).includes(networkPrefix as NetworkPrefix);

export async function signTransaction(
  unsignedTx: IUnsignedTxPro,
  signer: Signer,
): Promise<SignedTx> {
  const encodedTx = unsignedTx.encodedTx as IEncodedTxFil;

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const BufferConcatFunction = Buffer.concat;

  Buffer.concat = (list: ReadonlyArray<Uint8Array>, totalLength?: number) =>
    BufferConcatFunction(
      list.map((item) => Buffer.from(item)),
      totalLength,
    );
  // In @zondax/izari-filecoin AddressSecp256k1 fromString static fucntion
  // When comparing the check sum of the address,
  // The format of both sides is Buffer and Uint8Array,
  // Resulting in different comparison results of the same checksum
  // Which needs to be corrected
  AddressSecp256k1.fromString = (address: string) => {
    const networkPrefix = address[0];
    const protocolIndicator = address[1];

    if (!validateNetworkPrefix(networkPrefix))
      throw new OneKeyInternalError('Invalid filecoin network.');
    if (parseInt(protocolIndicator) !== ProtocolIndicator.SECP256K1)
      throw new OneKeyInternalError('Invalid filecoin protocol indicator.');

    const decodedData = Buffer.from(
      base32Decode(address.substring(2).toUpperCase(), 'RFC4648'),
    );
    const payload = decodedData.subarray(0, -4);
    const checksum = decodedData.subarray(-4);

    const newAddress = new AddressSecp256k1(networkPrefix, payload);
    if (
      Buffer.from(newAddress.getChecksum()).toString('hex') !==
      Buffer.from(checksum).toString('hex')
    )
      throw new OneKeyInternalError('Invalid filecoin checksum network.');

    return newAddress;
  };

  const transaction = Transaction.fromJSON(encodedTx);

  const messageDigest = getDigest(await transaction.serialize());
  const [sig, recoveryParam] = await signer.sign(messageDigest);

  const signatureResult = Buffer.concat([
    Buffer.from(sig),
    Buffer.from([recoveryParam]),
  ]);

  Buffer.concat = BufferConcatFunction;

  return Promise.resolve({
    txid: '',
    rawTx: JSON.stringify({
      Message: encodedTx,
      Signature: {
        Data: signatureResult.toString('base64'),
        Type: ProtocolIndicator.SECP256K1,
      },
    }),
  });
}

export function getTxStatus(
  status: string | null | undefined,
  cid: string | undefined,
) {
  if (cid && status === 'OK') {
    return TransactionStatus.CONFIRM_AND_SUCCESS;
  }

  if (status?.toLowerCase().includes('err')) {
    return TransactionStatus.CONFIRM_BUT_FAILED;
  }

  return TransactionStatus.PENDING;
}

export function getDecodedTxStatus(
  status: string | null | undefined,
  cid: string | undefined,
) {
  if (cid && status === 'OK') {
    return IDecodedTxStatus.Confirmed;
  }

  if (status?.toLowerCase().includes('err')) {
    return IDecodedTxStatus.Failed;
  }

  return IDecodedTxStatus.Pending;
}
