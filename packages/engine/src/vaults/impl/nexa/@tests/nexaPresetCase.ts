import { wait } from '@onekeyhq/kit/src/utils/helper';
import { IMPL_NEXA, SEPERATOR } from '@onekeyhq/shared/src/engine/engineConsts';

import { prepareMockVault } from '../../../../../@tests/prepareMockVault';
import { getAccountNameInfoByImpl } from '../../../../managers/impl';
import { verify } from '../sdk';
import { publickeyToAddress } from '../utils';
import Vault from '../Vault';
import VaultHelper from '../VaultHelper';

import type { IPrepareMockVaultOptions } from '../../../../../@tests/types';
import type { KeyringBase } from '../../../keyring/KeyringBase';
import type { KeyringSoftwareBase } from '../../../keyring/KeyringSoftwareBase';
import type { IPrepareAccountsParams } from '../../../types';
import type { VaultBase } from '../../../VaultBase';

const nexaAccountNameInfo = getAccountNameInfoByImpl(IMPL_NEXA);
const prepareAccountsParams = {
  indexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  coinType: nexaAccountNameInfo.default.coinType,
  template: nexaAccountNameInfo.default.template,
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
    privateKey: prepareOptions?.privateKey
      ? Buffer.from(prepareOptions.privateKey, 'hex')
      : undefined,
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
  const chainId = network.id.split(SEPERATOR).pop() || 'testnet';
  const encodeAddress = publickeyToAddress(
    Buffer.from(dbAccount.address, 'hex'),
    chainId,
  );
  const encodedTx = await vault.buildEncodedTxFromTransfer({
    from: encodeAddress,
    to: 'nexatest:nqtsq5g5wud2fr7l32as0mfzms3hwnz7dxvsc2h8szatr5p8',
    amount: '50',
  });
  const unsignedTx = await vault.buildUnsignedTxFromEncodedTx(encodedTx);
  // engine/src/proxy.ts  sign
  // TODO return signer from keyring.signTransaction
  const signedTx = await keyring.signTransaction(unsignedTx, {
    password,
  });

  const signers = await keyring.getSigners(password || '', [encodeAddress]);
  const signer = signers[encodeAddress];
  const publicKey = await signer.getPubkey(true);
  expect(
    verify(
      publicKey,
      Buffer.from(signedTx.digest || '', 'hex'),
      Buffer.from(signedTx.signature || '', 'hex'),
    ),
  ).toBeTruthy();
  await wait(1000);
}
