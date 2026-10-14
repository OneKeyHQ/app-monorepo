/** @jest-environment jsdom */
/* eslint-disable import/first */

// OK-63880: the native renderers pin an accountSelector row's create-address
// icon to the legacy `top: 18` offset unless the row states its own vertical
// alignment; on iOS that offset is computed from stale frames and lands the
// icon on the subtitle line. The row must ask for centered content so the
// icon sits where the row's "more" button sits.

import { renderHook } from '@testing-library/react';

import type {
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IAccountSelectorAccountsListSectionData,
  IAccountSelectorSelectedAccount,
} from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';

import { useAccountSelectorAccountRowsV2 } from './accountSelectorAccountRowsV2';

import type { NativeListTheme } from '@onekeyfe/react-native-native-list';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
    locale: 'en',
  }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceNetwork: { getNetworkSafe: async () => undefined } },
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: undefined,
    isLoading: false,
    run: jest.fn(),
  }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: { network: undefined } }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useAccountSelectorValuesMapAtom: () => [{}],
  useActiveAccountValueAtom: () => [undefined],
  useIndexedAccountAddressCreationStateAtom: () => [undefined],
  useCurrencyPersistAtom: () => [{ currencyMap: {} }],
  useSettingsPersistAtom: () => [{ currencyInfo: { id: 'usd', symbol: '$' } }],
  useSettingsValuePersistAtom: () => [{ hideValue: false }],
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { locale: 'en' },
    onLocaleChange: () => () => undefined,
  },
}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: { get: () => undefined },
}));
jest.mock('../accountSelectorNativeListV2', () => ({
  accountSelectorAccountVisualV2: () => ({ kind: 'account' }),
}));
jest.mock('./accountSelectorValueDisplayCacheV2', () => ({
  mergeAccountSelectorValueDisplayRowsV2: () => undefined,
  readAccountSelectorValueDisplayRowsV2: () => undefined,
  writeAccountSelectorValueDisplayCacheV2: jest.fn(),
}));
jest.mock('./accountSelectorValueRowsV2', () => ({
  createAccountSelectorValueRowsV2:
    () =>
    ({ staticRows }: { staticRows: unknown[] }) => ({
      rows: staticRows,
      sources: {},
    }),
}));

/*
yarn jest packages/kit/src/views/AccountManagerStacks/pages/AccountSelectorStack/WalletDetails/accountSelectorAccountRowsV2.createAddressRow.test.tsx
*/

const NETWORK_ID = 'evm--1';
const wallet = { id: 'hd-1', name: 'Wallet' } as IDBWallet;
const noAddressAccount = {
  id: 'hd-1--0',
  name: 'Account #1',
  idx: 0,
  walletId: wallet.id,
  associateAccount: undefined,
} as unknown as IDBIndexedAccount;
const addressedAccount = {
  id: 'hd-1--1',
  name: 'Account #2',
  idx: 1,
  walletId: wallet.id,
  associateAccount: {
    id: `${wallet.id}--m/44'/60'/0'/0/1`,
    address: '0x733863f1b3f7b1c6b9a4ae84ef7ff4c3b14e0cf6',
  },
} as unknown as IDBIndexedAccount;
const section = {
  title: '',
  data: [noAddressAccount, addressedAccount],
  walletId: wallet.id,
  firstAccount: noAddressAccount,
  accountsCount: 2,
} as unknown as IAccountSelectorAccountsListSectionData;
const selectedAccount = {
  networkId: NETWORK_ID,
  deriveType: 'default',
  indexedAccountId: addressedAccount.id,
  walletId: wallet.id,
} as unknown as IAccountSelectorSelectedAccount;
const theme = { iconSubdued: '#8D8D8D' } as unknown as NativeListTheme;

function renderRows() {
  return renderHook(() =>
    useAccountSelectorAccountRowsV2({
      num: 0,
      sections: [section],
      selectedAccount,
      wallet,
      linkedNetworkId: NETWORK_ID,
      linkNetwork: true,
      isOthersUniversal: false,
      editable: true,
      enabledNetworksCompatibleWithWalletId: [],
      networkInfoMap: {},
      theme,
      walletNetworksReady: true,
      valueDisplayScopeKey: 'scope',
      persistDisplayedValues: false,
      valuesLoaded: true,
    }),
  ).result.current.rows;
}

describe('account selector create-address row', () => {
  it('centers its content so the plus icon lines up with the more button', () => {
    const [createAddressRow, moreRow] = renderRows();

    expect(createAddressRow.trailing?.[0]).toMatchObject({
      kind: 'icon',
      name: 'PlusSmallOutline',
      actionKey: 'create-address',
    });
    expect(createAddressRow.style?.container?.contentVerticalAlignment).toBe(
      'center',
    );

    expect(moreRow.trailing?.[0]).toMatchObject({
      kind: 'icon',
      name: 'DotHorOutline',
      actionKey: 'account-more',
    });
    expect(moreRow.style).toBeUndefined();
  });
});
