/* eslint-disable import/first */

import { act, renderHook } from '@testing-library/react-native';

import type { IPerpsActiveAccountStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

type IMockEnableTradingResult = {
  shouldContinue: boolean;
  status: IPerpsActiveAccountStatusAtom | undefined;
};

type IMockShowEnableTradingStepsDialogParams = {
  accountStatus: IPerpsActiveAccountStatusAtom;
  onConfirm: (context: {
    closeDialog: () => void;
  }) => Promise<IMockEnableTradingResult | undefined>;
};

const mockEnableTrading = jest.fn<
  Promise<IPerpsActiveAccountStatusAtom | undefined>,
  []
>();
const mockCheckPerpsAccountStatus = jest.fn<Promise<void>, []>();
const mockRefreshHyperLiquidAgentPasswordStatus = jest.fn<
  Promise<{
    isPasswordSet: boolean;
    requiresPasswordSetupOrVerify: boolean;
  }>,
  []
>();
const mockShowDepositWithdrawModal = jest.fn();
const mockShowEnableTradingStepsDialog = jest.fn<
  Promise<IMockEnableTradingResult | undefined>,
  [IMockShowEnableTradingStepsDialogParams]
>();
const mockShowHyperliquidTermsDialog = jest.fn<Promise<boolean>, []>();
let mockLatestPerpsAccountStatus: IPerpsActiveAccountStatusAtom | undefined;
let mockPerpsAccount = {
  accountId: 'hd-1',
  indexedAccountId: null as string | null,
  accountAddress: '0xabc',
};

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
    servicePassword: {
      refreshHyperLiquidAgentPasswordStatus: () =>
        mockRefreshHyperLiquidAgentPasswordStatus(),
    },
    serviceHyperliquid: {
      enableTrading: () => mockEnableTrading(),
      checkPerpsAccountStatus: () => mockCheckPerpsAccountStatus(),
    },
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  perpsActiveAccountStatusAtom: {
    get: () => Promise.resolve(mockLatestPerpsAccountStatus),
  },
  usePerpsActiveAccountAtom: () => [mockPerpsAccount],
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {
    withErrorAutoToast: (callback: () => Promise<unknown>) => callback(),
  },
}));

jest.mock('../components/HyperliquidTerms', () => ({
  showHyperliquidTermsDialog: () => mockShowHyperliquidTermsDialog(),
}));

jest.mock('../components/TradingPanel/modals/EnableTradingStepsDialog', () => ({
  showEnableTradingStepsDialog: (
    params: IMockShowEnableTradingStepsDialogParams,
  ) => mockShowEnableTradingStepsDialog(params),
}));

jest.mock('./useShowDepositWithdrawModal', () => ({
  useShowDepositWithdrawModal: () => ({
    showDepositWithdrawModal: mockShowDepositWithdrawModal,
  }),
}));

import {
  useEnableTradingWithDepositFallback,
  useFirstDepositAction,
  useRequestEnableTradingWithDepositFallback,
} from './useEnableTradingWithDepositFallback';

describe('useRequestEnableTradingWithDepositFallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPerpsAccount = {
      accountId: 'hd-1',
      indexedAccountId: null,
      accountAddress: '0xabc',
    };
    mockLatestPerpsAccountStatus = undefined;
    mockCheckPerpsAccountStatus.mockResolvedValue(undefined);
    mockShowDepositWithdrawModal.mockResolvedValue(undefined);
    mockShowHyperliquidTermsDialog.mockResolvedValue(true);
    mockRefreshHyperLiquidAgentPasswordStatus.mockResolvedValue({
      isPasswordSet: true,
      requiresPasswordSetupOrVerify: false,
    });
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

  it('starts a separate in-flight request after the account changes', async () => {
    const pendingResolvers: Array<
      (status: IPerpsActiveAccountStatusAtom) => void
    > = [];
    mockEnableTrading.mockImplementation(
      () =>
        new Promise<IPerpsActiveAccountStatusAtom>((resolve) => {
          pendingResolvers.push(resolve);
        }),
    );
    const { result, rerender } = renderHook(() =>
      useRequestEnableTradingWithDepositFallback(),
    );

    let firstRequest!: ReturnType<typeof result.current>;
    act(() => {
      firstRequest = result.current();
    });
    mockPerpsAccount = {
      accountId: 'hd-2',
      indexedAccountId: null,
      accountAddress: '0xdef',
    };
    rerender({});

    let secondRequest!: ReturnType<typeof result.current>;
    act(() => {
      secondRequest = result.current();
    });

    expect(secondRequest).not.toBe(firstRequest);
    expect(mockEnableTrading).toHaveBeenCalledTimes(2);

    await act(async () => {
      pendingResolvers[0]?.(buildPerpsAccountStatus(false));
      pendingResolvers[1]?.(buildPerpsAccountStatus(true));
      await Promise.all([firstRequest, secondRequest]);
    });

    expect(mockShowDepositWithdrawModal).not.toHaveBeenCalled();
  });
});

describe('useEnableTradingWithDepositFallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLatestPerpsAccountStatus = {
      ...buildPerpsAccountStatus(true),
      canTrade: false,
      details: {
        activatedOk: true,
        agentOk: false,
        referralCodeOk: true,
        builderFeeOk: true,
        internalRebateBoundOk: true,
        abstractionOk: true,
      },
    };
    mockShowHyperliquidTermsDialog.mockResolvedValue(true);
    mockRefreshHyperLiquidAgentPasswordStatus.mockResolvedValue({
      isPasswordSet: true,
      requiresPasswordSetupOrVerify: true,
    });
    mockShowEnableTradingStepsDialog.mockResolvedValue({
      shouldContinue: false,
      status: mockLatestPerpsAccountStatus,
    });
  });

  it('shows the enable-trading steps dialog when password verification is required', async () => {
    const { result } = renderHook(() => useEnableTradingWithDepositFallback());

    await act(async () => {
      await result.current();
    });

    expect(mockShowEnableTradingStepsDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        accountStatus: mockLatestPerpsAccountStatus,
      }),
    );
    expect(mockShowHyperliquidTermsDialog).not.toHaveBeenCalled();
    expect(mockEnableTrading).not.toHaveBeenCalled();
  });
});

describe('useFirstDepositAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPerpsAccount = {
      accountId: 'hd-1',
      indexedAccountId: null,
      accountAddress: '0xabc',
    };
    mockCheckPerpsAccountStatus.mockResolvedValue(undefined);
    mockShowDepositWithdrawModal.mockResolvedValue(undefined);
    mockShowHyperliquidTermsDialog.mockResolvedValue(true);
    mockRefreshHyperLiquidAgentPasswordStatus.mockResolvedValue({
      isPasswordSet: true,
      requiresPasswordSetupOrVerify: false,
    });
  });

  it('opens deposit without waiting for the background status refresh', async () => {
    let resolveStatusRefresh: (() => void) | undefined;
    mockCheckPerpsAccountStatus.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveStatusRefresh = resolve;
      }),
    );
    mockLatestPerpsAccountStatus = buildPerpsAccountStatus(false);
    const { result } = renderHook(() => useFirstDepositAction());

    await act(async () => {
      await result.current();
    });

    expect(mockCheckPerpsAccountStatus).toHaveBeenCalledTimes(1);
    expect(mockShowDepositWithdrawModal).toHaveBeenCalledTimes(1);
    expect(mockShowHyperliquidTermsDialog).not.toHaveBeenCalled();
    expect(mockEnableTrading).not.toHaveBeenCalled();

    await act(async () => {
      resolveStatusRefresh?.();
      await Promise.resolve();
    });
  });

  it('uses the terms-gated enable flow when the refreshed account needs setup', async () => {
    mockLatestPerpsAccountStatus = {
      ...buildPerpsAccountStatus(true),
      canTrade: false,
      details: {
        activatedOk: true,
        agentOk: false,
        referralCodeOk: true,
        builderFeeOk: true,
        internalRebateBoundOk: true,
        abstractionOk: true,
      },
    };
    mockEnableTrading.mockResolvedValue(buildPerpsAccountStatus(true));
    const { result } = renderHook(() => useFirstDepositAction());

    await act(async () => {
      await result.current();
    });

    expect(mockCheckPerpsAccountStatus).toHaveBeenCalledTimes(1);
    expect(mockShowHyperliquidTermsDialog).toHaveBeenCalledTimes(1);
    expect(mockEnableTrading).toHaveBeenCalledTimes(1);
    expect(mockShowDepositWithdrawModal).not.toHaveBeenCalled();
  });
});
