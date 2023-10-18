import { VersionedTransaction } from '@solana/web3.js';

import { wait } from '@onekeyhq/kit/src/utils/helper';
import { IMPL_SOL } from '@onekeyhq/shared/src/engine/engineConsts';

import { prepareMockVault } from '../../../../../@tests/prepareMockVault';
import { getAccountNameInfoByImpl } from '../../../../managers/impl';
import Vault from '../Vault';
import VaultHelper from '../VaultHelper';

import type { IPrepareMockVaultOptions } from '../../../../../@tests/types';
import type { DBAccount } from '../../../../types/account';
import type { KeyringBase } from '../../../keyring/KeyringBase';
import type { KeyringSoftwareBase } from '../../../keyring/KeyringSoftwareBase';
import type { IPrepareAccountsParams } from '../../../types';
import type { VaultBase } from '../../../VaultBase';

const solAccountNameInfo = getAccountNameInfoByImpl(IMPL_SOL);
const PREPARE_ACCOUNTS_PARAMS = {
  coinType: solAccountNameInfo.default.coinType,
  template: solAccountNameInfo.default.template,
  indexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  accounts: [] as DBAccount[],
};

export async function testPrepareAccounts(
  prepareOptions: IPrepareMockVaultOptions,
  builder: {
    keyring: (payload: { vault: VaultBase }) => KeyringBase;
  },
  prepareAccountsParams?: typeof PREPARE_ACCOUNTS_PARAMS,
) {
  const { options, dbAccount } = prepareMockVault(prepareOptions);
  const vault = new Vault(options);
  vault.helper = new VaultHelper(options);
  const keyring = builder.keyring({ vault });
  const accountsParams = {
    ...PREPARE_ACCOUNTS_PARAMS,
    ...prepareAccountsParams,
  };
  const accounts = await keyring.prepareAccounts({
    ...accountsParams,
    name: dbAccount.name,
    target: dbAccount.address,
    accountIdPrefix: 'external',
    password: prepareOptions.password,
    privateKey: prepareOptions.privateKey
      ? Buffer.from(prepareOptions.privateKey, 'hex')
      : '',
  } as IPrepareAccountsParams);
  if (accountsParams?.accounts?.length) {
    expect(accounts).toEqual(accountsParams?.accounts);
  } else {
    expect(accounts[0]).toEqual(dbAccount);
  }
}

export type SOLPresetCaseType = {
  testPrepareAccounts: typeof testPrepareAccounts;
};
