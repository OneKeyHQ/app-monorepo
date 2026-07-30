import { type ReactTestRenderer, act, create } from 'react-test-renderer';

import { HomeAccountValuePersistenceController } from './HomeAccountValuePersistenceController';

const mockUpdateAccountWorth = jest.fn();
const mockUpdateAccountDeFiOverview = jest.fn();
const mockAccountWorth = {
  accountId: 'account-a',
  createAtNetworkWorth: '0',
  initialized: false,
  worth: {},
};
let mockActiveAccount = {
  account: { id: 'account-a', indexedAccountId: 'indexed-account-a' },
  network: {
    id: 'all--0',
    isAllNetworks: true,
  },
  wallet: {
    backuped: true,
    id: 'wallet-a',
    type: 'hd',
  },
};
const mockTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountOverview', () => ({
  useAccountOverviewActions: () => ({
    current: {
      updateAccountDeFiOverview: mockUpdateAccountDeFiOverview,
      updateAccountWorth: mockUpdateAccountWorth,
    },
  }),
  useAccountWorthAtom: () => [mockAccountWorth],
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: mockActiveAccount }),
}));

jest.mock('@onekeyhq/kit/src/utils/fiatConvert', () => ({
  convertFiat: jest.fn(() => '0'),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useCurrencyPersistAtom: () => [{ currencyMap: {} }],
  useSettingsPersistAtom: () => [{ currencyInfo: { id: 'usd', symbol: '$' } }],
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { AccountValueUpdate: 'AccountValueUpdate' },
  appEventBus: { emit: jest.fn() },
}));

beforeAll(() => {
  mockTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  delete mockTestGlobal.IS_REACT_ACT_ENVIRONMENT;
});

describe('HomeAccountValuePersistenceController', () => {
  let renderer: ReactTestRenderer | undefined;

  beforeEach(() => {
    mockUpdateAccountWorth.mockClear();
    mockUpdateAccountDeFiOverview.mockClear();
    mockActiveAccount = {
      account: { id: 'account-a', indexedAccountId: 'indexed-account-a' },
      network: {
        id: 'all--0',
        isAllNetworks: true,
      },
      wallet: {
        backuped: true,
        id: 'wallet-a',
        type: 'hd',
      },
    };
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = undefined;
  });

  it('keeps the All Networks cache on the initial owner mount', () => {
    act(() => {
      renderer = create(<HomeAccountValuePersistenceController />);
    });

    expect(mockUpdateAccountWorth).not.toHaveBeenCalled();
    expect(mockUpdateAccountDeFiOverview).not.toHaveBeenCalled();
  });

  it('clears owner-scoped values after the active owner changes', () => {
    act(() => {
      renderer = create(<HomeAccountValuePersistenceController />);
    });
    mockActiveAccount = {
      ...mockActiveAccount,
      account: {
        id: 'account-b',
        indexedAccountId: 'indexed-account-b',
      },
    };
    act(() => {
      renderer?.update(<HomeAccountValuePersistenceController />);
    });

    expect(mockUpdateAccountWorth).toHaveBeenCalledWith({
      accountId: 'account-b',
      initialized: false,
      worth: {},
    });
    expect(mockUpdateAccountDeFiOverview).toHaveBeenCalledWith({
      accountId: 'account-b',
      networkId: 'all--0',
      overview: {
        netWorth: 0,
        totalDebt: 0,
        totalReward: 0,
        totalValue: 0,
      },
    });
  });
});
