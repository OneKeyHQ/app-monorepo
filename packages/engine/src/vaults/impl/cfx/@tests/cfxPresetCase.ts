import { IMPL_NEAR } from '@onekeyhq/shared/src/engine/engineConsts';

import { prepareMockVault } from '../../../../../@tests/prepareMockVault';
import { getAccountNameInfoByImpl } from '../../../../managers/impl';
import Vault from '../Vault';
import VaultHelper from '../VaultHelper';

import type { IPrepareMockVaultOptions } from '../../../../../@tests/types';
import type { KeyringBase } from '../../../keyring/KeyringBase';
import type { IPrepareAccountsParams } from '../../../types';
import type { VaultBase } from '../../../VaultBase';

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
