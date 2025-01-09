import TonWeb from 'tonweb';

import { sha256 } from '../../../secret';

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
  const msgHash = sha256(msgBytes);
  const bytes = sha256(Buffer.concat([prefix, msgHash]));

  return {
    msg: msgBytes,
    bytes,
  };
}
