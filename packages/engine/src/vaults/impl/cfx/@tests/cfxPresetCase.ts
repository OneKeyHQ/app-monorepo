import { decode, encode } from '@conflux-dev/conflux-address-js';
import { Transaction } from 'js-conflux-sdk';
import format from 'js-conflux-sdk/src/util/format';
import * as rlp from 'js-conflux-sdk/src/util/rlp';
import { keccak256 } from 'js-conflux-sdk/src/util/sign';
import lodash from 'lodash';
import secp256k1 from 'secp256k1-v3/index';

import { wait } from '@onekeyhq/kit/src/utils/helper';
import { IMPL_CFX } from '@onekeyhq/shared/src/engine/engineConsts';

import { prepareMockVault } from '../../../../../@tests/prepareMockVault';
import { getAccountNameInfoByImpl } from '../../../../managers/impl';
import { Signer } from '../../../../proxy';
import Vault from '../Vault';
import VaultHelper from '../VaultHelper';

import type { IPrepareMockVaultOptions } from '../../../../../@tests/types';
import type { KeyringBase } from '../../../keyring/KeyringBase';
import type { KeyringSoftwareBase } from '../../../keyring/KeyringSoftwareBase';
import type { IPrepareAccountsParams } from '../../../types';
import type { VaultBase } from '../../../VaultBase';

const cfxAccountNameInfo = getAccountNameInfoByImpl(IMPL_CFX);
const prepareAccountsParams = {
  indexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  coinType: cfxAccountNameInfo.default.coinType,
  template: cfxAccountNameInfo.default.template,
};

// require('js-conflux-sdk/src/util/sign').ecdsaRecover = (
//   hash: any,
//   { r, s, v }: any,
// ) => {
//   const senderPublic = secp256k1.recover(hash, Buffer.concat([r, s]), v);
//   return secp256k1.publicKeyConvert(senderPublic, false).slice(1);
// };
function isHexString(v: string) {
  return lodash.isString(v) && v.match(/^0x[0-9A-Fa-f]*$/);
}

function publicKeyToAddress(publicKey) {
  if (isHexString(publicKey))
    publicKey = Buffer.from(publicKey.slice(2), 'hex');
  if (!Buffer.isBuffer(publicKey))
    throw new Error('publicKey should be a buffer');
  if (publicKey.length === 65) publicKey = publicKey.slice(1);
  if (publicKey.length !== 64)
    throw new Error('publicKey length should be 64 or 65');
  const buffer = keccak256(publicKey).slice(-20);
  buffer[0] = (buffer[0] & 0x0f) | 0x10; // eslint-disable-line no-bitwise
  return buffer;
}

const decodeRaw = (raw: any) => {
  const [
    [nonce, gasPrice, gas, to, value, storageLimit, epochHeight, chainId, data],
    v,
    r,
    s,
  ] = rlp.decode(raw);

  const netId = format.uInt(chainId);
  const tx = new Transaction({
    nonce: format.bigIntFromBuffer(nonce),
    gasPrice: format.bigIntFromBuffer(gasPrice),
    gas: format.bigIntFromBuffer(gas),
    to: to.length === 0 ? null : format.address(to, netId),
    value: format.bigIntFromBuffer(value),
    storageLimit: format.bigIntFromBuffer(storageLimit),
    epochHeight: format.bigIntFromBuffer(epochHeight),
    chainId: format.uInt(chainId),
    data: format.hex(data),
    v: v.length === 0 ? 0 : format.uInt(v),
    r: format.hex(r),
    s: format.hex(s),
  });

  function ecdsaRecover(hash, { r, s, v }) {
    const senderPublic = secp256k1.recover(hash, Buffer.concat([r, s]), v);
    return secp256k1.publicKeyConvert(senderPublic, false).slice(1);
  }

  const aaa = tx.encode(false);
  const bbb = keccak256(aaa);
  const _publicKey = ecdsaRecover(bbb, {
    r: format.hexBuffer(tx.r),
    s: format.hexBuffer(tx.s),
    v: format.uInt(tx.v),
  });
  const publicKey = format.publicKey(_publicKey);
  const hexAddress = publicKeyToAddress(format.hexBuffer(publicKey));
  tx.from = format.address(hexAddress, netId);
  return tx;
};

const encodeAddress = (address: string, networkId: string) =>
  encode(
    Buffer.from(address.slice(2), 'hex'),
    parseInt(String(networkId.split('--').pop())),
  );

