/* eslint-disable camelcase */
import { arrayify } from '@ethersproject/bytes';

import { wait } from '@onekeyhq/kit/src/utils/helper';
import { IMPL_STC } from '@onekeyhq/shared/src/engine/engineConsts';

import { prepareMockVault } from '../../../../../@tests/prepareMockVault';
import { getAccountNameInfoByImpl } from '../../../../managers/impl';
import { StarcoinTypes, bcs, encoding } from '../sdk';
import Vault from '../Vault';
import VaultHelper from '../VaultHelper';

import type { IPrepareMockVaultOptions } from '../../../../../@tests/types';
import type { KeyringBase } from '../../../keyring/KeyringBase';
import type { KeyringSoftwareBase } from '../../../keyring/KeyringSoftwareBase';
import type { IPrepareAccountsParams } from '../../../types';
import type { VaultBase } from '../../../VaultBase';

const stcAccountNameInfo = getAccountNameInfoByImpl(IMPL_STC);
const prepareAccountsParams = {
  indexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  coinType: stcAccountNameInfo.default.coinType,
  template: stcAccountNameInfo.default.template,
};

export async function testPrepareAccounts(
  prepareOptions: IPrepareMockVaultOptions,
  builder: {
    keyring: (payload: { vault: VaultBase }) => KeyringBase;
  },
) {
  const { options, dbAccount } = prepareMockVault(prepareOptions);
  const vault = new Vault(options);
  vault.helper = new VaultHelper(options);
  const keyring = builder.keyring({ vault });
  const accounts = await keyring.prepareAccounts({
    ...prepareAccountsParams,
    name: dbAccount.name,
    target: dbAccount.address,
    accountIdPrefix: 'external',
    password: prepareOptions.password,
    privateKey: prepareOptions.privateKey
      ? Buffer.from(prepareOptions.privateKey, 'hex')
      : '',
  } as IPrepareAccountsParams);
  expect(accounts[0]).toEqual({
    ...dbAccount,
    address: dbAccount.address.startsWith('stc')
      ? `0x${
          encoding.decodeReceiptIdentifier(dbAccount.address).accountAddress
        }`
      : dbAccount.address,
  });
}

export async function testSignTransaction(
  prepareOptions: IPrepareMockVaultOptions,
  builder: {
    keyring: (payload: { vault: VaultBase }) => KeyringSoftwareBase;
  },
) {
  const { options, dbAccount, password } = prepareMockVault(prepareOptions);

  expect(password).toBeTruthy();

  const vault = new Vault(options);
  vault.helper = new VaultHelper(options);

  const keyring = builder.keyring({ vault });

  const encodedTx = await vault.buildEncodedTxFromTransfer({
    from: dbAccount.address,
    to: dbAccount.address,
    amount: '12',
    'token': '',
  });
  const feeInfoValue = {
    'eip1559': false,
    'price': '0.000000001',
    'limit': '21000',
  };

  const encodedTxWithFee = await vault.attachFeeInfoToEncodedTx({
    encodedTx,
    feeInfoValue,
  });
  const unsignedTx = await vault.buildUnsignedTxFromEncodedTx(encodedTxWithFee);
  // 签名使用的是 elliptic
  const { rawTx, signature } = await keyring.signTransaction(unsignedTx, {
    password,
  });
  const bytes = arrayify(rawTx);
  const de = new bcs.BcsDeserializer(bytes);
  const scsDadta = StarcoinTypes.SignedUserTransaction.deserialize(de);
  const signers = await keyring.getSigners(password || '', [dbAccount.address]);
  const signer = signers[dbAccount.address];

  const serializer = new bcs.BcsSerializer();
  scsDadta.raw_txn.serialize(serializer);
  const digest = serializer.getBytes();
  const params = {
    publicKey: (await signer.getPubkey()).toString('hex'),
    digest: Buffer.from(digest),
    signature: Buffer.from(signature || ''),
  };
  const isVerified = signer.verifySignature(params);
  expect(isVerified).toBeTruthy();
  await wait(1000);
}
