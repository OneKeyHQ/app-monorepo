import { omit, range } from 'lodash';

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import {
  decryptString,
  encryptString,
  revealableSeedFromMnemonic,
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
  const { seed, entropyWithLangPrefixed } = revealableSeedFromMnemonic(
    hdCredential.mnemonic,
    password,
  );
  expect(
    decryptString({
      password,
      data: bufferUtils.bytesToHex(seed),
    }),
  ).toEqual(
    decryptString({
      password,
      data: hdCredential.seed,
    }),
  );
  expect(
    decryptString({
      password,
      data: bufferUtils.bytesToHex(entropyWithLangPrefixed),
    }),
  ).toEqual(
    decryptString({
      password,
      data: hdCredential.entropy,
    }),
  );
}
async function expectGetAddressFromPublicOk({
  coreApi,
  networkInfo,
  hdAccounts,
  publicKeyGetter,
}: {
  coreApi: CoreChainApiBase;
  networkInfo: ICoreApiNetworkInfo;
  hdAccounts: IPrepareCoreChainTestsFixturesOptions['hdAccounts'];
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
}: {
  coreApi: CoreChainApiBase;
  networkInfo: ICoreApiNetworkInfo;
  hdAccounts: IPrepareCoreChainTestsFixturesOptions['hdAccounts'];
}) {
  for (const account of hdAccounts) {
    const { address, addresses } = await coreApi.getAddressFromPrivate({
      networkInfo,
      privateKeyRaw: account.xpvtRaw || account.privateKeyRaw,
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
    hdCredential,
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
        hd: hdCredential,
      },
      networkInfo,
    });
    let encryptKey = keys[account.path];
    if (!encryptKey && account.relPaths?.[0]) {
      const fullPath = [account.path, account.relPaths?.[0]].join('/');
      encryptKey = keys[fullPath];
    }
    expect(encryptKey).toBeTruthy();
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
        inputs: [],
        outputs: [],
        payload: {},
        encodedTx: encodedTx || '',
      },
    };
    const resultHd = await coreApi.signTransaction({
      ...signTxPayload,
      credentials: {
        hd: hdCredential,
      },
    });
    const resultImported = await coreApi.signTransaction({
      ...signTxPayload,
      credentials: {
        imported: {
          privateKey: encryptString({
            password,
            data: account.privateKeyRaw,
          }),
        },
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
        hd: hdCredential,
      },
    });
    const resultImported = await coreApi.signMessage({
      ...signMsgPayload,
      credentials: {
        imported: {
          privateKey: encryptString({
            password,
            data: account.privateKeyRaw,
          }),
        },
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
