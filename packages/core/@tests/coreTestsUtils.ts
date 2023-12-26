import { omit, range } from 'lodash';

import {
  decryptRevealableSeed,
  decryptString,
  encryptImportedCredential,
  mnemonicToRevealableSeed,
} from '../src/secret';

import type {
  ICoreTestsAccountInfo,
  ICoreTestsHdCredential,
  IPrepareCoreChainTestsFixturesOptions,
} from './fixtures/coreTestsFixtures';
import type { CoreChainApiBase } from '../src/base/CoreChainApiBase';
import type {
  EAddressEncodings,
  ICoreApiGetAddressItem,
  ICoreApiNetworkInfo,
  ICoreApiSignAccount,
  ICoreApiSignMsgPayload,
  ICoreApiSignTxPayload,
} from '../src/types';

function expectAccountEqual(
  a: ICoreApiGetAddressItem,
  b: ICoreApiGetAddressItem,
) {
  const a1: ICoreApiGetAddressItem = {
    address: a.address,
    path: a.path,
    publicKey: a.publicKey,
  };
  const b1: ICoreApiGetAddressItem = {
    address: b.address,
    path: b.path,
    publicKey: b.publicKey,
  };
  expect(a1).toEqual(b1);
}

function expectMnemonicValid({
  hdCredential,
}: {
  hdCredential: ICoreTestsHdCredential;
}) {
  const { password } = hdCredential;
  const rsDecrypt2 = mnemonicToRevealableSeed(hdCredential.mnemonic);

  const rsDecrypt = decryptRevealableSeed({
    rs: hdCredential.hdCredentialHex,
    password,
  });
  expect(rsDecrypt.seed).toEqual(rsDecrypt2.seed);
  expect(rsDecrypt.entropyWithLangPrefixed).toEqual(
    rsDecrypt2.entropyWithLangPrefixed,
  );
}
async function expectGetAddressFromPublicOk({
  coreApi,
  networkInfo,
  hdAccounts,
  addressEncoding,
  publicKeyGetter,
}: {
  coreApi: CoreChainApiBase;
  networkInfo: ICoreApiNetworkInfo;
  hdAccounts: IPrepareCoreChainTestsFixturesOptions['hdAccounts'];
  addressEncoding?: EAddressEncodings;
  publicKeyGetter?: (params: { account: ICoreTestsAccountInfo }) => Promise<{
    publicKey: string;
  }>;
}) {
  for (const account of hdAccounts) {
    const publicKey = publicKeyGetter
      ? (await publicKeyGetter({ account })).publicKey
      : account.xpub || account.publicKey;
    const { address, addresses } = await coreApi.getAddressFromPublic({
      networkInfo,
      publicKey,
      addressEncoding,
    });
    expect(address).toEqual(account.address);
    if (addresses) {
      expect(addresses).toEqual(account.addresses);
    }
  }
}

async function expectGetAddressFromPrivateOk({
  coreApi,
  networkInfo,
  hdAccounts,
  addressEncoding,
}: {
  coreApi: CoreChainApiBase;
  networkInfo: ICoreApiNetworkInfo;
  hdAccounts: IPrepareCoreChainTestsFixturesOptions['hdAccounts'];
  addressEncoding?: EAddressEncodings;
}) {
  for (const account of hdAccounts) {
    const { address, addresses } = await coreApi.getAddressFromPrivate({
      networkInfo,
      privateKeyRaw: account.xpvtRaw || account.privateKeyRaw,
      addressEncoding,
    });
    expect(address).toEqual(account.address);
    if (addresses) {
      expect(addresses).toEqual(account.addresses);
    }
  }
}

async function expectGetAddressFromHdOk({
  coreApi,
  networkInfo,
  hdAccounts,
  hdAccountTemplate,
  hdCredential,
  addressEncoding,
}: {
  coreApi: CoreChainApiBase;
  networkInfo: ICoreApiNetworkInfo;
  hdAccounts: IPrepareCoreChainTestsFixturesOptions['hdAccounts'];
  hdAccountTemplate: string;
  hdCredential: ICoreTestsHdCredential;
  addressEncoding?: EAddressEncodings;
}) {
  const indexes = range(0, hdAccounts.length);
  const addresses = await coreApi.getAddressesFromHd({
    networkInfo,
    password: hdCredential.password,
    hdCredential: hdCredential.hdCredentialHex,
    template: hdAccountTemplate,
    indexes,
    addressEncoding,
  });
  for (let i = 0; i < hdAccounts.length; i += 1) {
    expectAccountEqual(addresses.addresses[i], hdAccounts[i]);
  }
}

