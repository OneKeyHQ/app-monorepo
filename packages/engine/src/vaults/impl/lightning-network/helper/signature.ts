import stringify from 'fast-json-stable-stringify';

import { getBtcProvider } from './account';

import type { Engine } from '../../../..';

export const LightningScenario = 'onekey-lightning-network';

type RegisterMsgType = {
  scenario: typeof LightningScenario;
  type: 'register';
  pubkey: string;
  address: string;
};
type AuthMsgType = {
  scenario: typeof LightningScenario;
  type: 'auth';
  pubkey: string;
  address: string;
  timestamp: number;
};
type PaymentBolt11MsgType = {
  scenario: typeof LightningScenario;
  type: 'transfer';
  invoice: string;
  paymentHash: string;
  expired: string;
  created: number;
  nonce: number;
};

type UnionMsgType = RegisterMsgType | AuthMsgType | PaymentBolt11MsgType;

const generateMessage = (msgPayload: UnionMsgType) => {
  if (msgPayload.type === 'register') {
    return {
      scenario: LightningScenario,
      type: 'register',
      pubkey: msgPayload.pubkey,
      address: msgPayload.address,
    };
  }
  if (msgPayload.type === 'auth') {
    return {
      scenario: LightningScenario,
      type: 'auth',
      pubkey: msgPayload.pubkey,
      address: msgPayload.address,
      timestamp: msgPayload.timestamp,
    };
  }
  if (msgPayload.type === 'transfer') {
    return {
      scenario: LightningScenario,
      type: 'transfer',
      invoice: msgPayload.invoice,
      paymentHash: msgPayload.paymentHash,
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
  const provider = await getBtcProvider(engine);
  const result = provider.signMessage(
    password,
    entropy,
    `${path}/0/0`,
    stringify(message),
  );
  return result.toString('hex');
};
