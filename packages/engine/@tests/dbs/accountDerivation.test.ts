import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';

import { DbApi } from '../../src/dbs/index';
import { getAccountNameInfoByImpl } from '../../src/managers/impl';

import type { DBAPI } from '../../src/dbs/base';

const walletId = 'fake-walletId';
const createAccountId = (index: number) => `fake-accountId-${index}`;

describe('test AccountDerivation database API', () => {
  let dbApi: DBAPI;
  let bip44StandardTemplate = '';
  let ledgerLiveTemplate = '';

  beforeEach(() => {
    dbApi = new DbApi();
    const evmAccountNameInfo = getAccountNameInfoByImpl(IMPL_EVM);
    bip44StandardTemplate = evmAccountNameInfo.default.template;
    ledgerLiveTemplate = evmAccountNameInfo.ledgerLive.template;
  });

  test('should insert a bip44 standard template record', async () => {
    await dbApi.addAccountDerivation({
      walletId,
      accountId: createAccountId(1),
      impl: IMPL_EVM,
      template: bip44StandardTemplate,
    });

    const accountDerivationMap = await dbApi.getAccountDerivationByWalletId({
      walletId,
    });

    expect(Object.keys(accountDerivationMap).length).toBe(1);
    expect(accountDerivationMap[bip44StandardTemplate].template).toBe(
      bip44StandardTemplate,
    );
    expect(accountDerivationMap[bip44StandardTemplate].walletId).toBe(walletId);
    expect(accountDerivationMap[bip44StandardTemplate].accounts[0]).toBe(
      createAccountId(1),
    );
  });

  test('should insert another bip44 standard record', async () => {
    await dbApi.addAccountDerivation({
      walletId,
      accountId: createAccountId(2),
      impl: IMPL_EVM,
      template: bip44StandardTemplate,
    });

    const accountDerivationMap = await dbApi.getAccountDerivationByWalletId({
      walletId,
    });
    expect(Object.keys(accountDerivationMap).length).toBe(1);
    expect(accountDerivationMap[bip44StandardTemplate].template).toBe(
      bip44StandardTemplate,
    );
    expect(accountDerivationMap[bip44StandardTemplate].walletId).toBe(walletId);
    expect(accountDerivationMap[bip44StandardTemplate].accounts.length).toBe(2);
  });

  test('should insert a Ledger Live template record', async () => {
    await dbApi.addAccountDerivation({
      walletId,
      accountId: createAccountId(3),
      impl: IMPL_EVM,
      template: ledgerLiveTemplate,
    });

    const accountDerivationMap = await dbApi.getAccountDerivationByWalletId({
      walletId,
    });

    expect(Object.keys(accountDerivationMap).length).toBe(2);
    expect(accountDerivationMap[ledgerLiveTemplate].template).toBe(
      ledgerLiveTemplate,
    );
    expect(accountDerivationMap[ledgerLiveTemplate].walletId).toBe(walletId);
    expect(accountDerivationMap[bip44StandardTemplate].accounts.length).toBe(2);
    expect(accountDerivationMap[ledgerLiveTemplate].accounts.length).toBe(1);
  });

  test('should remove account1 accountDerivation by accountId', async () => {
    await dbApi.removeAccountDerivationByAccountId({
      walletId,
      accountId: createAccountId(1),
    });
    const accountDerivationMap = await dbApi.getAccountDerivationByWalletId({
      walletId,
    });
    expect(accountDerivationMap[bip44StandardTemplate].accounts.length).toBe(1);
  });

  test('should remove accountDerivation record by walletId', async () => {
    await dbApi.removeAccountDerivationByWalletId({ walletId });
    const accountDerivationMap = await dbApi.getAccountDerivationByWalletId({
      walletId,
    });
    console.log(accountDerivationMap);
    expect(Object.keys(accountDerivationMap).length).toBe(0);
  });
});
