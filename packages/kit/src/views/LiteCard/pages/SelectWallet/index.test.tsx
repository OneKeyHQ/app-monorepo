/** @jest-environment jsdom */

import SelectWalletPage from '.';

import { render } from '@testing-library/react';

import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

const mockGetWallets = jest.fn<Promise<{ wallets: IDBWallet[] }>, []>();
let mockLoadWallets: () => Promise<IDBWallet[]>;

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({ params: { onPick: jest.fn() } }),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => '' }),
}));
jest.mock('@onekeyhq/components', () => ({
  Page: () => null,
  Empty: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/WalletListView', () => ({
  WalletListView: () => null,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: { getWallets: () => mockGetWallets() },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (loadWallets: () => Promise<IDBWallet[]>) => {
    mockLoadWallets = loadWallets;
    return { result: undefined };
  },
}));

function walletFixture(id: string, isKeyless?: boolean): IDBWallet {
  return {
    id,
    isKeyless,
    name: 'Fixture wallet',
    type: 'hd',
    backuped: false,
    accounts: [],
    nextIds: {},
    walletNo: 1,
  };
}

it('only lists ordinary HD wallets for Lite card backup', async () => {
  mockGetWallets.mockResolvedValue({
    wallets: [
      walletFixture('hd-1'),
      walletFixture('hd-keyless-parent', true),
      walletFixture('hd-keyless-without-flag'),
      walletFixture('hd-bot--hd-keyless-parent--0'),
      walletFixture('hw-1'),
      walletFixture('qr-1'),
      walletFixture('imported'),
      walletFixture('watching'),
    ],
  });

  render(<SelectWalletPage />);
  const wallets = await mockLoadWallets();

  expect(wallets.map((wallet) => wallet.id)).toEqual(['hd-1']);
});
