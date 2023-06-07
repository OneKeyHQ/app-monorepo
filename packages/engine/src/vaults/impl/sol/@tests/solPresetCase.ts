import { VersionedTransaction } from '@solana/web3.js';

import { wait } from '@onekeyhq/kit/src/utils/helper';
import { IMPL_SOL } from '@onekeyhq/shared/src/engine/engineConsts';

import { prepareMockVault } from '../../../../../@tests/prepareMockVault';
import { getAccountNameInfoByImpl } from '../../../../managers/impl';
import Vault from '../Vault';
import VaultHelper from '../VaultHelper';

import type { IPrepareMockVaultOptions } from '../../../../../@tests/types';
import type { KeyringBase } from '../../../keyring/KeyringBase';
import type { KeyringSoftwareBase } from '../../../keyring/KeyringSoftwareBase';
import type { IPrepareAccountsParams } from '../../../types';
import type { VaultBase } from '../../../VaultBase';

const sqlAccountNameInfo = getAccountNameInfoByImpl(IMPL_SOL);
const prepareAccountsParams = {
  indexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  coinType: sqlAccountNameInfo.default.coinType,
  template: sqlAccountNameInfo.default.template,
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
  const { address } = dbAccount;
  const encodedTx = await vault.buildEncodedTxFromTransfer({
    from: address,
    to: address,
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

  const signedTx = await keyring.signTransaction(unsignedTx, {
    password,
  });

  const nativeTx = VersionedTransaction.deserialize(
    new Uint8Array(Buffer.from(signedTx.rawTx, 'base64')),
  );

  const signers = await keyring.getSigners(password || '', [dbAccount.address]);
  const signer = signers[dbAccount.address];
  const params = {
    digest: Buffer.from(nativeTx.message.serialize()),
    publicKey: (await signer.getPubkey()).toString('hex'),
    signature: Buffer.from(nativeTx.signatures[0]),
  };
  const isVerified = await signer.verifySignature(params);
  expect(isVerified).toBeTruthy();
  await wait(1000);
}

export type SOLPresetCaseType = {
  testPrepareAccounts: typeof testPrepareAccounts;
  testSignTransaction: typeof testSignTransaction;
};
