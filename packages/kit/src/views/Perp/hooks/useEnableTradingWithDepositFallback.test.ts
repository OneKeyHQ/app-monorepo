/* eslint-disable import/first */

import { act, renderHook } from '@testing-library/react-native';

import type { IPerpsActiveAccountStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

const mockEnableTrading = jest.fn<
  Promise<IPerpsActiveAccountStatusAtom | undefined>,
  []
>();
const mockShowDepositWithdrawModal = jest.fn();

function buildPerpsAccountStatus(
  activatedOk: boolean,
): IPerpsActiveAccountStatusAtom {
  return {
    canTrade: activatedOk,
    canCreateAddress: false,
    accountNotSupport: false,
    accountAddress: '0xabc',
    details: {
      activatedOk,
      agentOk: true,
      referralCodeOk: true,
      builderFeeOk: true,
      internalRebateBoundOk: true,
      abstractionOk: true,
    },
  };
}

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      enableTrading: () => mockEnableTrading(),
    },
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [
    {
      accountId: 'hd-1',
      indexedAccountId: null,
      accountAddress: '0xabc',
    },
  ],
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {
    withErrorAutoToast: (callback: () => Promise<unknown>) => callback(),
  },
}));

jest.mock('../components/HyperliquidTerms', () => ({
  showHyperliquidTermsDialog: jest.fn(),
}));

jest.mock('./useShowDepositWithdrawModal', () => ({
  useShowDepositWithdrawModal: () => ({
    showDepositWithdrawModal: mockShowDepositWithdrawModal,
  }),
}));

import { useRequestEnableTradingWithDepositFallback } from './useEnableTradingWithDepositFallback';

describe('useRequestEnableTradingWithDepositFallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShowDepositWithdrawModal.mockResolvedValue(undefined);
  });

  it('reuses the in-flight request and opens the deposit flow once', async () => {
    let resolveEnableTrading:
      | ((status: IPerpsActiveAccountStatusAtom) => void)
      | undefined;
    mockEnableTrading.mockReturnValue(
      new Promise<IPerpsActiveAccountStatusAtom>((resolve) => {
        resolveEnableTrading = (status) => resolve(status);
      }),
    );
    const { result } = renderHook(() =>
      useRequestEnableTradingWithDepositFallback(),
    );

    let firstRequest!: ReturnType<typeof result.current>;
    let secondRequest!: ReturnType<typeof result.current>;
    act(() => {
      firstRequest = result.current();
      secondRequest = result.current();
    });

    expect(secondRequest).toBe(firstRequest);
    expect(mockEnableTrading).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveEnableTrading?.(buildPerpsAccountStatus(false));
      await firstRequest;
    });

    expect(mockShowDepositWithdrawModal).toHaveBeenCalledTimes(1);
  });

  it('allows a new request after the previous request settles', async () => {
    mockEnableTrading.mockResolvedValue(buildPerpsAccountStatus(true));
    const { result } = renderHook(() =>
      useRequestEnableTradingWithDepositFallback(),
    );

    await act(async () => {
      await result.current();
      await result.current();
    });

    expect(mockEnableTrading).toHaveBeenCalledTimes(2);
  });
});