export async function testPrepareAccounts(
  prepareOptions: IPrepareMockVaultOptions,
  builder: {
    keyring: (payload: { vault: VaultBase }) => KeyringBase;
  },
) {
  const { options, dbAccount, network } = prepareMockVault(prepareOptions);
  const vault = new Vault(options);
  vault.helper = new VaultHelper(options);
  const keyring = builder.keyring({ vault });
  const accounts = await keyring.prepareAccounts({
    ...prepareAccountsParams,
    name: dbAccount.name,
    target: encodeAddress(dbAccount.address, network.id),
    accountIdPrefix: 'external',
    password: prepareOptions.password,
    privateKey: prepareOptions?.privateKey,
  } as IPrepareAccountsParams);
  expect(accounts[0]).toEqual(dbAccount);
}

export async function testSignTransaction(
  prepareOptions: IPrepareMockVaultOptions,
  builder: {
    keyring: (payload: { vault: VaultBase }) => KeyringSoftwareBase;
  },
) {
  const { options, dbAccount, password, network } =
    prepareMockVault(prepareOptions);

  expect(password).toBeTruthy();

  const vault = new Vault(options);
  vault.helper = new VaultHelper(options);

  const keyring = builder.keyring({ vault });
  //   {
  //     "from": "cfxtest:aak8b0wvw0fpnj9rkn8an2xyax9eue2b4eg78c349c",
  //     "to": "cfxtest:aapvwppysj3tcnvvpc77p420ax28se84v2gt0j3spc",
  //     "amount": "12",
  //     "token": "",
  //     "networkId": "cfx--1",
  //     "accountId": "hd-1--m/44'/503'/0'/0/0"
  // }
  const encodedTx = await vault.buildEncodedTxFromTransfer({
    from: 'cfxtest:aak8b0wvw0fpnj9rkn8an2xyax9eue2b4eg78c349c',
    to: 'cfxtest:aapvwppysj3tcnvvpc77p420ax28se84v2gt0j3spc',
    amount: '12',
    'token': '',
  });
  // const encodedTx = {
  //   'from': 'cfxtest:aak8b0wvw0fpnj9rkn8an2xyax9eue2b4eg78c349c',
  //   'to': 'cfxtest:aapvwppysj3tcnvvpc77p420ax28se84v2gt0j3spc',
  //   'value': '0xa688906bd8b00000',
  //   'data': '0x',
  // };
  // const unsignedTx = await vault.buildUnsignedTxFromEncodedTx(encodedTx);
  const unsignedTx = {
    'inputs': [],
    'outputs': [],
    'payload': {
      'encodedTx': {
        'from': 'cfxtest:aak8b0wvw0fpnj9rkn8an2xyax9eue2b4eg78c349c',
        'to': 'cfxtest:aapvwppysj3tcnvvpc77p420ax28se84v2gt0j3spc',
        'value': '0xa688906bd8b00000',
        'data': '0x',
        'gas': '0x5208',
        'gasLimit': '0x5208',
        'gasPrice': '1000000000',
        'nonce': 6,
        'epochHeight': 124992145,
        'chainId': 1,
        'storageLimit': '0',
      },
    },
    'encodedTx': {
      'from': 'cfxtest:aak8b0wvw0fpnj9rkn8an2xyax9eue2b4eg78c349c',
      'to': 'cfxtest:aapvwppysj3tcnvvpc77p420ax28se84v2gt0j3spc',
      'value': '0xa688906bd8b00000',
      'data': '0x',
      'gas': '0x5208',
      'gasLimit': '0x5208',
      'gasPrice': '1000000000',
      'nonce': 6,
      'epochHeight': 124992145,
      'chainId': 1,
      'storageLimit': '0',
    },
  };
  const signedTx = await keyring.signTransaction(unsignedTx, {
    password,
  });
  // const nativeTx = deserializeSignedTransaction(signedTx.rawTx);

  // const signers = await keyring.getSigners(password || '', [dbAccount.address]);
  // const signer = signers[dbAccount.address];
  // const isVerified = await signer.verifySignature({
  //   digest: `${signedTx.digest || ''}`,
  //   publicKey: `${dbAccount.address || ''}`,
  //   signature: nativeTx.signature.data,
  // });
  const natvieTx = decodeRaw(signedTx.rawTx);
  // const signers = await keyring.getSigners(password || '', [
  //   'cfxtest:aak8b0wvw0fpnj9rkn8an2xyax9eue2b4eg78c349c',
  // ]);
  // const signer = signers['cfxtest:aak8b0wvw0fpnj9rkn8an2xyax9eue2b4eg78c349c'];
  // const keys = await keyring.getPrivateKeys(password);
  // const singer = new Signer(privateKey, password!, 'secp256k1');
  // const isVerified = await signer.verifySignature({
  //   digest: `${signedTx.digest || ''}`,
  //   publicKey: `${'cfxtest:aak8b0wvw0fpnj9rkn8an2xyax9eue2b4eg78c349c' || ''}`,
  //   signature: natvieTx.data,
  // });
  expect(isVerified).toBeTruthy();
  await wait(1000);
}
