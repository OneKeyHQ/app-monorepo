/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import ConnectionModal from './ConnectionModal';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';
import type { IHandleAccountChanged } from '../hooks/useHandleAccountChanged';

let capturedHandleAccountChanged: IHandleAccountChanged | undefined;
let capturedOnConfirm: (() => Promise<void>) | undefined;
let capturedConfirmDisabled: boolean | undefined;

const mockResolve = jest.fn(async (_params: unknown) => undefined);
const mockReject = jest.fn();
const mockToastError = jest.fn((_params: unknown) => undefined);
const mockIsAccountIdDeactivatedBotWallet = jest.fn(
  async (_params: unknown) => false,
);
const mockUpdateConnectionSession = jest.fn(
  async (_params: unknown) => undefined,
);
const mockSaveConnectionSession = jest.fn(
  async (_params: unknown) => undefined,
);
const mockApproveConnectionSession = jest.fn(
  async (
    _params: unknown,
  ): Promise<{
    approved: boolean;
    reason?: 'request-settled' | 'selection-changed';
  }> => ({
    approved: true,
  }),
);
const mockInvalidateConnectionApproval = jest.fn(
  async (_params: unknown) => undefined,
);

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => '' }),
}));

jest.mock('@onekeyhq/components', () => ({
  Page: {
    Header: () => null,
    Body: ({ children }: { children: ReactNode }) => children,
    Footer: ({ children }: { children: ReactNode }) => children,
  },
  Toast: {
    error: (params: unknown) => {
      mockToastError(params);
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const noopLogger: unknown = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: () => noopLogger,
  });
  return { defaultLogger: noopLogger };
});

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDApp: {
      approveConnectionSession: async (params: unknown) =>
        mockApproveConnectionSession(params),
      invalidateConnectionApproval: async (params: unknown) =>
        mockInvalidateConnectionApproval(params),
      saveConnectionSession: async (params: unknown) => {
        await mockSaveConnectionSession(params);
      },
      updateConnectionSession: async (params: unknown) => {
        await mockUpdateConnectionSession(params);
      },
      notifyDAppAccountAndChainChangedWithCache: async () => undefined,
    },
    serviceRookieGuide: {
      recordTaskCompleted: async () => undefined,
    },
  },
}));

jest.mock('../../../hooks/useDappApproveAction', () => ({
  __esModule: true,
  default: () => ({
    resolve: async (params: unknown) => {
      await mockResolve(params);
    },
    reject: () => {
      mockReject();
    },
    resolveByBackground: async ({
      resolveInBackground,
    }: {
      resolveInBackground: (id: string) => Promise<boolean>;
    }) => {
      const resolved = await resolveInBackground('request-1');
      if (resolved) {
        await mockResolve({});
      }
      return resolved;
    },
  }),
}));

jest.mock('../../../hooks/useDappQuery', () => ({
  __esModule: true,
  default: () => ({
    $sourceInfo: {
      id: 'request-1',
      hostname: 'example.test',
      origin: 'https://example.test',
      scope: 'ethereum',
    },
  }),
}));

jest.mock('../../../hooks/useWebDapp/useKeylessWebFlow', () => ({
  useKeylessWebFlowAutoConnectDapp: () => ({
    notifyKeylessWebConnectSuccess: async () => undefined,
  }),
}));

jest.mock('../../../states/jotai/contexts/accountSelector/perfDebug', () => ({
  getAccountSelectorPerfTimestamp: () => 0,
  isAccountSelectorPerfDebugEnabled: () => false,
}));

jest.mock('../../../utils/botWalletAccountUtils', () => ({
  isAccountIdDeactivatedBotWallet: async (params: unknown) =>
    mockIsAccountIdDeactivatedBotWallet(params),
}));

jest.mock('../../../utils/botWalletStatusUtils', () => ({
  shouldWarnBotWalletInteract: () => false,
}));

jest.mock('../../../utils/botWalletWarningDialog', () => ({
  showBotWalletDeactivatedWarningDialog: async () => true,
}));

jest.mock('../hooks/useRiskDetection', () => ({
  useRiskDetection: () => ({
    showContinueOperate: false,
    continueOperate: true,
    setContinueOperate: jest.fn(),
    riskLevel: 'ok',
    urlSecurityInfo: undefined,
  }),
}));

jest.mock('../components/DAppAccountList', () => ({
  DAppAccountListStandAloneItem: ({
    handleAccountChanged,
  }: {
    handleAccountChanged: IHandleAccountChanged;
  }) => {
    capturedHandleAccountChanged = handleAccountChanged;
    return null;
  },
}));

