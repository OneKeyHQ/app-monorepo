import { DbApi } from './index';

import {
  COINTYPE_ETH,
  IMPL_EVM,
} from '@onekeyhq/shared/src/engine/engineConsts';

import type { DBAPI } from './base';

const defaultAccountNameInfo = {
  [IMPL_EVM]: {
    default: {
      prefix: 'EVM',
      category: `44'/${COINTYPE_ETH}'`,
      label: 'BIP44 Standard',
      coinType: COINTYPE_ETH,
      template: `m/44'/60'/0'/0/x`,
    },
    ledgerLive: {
      prefix: 'EVM',
      category: `44'/${COINTYPE_ETH}'`,
      label: `Ledger Live`,
      coinType: COINTYPE_ETH,
      template: `m/44'/60'/x'/0/0`,
    },
    LedgerLegacy: {
      prefix: 'EVM',
      category: `44'/${COINTYPE_ETH}'`,
      label: `Ledger Legacy`,
      coinType: COINTYPE_ETH,
      template: `m/44'/60'/0'/x`,
    },
  },
};

const walletId = 'fake-walletId';
const createAccountId = (index: number) => `fake-accountId-${index}`;

const bip44StandardTemplate = defaultAccountNameInfo[IMPL_EVM].default.template;
const ledgerLiveTemplate = defaultAccountNameInfo[IMPL_EVM].ledgerLive.template;

describe('test AccountDerivation database API', () => {
  let dbApi: DBAPI;

  beforeEach(() => {
    dbApi = new DbApi();
  });

  test('should insert a bip44 standard template record', async () => {
    await dbApi.addAccountDerivation(
      walletId,
      createAccountId(1),
      IMPL_EVM,
      bip44StandardTemplate,
    );

    const accountDerivationMap = await dbApi.getAccountDerivationByWalletId(
      walletId,
    );

    expect(Object.keys(accountDerivationMap).length).toBe(1);
    expect(accountDerivationMap[bip44StandardTemplate].template).toBe(
      bip44StandardTemplate,
    );
    expect(accountDerivationMap[bip44StandardTemplate].walletId).toBe(walletId);
    expect(accountDerivationMap[bip44StandardTemplate].accounts[0]).toBe(
      createAccountId(1),
    );
  });

  test('should insert another bip44 standard recoed', async () => {
    await dbApi.addAccountDerivation(
      walletId,
      createAccountId(2),
      IMPL_EVM,
      bip44StandardTemplate,
    );

    const accountDerivationMap = await dbApi.getAccountDerivationByWalletId(
      walletId,
    );
    expect(Object.keys(accountDerivationMap).length).toBe(1);
    expect(accountDerivationMap[bip44StandardTemplate].template).toBe(
      bip44StandardTemplate,
    );
    expect(accountDerivationMap[bip44StandardTemplate].walletId).toBe(walletId);
    expect(accountDerivationMap[bip44StandardTemplate].accounts.length).toBe(2);
  });

  test('should insert a Ledger Live teamplate reocrd', async () => {
    await dbApi.addAccountDerivation(
      walletId,
      createAccountId(3),
      IMPL_EVM,
      ledgerLiveTemplate,
    );

    const accountDerivationMap = await dbApi.getAccountDerivationByWalletId(
      walletId,
    );
    console.log(accountDerivationMap);

    expect(Object.keys(accountDerivationMap).length).toBe(2);
    expect(accountDerivationMap[ledgerLiveTemplate].template).toBe(
      ledgerLiveTemplate,
    );
    expect(accountDerivationMap[ledgerLiveTemplate].walletId).toBe(walletId);
    expect(accountDerivationMap[bip44StandardTemplate].accounts.length).toBe(2);
    expect(accountDerivationMap[ledgerLiveTemplate].accounts.length).toBe(1);
  });

  test('should remove account1 accountDerivation by accountId', async () => {
    await dbApi.removeAccountDerivationByAccountId(
      walletId,
      createAccountId(1),
    );
    const accountDerivationMap = await dbApi.getAccountDerivationByWalletId(
      walletId,
    );
    expect(accountDerivationMap[bip44StandardTemplate].accounts.length).toBe(1);
  });

  test('should remove accountDerivation record by walletId', async () => {
    await dbApi.removeAccountDerivationByWalletId(walletId);
    const accountDerivationMap = await dbApi.getAccountDerivationByWalletId(
      walletId,
    );
    console.log(accountDerivationMap);
    expect(Object.keys(accountDerivationMap).length).toBe(0);
  });
});
