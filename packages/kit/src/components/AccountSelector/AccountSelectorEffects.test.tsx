import type { Dispatch, SetStateAction } from 'react';

import { type ReactTestRenderer, act, create } from 'react-test-renderer';

import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorEffects } from './AccountSelectorEffects';

const mockSelectedAccount: IAccountSelectorSelectedAccount = {
  walletId: 'hd-1',
  indexedAccountId: 'hd-1--0',
  othersWalletAccountId: undefined,
  networkId: 'evm--1',
  deriveType: 'default',
  focusedWallet: 'hd-1',
};
let mockCurrentSelectedAccount = mockSelectedAccount;
type IMockImmediateReloadRequest = {
  requestId: number;
  reason: string;
  selectionRevision: number;
  selectedAccount: IAccountSelectorSelectedAccount;
  status: 'completed' | 'pending' | 'running';
};
type IMockImmediateReloadRequests = Record<number, IMockImmediateReloadRequest>;

let mockImmediateReloadRequests: IMockImmediateReloadRequests = {};
let mockSelectionRevision = 0;
let mockSetImmediateReloadRequests:
  | Dispatch<SetStateAction<IMockImmediateReloadRequests>>
  | undefined;

const mockReloadActiveAccountInfo = jest.fn();
const mockSaveToStorage = jest.fn();
const mockSetContextData = jest.fn();
const mockClaimActiveAccountReloadRequest = jest.fn(() => true);
const mockCompleteActiveAccountReloadRequest = jest.fn();

const mockActions = {
  reloadActiveAccountInfo: mockReloadActiveAccountInfo,
  claimActiveAccountReloadRequest: mockClaimActiveAccountReloadRequest,
  completeActiveAccountReloadRequest: mockCompleteActiveAccountReloadRequest,
  saveToStorage: mockSaveToStorage,
  syncHomeAndSwapSelectedAccount: jest.fn(),
  updateSelectedAccount: jest.fn(),
  updateSelectedAccountNetwork: jest.fn(),
  reloadSwapToAccountFromHome: jest.fn(),
};

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsAtom: () => [
    {
      swapToAnotherAccountSwitchOn: true,
    },
  ],
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/eventBus/appEventBus')
  >('@onekeyhq/shared/src/eventBus/appEventBus');
  return {
    ...actual,
    appEventBus: {
      off: jest.fn(),
      on: jest.fn(),
    },
  };
});

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const noopLogger = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: () => noopLogger,
  });
  return {
    defaultLogger: noopLogger,
  };
});

jest.mock('@onekeyhq/shared/src/utils/debug/debugUtils', () => ({
  useDebugComponentRemountLog: jest.fn(),
}));

jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDappSide: {
      activateConnector: jest.fn(),
      syncAccountFromPeerWallet: jest.fn(),
    },
    servicePrimeTransfer: {
      isInTransferImportOrBackupRestoreFlow: jest.fn(async () => false),
    },
  },
}));

jest.mock('../../states/jotai/contexts/accountSelector', () => ({
  EAccountSelectorActiveAccountReloadStatus: {
    Completed: 'completed',
    Pending: 'pending',
    Running: 'running',
  },
  getActiveAccountSelectionIdentity: (
    selectedAccount: IAccountSelectorSelectedAccount | undefined,
  ) => ({
    deriveType: selectedAccount?.deriveType,
    indexedAccountId: selectedAccount?.indexedAccountId,
    networkId: selectedAccount?.networkId,
    othersWalletAccountId: selectedAccount?.othersWalletAccountId,
    walletId: selectedAccount?.walletId,
  }),
  useAccountSelectorActiveAccountReloadRequestsAtom: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const [requests, setRequests] = React.useState(mockImmediateReloadRequests);
    mockSetImmediateReloadRequests = setRequests;
    return [requests];
  },
  useAccountSelectorContextDataAtom: () => [undefined, mockSetContextData],
  useAccountSelectorSceneInfo: () => ({
    sceneName: EAccountSelectorSceneName.home,
    sceneUrl: undefined,
  }),
  useAccountSelectorSelectionRevisionsAtom: () => [
    {
      0: mockSelectionRevision,
    },
  ],
  useAccountSelectorStorageReadyAtom: () => [true],
  useAccountSelectorUpdateMetaAtom: () => [{}],
  useActiveAccount: () => ({
    activeAccount: {
      account: undefined,
      network: undefined,
      ready: true,
    },
  }),
  useSelectedAccount: () => ({
    isSelectedAccountDefaultValue: false,
    selectedAccount: mockCurrentSelectedAccount,
  }),
}));

