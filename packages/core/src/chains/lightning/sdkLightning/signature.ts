import bitcoinMessage from 'bitcoinjs-message';
import stringify from 'fast-json-stable-stringify';

import { IMPL_BTC, IMPL_TBTC } from '@onekeyhq/shared/src/engine/engineConsts';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { getBitcoinECPair, getBtcForkNetwork } from '../../btc/sdkBtc';

import type { ILightningHDSignatureParams } from '../types';

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
  invoice: string;
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

export const signLightningMessage = async ({
  msgPayload,
  signer,
  isTestnet,
}: ILightningHDSignatureParams) => {
  const impl = isTestnet ? IMPL_TBTC : IMPL_BTC;
  const network = getBtcForkNetwork(impl);
  const privateKey = await signer.getPrvkey();
  const keyPair = getBitcoinECPair().fromPrivateKey(privateKey, {
    network,
  });
  const result = bitcoinMessage.sign(
    stringify(msgPayload),
    checkIsDefined(keyPair.privateKey),
    keyPair.compressed,
    { segwitType: 'p2wpkh' },
  );

  return result.toString('hex');
};
