import { wait } from '@onekeyhq/kit/src/utils/helper';

import { prepareMockVault } from '../../../../../@tests/prepareMockVault';
import { deserializeSignedTransaction } from '../utils';
import Vault from '../Vault';
import VaultHelper from '../VaultHelper';

import type { IPrepareMockVaultOptions } from '../../../../../@tests/types';
import type { KeyringSoftwareBase } from '../../../keyring/KeyringSoftwareBase';
import type { VaultBase } from '../../../VaultBase';

async function testSignTransaction(
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

export default {
  testSignTransaction,
};
