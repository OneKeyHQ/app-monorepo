import stringify from 'fast-json-stable-stringify';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { getBtcProvider } from './account';

import type { Engine } from '../../../..';

export const LightningScenario = 'onekey-lightning-network';

type RegisterMsgType = {
  scenario: typeof LightningScenario;
  type: 'register';
  pubkey: string;
  address: string;
  randomSeed: number;
};
type AuthMsgType = {
  scenario: typeof LightningScenario;
  type: 'auth';
  pubkey: string;
  address: string;
  timestamp: number;
  randomSeed: number;
};
type PaymentBolt11MsgType = {
  scenario: typeof LightningScenario;
  type: 'transfer';
  invoice: string;
  paymentHash: string;
  expired: string;
  created: number;
  nonce: number;
  randomSeed: number;
};

export type UnionMsgType = RegisterMsgType | AuthMsgType | PaymentBolt11MsgType;

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
  const provider = await getBtcProvider(engine);
  const result = provider.signMessage(
    password,
    entropy,
    `${path}/0/0`,
    stringify(msgPayload),
  );
  debugLogger.common.debug(
    `Lightning Signature, msgPayload: ${stringify(
      msgPayload,
    )}, path: ${path}, result: ${result.toString('hex')}`,
  );
  return result.toString('hex');
};
