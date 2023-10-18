import { IMPL_CFX } from '@onekeyhq/shared/src/engine/engineConsts';

import { prepareMockVault } from '../../../../../@tests/prepareMockVault';
import { getAccountNameInfoByImpl } from '../../../../managers/impl';
import Vault from '../Vault';
import VaultHelper from '../VaultHelper';

import { encodeAddress } from './utils';

import type { IPrepareMockVaultOptions } from '../../../../../@tests/types';
import type { KeyringBase } from '../../../keyring/KeyringBase';
import type { IPrepareAccountsParams } from '../../../types';
import type { VaultBase } from '../../../VaultBase';

const cfxAccountNameInfo = getAccountNameInfoByImpl(IMPL_CFX);
const prepareAccountsParams = {
  indexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  coinType: cfxAccountNameInfo.default.coinType,
  template: cfxAccountNameInfo.default.template,
};

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
    privateKey: prepareOptions.privateKey
      ? Buffer.from(prepareOptions.privateKey, 'hex')
      : '',
  } as IPrepareAccountsParams);
  expect(accounts[0]).toEqual(dbAccount);
}
