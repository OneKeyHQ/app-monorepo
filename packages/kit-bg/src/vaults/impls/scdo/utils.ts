import { defaultAbiCoder } from '@ethersproject/abi';
import BigNumber from 'bignumber.js';
import RLP from 'rlp';
import { keccak256 } from 'viem';

import type { IEncodedTxScdo } from '@onekeyhq/core/src/chains/scdo/types';
import { secp256k1 } from '@onekeyhq/core/src/secret';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

const TransferMethod = '0xa9059cbb';

export function serializeUnsignedTransaction(tx: IEncodedTxScdo) {
  const raw = [
    tx.Type,
    `0x${tx.From.slice(2)}`,
    `0x${tx.To.slice(2)}`,
    tx.Amount,
    tx.AccountNonce,
    tx.GasPrice,
    tx.GasLimit,
    tx.Timestamp,
    tx.Payload,
  ];
  return RLP.encode(raw);
}

export function hash(content: Uint8Array | `0x${string}`) {
  return keccak256(content);
}

export function serializeSignedTransaction(
  tx: IEncodedTxScdo,
  txHash: `0x${string}`,
  signature: string,
) {
  return Buffer.from(
    JSON.stringify({
      Data: {
        From: tx.From,
        To: tx.To,
        Amount: tx.Amount,
        AccountNonce: tx.AccountNonce,
        GasPrice: tx.GasPrice,
        GasLimit: tx.GasLimit,
        Timestamp: tx.Timestamp,
        Payload: tx.Payload,
      },
      Hash: txHash,
      Signature: {
        Sig: signature,
      },
    }),
  ).toString('base64');
}

export function publicKeyToAddress(publicKey: Buffer) {
  let publicKeyBytes = Buffer.alloc(0);
  if (publicKey.length === 33) {
    publicKeyBytes = secp256k1.transformPublicKey(publicKey).subarray(1);
  } else if (publicKey.length === 65) {
    publicKeyBytes = publicKey.subarray(1);
  } else {
    throw new Error('Invalid public key');
  }
  const shard = 1;
  const pubkey = RLP.encode(publicKeyBytes);
  const pubkeyHash = bufferUtils.hexToBytes(
    hexUtils.stripHexPrefix(keccak256(pubkey)),
  );
  const addr = pubkeyHash.slice(-20);
  addr[0] = shard;
  // eslint-disable-next-line no-bitwise
  addr[19] = (addr[19] & 0xf0) | 1;
  return `${shard}S${bufferUtils.bytesToHex(addr)}`;
}

export function decodeTransferPayload(payload: string):
  | {
      address: string;
      amount: string;
    }
  | undefined {
  if (!payload.startsWith(TransferMethod)) {
    return undefined;
  }
  try {
    const [address, amount] = defaultAbiCoder.decode(
      ['address', 'uint256'],
      `0x${payload.slice(TransferMethod.length)}`,
    );
    const addressBytes = bufferUtils.hexToBytes(
      hexUtils.stripHexPrefix(address),
    );
    return {
      address: (address as string)
        .toLowerCase()
        .replace(/^0x/, `${addressBytes[0]}S`),
      amount: new BigNumber((amount as BigNumber).toString()).toFixed(),
    };
  } catch (error) {
    return undefined;
  }
}

export function encodeTransferPayload({
  address,
  amount,
}: {
  address: string;
  amount: string;
}) {
  const method = '0xa9059cbb';
  const params = defaultAbiCoder.encode(
    ['address', 'uint256'],
    [`0x${address.slice(2)}`, amount],
  );
  return `${method}${params.slice(2)}`;
}
