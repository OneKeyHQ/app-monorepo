import { getAddress } from '@ethersproject/address';
import { hexZeroPad, splitSignature } from '@ethersproject/bytes';
import { keccak256 } from '@ethersproject/keccak256';
import {
  type UnsignedTransaction,
  serialize,
} from '@ethersproject/transactions';
import {
  SignTypedDataVersion,
  TypedDataUtils,
  getEncryptionPublicKey,
  legacyToBuffer,
  decrypt as mmSigUtilDecrypt,
  typedSignatureHash,
} from '@metamask/eth-sig-util';
import BigNumber from 'bignumber.js';
import {
  addHexPrefix,
  ecrecover,
  hashPersonalMessage,
  pubToAddress,
  toBuffer,
} from 'ethereumjs-util';

import type {
  AddressValidation,
  TypedMessage,
  UnsignedTx,
} from '@onekeyhq/engine/src/types/provider';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { check, checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';

import type { Signer, Verifier } from '../../../proxy';
import type { ISignedTxPro } from '../../types';

export enum MessageTypes {
  ETH_SIGN = 0,
  PERSONAL_SIGN = 1,
  TYPE_DATA_V1 = 2,
  TYPE_DATA_V3 = 3,
  TYPE_DATA_V4 = 4,
}

const hashMessage = (messageType: MessageTypes, message: string): string => {
  switch (messageType) {
    case MessageTypes.ETH_SIGN:
      return addHexPrefix(message);
    case MessageTypes.PERSONAL_SIGN:
      return addHexPrefix(
        hashPersonalMessage(legacyToBuffer(message)).toString('hex'),
      );
    case MessageTypes.TYPE_DATA_V1:
      return addHexPrefix(typedSignatureHash(JSON.parse(message)));
    case MessageTypes.TYPE_DATA_V3:
      return addHexPrefix(
        TypedDataUtils.eip712Hash(
          JSON.parse(message),
          SignTypedDataVersion.V3,
        ).toString('hex'),
      );
    case MessageTypes.TYPE_DATA_V4:
      return addHexPrefix(
        TypedDataUtils.eip712Hash(
          JSON.parse(message),
          SignTypedDataVersion.V4,
        ).toString('hex'),
      );

    default:
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Invalid messageType: ${messageType}`);
  }
};

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

export async function signTransactionWithSigner(
  unsignedTx: UnsignedTx,
  signer: Signer,
  chainId: string,
): Promise<ISignedTxPro> {
  const tx = buildEtherUnSignedTx(unsignedTx, chainId);
  const digest = keccak256(serialize(tx));
  const [sig, recoveryParam] = await signer.sign(
    Buffer.from(digest.slice(2), 'hex'),
  );
  const [r, s]: [Buffer, Buffer] = [sig.slice(0, 32), sig.slice(32)];
  const signature = splitSignature({
    recoveryParam,
    r: hexZeroPad(`0x${r.toString('hex')}`, 32),
    s: hexZeroPad(`0x${s.toString('hex')}`, 32),
  });

  const rawTx: string = serialize(tx, signature);
  const txid = keccak256(rawTx);
  return { txid, rawTx, digest };
}