jest.mock('../../states/jotai/contexts/accountSelector/actions', () => ({
  useAccountSelectorActions: () => ({
    current: mockActions,
  }),
}));

jest.mock('./hooks/useAutoSelectAccount', () => ({
  useAutoSelectAccount: jest.fn(),
}));
jest.mock('./hooks/useAutoSelectDeriveType', () => ({
  useAutoSelectDeriveType: jest.fn(),
}));
jest.mock('./hooks/useAutoSelectNetwork', () => ({
  useAutoSelectNetwork: jest.fn(),
}));

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('AccountSelectorEffects active account reload policy', () => {
  let renderer: ReactTestRenderer | undefined;
  const mockTestGlobal = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockImmediateReloadRequests = {};
    mockSelectionRevision = 0;
    mockCurrentSelectedAccount = mockSelectedAccount;
    mockSetImmediateReloadRequests = undefined;
    mockTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
    mockReloadActiveAccountInfo.mockResolvedValue({
      status: 'committed',
      activeAccount: {
        account: undefined,
        network: undefined,
        ready: true,
      },
    });
    mockSaveToStorage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = undefined;
    jest.useRealTimers();
    delete mockTestGlobal.IS_REACT_ACT_ENVIRONMENT;
  });

  it('runs an explicit reload immediately without waiting for the trailing window', async () => {
    mockImmediateReloadRequests = {
      0: {
        requestId: 1,
        reason: 'networkSelect',
        selectionRevision: 0,
        selectedAccount: mockSelectedAccount,
        status: 'pending',
      },
    };

    await act(async () => {
      renderer = create(<AccountSelectorEffects num={0} />);
    });
    await flushPromises();

    expect(mockReloadActiveAccountInfo).toHaveBeenCalledTimes(1);
    expect(mockReloadActiveAccountInfo).toHaveBeenCalledWith({
      num: 0,
      selectedAccount: mockSelectedAccount,
      selectionRevision: 0,
    });

    act(() => {
      jest.advanceTimersByTime(150);
    });
    await flushPromises();
    expect(mockReloadActiveAccountInfo).toHaveBeenCalledTimes(1);
    expect(mockReloadActiveAccountInfo).toHaveBeenCalledWith({
      num: 0,
      selectedAccount: mockSelectedAccount,
      selectionRevision: 0,
    });
  });

  it('matches an immediate owner request when only focused wallet differs', async () => {
    mockCurrentSelectedAccount = {
      ...mockSelectedAccount,
      focusedWallet: 'hd-2',
    };
    mockImmediateReloadRequests = {
      0: {
        requestId: 1,
        reason: 'networkSelect',
        selectionRevision: 0,
        selectedAccount: mockSelectedAccount,
        status: 'pending',
      },
    };

    await act(async () => {
      renderer = create(<AccountSelectorEffects num={0} />);
    });
    await flushPromises();

    expect(mockReloadActiveAccountInfo).toHaveBeenCalledWith({
      num: 0,
      selectedAccount: mockSelectedAccount,
      selectionRevision: 0,
    });
  });

  it('keeps automatic selection changes on the trailing coalesced path', async () => {
    await act(async () => {
      renderer = create(<AccountSelectorEffects num={0} />);
    });
    await flushPromises();
    expect(mockReloadActiveAccountInfo).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(149);
    });
    await flushPromises();
    expect(mockReloadActiveAccountInfo).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    await flushPromises();
    expect(mockReloadActiveAccountInfo).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending trailing reload when an immediate request arrives', async () => {
    await act(async () => {
      renderer = create(<AccountSelectorEffects num={0} />);
    });
    await flushPromises();

    act(() => {
      mockSetImmediateReloadRequests?.({
        0: {
          requestId: 1,
          reason: 'networkSelect',
          selectionRevision: 0,
          selectedAccount: mockSelectedAccount,
          status: 'pending',
        },
      });
    });
    await flushPromises();
    expect(mockReloadActiveAccountInfo).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(150);
    });
    await flushPromises();
    expect(mockReloadActiveAccountInfo).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending trailing reload on unmount', async () => {
    await act(async () => {
      renderer = create(<AccountSelectorEffects num={0} />);
    });
    await flushPromises();

    act(() => {
      renderer?.unmount();
    });
    renderer = undefined;
    act(() => {
      jest.advanceTimersByTime(150);
    });
    await flushPromises();

    expect(mockReloadActiveAccountInfo).not.toHaveBeenCalled();
  });

  it('settles an immediate request after a stale reload result', async () => {
    mockImmediateReloadRequests = {
      0: {
        requestId: 1,
        reason: 'networkSelect',
        selectionRevision: 0,
        selectedAccount: mockSelectedAccount,
        status: 'pending',
      },
    };
    mockReloadActiveAccountInfo.mockResolvedValue({
      status: 'stale',
    });

    await act(async () => {
      renderer = create(<AccountSelectorEffects num={0} />);
    });
    await flushPromises();

    expect(mockClaimActiveAccountReloadRequest).toHaveBeenCalledWith({
      num: 0,
      requestId: 1,
    });
    expect(mockCompleteActiveAccountReloadRequest).toHaveBeenCalledWith({
      num: 0,
      requestId: 1,
    });
  });

  it('does not execute when another consumer wins the request claim', async () => {
    mockImmediateReloadRequests = {
      0: {
        requestId: 1,
        reason: 'networkSelect',
        selectionRevision: 0,
        selectedAccount: mockSelectedAccount,
        status: 'pending',
      },
    };
    mockClaimActiveAccountReloadRequest.mockReturnValueOnce(false);

    await act(async () => {
      renderer = create(<AccountSelectorEffects num={0} />);
    });
    await flushPromises();

    expect(mockReloadActiveAccountInfo).not.toHaveBeenCalled();
    expect(mockCompleteActiveAccountReloadRequest).not.toHaveBeenCalled();
  });

  it('suppresses a completed request only for the same selection revision', async () => {
    mockImmediateReloadRequests = {
      0: {
        requestId: 1,
        reason: 'networkSelect',
        selectionRevision: 0,
        selectedAccount: mockSelectedAccount,
        status: 'completed',
      },
    };

    await act(async () => {
      renderer = create(<AccountSelectorEffects num={0} />);
    });
    act(() => {
      jest.advanceTimersByTime(150);
    });
    await flushPromises();

    expect(mockReloadActiveAccountInfo).not.toHaveBeenCalled();
  });

  it('reloads an ABA selection when its completed request belongs to an older revision', async () => {
    mockSelectionRevision = 2;
    mockImmediateReloadRequests = {
      0: {
        requestId: 1,
        reason: 'networkSelect',
        selectionRevision: 0,
        selectedAccount: mockSelectedAccount,
        status: 'completed',
      },
    };

    await act(async () => {
      renderer = create(<AccountSelectorEffects num={0} />);
    });
    act(() => {
      jest.advanceTimersByTime(150);
    });
    await flushPromises();

    expect(mockReloadActiveAccountInfo).toHaveBeenCalledWith({
      num: 0,
      selectedAccount: mockSelectedAccount,
      selectionRevision: 2,
    });
  });
});
