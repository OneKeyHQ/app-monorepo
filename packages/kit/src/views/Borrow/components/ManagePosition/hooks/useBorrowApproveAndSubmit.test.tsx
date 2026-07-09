/* eslint-disable import/first */

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

jest.mock('@onekeyhq/components', () => ({
  __esModule: true,
  Toast: {
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('react-native', () => {
  const actualReactNative =
    jest.requireActual<typeof import('react-native')>('react-native');

  const mockReactNative: typeof actualReactNative = {
    ...actualReactNative,
    Keyboard: {
      ...actualReactNative.Keyboard,
      dismiss: jest.fn(),
      emit: jest.fn(),
      listenerCount: jest.fn(() => 0),
      removeAllListeners: jest.fn(),
    } as typeof actualReactNative.Keyboard,
  };

  return mockReactNative;
});

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  __esModule: true,
  useRouteIsFocused: () => true,
}));

jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => {
  const mockBag = ((
    globalThis as typeof globalThis & {
      __borrowApproveHookMock?: {
        navigationToTxConfirm?: jest.Mock;
      };
    }
  ).__borrowApproveHookMock ??= {});
  mockBag.navigationToTxConfirm = jest.fn();

  return {
    __esModule: true,
    useSignatureConfirm: () => ({
      navigationToTxConfirm: mockBag.navigationToTxConfirm,
    }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const mockBag = ((
    globalThis as typeof globalThis & {
      __borrowApproveHookMock?: {
        getAccount?: jest.Mock;
      };
    }
  ).__borrowApproveHookMock ??= {});
  mockBag.getAccount = jest.fn();

  return {
    __esModule: true,
    default: {
      serviceAccount: {
        getAccount: mockBag.getAccount,
      },
    },
  };
});

jest.mock('@onekeyhq/kit/src/views/Staking/hooks/useUtilsHooks', () => {
  const mockBag = ((
    globalThis as typeof globalThis & {
      __borrowApproveHookMock?: {
        allowance?: string;
        loadingAllowance?: boolean;
        fetchAllowanceResponse?: jest.Mock;
        trackAllowance?: jest.Mock;
      };
    }
  ).__borrowApproveHookMock ??= {});
  mockBag.fetchAllowanceResponse = jest.fn();
  mockBag.trackAllowance = jest.fn();

  return {
    __esModule: true,
    useTrackTokenAllowance: () => ({
      allowance: mockBag.allowance ?? '0',
      loading: mockBag.loadingAllowance ?? false,
      trackAllowance: mockBag.trackAllowance,
      fetchAllowanceResponse: mockBag.fetchAllowanceResponse,
    }),
  };
});

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  __esModule: true,
  defaultLogger: {
    staking: {
      page: {
        permitSignError: jest.fn(),
      },
    },
  },
}));

import { act, renderHook } from '@testing-library/react-native';

import { useBorrowApproveAndSubmit } from './useBorrowApproveAndSubmit';

import type { IManagePositionApproveTarget } from '../types';

type IBorrowApproveHookMock = {
  allowance?: string;
  loadingAllowance?: boolean;
  fetchAllowanceResponse: jest.Mock;
  getAccount: jest.Mock;
  navigationToTxConfirm: jest.Mock;
  trackAllowance: jest.Mock;
};

const mockBag = (
  globalThis as typeof globalThis & {
    __borrowApproveHookMock: IBorrowApproveHookMock;
  }
).__borrowApproveHookMock;

const approveTarget: IManagePositionApproveTarget = {
  accountId: 'account-1',
  networkId: 'evm--1',
  spenderAddress: '0xspender',
  token: {
    address: '0xtoken',
    decimals: 18,
    isNative: false,
    name: 'USDe',
    networkId: 'evm--1',
    symbol: 'USDe',
  } as IManagePositionApproveTarget['token'],
};

describe('useBorrowApproveAndSubmit', () => {
  beforeEach(() => {
    mockBag.allowance = '0';
    mockBag.loadingAllowance = false;
    mockBag.fetchAllowanceResponse.mockReset();
    mockBag.getAccount.mockReset();
    mockBag.navigationToTxConfirm.mockReset();
    mockBag.trackAllowance.mockReset();
    mockBag.fetchAllowanceResponse.mockResolvedValue({ allowanceParsed: '0' });
    mockBag.getAccount.mockResolvedValue({ address: '0xowner' });
    mockBag.navigationToTxConfirm.mockResolvedValue(undefined);
  });

  it('runs the before-confirm hook before opening the approve confirm', async () => {
    const callOrder: string[] = [];
    const onBeforeNavigateConfirm = jest.fn(() => {
      callOrder.push('beforeConfirm');
    });
    const onSubmit = jest.fn().mockResolvedValue(undefined);

    mockBag.fetchAllowanceResponse.mockImplementation(async () => {
      callOrder.push('fetchAllowance');
      return { allowanceParsed: '0' };
    });
    mockBag.getAccount.mockImplementation(async () => {
      callOrder.push('getAccount');
      return { address: '0xowner' };
    });
    mockBag.navigationToTxConfirm.mockImplementation(async () => {
      callOrder.push('txConfirm');
    });

    const { result } = renderHook(() =>
      useBorrowApproveAndSubmit({
        approveTarget,
        currentAllowance: '0',
        amountValue: '10',
        onSubmit,
        onBeforeNavigateConfirm,
      }),
    );

    await act(async () => {
      await result.current.onApprove();
    });

    expect(onBeforeNavigateConfirm).toHaveBeenCalledTimes(1);
    expect(mockBag.navigationToTxConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        approvesInfo: [
          expect.objectContaining({
            amount: '10',
            owner: '0xowner',
            spender: '0xspender',
          }),
        ],
      }),
    );
    expect(callOrder).toEqual([
      'fetchAllowance',
      'getAccount',
      'beforeConfirm',
      'txConfirm',
    ]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not run the before-confirm hook when allowance is already enough', async () => {
    const onBeforeNavigateConfirm = jest.fn();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    mockBag.allowance = '10';
    mockBag.fetchAllowanceResponse.mockResolvedValue({ allowanceParsed: '10' });

    const { result } = renderHook(() =>
      useBorrowApproveAndSubmit({
        approveTarget,
        currentAllowance: '10',
        amountValue: '10',
        onSubmit,
        onBeforeNavigateConfirm,
      }),
    );

    await act(async () => {
      await result.current.onApprove();
    });

    expect(onBeforeNavigateConfirm).not.toHaveBeenCalled();
    expect(mockBag.navigationToTxConfirm).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
