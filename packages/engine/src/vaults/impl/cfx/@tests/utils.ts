/* eslint-disable @typescript-eslint/no-unsafe-call */
import { encode } from '@conflux-dev/conflux-address-js';
// import * as rlp from 'js-conflux-sdk/src/util/rlp';
import lodash from 'lodash';
import { decode as rlpDecode } from 'rlp';
import secp256k1V3 from 'secp256k1-v3';

import { conflux } from '../sdk';

const { format, Transaction, sign } = conflux;
const { keccak256 } = sign;
function isHexString(v: string) {
  return lodash.isString(v) && v.match(/^0x[0-9A-Fa-f]*$/);
}

function publicKeyToAddress(_publicKey: Buffer | string) {
  let publicKey = _publicKey;
  if (isHexString(publicKey as string))
    publicKey = Buffer.from(publicKey.slice(2) as string, 'hex');
  if (!Buffer.isBuffer(publicKey))
    throw new Error('publicKey should be a buffer');
  if (publicKey.length === 65) publicKey = publicKey.slice(1);
  if (publicKey.length !== 64)
    throw new Error('publicKey length should be 64 or 65');
  const buffer = keccak256(publicKey).slice(-20);
  buffer[0] = (buffer[0] & 0x0f) | 0x10; // eslint-disable-line no-bitwise
  return buffer;
}

function ecdsaRecover(
  hash: Buffer,
  { r, s, v }: { r: Buffer; s: Buffer; v: number },
) {
  const senderPublic = secp256k1V3.recover(hash, Buffer.concat([r, s]), v);
  return secp256k1V3.publicKeyConvert(senderPublic, false).slice(1);
}

export const encodeAddress = (address: string, networkId: string) =>
  encode(
    Buffer.from(address.slice(2), 'hex'),
    parseInt(String(networkId.split('--').pop())),
  );

export const decodeRaw = (raw: any) => {
  const [
    [nonce, gasPrice, gas, to, value, storageLimit, epochHeight, chainId, data],
    v,
    r,
    s,
  ] = rlpDecode(raw) as unknown as Buffer[][];
  const netId = format.uInt(chainId);
  const tx = new Transaction({
    nonce: format.bigIntFromBuffer(nonce),
    gasPrice: format.bigIntFromBuffer(gasPrice),
    gas: format.bigIntFromBuffer(gas),
    to: to.length === 0 ? null : format.address(to, netId),
    value: format.bigIntFromBuffer(value),
    storageLimit: format.bigIntFromBuffer(storageLimit),
    epochHeight: format.bigIntFromBuffer(epochHeight),
    chainId: format.uInt(chainId),
    data: format.hex(data),
    v: v.length === 0 ? 0 : format.uInt(v),
    r: format.hex(r),
    s: format.hex(s),
  });

  const publicKey = format.publicKey(
    ecdsaRecover(keccak256(tx.encode(false)), {
      r: format.hexBuffer(tx.r),
      s: format.hexBuffer(tx.s),
      v: format.uInt(tx.v),
    }),
  );
  const hexAddress = publicKeyToAddress(format.hexBuffer(publicKey));
  tx.from = format.address(hexAddress, netId);
  return tx;
};

export const verifySignature = secp256k1V3.verify;
