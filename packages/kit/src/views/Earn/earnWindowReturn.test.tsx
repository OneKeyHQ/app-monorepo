/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import {
  EModalRoutes,
  EModalStakingRoutes,
  ERootRoutes,
  ETabEarnRoutes,
} from '@onekeyhq/shared/src/routes';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import {
  captureEarnWindowReturnOnSend,
  leaveEarnWindowFor,
  useEarnWindowReturn,
  useEarnWindowScope,
} from './earnWindowReturn';

const page = {
  name: ETabEarnRoutes.BorrowReserveDetails,
  key: 'reserve-details',
};
const home = { key: 'earn-home' };
type IMockAction = { type: string; payload?: { count?: number } };
let mockOnBeforeRemove:
  | ((event: { data: { action: IMockAction } }) => void)
  | undefined;
const mockNavigate = jest.fn<void, unknown[]>();
const mockGetRootState = jest.fn<
  { routes: { key: string }[]; index: number },
  []
>();
let mockStorageInitialized = false;
let mockSelectedAccount: {
  walletId?: string;
  indexedAccountId?: string;
  othersWalletAccountId?: string;
} = {};
const mockNavigation = {
  getState: () => ({ routes: [home, page] }),
  addListener: (_type: string, handler: typeof mockOnBeforeRemove) => {
    mockOnBeforeRemove = handler;
    return () => {
      mockOnBeforeRemove = undefined;
    };
  },
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => page,
}));

jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: {
    current: {
      navigate: (...args: unknown[]) => mockNavigate(...args),
      getRootState: () => mockGetRootState(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useSelectedAccount: () => ({ selectedAccount: mockSelectedAccount }),
  useAccountSelectorStorageInitDoneAtom: () => [mockStorageInitialized],
}));

const walletA = { accountId: 'wallet-a', networkId: 'evm--1' };
const walletB = { accountId: 'wallet-b', networkId: 'evm--1' };
const modal = {
  screen: EModalStakingRoutes.EarnLoanRouter,
  params: { collateral: 'ETH', borrow: 'USDC', collateralAmount: '0.5' },
} as const;

function removePage(type: string, count?: number) {
  mockGetRootState.mockReturnValue({ routes: [home], index: 0 });
  act(() => {
    mockOnBeforeRemove?.({ data: { action: { type, payload: { count } } } });
    jest.runAllTimers();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockNavigate.mockClear();
  mockGetRootState.mockReturnValue({ routes: [home, page], index: 1 });
  mockStorageInitialized = true;
  mockSelectedAccount = {};
});

afterEach(() => {
  jest.useRealTimers();
});

it('restores the original window when the user backs out of the same account and page', () => {
  leaveEarnWindowFor(page.name, modal, walletA);
  renderHook(() => useEarnWindowReturn(walletA));
  removePage('POP', 1);
  expect(mockNavigate).toHaveBeenCalledWith(ERootRoutes.Modal, {
    screen: EModalRoutes.StakingModal,
    params: modal,
  });
});

it('restores the preview for an anonymous visitor, and refuses it after a wallet is selected', () => {
  const guest = { anonymous: true, networkId: walletA.networkId } as const;
  leaveEarnWindowFor(page.name, modal, guest);
  const { unmount } = renderHook(() =>
    useEarnWindowReturn(useEarnWindowScope({ networkId: guest.networkId })),
  );
  removePage('GO_BACK');
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  unmount();

  leaveEarnWindowFor(page.name, modal, guest);
  const { rerender } = renderHook(() =>
    useEarnWindowReturn(useEarnWindowScope({ networkId: guest.networkId })),
  );
  mockSelectedAccount = { walletId: 'hd-1', indexedAccountId: 'hd-1--0' };
  rerender();
  removePage('GO_BACK');
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

it('waits for selected-account storage and rejects an account from the same wallet with a different index', () => {
  mockStorageInitialized = false;
  const { result, rerender } = renderHook(() =>
    useEarnWindowScope({
      accountId: 'hd-1--account-1',
      indexedAccountId: 'hd-1--1',
      networkId: walletA.networkId,
    }),
  );
  expect(result.current).toBeUndefined();
  mockStorageInitialized = true;
  mockSelectedAccount = { walletId: 'hd-1', indexedAccountId: 'hd-1--0' };
  rerender();
  expect(result.current).toBeUndefined();
  mockSelectedAccount.indexedAccountId = 'hd-1--1';
  rerender();
  expect(result.current).toEqual({
    accountId: 'hd-1--account-1',
    networkId: walletA.networkId,
  });
});

it('does not reopen through breadcrumb navigation or a multiple-screen pop', () => {
  for (const action of ['POP_TO', 'POP']) {
    leaveEarnWindowFor(page.name, modal, walletA);
    const { unmount } = renderHook(() => useEarnWindowReturn(walletA));
    removePage(action, 2);
    unmount();
  }
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('does not reopen a claimed ticket after an account switch', () => {
  leaveEarnWindowFor(page.name, modal, walletA);
  const { rerender } = renderHook(({ scope }) => useEarnWindowReturn(scope), {
    initialProps: { scope: walletA },
  });
  rerender({ scope: walletB });
  removePage('GO_BACK');
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('keeps a new ticket through a late old submission and a claim', () => {
  leaveEarnWindowFor(page.name, modal, walletA);
  const lateSupply = captureEarnWindowReturnOnSend(EEarnLabels.Supply, walletA);
  leaveEarnWindowFor(page.name, modal, walletA);
  const claim = captureEarnWindowReturnOnSend(EEarnLabels.Claim, walletA);
  lateSupply();
  claim();
  renderHook(() => useEarnWindowReturn(walletA));
  removePage('GO_BACK');
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

it('clears the active ticket after its matching transaction is accepted', () => {
  leaveEarnWindowFor(page.name, modal, walletA);
  renderHook(() => useEarnWindowReturn(walletA));
  captureEarnWindowReturnOnSend(EEarnLabels.Supply, walletA)();
  removePage('GO_BACK');
  expect(mockNavigate).not.toHaveBeenCalled();
});
