import { getProvider } from './account';

import type { Engine } from '../../../..';

type RegisterMsgType = { type: 'register'; pubkey: string; address: string };
type PaymentBolt11MsgType = {
  type: 'transfer';
  invoice: string;
  expired: string;
  created: number;
  nonce: number;
};

type UnionMsgType = RegisterMsgType | PaymentBolt11MsgType;

const generateMessage = (msgPayload: UnionMsgType) => {
  if (msgPayload.type === 'register') {
    return {
      type: 'register',
      pubkey: msgPayload.pubkey,
      address: msgPayload.address,
    };
  }
  if (msgPayload.type === 'transfer') {
    return {
      type: 'transfer',
      invoice: msgPayload.invoice,
      expired: msgPayload.expired,
      created: msgPayload.created,
      nonce: msgPayload.nonce,
    };
  }
  return {};
};

export const signature = async ({
  msgPayload,
  engine,
  path,
  password,
  entropy,
}: {
  msgPayload: UnionMsgType;
  engine: Engine;
  path: string;
  password: string;
  entropy: Buffer;
}) => {
  const message = generateMessage(msgPayload);
  const provider = await getProvider(engine);
  const result = provider.signMessage(
    password,
    entropy,
    `${path}/0/0`,
    JSON.stringify(message),
  );
  return result.toString('hex');
};
