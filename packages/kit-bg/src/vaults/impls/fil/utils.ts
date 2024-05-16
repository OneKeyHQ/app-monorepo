import { NetworkPrefix } from '@zondax/izari-filecoin';
import blake from 'blakejs';

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
