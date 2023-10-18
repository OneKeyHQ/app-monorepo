import {
  publickeyToAddress,
  verify,
} from '@onekeyhq/core/src/chains/nexa/sdkNexa';
import { wait } from '@onekeyhq/kit/src/utils/helper';
import { IMPL_NEXA, SEPERATOR } from '@onekeyhq/shared/src/engine/engineConsts';

import { prepareMockVault } from '../../../../../@tests/prepareMockVault';
import { getAccountNameInfoByImpl } from '../../../../managers/impl';
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