jest.mock('../components/DAppRequestContent', () => ({
  DAppRequestedPermissionContent: () => null,
}));

jest.mock('../components/DAppRequestContent/DAppRequestedDappList', () => ({
  DAppRequestedDappList: () => null,
}));

jest.mock('../components/DAppRequestLayout', () => ({
  DAppRequestLayout: ({ children }: { children: ReactNode }) => children,
  DAppRequestFooter: ({
    onConfirm,
    confirmButtonProps,
  }: {
    onConfirm: () => Promise<void>;
    confirmButtonProps: { disabled: boolean };
  }) => {
    capturedOnConfirm = onConfirm;
    capturedConfirmDisabled = confirmButtonProps?.disabled;
    return null;
  },
}));

jest.mock('./DappOpenModalPage', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => children,
}));

function buildActiveAccount({
  accountId,
  withAddress = true,
}: {
  accountId: string;
  withAddress?: boolean;
}) {
  return {
    ready: true,
    // An account whose address is not created yet reports no account object at
    // all — this is what the modal sees while the row offers "create address".
    account: withAddress
      ? {
          id: accountId,
          address: `0x-${accountId}`,
          addressDetail: { isValid: true },
        }
      : undefined,
    network: { id: 'evm--1', impl: 'evm', name: 'Ethereum' },
    wallet: { id: 'hd-1' },
    indexedAccount: { id: `${accountId}-indexed` },
    deriveType: 'default',
  } as unknown as IAccountSelectorActiveAccountInfo;
}

const rawSelection = {
  walletId: 'hd-1',
  networkId: 'evm--1',
  deriveType: 'default',
} as any;

