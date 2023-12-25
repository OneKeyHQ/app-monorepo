import type {
  ICoreApiNetworkInfo,
  ICoreApiSignBtcExtraInfo,
  ICoreHdCredentialEncryptHex,
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
  hdCredentialHex: ICoreHdCredentialEncryptHex;
  // entropy: string;
  // seed: string;
};
const hdCredential1: ICoreTestsHdCredential = {
  // evm first account: 0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e
  password: '11111111',
  mnemonic:
    'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote',
  hdCredentialHex:
    '78e8626a7bae1b46d968805c735a9562383609680054aa171a89eb8c62619894658ce972354b5467668f074084b135b9c41dc6570d09bb5daeb4325f3429e8ddf9b663c508464f7ee152e2e3190ef7fe036cdc1a351d2e75849aa5d0947b3137e82789b80718763b6187f710a89738655b0295518dd3d43393c7f95138699cead6a95efde511ad040a73a23ddc3a39c32ceb48793d49e93cb8e8dc4633d0402ebf23519fe9fb238f6a6e19509bab3d72b62f3d6cf588772821f6460876477c91c82dd1c1f5b9cbfd9e7a5afa87dd672e49d64959d1c03d00765d643e37b5bfe1ab3ba95537db7d4776c8b520583518f19bcd3e9fcb028c596c40defcc0f1ecf21099b14893c408e1370293278c2a311a92a519f650355376df068bb0a345e0cd',
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
