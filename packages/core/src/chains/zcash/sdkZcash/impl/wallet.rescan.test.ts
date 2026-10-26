import * as runtime from 'onekey-zcash-runtime';

import sdk from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl';

import { forgetOpenWallet } from './carrier';

import type { IZcashWalletAccount } from '../types/sdk';

jest.mock('onekey-zcash-runtime', () => ({
  __esModule: true,
  default: async () => undefined,
  init: async () => undefined,
  storageRequiresWorkerRestart: () => false,
  openWallet: jest.fn(async () => undefined),
  setLightwalletdUrl: jest.fn(),
  accountByUfvk: jest.fn(() => JSON.stringify({ uuid: 'retained-account' })),
  accountSyncStatus: jest.fn(() =>
    JSON.stringify({ birthdayHeight: 100, chainTip: 300 }),
  ),
  rescanAccount: jest.fn(async () => '{}'),
  queueRescanFrom: jest.fn(),
  removeAccount: jest.fn(),
  deleteWallet: jest.fn(),
}));

const extended = runtime as Omit<typeof runtime, 'rescanAccount'> & {
  rescanAccount?: jest.Mock;
};
const safeRescan = extended.rescanAccount;
const account: IZcashWalletAccount = {
  network: 'main',
  lightwalletdUrl: 'https://example.invalid',
  ufvk: 'synthetic-ufvk',
  seedFingerprintHex: 'ab'.repeat(32),
  hdIndex: 0,
  birthdayHeight: 50,
};

beforeEach(() => {
  forgetOpenWallet('main');
  jest.clearAllMocks();
  extended.rescanAccount = safeRescan;
});

it('uses the non-destructive runtime operation to lower a birthday', async () => {
  await (await sdk.getZcashApi()).rescanWallet(account);
  expect(safeRescan).toHaveBeenCalledWith('retained-account', 50);
  expect(runtime.removeAccount).not.toHaveBeenCalled();
  expect(runtime.deleteWallet).not.toHaveBeenCalled();
});

it('keeps an older runtime database intact when it cannot lower a birthday', async () => {
  extended.rescanAccount = undefined;
  await expect(
    (await sdk.getZcashApi()).rescanWallet(account),
  ).rejects.toMatchObject({
    code: 'DATABASE_TOO_NEW',
    params: { feature: 'safeAccountRescan' },
  });
  expect(runtime.queueRescanFrom).not.toHaveBeenCalled();
  expect(runtime.removeAccount).not.toHaveBeenCalled();
  expect(runtime.deleteWallet).not.toHaveBeenCalled();
});

it.each([100, 200])(
  'can safely requeue from %s on an older runtime',
  async (birthdayHeight) => {
    extended.rescanAccount = undefined;
    await (
      await sdk.getZcashApi()
    ).rescanWallet({ ...account, birthdayHeight });
    expect(runtime.queueRescanFrom).toHaveBeenCalledWith(birthdayHeight);
    expect(runtime.removeAccount).not.toHaveBeenCalled();
    expect(runtime.deleteWallet).not.toHaveBeenCalled();
  },
);
