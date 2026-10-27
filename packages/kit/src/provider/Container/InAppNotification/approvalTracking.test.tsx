/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import InAppNotificationWithAccount from '.';

import { act, render } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import type { IInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/InAppNotification';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EProtocolOfExchange,
  ESwapApproveTransactionStatus,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

type INotificationState = Pick<
  IInAppNotificationAtom,
  'swapApprovingTransaction' | 'swapApprovingLoading' | 'swapHistoryPendingList'
>;
let mockState: INotificationState;
const mockSetState = (
  updater: (prev: INotificationState) => INotificationState,
) => {
  mockState = updater(mockState);
};
const mockNavigation = {};

jest.mock('@onekeyhq/components', () => ({
  Button: () => null,
  SizableText: () => null,
  Toast: { success: jest.fn(() => ({ close: jest.fn() })), error: jest.fn() },
  rootNavigationRef: { current: null },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/InAppNotification', () => ({
  useInAppNotificationAtom: () => [mockState, mockSetState],
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/shared/src/utils/notificationsUtils', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  serviceSwap: {
    swapHistoryStatusFetchLoop: jest.fn(),
    approvingStateAction: jest.fn(),
    cleanApprovingInterval: jest.fn(),
    cleanSpeedSwapApprovingInterval: jest.fn(),
  },
}));
jest.mock(
  '../../../components/AccountSelector/AccountSelectorProvider',
  () => ({
    AccountSelectorProviderMirror: ({ children }: { children: ReactNode }) =>
      children,
  }),
);
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('../../../hooks/useDebounce', () => ({
  useDebouncedCallback: (callback: () => void) => callback,
}));
jest.mock('../../../hooks/useRunAfterTokensDone', () => ({
  runAfterTokensDone: () => undefined,
}));
jest.mock('../../../states/jotai/contexts/accountSelector/atoms', () => ({
  useActiveAccount: () => ({}),
}));
jest.mock('../../../utils/passwordUtils', () => ({
  whenAppUnlocked: jest.fn(),
}));
jest.mock('../../../views/Swap/hooks/useSwapNavigation', () => ({
  handleSwapNavigation: (callback: (state: object) => void) => callback({}),
}));

describe('approval success toast ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const token = {
      networkId: 'evm--1',
      contractAddress: '0xtoken',
      decimals: 18,
      symbol: 'TOKEN',
    };
    mockState = {
      swapHistoryPendingList: [],
      swapApprovingLoading: false,
      swapApprovingTransaction: {
        approvalRequestId: 'approval-A',
        txId: 'tx-A',
        fromToken: token,
        toToken: token,
        protocol: EProtocolOfExchange.SWAP,
        swapType: ESwapTabSwitchType.SWAP,
        provider: 'test',
        providerName: 'Test',
        useAddress: '0xowner',
        spenderAddress: '0xspender',
        amount: '1',
        status: ESwapApproveTransactionStatus.SUCCESS,
      },
    };
  });

  it.each(['same', 'new-request', 'new-transaction', 'new-network', 'cleared'])(
    'cleans only the approval that created the toast: %s',
    (change) => {
      const { rerender } = render(<InAppNotificationWithAccount />);
      const onClose = jest.mocked(Toast.success).mock.calls[0][0].onClose;
      expect(onClose).toBeDefined();
      const original = mockState.swapApprovingTransaction;
      if (!original) throw new OneKeyLocalError('Missing approval fixture');
      mockState = {
        ...mockState,
        swapApprovingTransaction:
          change === 'cleared'
            ? undefined
            : {
                ...original,
                ...(change === 'new-request'
                  ? {
                      approvalRequestId: 'approval-B',
                      status: ESwapApproveTransactionStatus.PENDING,
                    }
                  : {}),
                ...(change === 'new-transaction' ? { txId: 'tx-B' } : {}),
                ...(change === 'new-network'
                  ? {
                      fromToken: {
                        ...original.fromToken,
                        networkId: 'evm--56',
                      },
                    }
                  : {}),
              },
      };
      rerender(<InAppNotificationWithAccount />);
      const beforeClose = mockState;
      act(() => {
        onClose?.();
      });
      if (change === 'same') {
        expect(mockState.swapApprovingTransaction).toBeUndefined();
      } else {
        expect(mockState).toBe(beforeClose);
      }
    },
  );
});
