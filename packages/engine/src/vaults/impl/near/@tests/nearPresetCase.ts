import { wait } from '@onekeyhq/kit/src/utils/helper';
import { IMPL_NEAR } from '@onekeyhq/shared/src/engine/engineConsts';

import { prepareMockVault } from '../../../../../@tests/prepareMockVault';
import { getAccountNameInfoByImpl } from '../../../../managers/impl';
import { deserializeSignedTransaction } from '../utils';
import Vault from '../Vault';
import VaultHelper from '../VaultHelper';

import type { IPrepareMockVaultOptions } from '../../../../../@tests/types';
import type { KeyringBase } from '../../../keyring/KeyringBase';
import type { KeyringSoftwareBase } from '../../../keyring/KeyringSoftwareBase';
import type { IPrepareAccountsParams } from '../../../types';
import type { VaultBase } from '../../../VaultBase';

export async function testSignTransaction(
  prepareOptions: IPrepareMockVaultOptions,
  builder: {
    keyring: (payload: { vault: VaultBase }) => KeyringSoftwareBase;
  },
) {
  // expect.assertions(2);

  const { options, dbAccount, password } = prepareMockVault(prepareOptions);

  expect(password).toBeTruthy();

  const vault = new Vault(options);
  vault.helper = new VaultHelper(options);

  const keyring = builder.keyring({ vault });

  const encodedTx = await vault.buildEncodedTxFromTransfer({
    from: dbAccount.address,
    to: dbAccount.address,
    amount: '0.0001',
  });
  const unsignedTx = await vault.buildUnsignedTxFromEncodedTx(encodedTx);
  // engine/src/proxy.ts  sign
  // TODO return signer from keyring.signTransaction
  const signedTx = await keyring.signTransaction(unsignedTx, {
    password,
  });
  console.log(signedTx);
  const nativeTx = deserializeSignedTransaction(signedTx.rawTx);

  const signers = await keyring.getSigners(password || '', [dbAccount.address]);
  const signer = signers[dbAccount.address];
  const isVerified = await signer.verifySignature({
    digest: `${signedTx.digest || ''}`,
    publicKey: `${dbAccount.address || ''}`,
    signature: nativeTx.signature.data,
  });

  expect(isVerified).toBeTruthy();
  await wait(1000);
}

const nearAccountNameInfo = getAccountNameInfoByImpl(IMPL_NEAR);
const prepareAccountsParams = {
  indexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  coinType: nearAccountNameInfo.default.coinType,
  template: nearAccountNameInfo.default.template,
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
    privateKey: prepareOptions?.privateKey,
  } as IPrepareAccountsParams);
  expect(accounts[0]).toEqual(dbAccount);
}
