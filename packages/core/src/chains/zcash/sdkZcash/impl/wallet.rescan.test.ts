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

const account: IZcashWalletAccount = {
  network: 'main',
  lightwalletdUrl: 'https://example.invalid',
  ufvk: 'synthetic-ufvk',
  seedFingerprintHex: 'ab'.repeat(32),
  hdIndex: 0,
  birthdayHeight: 50,
  label: 'synthetic-fp',
};

beforeEach(() => {
  forgetOpenWallet('main');
  jest.clearAllMocks();
});

it('rescans the account from its birthday without deleting the database', async () => {
  await (await sdk.getZcashApi()).rescanWallet(account);
  expect(runtime.rescanAccount).toHaveBeenCalledWith('retained-account', 50);
  expect(runtime.removeAccount).not.toHaveBeenCalled();
  expect(runtime.deleteWallet).not.toHaveBeenCalled();
});

it('falls back to the runtime birthday when the account has none', async () => {
  await (
    await sdk.getZcashApi()
  ).rescanWallet({ ...account, birthdayHeight: undefined });
  expect(runtime.rescanAccount).toHaveBeenCalledWith('retained-account', 100);
});