async function expectGetPrivateKeysHdOk({
  coreApi,
  networkInfo,
  hdAccounts,
  hdCredential,
}: {
  coreApi: CoreChainApiBase;
  networkInfo: ICoreApiNetworkInfo;
  hdAccounts: IPrepareCoreChainTestsFixturesOptions['hdAccounts'];
  hdCredential: ICoreTestsHdCredential;
}) {
  const { password } = hdCredential;
  for (const account of hdAccounts) {
    const keys = await coreApi.getPrivateKeys({
      password,
      account,
      credentials: {
        hd: hdCredential.hdCredentialHex,
      },
      networkInfo,
    });
    let encryptKey = keys[account.path];
    if (!encryptKey && account.relPaths?.[0]) {
      const fullPath = [account.path, account.relPaths?.[0]].join('/');
      encryptKey = keys[fullPath];
    }
    // c1c3e59db78da160261befeef577daa7b54cd756e48601473cfe98d012b3ccfca240a8a3e1a328ee7611ba2688f3fadf1d7c61d36c379c0ced0eec0b66ff9ecd635a8dbfcae4cce36c15c64a79d5873d1d26cbf6c90a36034f96077d66cef413
    expect(encryptKey).toBeTruthy();
    // 105434ca932be16664cb5e44e5b006728577dd757440d068e6d15ef52c15a82f
    const privateKey = decryptString({
      password,
      data: encryptKey,
    });
    expect(privateKey).toEqual(account.privateKeyRaw);
  }
}

async function expectSignTransactionOk({
  coreApi,
  networkInfo,
  account,
  hdCredential,
  txSamples,
}: {
  coreApi: CoreChainApiBase;
  networkInfo: ICoreApiNetworkInfo;
  account: ICoreTestsAccountInfo;
  txSamples: IPrepareCoreChainTestsFixturesOptions['txSamples'];
  hdCredential: ICoreTestsHdCredential;
}) {
  const { password } = hdCredential;
  for (const { encodedTx, unsignedTx, signedTx } of txSamples) {
    const signAccount: ICoreApiSignAccount = account;
    signAccount.pub = signAccount.pub || account.publicKey;
    signAccount.pubKey = signAccount.pubKey || account.publicKey;
    const signTxPayload: ICoreApiSignTxPayload = {
      networkInfo,
      password,
      credentials: {},
      account: signAccount,
      unsignedTx: unsignedTx ?? {
        encodedTx: encodedTx || '',
      },
    };
    const resultHd = await coreApi.signTransaction({
      ...signTxPayload,
      credentials: {
        hd: hdCredential.hdCredentialHex,
      },
    });
    const resultImported = await coreApi.signTransaction({
      ...signTxPayload,
      credentials: {
        imported: encryptImportedCredential({
          password,
          credential: { privateKey: account.privateKeyRaw },
        }),
      },
    });
    expect(resultHd).toEqual(resultImported);
    expect(omit(resultHd, 'encodedTx')).toEqual(omit(signedTx, 'encodedTx'));
  }
}

async function expectSignMessageOk({
  coreApi,
  networkInfo,
  account,
  hdCredential,
  msgSamples,
}: {
  coreApi: CoreChainApiBase;
  networkInfo: ICoreApiNetworkInfo;
  account: ICoreTestsAccountInfo;
  msgSamples: IPrepareCoreChainTestsFixturesOptions['msgSamples'];
  hdCredential: ICoreTestsHdCredential;
}) {
  const { password } = hdCredential;
  for (const { unsignedMsg, signedMsg } of msgSamples) {
    const signMsgPayload: ICoreApiSignMsgPayload = {
      networkInfo,
      password,
      credentials: {},
      account,
      unsignedMsg,
    };
    const resultHd = await coreApi.signMessage({
      ...signMsgPayload,
      credentials: {
        hd: hdCredential.hdCredentialHex,
      },
    });
    const resultImported = await coreApi.signMessage({
      ...signMsgPayload,
      credentials: {
        imported: encryptImportedCredential({
          password,
          credential: { privateKey: account.privateKeyRaw },
        }),
      },
    });
    expect(resultHd).toEqual(resultImported);
    expect(resultHd).toEqual(signedMsg);
  }
}

export default {
  expectAccountEqual,
  expectMnemonicValid,
  expectGetAddressFromPublicOk,
  expectGetAddressFromPrivateOk,
  expectGetAddressFromHdOk,
  expectGetPrivateKeysHdOk,
  expectSignTransactionOk,
  expectSignMessageOk,
};
