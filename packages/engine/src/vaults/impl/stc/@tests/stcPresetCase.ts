/* eslint-disable camelcase */

import { IMPL_STC } from '@onekeyhq/shared/src/engine/engineConsts';

import { prepareMockVault } from '../../../../../@tests/prepareMockVault';
import { getAccountNameInfoByImpl } from '../../../../managers/impl';
import { encoding } from '../sdk';
import Vault from '../Vault';
import VaultHelper from '../VaultHelper';

import type { IPrepareMockVaultOptions } from '../../../../../@tests/types';
import type { KeyringBase } from '../../../keyring/KeyringBase';
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
