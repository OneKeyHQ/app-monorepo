import TonWeb from 'tonweb';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { crc32 } from '@onekeyhq/shared/src/utils/crc32';

import { sha256 } from '../../../secret';

import { encodeDnsName } from './utils';

import type {
  ISignDataPayloadBinary,
  ISignDataPayloadCell,
  ISignDataPayloadText,
} from '../../../types';

export async function createTextBinaryHash(
  payload: ISignDataPayloadText | ISignDataPayloadBinary,
  address: string,
  domain: string,
  timestamp: number,
): Promise<Buffer> {
  const addr = new TonWeb.Address(address);

  // Create workchain buffer
  const wcBuffer = Buffer.alloc(4);
  wcBuffer.writeInt32BE(addr.wc);

  // Create domain buffer
  const domainBuffer = Buffer.from(domain, 'utf8');
  const domainLenBuffer = Buffer.alloc(4);
  domainLenBuffer.writeUInt32BE(domainBuffer.length);

  // Create timestamp buffer
  const tsBuffer = Buffer.alloc(8);
  tsBuffer.writeBigUInt64BE(BigInt(timestamp));

  // Create payload buffer
  const typePrefix = payload.type === 'text' ? 'txt' : 'bin';
  const content = payload.type === 'text' ? payload.text : payload.bytes;
  const encoding = payload.type === 'text' ? 'utf8' : 'base64';

  const payloadPrefix = Buffer.from(typePrefix);
  const payloadBuffer = Buffer.from(content, encoding);
  const payloadLenBuffer = Buffer.alloc(4);
  payloadLenBuffer.writeUInt32BE(payloadBuffer.length);

  // Build message
  const message = Buffer.concat([
    Buffer.from([0xff, 0xff]),
    Buffer.from('ton-connect/sign-data/'),
    wcBuffer,
    addr.hashPart,
    domainLenBuffer,
    domainBuffer,
    tsBuffer,
    payloadPrefix,
    payloadLenBuffer,
    payloadBuffer,
  ]);

  // Hash message with sha256
  return sha256(message);
}

export async function createCellHash(
  payload: ISignDataPayloadCell,
  address: string,
  domain: string,
  timestamp: number,
): Promise<Buffer> {
  const addr = new TonWeb.Address(address);

  const cell = TonWeb.boc.Cell.oneFromBoc(
    Buffer.from(payload.cell, 'base64').toString('hex'),
  );
  const schemaHash = crc32(payload.schema); // unsigned crc32 hash
  const encodedDomain = encodeDnsName(domain).toString('utf8');

  const domainRef = new TonWeb.boc.Cell();
  domainRef.bits.writeString(encodedDomain);

  const message = new TonWeb.boc.Cell();
  message.bits.writeUint(0x75_56_90_22, 32); // prefix
  message.bits.writeUint(schemaHash, 32); // schema hash
  message.bits.writeUint(timestamp, 64); // timestamp
  message.bits.writeAddress(addr); // user wallet address

  message.refs.push(domainRef); // app domain
  message.refs.push(cell); // payload cell

  return Buffer.from(await message.hash());
}

export async function serializeDataPayload({
  payload,
  timestamp,
  appDomain,
  address,
}: {
  payload: ISignDataPayloadText | ISignDataPayloadBinary | ISignDataPayloadCell;
  appDomain: string;
  timestamp: number;
  address: string;
}) {
  if (payload.type === 'text' || payload.type === 'binary') {
    return createTextBinaryHash(payload, address, appDomain, timestamp);
  }
  if (payload.type === 'cell') {
    return createCellHash(payload, address, appDomain, timestamp);
  }
  throw new OneKeyLocalError('Invalid payload type');
}

export async function serializeData({
  message,
  schemaCrc,
  timestamp,
}: {
  message: string;
  schemaCrc: number;
  timestamp: number;
}) {
  const prefix = Buffer.alloc(4 + 8);
  prefix.writeUInt32BE(schemaCrc, 0);
  prefix.writeBigUInt64BE(BigInt(timestamp), 0);
  const cell = TonWeb.boc.Cell.oneFromBoc(
    Buffer.from(message, 'base64').toString('hex'),
  );
  const bytes = Buffer.concat([prefix, await cell.hash()]);
  return {
    cell,
    bytes,
  };
}

export async function serializeProof({
  address,
  appDomain,
  timestamp,
  message,
}: {
  address: string;
  appDomain: string;
  timestamp: number;
  message: string;
}) {
  let prefix = Buffer.from('ffff', 'hex');
  prefix = Buffer.concat([prefix, Buffer.from('ton-connect', 'utf-8')]);

  let msgBytes = Buffer.from('ton-proof-item-v2/', 'utf-8');
  const addr = new TonWeb.Address(address);
  const wcBuffer = Buffer.alloc(4);
  wcBuffer.writeUInt32BE(addr.wc, 0);
  const appDomainBuffer = Buffer.from(appDomain, 'utf-8');
  const appDomainLengthBuffer = Buffer.alloc(4);
  appDomainLengthBuffer.writeUInt32LE(appDomainBuffer.length, 0);
  const timestampBuffer = Buffer.alloc(8);
  timestampBuffer.writeBigUInt64LE(BigInt(timestamp), 0);
  msgBytes = Buffer.concat([
    msgBytes,
    wcBuffer,
    addr.hashPart,
    appDomainLengthBuffer,
    appDomainBuffer,
    timestampBuffer,
    Buffer.from(message, 'utf-8'),
  ]);
  const msgHash = await sha256(msgBytes);
  const bytes = await sha256(Buffer.concat([prefix, msgHash]));

  return {
    msg: msgBytes,
    bytes,
  };
}
