import type {
  ICoreApiNetworkInfo,
  ICoreApiSignBtcExtraInfo,
  IEncodedTx,
  ISignedTxPro,
  IUnsignedMessage,
  IUnsignedTxPro,
} from '../../src/types';

export type ICoreTestsAccountInfo = {
  address: string;
  addresses?: Record<string, string>;
  path: string;
  relPaths?: string[];
  xpub?: string;
  xpvtRaw?: string;
  publicKey: string; // pub, pubKey TODO rename
  // publicKeyHex
  privateKeyRaw: string;
};
export type ICoreTestsHdCredential = {
  password: string;
  mnemonic: string;
  entropy: string;
  seed: string;
};
const hdCredential1: ICoreTestsHdCredential = {
  password: '11111111',
  mnemonic:
    'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote',
  entropy:
    '9e52bc917a85268333b29f2d2d8c52d5ed7499fe05427045599035abc314f5ccc21d4e5e5c3e2f464e9c7f59c08557df46d9a43a182fe2b10ff85d90230aaa2940031ec5d7f724de6fbee266950440b72dd5f0057ba98e2d82a60186d9bf23f3',
  seed: 'da75e3c1207030089d2372aa17d943f1d36e7d1bfa3f2e871aa11c27d34ef025300bb293e17704215ea94196190cacc22ee352b191e55e3208bd53c04fda3854c86ca13f5a86c36ad21b21cc35492c0b59793718bc49a1a821628535cc1bcf8dcbeb82d1b36e1c81c3548142f4555641913d9aa6d6bab5ae3f73f85616dacd18',
};

export type IPrepareCoreChainTestsFixturesOptions = {
  hdCredential?: ICoreTestsHdCredential;
  networkInfo: ICoreApiNetworkInfo;
  hdAccountTemplate: string;
  hdAccounts: ICoreTestsAccountInfo[];
  // TODO
  // hdAccountsInfo: {accounts, template}[]
  txSamples: Array<{
    btcExtraInfo?: ICoreApiSignBtcExtraInfo;
    encodedTx?: IEncodedTx;
    unsignedTx?: IUnsignedTxPro;
    signedTx: ISignedTxPro;
  }>;
  msgSamples: Array<{ unsignedMsg: IUnsignedMessage; signedMsg: string }>;
};
function prepareCoreChainTestsFixtures(
  options: IPrepareCoreChainTestsFixturesOptions,
) {
  const hdCredential = options.hdCredential || hdCredential1;
  return {
    ...options,
    hdCredential,
    password: hdCredential.password,
  };
}

export default {
  prepareCoreChainTestsFixtures,
  hdCredential1,
};