describe('ConnectionModal account consistency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedHandleAccountChanged = undefined;
    capturedOnConfirm = undefined;
    capturedConfirmDisabled = undefined;
    mockReject.mockImplementation(() => undefined);
    mockIsAccountIdDeactivatedBotWallet.mockImplementation(async () => false);
    mockSaveConnectionSession.mockImplementation(async () => undefined);
    mockUpdateConnectionSession.mockImplementation(async () => undefined);
    mockInvalidateConnectionApproval.mockImplementation(async () => undefined);
    mockApproveConnectionSession.mockImplementation(async () => ({
      approved: true,
    }));
  });

  it('shows an account without an address and disables approval instead of keeping the previous one', async () => {
    render(<ConnectionModal />);

    await act(async () => {
      capturedHandleAccountChanged?.(
        {
          activeAccount: buildActiveAccount({ accountId: 'account-a' }),
          selectedAccount: rawSelection,
        } as any,
        0,
      );
    });
    expect(capturedConfirmDisabled).toBe(false);

    // Switching to an account whose address is not created yet must not leave
    // account-a on screen: the modal would render one account and approve
    // another.
    await act(async () => {
      capturedHandleAccountChanged?.(
        {
          activeAccount: buildActiveAccount({
            accountId: 'account-b',
            withAddress: false,
          }),
          selectedAccount: rawSelection,
        } as any,
        0,
      );
    });

    expect(capturedConfirmDisabled).toBe(true);
  });

  it('rejects approval when the account changes while the approval is in flight', async () => {
    render(<ConnectionModal />);

    await act(async () => {
      capturedHandleAccountChanged?.(
        {
          activeAccount: buildActiveAccount({ accountId: 'account-a' }),
          selectedAccount: rawSelection,
        } as any,
        0,
      );
    });

    // The bot-wallet lookup is the first await inside onApproval. Switching the
    // account there reproduces a switch landing mid-approval.
    mockIsAccountIdDeactivatedBotWallet.mockImplementation(async () => {
      capturedHandleAccountChanged?.(
        {
          activeAccount: buildActiveAccount({ accountId: 'account-b' }),
          selectedAccount: rawSelection,
        } as any,
        0,
      );
      return false;
    });

    await act(async () => {
      await capturedOnConfirm?.();
    });

    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockResolve).not.toHaveBeenCalled();
    expect(mockApproveConnectionSession).not.toHaveBeenCalled();
  });

  it('rejects an in-flight approval when the latest observation has no account', async () => {
    const botWalletLookup = createDeferred<boolean>();
    mockIsAccountIdDeactivatedBotWallet.mockImplementation(
      async () => botWalletLookup.promise,
    );
    render(<ConnectionModal />);

    await act(async () => {
      capturedHandleAccountChanged?.(
        {
          activeAccount: buildActiveAccount({ accountId: 'account-a' }),
          selectedAccount: rawSelection,
        } as any,
        0,
      );
    });

    let approvalPromise: Promise<void> | undefined;
    act(() => {
      approvalPromise = capturedOnConfirm?.();
    });

    await act(async () => {
      capturedHandleAccountChanged?.(
        {
          activeAccount: buildActiveAccount({
            accountId: 'account-b',
            withAddress: false,
          }),
          selectedAccount: rawSelection,
        } as any,
        0,
      );
      botWalletLookup.resolve(false);
      await approvalPromise;
    });

    expect(mockApproveConnectionSession).not.toHaveBeenCalled();
    expect(mockResolve).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledTimes(1);
  });

  it('invalidates the background approval when the observed account becomes addressless during the session RPC', async () => {
    const saveStarted = createDeferred<void>();
    const finishSave = createDeferred<void>();
    let approvalInvalidated = false;
    let persistedConnectionAccountId: string | undefined;
    mockInvalidateConnectionApproval.mockImplementation(async () => {
      approvalInvalidated = true;
    });
    mockApproveConnectionSession.mockImplementation(async (params: unknown) => {
      saveStarted.resolve();
      await finishSave.promise;
      const accountId = (params as { accountInfo: { accountId: string } })
        .accountInfo.accountId;
      if (!approvalInvalidated) {
        persistedConnectionAccountId = accountId;
        return { approved: true };
      }
      return { approved: false, reason: 'selection-changed' as const };
    });
    render(<ConnectionModal />);

    await act(async () => {
      capturedHandleAccountChanged?.(
        {
          activeAccount: buildActiveAccount({ accountId: 'account-a' }),
          selectedAccount: rawSelection,
        } as any,
        0,
      );
    });

    let approvalPromise: Promise<void> | undefined;
    act(() => {
      approvalPromise = capturedOnConfirm?.();
    });
    await saveStarted.promise;

    await act(async () => {
      capturedHandleAccountChanged?.(
        {
          activeAccount: buildActiveAccount({
            accountId: 'account-a',
            withAddress: false,
          }),
          selectedAccount: rawSelection,
        } as any,
        0,
      );
    });

    finishSave.resolve();
    await act(async () => {
      await approvalPromise;
    });

    expect(mockInvalidateConnectionApproval).toHaveBeenCalledTimes(1);
    expect(persistedConnectionAccountId).toBeUndefined();
    expect(mockResolve).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledTimes(1);
  });

  it('force rejects the request when background invalidation fails', async () => {
    const approvalStarted = createDeferred<void>();
    const finishApproval = createDeferred<void>();
    let requestRejected = false;
    mockReject.mockImplementation(() => {
      requestRejected = true;
    });
    mockInvalidateConnectionApproval.mockRejectedValueOnce(
      new Error('invalidation unavailable'),
    );
    mockApproveConnectionSession.mockImplementation(async () => {
      approvalStarted.resolve();
      await finishApproval.promise;
      return requestRejected
        ? { approved: false, reason: 'request-settled' as const }
        : { approved: true };
    });
    render(<ConnectionModal />);

    await act(async () => {
      capturedHandleAccountChanged?.(
        {
          activeAccount: buildActiveAccount({ accountId: 'account-a' }),
          selectedAccount: rawSelection,
        } as any,
        0,
      );
    });

    let approvalPromise: Promise<void> | undefined;
    act(() => {
      approvalPromise = capturedOnConfirm?.();
    });
    await approvalStarted.promise;

    await act(async () => {
      capturedHandleAccountChanged?.(
        {
          activeAccount: buildActiveAccount({
            accountId: 'account-a',
            withAddress: false,
          }),
          selectedAccount: rawSelection,
        } as any,
        0,
      );
      await Promise.resolve();
    });

    finishApproval.resolve();
    await act(async () => {
      await approvalPromise;
    });

    expect(mockReject).toHaveBeenCalledTimes(1);
    expect(mockResolve).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledTimes(1);
  });

  it('approves normally when the account stays the same', async () => {
    render(<ConnectionModal />);

    await act(async () => {
      capturedHandleAccountChanged?.(
        {
          activeAccount: buildActiveAccount({ accountId: 'account-a' }),
          selectedAccount: rawSelection,
        } as any,
        0,
      );
    });

    await act(async () => {
      await capturedOnConfirm?.();
    });

    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockResolve).toHaveBeenCalledTimes(1);
  });
});
