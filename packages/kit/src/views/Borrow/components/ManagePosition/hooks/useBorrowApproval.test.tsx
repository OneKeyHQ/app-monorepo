/* eslint-disable import/first */

type IGlobalBorrowApprovalMocks = {
  __borrowApprovalSignatureConfirmMock: {
    navigationToTxConfirm: jest.Mock;
  };
  __borrowApprovalBackgroundMock: {
    serviceAccount: {
      getAccount: jest.Mock;
    };
  };
  __borrowApprovalAllowanceHookMock: jest.Mock;
  __borrowApprovalLoggerMock: {
    log: jest.Mock;
  };
};

jest.mock('react-intl', () => {
  const actualReactIntl =
    jest.requireActual<typeof import('react-intl')>('react-intl');

  return {
    __esModule: true,
    ...actualReactIntl,
    useIntl: () => ({
      formatMessage: ({ id }: { id: string }) => id,
    }),
  };
});

jest.mock('react-native', () => {
  const actualReactNative =
    jest.requireActual<typeof import('react-native')>('react-native');
  const mockKeyboard = Object.assign(actualReactNative.Keyboard, {
    dismiss: jest.fn(),
  });
  const mockReactNative: typeof actualReactNative = {
    ...actualReactNative,
    Keyboard: mockKeyboard,
  };

  return mockReactNative;
});

jest.mock('@onekeyhq/components', () => ({
  __esModule: true,
  Dialog: {
    show: jest.fn(),
  },
  Toast: {
    error: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  __esModule: true,
  defaultLogger: (() => {
    const log = jest.fn();

    (
      globalThis as unknown as Pick<
        IGlobalBorrowApprovalMocks,
        '__borrowApprovalLoggerMock'
      >
    ).__borrowApprovalLoggerMock = {
      log,
    };

    return {
      app: {
        error: {
          log,
        },
      },
    };
  })(),
}));

jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => {
  const navigationToTxConfirm = jest.fn();

  (
    globalThis as unknown as Pick<
      IGlobalBorrowApprovalMocks,
      '__borrowApprovalSignatureConfirmMock'
    >
  ).__borrowApprovalSignatureConfirmMock = {
    navigationToTxConfirm,
  };

  return {
    __esModule: true,
    useSignatureConfirm: () => ({
      navigationToTxConfirm,
    }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const serviceAccount = {
    getAccount: jest.fn(),
  };

  (
    globalThis as unknown as Pick<
      IGlobalBorrowApprovalMocks,
      '__borrowApprovalBackgroundMock'
    >
  ).__borrowApprovalBackgroundMock = {
    serviceAccount,
  };

  return {
    __esModule: true,
    default: {
      serviceAccount,
    },
  };
});

jest.mock('@onekeyhq/kit/src/views/Staking/hooks/useUtilsHooks', () => {
  const useTrackTokenAllowance = jest.fn();

  (
    globalThis as unknown as Pick<
      IGlobalBorrowApprovalMocks,
      '__borrowApprovalAllowanceHookMock'
    >
  ).__borrowApprovalAllowanceHookMock = useTrackTokenAllowance;

  return {
    __esModule: true,
    useTrackTokenAllowance,
  };
});

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { Toast } from '@onekeyhq/components';
import { EApproveType } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { useBorrowApproval } from './useBorrowApproval';

const mockState = globalThis as unknown as IGlobalBorrowApprovalMocks;

const token: IToken = {
  address: '0xToken',
  decimals: 18,
  isNative: false,
  name: 'DAI',
  symbol: 'DAI',
};

describe('useBorrowApproval', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.__borrowApprovalBackgroundMock.serviceAccount.getAccount.mockResolvedValue(
      {
        address: '0xOwner',
      },
    );
  });

  it('shows the submit error when post-approve auto submit rejects', async () => {
    const fetchAllowanceResponse = jest
      .fn()
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockResolvedValueOnce({ allowanceParsed: '2' });
    const trackAllowance = jest.fn();
    const onApprovedSubmit = jest
      .fn()
      .mockRejectedValue(new Error('submit failed'));

    mockState.__borrowApprovalAllowanceHookMock.mockReturnValue({
      allowance: '0',
      loading: false,
      trackAllowance,
      fetchAllowanceResponse,
    });
    mockState.__borrowApprovalSignatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async ({
        onSuccess,
      }: {
        onSuccess?: (
          data: Array<{
            decodedTx: { txid: string };
            signedTx: { txid: string };
          }>,
        ) => void;
      }) => {
        onSuccess?.([
          {
            decodedTx: { txid: '0xApprove' },
            signedTx: { txid: '0xApprove' },
          },
        ]);
      },
    );

    const { result } = renderHook(() =>
      useBorrowApproval({
        action: 'repay',
        amountValue: '1',
        approveType: EApproveType.Legacy,
        approveTarget: {
          accountId: 'account-id',
          networkId: 'evm--1',
          spenderAddress: '0xSpender',
          token,
        },
        currentAllowance: '0',
        onApprovedSubmit,
      }),
    );

    await act(async () => {
      await result.current.onApprove();
    });

    await waitFor(() => {
      expect(onApprovedSubmit).toHaveBeenCalledTimes(1);
      expect(Toast.error).toHaveBeenCalledWith({
        title: 'submit failed',
      });
    });
    expect(mockState.__borrowApprovalLoggerMock.log).toHaveBeenCalledWith(
      expect.stringContaining('submit failed'),
    );
    expect(trackAllowance).toHaveBeenCalledWith('0xApprove');
    expect(result.current.approving).toBe(false);
  });
});
