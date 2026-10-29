/** @jest-environment jsdom */

import { type ReactNode, createElement } from 'react';

import { act, fireEvent, render, renderHook } from '@testing-library/react';

import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import MobileUnifoldDepositTrackerModal from '../components/TradingPanel/modals/UnifoldDeposit/MobileUnifoldDepositTrackerModal';

import {
  useShowDepositWithdrawModal,
  useShowUnifoldDepositTracker,
} from './useShowDepositWithdrawModal';

let mockMode: 'simple' | 'pro' = 'simple';
let mockUnifoldEnabled = true;
let mockTrackerParams = {
  expectedRecipient: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  tradingUiMode: 'simple',
  analyticsEntrySource: 'accountPanel',
  openedFromTransfer: false,
};
const mockReplace = jest.fn<void, unknown[]>();
const mockGoBack = jest.fn();
const mockTrackerDialog = jest.fn<void, [unknown]>();
const mockPushModal = jest.fn<void, unknown[]>();
const mockPanelView = jest.fn<void, [unknown]>();
const mockMethodSelect = jest.fn<void, [unknown]>();
const mockMenu = jest.fn<
  void,
  [{ onAction: (action: 'onekey' | 'transfer' | 'tracker') => void }]
>();
const mockAccount = {
  accountId: 'hd-1--1',
  accountAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  walletType: 'hd',
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ replace: mockReplace, goBack: mockGoBack }),
  useRoute: () => ({ params: mockTrackerParams }),
}));
jest.mock(
  '../components/TradingPanel/modals/UnifoldDeposit/UnifoldTrackerContent',
  () => ({
    UnifoldTrackerContent: ({
      onDepositPress,
    }: {
      onDepositPress: () => void;
    }) => createElement('button', { onClick: onDepositPress }, 'deposit'),
  }),
);
jest.mock('@onekeyhq/components', () => ({
  NavBackButton: () => null,
  Page: Object.assign(({ children }: { children: ReactNode }) => children, {
    Header: () => null,
    Body: ({ children }: { children: ReactNode }) => children,
  }),
  useMedia: () => ({ gtMd: false }),
  useInTabDialog: () => ({}),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal }),
}));
jest.mock('./usePerpsTradingUiMode', () => ({
  usePerpsTradingUiMode: () => mockMode,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [mockAccount],
  usePerpsCommonConfigPersistAtom: () => [
    { perpConfigCommon: { unifoldDepositEnabled: true } },
  ],
  perpsActiveAccountAtom: { atom: () => ({}) },
  perpsCommonConfigPersistAtom: {
    get: async () => ({
      perpConfigCommon: { unifoldDepositEnabled: mockUnifoldEnabled },
    }),
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore', () => ({
  jotaiDefaultStore: { get: () => mockAccount },
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: { isExternalAccount: () => false },
}));
jest.mock('../utils/unifoldRecipient', () => ({
  isUnifoldDepositAccountDisabled: () => false,
  getSafeUnifoldRecipient: () => mockAccount.accountAddress,
}));
jest.mock('../utils/preloadPerpsUnifoldDeposit', () => ({
  loadPerpsUnifoldDepositModals: async () => ({
    showUnifoldTrackerDialog: (params: unknown) => mockTrackerDialog(params),
    showPerpsUnifoldDepositMenuDialog: (...args: Parameters<typeof mockMenu>) =>
      mockMenu(...args),
  }),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    perp: {
      deposit: {
        perpDepositMethodPanelView: (params: unknown) => mockPanelView(params),
        perpDepositMethodSelect: (params: unknown) => mockMethodSelect(params),
      },
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockMode = 'simple';
  mockUnifoldEnabled = true;
  mockTrackerParams = {
    expectedRecipient: mockAccount.accountAddress,
    tradingUiMode: 'simple',
    analyticsEntrySource: 'accountPanel',
    openedFromTransfer: false,
  };
});

it.each(['deposit', 'withdraw'] as const)(
  'passes the entry mode to the mobile %s form',
  async (actionType) => {
    mockUnifoldEnabled = false;
    const { result } = renderHook(() => useShowDepositWithdrawModal('header'));
    await act(async () => result.current.showDepositWithdrawModal(actionType));
    expect(mockPushModal).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        screen: EModalPerpRoutes.MobileDepositWithdrawModal,
        params: { actionType, tradingUiMode: 'simple' },
      }),
    );
  },
);

it.each(['onekey', 'transfer'] as const)(
  'keeps the original mode when selecting %s after a UI mode change',
  async (action) => {
    const { result, rerender } = renderHook(() =>
      useShowDepositWithdrawModal('header'),
    );
    await act(async () => result.current.showDepositWithdrawModal('deposit'));
    expect(mockPanelView).toHaveBeenCalledWith({
      tradingUiMode: 'simple',
      entrySource: 'header',
      walletType: 'hd',
    });
    mockMode = 'pro';
    rerender();
    await act(async () => mockMenu.mock.calls[0][0].onAction(action));
    expect(mockMethodSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        tradingUiMode: 'simple',
        depositMethod:
          action === 'onekey' ? 'connectedWallet' : 'depositAddress',
      }),
    );
    expect(mockPushModal).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        params: expect.objectContaining({ tradingUiMode: 'simple' }),
      }),
    );
  },
);

it('carries mode from standalone deposit history to its desktop dialog', async () => {
  const { result } = renderHook(() => useShowUnifoldDepositTracker());
  await act(async () => result.current.showUnifoldDepositTracker());
  expect(mockTrackerDialog).toHaveBeenCalledWith(
    expect.objectContaining({
      tradingUiMode: 'simple',
      analyticsEntrySource: 'depositHistory',
    }),
  );
});

it('preserves the entry mode and source when starting a deposit from mobile history', () => {
  mockMode = 'pro';
  const { getByText } = render(createElement(MobileUnifoldDepositTrackerModal));
  fireEvent.click(getByText('deposit'));
  expect(mockReplace).toHaveBeenCalledWith(
    EModalPerpRoutes.MobileUnifoldDepositTransfer,
    {
      expectedRecipient: mockAccount.accountAddress,
      tradingUiMode: 'simple',
      analyticsEntrySource: 'accountPanel',
    },
  );
});

it('returns to the existing transfer form when history was opened from it', () => {
  mockTrackerParams.openedFromTransfer = true;
  const { getByText } = render(createElement(MobileUnifoldDepositTrackerModal));
  fireEvent.click(getByText('deposit'));
  expect(mockGoBack).toHaveBeenCalledTimes(1);
  expect(mockReplace).not.toHaveBeenCalled();
});
