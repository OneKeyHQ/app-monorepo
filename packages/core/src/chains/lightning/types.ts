/** Signature */
export const LightningScenario = 'onekey-lightning-network';

type IRegisterMsgType = {
  scenario: typeof LightningScenario;
  type: 'register';
  pubkey: string;
  address: string;
  randomSeed: number;
};
type IAuthMsgType = {
  scenario: typeof LightningScenario;
  type: 'auth';
  pubkey: string;
  address: string;
  timestamp: number;
  randomSeed: number;
};
type IPaymentBolt11MsgType = {
  scenario: typeof LightningScenario;
  type: 'transfer';
  paymentRequest: string;
  paymentHash: string;
  expired: string;
  created: number;
  nonce: number;
  randomSeed: number;
};

export type IUnionMsgType =
  | IRegisterMsgType
  | IAuthMsgType
  | IPaymentBolt11MsgType;

// export type ILightningHDSignatureParams = {
//   msgPayload: UnionMsgType;
//   engine: Engine;
//   path: string;
//   password: string;
//   entropy: Buffer;
//   isTestnet: boolean;
// };

// export type ILightningHWSIgnatureParams = {
//   msgPayload: UnionMsgType;
//   path: string;
//   isTestnet: boolean;
// };
