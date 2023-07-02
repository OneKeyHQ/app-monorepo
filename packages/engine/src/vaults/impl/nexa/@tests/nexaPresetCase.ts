import {
  Networks,
  PrivateKey,
  PublicKey,
  Transaction,
  crypto,
} from 'nexcore-lib';

import { wait } from '@onekeyhq/kit/src/utils/helper';
import { IMPL_NEXA } from '@onekeyhq/shared/src/engine/engineConsts';

import { prepareMockVault } from '../../../../../@tests/prepareMockVault';
import { getAccountNameInfoByImpl } from '../../../../managers/impl';
import Vault from '../Vault';
import VaultHelper from '../VaultHelper';

import type { IPrepareMockVaultOptions } from '../../../../../@tests/types';
import type { KeyringBase } from '../../../keyring/KeyringBase';
import type { KeyringSoftwareBase } from '../../../keyring/KeyringSoftwareBase';
import type { IPrepareAccountsParams } from '../../../types';
import type { VaultBase } from '../../../VaultBase';

const nearAccountNameInfo = getAccountNameInfoByImpl(IMPL_NEXA);
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
    to: 'nexatest:nqtsq5g5wud2fr7l32as0mfzms3hwnz7dxvsc2h8szatr5p8',
    amount: '50',
  });
  const unsignedTx = await vault.buildUnsignedTxFromEncodedTx(encodedTx);
  // engine/src/proxy.ts  sign
  // TODO return signer from keyring.signTransaction
  const signedTx = await keyring.signTransaction(unsignedTx, {
    password,
  });
  console.error(signedTx.rawTx);
  // const transaction = new Transaction(signedTx.rawTx);

  const signers = await keyring.getSigners(password || '', [dbAccount.address]);
  const signer = signers[dbAccount.address];
  expect(signedTx.txid).toBe(
    '1e04ea46dbbddf5291df961bf02f4d9158e0e90421379165c6a0b5fe897b9f33',
  );
  expect(signedTx.rawTx).toBe(
    '00040078c03cc5ed749b3c484b2edbedaa24790832f3da0b066fc301e9b87621173fb364222102f6e52d3ae26271c9afe56f6bc513727207d976651bc6f3843714fc59721a79d2400a0c5f8078469e22a5431b91891fbe300e2bbd840347f3b3e6668fc85ac6f8370d01cba0b36663009f02ba94d5dccca6731eb437a3082a18493ce2daabb5e53bffffffff10270000000000000058849bcfbb64e89a0b8c8cdab984421c1875b08096284a79fdc6a813374e16a164222102f6e52d3ae26271c9afe56f6bc513727207d976651bc6f3843714fc59721a79d2400a0c5f8078469e22a5431b91891fbe300e2bbd840347f3b3e6668fc85ac6f8370d01cba0b36663009f02ba94d5dccca6731eb437a3082a18493ce2daabb5e53bffffffff50c300000000000000ba27a4cafbcf68b9de413f6f73aea6cadbc538790cef585bb9e7a93ac021e28664222102f6e52d3ae26271c9afe56f6bc513727207d976651bc6f3843714fc59721a79d2400a0c5f8078469e22a5431b91891fbe300e2bbd840347f3b3e6668fc85ac6f8370d01cba0b36663009f02ba94d5dccca6731eb437a3082a18493ce2daabb5e53bffffffff8813000000000000003945742ca2c89fb6c6faea59749fc9cb7c174622681db92647bd1392ff95c30e64222102f6e52d3ae26271c9afe56f6bc513727207d976651bc6f3843714fc59721a79d2400a0c5f8078469e22a5431b91891fbe300e2bbd840347f3b3e6668fc85ac6f8370d01cba0b36663009f02ba94d5dccca6731eb437a3082a18493ce2daabb5e53bffffffff50c30000000000000201881300000000000017005114771aa48fdf8abb07ed22dc23774c5e69990c2ae701fda501000000000017005114fff72bf1654f0505d4a588b76d2b6728dca4097c00000000',
  );

  // const signers = await keyring.getSigners(password || '', [dbAccount.address]);
  // const signer = signers[dbAccount.address];
  // const isVerified = await signer.verifySignature({
  //   digest: `${signedTx.digest || ''}`,
  //   publicKey: `${dbAccount.address || ''}`,
  //   signature: nativeTx.signature.data,
  // });
  // expect(isVerified).toBeTruthy();
  await wait(1000);
}
