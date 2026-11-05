/** @jest-environment jsdom */

import {
  StrictMode,
  Suspense,
  startTransition,
  useLayoutEffect,
  useState,
} from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { UniversalWithdraw } from '.';

import { act, fireEvent, render, waitFor } from '@testing-library/react';

import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';

type IProps = ComponentProps<typeof UniversalWithdraw>;
type INavigationParams = {
  onBeforeSend?: () => void | Promise<void>;
  onSuccess: (data: { decodedTx: { txid: string } }[]) => void;
};

const mockNavigate = jest.fn<Promise<void>, [INavigationParams]>();
const mockFetchAllowance = jest.fn<Promise<{ allowanceParsed: string }>, []>();
const mockTrackAllowance = jest.fn();
const mockRetryAllowance = jest.fn();
const mockVerify = jest.fn<Promise<boolean>, []>();
const mockFooterAction = jest.fn<void, [() => void]>();
type IConfirmParams = Parameters<NonNullable<IProps['onConfirm']>>[0] & {
  isSendCurrent?: () => boolean;
  isResultCurrent?: () => boolean;
};
const mockConfirm = jest.fn<Promise<boolean>, [IConfirmParams]>();
const mockCheckAmount = jest.fn<Promise<unknown>, unknown[]>();
const mockQuote = jest.fn<Promise<unknown>, unknown[]>();
const mockEstimateFee = jest.fn<Promise<unknown>, unknown[]>();
let mockEstimateRequest: (() => Promise<unknown>) | undefined;
const mockRiskAccepted = jest.fn();
const mockSignMessage = jest.fn();
const mockToastError = jest.fn<void, [unknown]>();
const mockToastMessage = jest.fn<void, [unknown]>();
const mockDialog = jest.fn<
  void,
  [{ renderContent: ReactNode; onConfirm: () => void }]
>();
const mockWaitForStatus = jest.fn<
  Promise<EOnChainHistoryTxStatus | undefined>,
  [unknown]
>();

jest.mock('react-intl', () => {
  const intl = { formatMessage: ({ id }: { id: string }) => id };
  return { useIntl: () => intl };
});
jest.mock('react-native', () => ({
  Keyboard: { dismiss: jest.fn() },
  StyleSheet: { hairlineWidth: 1 },
  Platform: {
    OS: 'web',
    select: (items: Record<string, unknown>) => items.web ?? items.default,
  },
}));

jest.mock('@onekeyhq/components', () => {
  const Container = ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) =>
    onPress ? (
      <div
        role="button"
        tabIndex={0}
        onClick={onPress}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onPress();
        }}
      >
        {children}
      </div>
    ) : (
      <div>{children}</div>
    );
  const Page = Object.assign(Container, {
    Footer: Container,
    FooterActions: ({
      onConfirmText,
      confirmButtonProps,
    }: {
      onConfirmText: string;
      confirmButtonProps: {
        onPress: () => void;
        disabled?: boolean;
        loading?: boolean;
      };
    }) => {
      mockFooterAction(confirmButtonProps.onPress);
      return (
        <button
          type="button"
          disabled={confirmButtonProps.disabled}
          data-loading={Boolean(confirmButtonProps.loading)}
          onClick={confirmButtonProps.onPress}
        >
          {onConfirmText}
        </button>
      );
    },
  });
  const Accordion = Object.assign(Container, {
    Item: Container,
    Trigger: Container,
    Content: Container,
    HeightAnimator: Container,
  });
  const Alert = ({
    title,
    action,
  }: {
    title?: string;
    action?: { primary: string; onPrimaryPress: () => void };
  }) => (
    <div>
      {title}
      {action ? (
        <button type="button" onClick={action.onPrimaryPress}>
          {action.primary}
        </button>
      ) : null}
    </div>
  );
  return {
    Accordion,
    Page,
    Alert,
    Divider: Container,
    HeightTransition: Container,
    Icon: Container,
    IconButton: Container,
    Image: Container,
    SizableText: Container,
    Stack: Container,
    XStack: Container,
    YStack: Container,
    Dialog: {
      show: (params: { renderContent: ReactNode; onConfirm: () => void }) => {
        mockDialog(params);
        return { close: async () => undefined };
      },
    },
    Toast: {
      error: (params: unknown) => mockToastError(params),
      message: (params: unknown) => mockToastMessage(params),
    },
  };
});

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: { toastIfError: jest.fn(), showToastOfError: jest.fn() },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccount: jest.fn().mockResolvedValue({ address: '0xaccount' }),
    },
    serviceStaking: {
      checkAmount: (...args: unknown[]) => mockCheckAmount(...args),
      getTransactionConfirmation: (...args: unknown[]) => mockQuote(...args),
      estimateFee: (...args: unknown[]) => mockEstimateFee(...args),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    method: () => Promise<unknown>,
    _deps: unknown[],
    options?: { undefinedResultIfReRun?: boolean },
  ) => {
    if (options?.undefinedResultIfReRun) mockEstimateRequest = method;
    return { result: undefined };
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));
jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({ navigationToTxConfirm: mockNavigate }),
}));
jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => ({
  waitForTxFinalStatus: (params: unknown) => mockWaitForStatus(params),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/discovery', () => ({
  useBrowserAction: () => ({ current: { handleOpenWebSite: jest.fn() } }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: { symbol: '$' } }],
}));
jest.mock('@onekeyhq/kit/src/components/PercentageStageOnKeyboard', () => ({
  PercentageStageOnKeyboard: () => null,
  calcPercentBalance: jest.fn(),
}));
jest.mock(
  '@onekeyhq/kit/src/components/PercentageStageOnKeyboard/useAmountInputFocus',
  () => ({
    useAmountInputFocus: () => ({
      isAmountFocused: false,
      onAmountFocusChange: jest.fn(),
    }),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/EarnRiskWarningDialog',
  () => ({ useEarnRiskWarningGate: () => mockRiskAccepted }),
);
jest.mock('../../hooks/useEarnSignMessageWithoutVerify', () => ({
  useEarnSignMessageWithoutVerify: () => mockSignMessage,
}));
jest.mock('../../hooks/usePendleLayoutState', () => ({
  usePendleLayoutState: () => ({}),
}));
jest.mock('../../hooks/useQuoteRefresh', () => ({
  useQuoteRefresh: () => ({
    quoteRefreshing: false,
    handleLocalRefreshQuote: jest.fn(),
  }),
}));
jest.mock('../../hooks/useUtilsHooks', () => ({
  useTrackTokenAllowance: () => ({
    allowance: '0',
    allowanceAvailable: true,
    allowanceError: false,
    loading: false,
    retryAllowance: mockRetryAllowance,
    trackAllowance: mockTrackAllowance,
    fetchAllowanceResponse: mockFetchAllowance,
  }),
}));
jest.mock('../../pages/ProtocolDetails/useHandleActions', () => ({
  useHandleWithdraw: () => jest.fn(),
}));
jest.mock('../CalculationList', () => ({ CalculationListItem: () => null }));
jest.mock('../EstimateNetworkFee', () => ({ EstimateNetworkFee: () => null }));
jest.mock('../ManagePageV2ReceiveInput', () => ({
  ManagePageV2ReceiveInput: () => null,
}));
jest.mock('../ProtocolDetails/EarnActionIcon', () => ({
  ActionPopupContent: () => null,
  EarnActionIcon: () => null,
}));
jest.mock('../ProtocolDetails/EarnAmountText', () => ({
  EarnAmountText: () => null,
}));
jest.mock('../ProtocolDetails/EarnText', () => ({ EarnText: () => null }));
jest.mock('../ProtocolDetails/EarnTooltip', () => ({
  EarnTooltip: () => null,
}));
jest.mock('../ProtocolDetails/PendleSharedComponents', () => ({
  PendleAccordionTriggerContent: () => null,
  PendleSummarySection: () => null,
}));
jest.mock('../showHighPriceImpactDialog', () => ({
  calcPriceImpactInfo: () => undefined,
  showHighPriceImpactDialog: jest.fn(),
}));
jest.mock('../StakeProgress', () => ({
  EStakeProgressStep: { approve: 0, deposit: 1, unstake: 2 },
  StakeProgress: () => null,
}));
jest.mock('../StakingAmountInput', () => ({
  StakingAmountInput: ({
    value,
    onChange,
    onBlur,
    balanceProps,
  }: {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    balanceProps?: { onPress?: () => void };
  }) => (
    <>
      <input
        aria-label="amount"
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
      />
      <button type="button" onClick={balanceProps?.onPress}>
        max
      </button>
    </>
  ),
  useOnBlurAmountValue:
    (value: string, setValue: (next: string) => void) => () => {
      if (value.startsWith('.')) setValue(`0${value}`);
    },
}));

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const approveTarget = {
  accountId: 'account-a',
  networkId: 'evm--1',
  spenderAddress: '0xspender',
  token: {
    address: '0xtoken',
    decimals: 18,
    symbol: 'liquidETH',
    name: 'Liquid ETH',
    isNative: false,
    networkId: 'evm--1',
  },
};

const props: IProps = {
  accountId: 'account-a',
  accountAddress: '0xaccount',
  networkId: 'evm--1',
  providerName: 'etherfi',
  protocolVault: '0xvault',
  tokenSymbol: 'eETH',
  balance: '2',
  price: '1',
  initialAmount: '1',
  amountUnit: 'shares',
  withdrawalSafetyPolicy: 'confirm-and-revalidate',
  withdrawAssetsReady: true,
  transactionInputTokenAddress: '0xtoken',
  transactionOutputTokenAddress: '0xoutput',
  showSingleWithdrawPath: true,
  approveTarget,
  protocolInfo: {
    stakeTag: '',
    provider: 'etherfi',
    networkId: 'evm--1',
    symbol: 'eETH',
    vault: '0xvault',
    providerDetail: { name: 'ether.fi', logoURI: '' },
    withdrawApprove: { tokenAddress: '0xtoken' },
  },
  actionGuard: {
    loading: false,
    blocked: false,
    verifyBeforeAction: mockVerify,
  },
  onConfirm: mockConfirm,
};

function renderWithSuspendingAddressChange() {
  const suspended = new Promise<never>(() => undefined);
  const committedAddresses: string[] = [];
  let suspendedRenders = 0;

  function CommitMarker({ address }: { address: string }) {
    useLayoutEffect(() => {
      committedAddresses.push(address);
    }, [address]);
    return null;
  }

  function SuspendAfterWithdraw({ suspend }: { suspend: boolean }) {
    if (suspend) {
      suspendedRenders += 1;
      throw suspended;
    }
    return null;
  }

  function App() {
    const [view, setView] = useState({
      address: '0xaccount',
      suspend: false,
    });
    return (
      <>
        <button
          type="button"
          onClick={() =>
            startTransition(() =>
              setView({ address: '0xother', suspend: true }),
            )
          }
        >
          Suspend address B
        </button>
        <button
          type="button"
          onClick={() => setView({ address: '0xother', suspend: false })}
        >
          Commit address B
        </button>
        <Suspense fallback={<span>Suspended</span>}>
          <UniversalWithdraw
            {...props}
            accountAddress={view.address}
            approveTarget={undefined}
          />
          <CommitMarker address={view.address} />
          <SuspendAfterWithdraw suspend={view.suspend} />
        </Suspense>
      </>
    );
  }

  return {
    screen: render(<App />),
    committedAddresses,
    getSuspendedRenders: () => suspendedRenders,
  };
}

async function openApproval(screen: ReturnType<typeof render>) {
  const button = await screen.findByRole(
    'button',
    { name: 'global.approve' },
    { timeout: 5000 },
  );
  await waitFor(() => expect(mockQuote).toHaveBeenCalledTimes(2), {
    timeout: 5000,
  });
  await waitFor(() => expect(mockCheckAmount).toHaveBeenCalled(), {
    timeout: 5000,
  });
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false), {
    timeout: 5000,
  });
  fireEvent.click(button);
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
  const params = mockNavigate.mock.calls[0][0];
  mockVerify.mockClear();
  return params;
}

async function beginApproval(screen: ReturnType<typeof render>) {
  const params = await openApproval(screen);
  act(() => {
    params.onSuccess([{ decodedTx: { txid: 'synthetic' } }]);
  });
  await waitFor(() => expect(mockFetchAllowance).toHaveBeenCalledTimes(2));
}

async function handOffWithdrawal(screen: ReturnType<typeof render>) {
  const button = await screen.findByRole(
    'button',
    { name: 'global.withdraw' },
    { timeout: 5000 },
  );
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false), {
    timeout: 5000,
  });
  fireEvent.click(button);
  await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect((screen.getByLabelText('amount') as HTMLInputElement).value).toBe(
      '',
    ),
  );
  const sendCurrent = mockConfirm.mock.calls[0][0].isSendCurrent;
  expect(sendCurrent).toEqual(expect.any(Function));
  return () => sendCurrent?.() ?? false;
}

describe('UniversalWithdraw share approval continuation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchAllowance.mockReset();
    mockEstimateRequest = undefined;
    mockEstimateFee.mockResolvedValue({});
    mockVerify.mockResolvedValue(true);
    mockRiskAccepted.mockResolvedValue(true);
    mockConfirm.mockResolvedValue(true);
    mockNavigate.mockResolvedValue(undefined);
    mockWaitForStatus.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    mockCheckAmount.mockResolvedValue({ code: 0, data: { alerts: [] } });
    mockQuote.mockResolvedValue({
      withdrawPath: {
        data: {
          confirmBoxes: [
            {
              withdrawType: 'queued',
              title: { text: 'Queued' },
              description: { text: '1' },
            },
          ],
        },
      },
    });
  });

  it('uses account A for a queued quote when an account B render suspends', async () => {
    jest.useFakeTimers();
    const pending = deferred<unknown>();
    mockQuote.mockReturnValue(pending.promise);
    const { screen, committedAddresses, getSuspendedRenders } =
      renderWithSuspendingAddressChange();
    try {
      expect(mockQuote).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole('button', { name: 'Suspend address B' }),
      );
      expect(getSuspendedRenders()).toBeGreaterThan(0);
      expect(committedAddresses).not.toContain('0xother');
      expect(mockQuote).not.toHaveBeenCalled();

      await act(async () => jest.advanceTimersByTimeAsync(350));

      expect(mockQuote).toHaveBeenCalledTimes(1);
      expect(mockQuote).toHaveBeenCalledWith(
        expect.objectContaining({ accountAddress: '0xaccount' }),
      );
      expect(committedAddresses).not.toContain('0xother');
    } finally {
      screen.unmount();
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('uses account B for a queued quote after account B commits', async () => {
    jest.useFakeTimers();
    const pending = deferred<unknown>();
    mockQuote.mockReturnValue(pending.promise);
    const { screen, committedAddresses } = renderWithSuspendingAddressChange();
    try {
      expect(mockQuote).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Commit address B' }));
      expect(committedAddresses).toContain('0xother');
      expect(mockQuote).not.toHaveBeenCalled();

      await act(async () => jest.advanceTimersByTimeAsync(350));

      expect(mockQuote).toHaveBeenCalledTimes(1);
      expect(mockQuote).toHaveBeenCalledWith(
        expect.objectContaining({ accountAddress: '0xother' }),
      );
    } finally {
      screen.unmount();
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('accepts a pending account A quote while an account B render is suspended', async () => {
    const pending = deferred<unknown>();
    const quote = {
      withdrawPath: {
        data: {
          confirmBoxes: [
            {
              withdrawType: 'queued',
              title: { text: 'Queued' },
              description: { text: '1' },
            },
          ],
        },
      },
    };
    mockQuote.mockReturnValueOnce(pending.promise).mockResolvedValue(quote);
    const { screen, committedAddresses, getSuspendedRenders } =
      renderWithSuspendingAddressChange();
    await waitFor(() => expect(mockQuote).toHaveBeenCalledTimes(1), {
      timeout: 5000,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Suspend address B' }));
    await waitFor(() => expect(getSuspendedRenders()).toBeGreaterThan(0));
    expect(committedAddresses).not.toContain('0xother');
    await act(async () => pending.resolve(quote));

    expect(
      await screen.findByText('Queued', {}, { timeout: 5000 }),
    ).toBeTruthy();
    const button = screen.getByRole('button', { name: 'global.withdraw' });
    await waitFor(
      () => expect(button.getAttribute('data-loading')).toBe('false'),
      {
        timeout: 5000,
      },
    );
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(committedAddresses).not.toContain('0xother');
  });

  it('applies a pending account A amount check while an account B render is suspended', async () => {
    const pending = deferred<unknown>();
    mockCheckAmount.mockReturnValueOnce(pending.promise);
    const { screen, committedAddresses, getSuspendedRenders } =
      renderWithSuspendingAddressChange();
    await waitFor(() => expect(mockCheckAmount).toHaveBeenCalledTimes(1), {
      timeout: 5000,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Suspend address B' }));
    await waitFor(() => expect(getSuspendedRenders()).toBeGreaterThan(0));
    expect(committedAddresses).not.toContain('0xother');
    await act(async () =>
      pending.resolve({ code: 1, message: 'A amount rejected' }),
    );

    expect(await screen.findByText('A amount rejected')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'global.withdraw' });
    await waitFor(() =>
      expect(button.getAttribute('data-loading')).toBe('false'),
    );
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(committedAddresses).not.toContain('0xother');
  });

  it('does not apply an account A amount check after account B commits', async () => {
    const oldCheck = deferred<unknown>();
    const newCheck = deferred<unknown>();
    mockCheckAmount
      .mockReturnValueOnce(oldCheck.promise)
      .mockReturnValueOnce(newCheck.promise);
    const { screen, committedAddresses } = renderWithSuspendingAddressChange();
    await waitFor(() => expect(mockCheckAmount).toHaveBeenCalledTimes(1), {
      timeout: 5000,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Commit address B' }));
    await waitFor(() => expect(mockCheckAmount).toHaveBeenCalledTimes(2), {
      timeout: 5000,
    });
    expect(committedAddresses).toContain('0xother');
    await act(async () =>
      oldCheck.resolve({ code: 1, message: 'A amount rejected' }),
    );
    expect(screen.queryByText('A amount rejected')).toBeNull();
    const button = screen.getByRole('button', { name: 'global.withdraw' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('data-loading')).toBe('true');

    await act(async () => newCheck.resolve({ code: 0, data: { alerts: [] } }));
    await waitFor(() =>
      expect(button.getAttribute('data-loading')).toBe('false'),
    );
    expect(button.hasAttribute('disabled')).toBe(false);
  });

  it('binds Max withdrawal to the selected share amount even if balance increases', async () => {
    const screen = render(
      <UniversalWithdraw
        {...props}
        approveTarget={undefined}
        maxWithdrawAmountMode="fixed"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'max' }));
    await waitFor(
      () =>
        expect(mockCheckAmount).toHaveBeenCalledWith(
          expect.objectContaining({ amount: '2', withdrawAll: false }),
        ),
      { timeout: 5000 },
    );
    await waitFor(
      () =>
        expect(mockQuote).toHaveBeenCalledWith(
          expect.objectContaining({ amount: '2' }),
        ),
      { timeout: 5000 },
    );
    screen.rerender(
      <UniversalWithdraw
        {...props}
        balance="3"
        approveTarget={undefined}
        maxWithdrawAmountMode="fixed"
      />,
    );
    const button = await screen.findByRole('button', {
      name: 'global.withdraw',
    });
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
    await act(async () => {
      await mockEstimateRequest?.();
    });
    expect(mockEstimateFee).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '2', withdrawAll: false }),
    );
    fireEvent.click(button);
    await waitFor(() =>
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ amount: '2', withdrawAll: false }),
      ),
    );
  });

  it('preserves the existing live-balance Max behavior when no fixed mode is selected', async () => {
    const screen = render(
      <UniversalWithdraw
        {...props}
        providerName="native"
        approveTarget={undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'max' }));
    await waitFor(
      () =>
        expect(mockCheckAmount).toHaveBeenCalledWith(
          expect.objectContaining({ amount: '2', withdrawAll: true }),
        ),
      { timeout: 5000 },
    );
    const button = await screen.findByRole('button', {
      name: 'global.withdraw',
    });
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
    await act(async () => {
      await mockEstimateRequest?.();
    });
    expect(mockEstimateFee).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '2', withdrawAll: true }),
    );
    fireEvent.click(button);
    await waitFor(() =>
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ amount: '2', withdrawAll: true }),
      ),
    );
  });

  it.each([
    ['.5', '0.5'],
    ['.000000000000000001', '0.000000000000000001'],
  ])(
    'normalizes share input %s without requiring input blur',
    async (input, expected) => {
      const screen = render(
        <UniversalWithdraw
          {...props}
          initialAmount={undefined}
          decimals={18}
          approveTarget={undefined}
          maxWithdrawAmountMode="fixed"
        />,
      );
      fireEvent.change(screen.getByLabelText('amount'), {
        target: { value: input },
      });
      const button = await screen.findByRole('button', {
        name: 'global.withdraw',
      });
      await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false), {
        timeout: 5000,
      });
      await waitFor(
        () =>
          expect(mockCheckAmount).toHaveBeenCalledWith(
            expect.objectContaining({ amount: expected }),
          ),
        { timeout: 5000 },
      );
      await waitFor(
        () =>
          expect(mockQuote).toHaveBeenCalledWith(
            expect.objectContaining({ amount: expected }),
          ),
        { timeout: 5000 },
      );
      await act(async () => {
        await mockEstimateRequest?.();
      });
      expect(mockEstimateFee).toHaveBeenCalledWith(
        expect.objectContaining({ amount: expected }),
      );
      fireEvent.click(button);
      await waitFor(() =>
        expect(mockConfirm).toHaveBeenCalledWith(
          expect.objectContaining({ amount: expected }),
        ),
      );
    },
  );

  it('uses the normalized share amount for the approval transaction', async () => {
    mockFetchAllowance.mockResolvedValue({ allowanceParsed: '0' });
    const screen = render(
      <UniversalWithdraw
        {...props}
        initialAmount={undefined}
        maxWithdrawAmountMode="fixed"
      />,
    );
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '.5' },
    });
    const button = await screen.findByRole('button', {
      name: 'global.approve',
    });
    await waitFor(() => expect(mockCheckAmount).toHaveBeenCalled(), {
      timeout: 5000,
    });
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false), {
      timeout: 5000,
    });
    fireEvent.click(button);
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          approvesInfo: [expect.objectContaining({ amount: '0.5' })],
        }),
      ),
    );
  });

  it('continues when blur only normalizes the amount while the action guard is pending', async () => {
    const guard = deferred<boolean>();
    const screen = render(
      <UniversalWithdraw
        {...props}
        initialAmount={undefined}
        approveTarget={undefined}
        maxWithdrawAmountMode="fixed"
      />,
    );
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '.5' },
    });
    const button = await screen.findByRole('button', {
      name: 'global.withdraw',
    });
    await waitFor(() => expect(mockCheckAmount).toHaveBeenCalled(), {
      timeout: 5000,
    });
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false), {
      timeout: 5000,
    });
    mockVerify.mockReturnValueOnce(guard.promise);
    fireEvent.click(button);
    await waitFor(() => expect(mockVerify).toHaveBeenCalled());
    fireEvent.blur(screen.getByLabelText('amount'));
    await act(async () => {
      guard.resolve(true);
    });
    await waitFor(() =>
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ amount: '0.5' }),
      ),
    );
  });

  it('continues an in-flight withdrawal when a changed scope suspends and is discarded', async () => {
    const pending = deferred<boolean>();
    const suspended = new Promise<never>(() => undefined);
    let suspendedRenders = 0;
    const committedAccounts: string[] = [];
    mockConfirm.mockReturnValueOnce(pending.promise);

    function CommitMarker({ accountId }: { accountId: string }) {
      useLayoutEffect(() => {
        committedAccounts.push(accountId);
      }, [accountId]);
      return null;
    }

    function SuspendAfterWithdraw({ suspend }: { suspend: boolean }) {
      if (suspend) {
        suspendedRenders += 1;
        throw suspended;
      }
      return null;
    }

    function App() {
      const [view, setView] = useState({
        accountId: 'account-a',
        suspend: false,
      });
      return (
        <>
          <button
            type="button"
            onClick={() =>
              startTransition(() =>
                setView({ accountId: 'account-b', suspend: true }),
              )
            }
          >
            Suspend account B
          </button>
          <button
            type="button"
            onClick={() => setView({ accountId: 'account-a', suspend: false })}
          >
            Discard account B
          </button>
          <Suspense fallback={<span>Suspended</span>}>
            <UniversalWithdraw
              {...props}
              accountId={view.accountId}
              approveTarget={undefined}
            />
            <CommitMarker accountId={view.accountId} />
            <SuspendAfterWithdraw suspend={view.suspend} />
          </Suspense>
        </>
      );
    }

    const screen = render(<App />);
    const button = await screen.findByRole('button', {
      name: 'global.withdraw',
    });
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
    fireEvent.click(button);
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
    const resultCurrent = mockConfirm.mock.calls[0][0].isResultCurrent;
    const actionCurrent = mockConfirm.mock.calls[0][0].isActionCurrent;
    expect(resultCurrent?.()).toBe(true);
    await waitFor(() => expect(actionCurrent?.()).toBe(true));
    expect(button.getAttribute('data-loading')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Suspend account B' }));
    await waitFor(() => expect(suspendedRenders).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'Discard account B' }));
    expect(committedAccounts).not.toContain('account-b');
    expect(actionCurrent?.()).toBe(true);
    await act(async () => pending.resolve(true));

    await waitFor(() =>
      expect(button.getAttribute('data-loading')).toBe('false'),
    );
    expect(resultCurrent?.()).toBe(true);
    await waitFor(() =>
      expect((screen.getByLabelText('amount') as HTMLInputElement).value).toBe(
        '',
      ),
    );
  });

  it('continues account A after approval while an account B render is suspended', async () => {
    const allowance = deferred<{ allowanceParsed: string }>();
    const suspended = new Promise<never>(() => undefined);
    const committedAccounts: string[] = [];
    let suspendedRenders = 0;
    mockFetchAllowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockReturnValueOnce(allowance.promise);

    function CommitMarker({ accountId }: { accountId: string }) {
      useLayoutEffect(() => {
        committedAccounts.push(accountId);
      }, [accountId]);
      return null;
    }

    function SuspendAfterWithdraw({ suspend }: { suspend: boolean }) {
      if (suspend) {
        suspendedRenders += 1;
        throw suspended;
      }
      return null;
    }

    function App() {
      const [view, setView] = useState({
        accountId: 'account-a',
        suspend: false,
      });
      return (
        <>
          <button
            type="button"
            onClick={() =>
              startTransition(() =>
                setView({ accountId: 'account-b', suspend: true }),
              )
            }
          >
            Suspend account B
          </button>
          <button
            type="button"
            onClick={() => setView({ accountId: 'account-a', suspend: false })}
          >
            Discard account B
          </button>
          <Suspense fallback={<span>Suspended</span>}>
            <UniversalWithdraw {...props} accountId={view.accountId} />
            <CommitMarker accountId={view.accountId} />
            <SuspendAfterWithdraw suspend={view.suspend} />
          </Suspense>
        </>
      );
    }

    const screen = render(<App />);
    await beginApproval(screen);
    fireEvent.click(screen.getByRole('button', { name: 'Suspend account B' }));
    await waitFor(() => expect(suspendedRenders).toBeGreaterThan(0));
    expect(committedAccounts).not.toContain('account-b');
    expect(screen.queryByText('Suspended')).toBeNull();

    await act(async () => allowance.resolve({ allowanceParsed: '2' }));
    await waitFor(() => expect(mockVerify).toHaveBeenCalled());
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '1' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Discard account B' }));
    expect(committedAccounts).not.toContain('account-b');
  });

  it('does not continue an in-flight withdrawal after the changed scope commits', async () => {
    const pending = deferred<boolean>();
    mockConfirm.mockReturnValueOnce(pending.promise);
    const initial = { ...props, approveTarget: undefined };
    const screen = render(<UniversalWithdraw {...initial} />);
    const button = await screen.findByRole('button', {
      name: 'global.withdraw',
    });
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
    fireEvent.click(button);
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
    const resultCurrent = mockConfirm.mock.calls[0][0].isResultCurrent;
    expect(resultCurrent?.()).toBe(true);

    screen.rerender(<UniversalWithdraw {...initial} accountId="account-b" />);
    expect(resultCurrent?.()).toBe(false);
    await act(async () => pending.resolve(true));
    expect((screen.getByLabelText('amount') as HTMLInputElement).value).toBe(
      '1',
    );
    await waitFor(() =>
      expect(button.getAttribute('data-loading')).toBe('false'),
    );
  });

  it('keeps the in-flight action current when blur only normalizes the amount', async () => {
    const pending = deferred<boolean>();
    mockConfirm.mockReturnValueOnce(pending.promise);
    const screen = render(
      <UniversalWithdraw
        {...props}
        initialAmount={undefined}
        approveTarget={undefined}
        maxWithdrawAmountMode="fixed"
      />,
    );
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '.5' },
    });
    const button = await screen.findByRole('button', {
      name: 'global.withdraw',
    });
    await waitFor(() => expect(mockCheckAmount).toHaveBeenCalled(), {
      timeout: 5000,
    });
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false), {
      timeout: 5000,
    });
    fireEvent.click(button);
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
    const isCurrent = mockConfirm.mock.calls[0][0].isActionCurrent;
    expect(isCurrent?.()).toBe(true);
    const checkCount = mockCheckAmount.mock.calls.length;
    const quoteCount = mockQuote.mock.calls.length;
    fireEvent.blur(screen.getByLabelText('amount'));
    expect(isCurrent?.()).toBe(true);
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 800));
    });
    expect(mockCheckAmount).toHaveBeenCalledTimes(checkCount);
    expect(mockQuote).toHaveBeenCalledTimes(quoteCount);
    await act(async () => {
      pending.resolve(false);
    });
  });

  it('keeps the send guard valid after the form resets following handoff', async () => {
    const screen = render(
      <UniversalWithdraw {...props} approveTarget={undefined} />,
    );
    const isSendCurrent = await handOffWithdrawal(screen);
    expect(isSendCurrent()).toBe(true);
  });

  it('invalidates the old send guard when the user changes the amount after handoff', async () => {
    const screen = render(
      <UniversalWithdraw
        {...props}
        approveTarget={undefined}
        initialAmount={undefined}
      />,
    );
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '1' },
    });
    const isSendCurrent = await handOffWithdrawal(screen);
    expect(isSendCurrent()).toBe(true);
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '1.5' },
    });
    expect(isSendCurrent()).toBe(false);
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '' },
    });
    expect(isSendCurrent()).toBe(false);
  });

  it('invalidates the old send guard when the user changes the withdrawal path during handoff', async () => {
    const pending = deferred<boolean>();
    mockConfirm.mockReturnValue(pending.promise);
    mockQuote.mockResolvedValue({
      withdrawPath: {
        data: {
          confirmBoxes: [
            {
              withdrawType: 'queued',
              title: { text: 'Queued' },
              description: { text: '1' },
            },
            {
              withdrawType: 'instant',
              title: { text: 'Instant' },
              description: { text: '1' },
            },
          ],
        },
      },
    });
    const screen = render(
      <UniversalWithdraw {...props} approveTarget={undefined} />,
    );
    const button = await screen.findByRole('button', {
      name: 'global.withdraw',
    });
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false), {
      timeout: 5000,
    });
    fireEvent.click(button);
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
    const isSendCurrent = mockConfirm.mock.calls[0][0].isSendCurrent;
    expect(isSendCurrent?.()).toBe(true);
    fireEvent.click(screen.getByText('Queued'));
    expect(mockDialog).toHaveBeenCalledTimes(1);
    const dialog = mockDialog.mock.calls[0][0];
    const renderedDialog = render(<>{dialog.renderContent}</>);
    fireEvent.click(renderedDialog.getByText('Instant'));
    act(() => dialog.onConfirm());
    expect(isSendCurrent?.()).toBe(false);
    await act(async () => pending.resolve(false));
  });

  it.each([
    'account',
    'address',
    'network',
    'provider',
    'vault',
    'identity',
    'input',
    'output',
    'max mode',
  ] as const)(
    'invalidates the old send guard if %s changes and changes back',
    async (scope) => {
      const initial = { ...props, approveTarget: undefined };
      const screen = render(<UniversalWithdraw {...initial} />);
      const isSendCurrent = await handOffWithdrawal(screen);
      expect(isSendCurrent()).toBe(true);
      let changed: Partial<IProps>;
      if (scope === 'account') {
        changed = { accountId: 'account-b', accountAddress: '0xother' };
      } else if (scope === 'address') {
        changed = { accountAddress: '0xother' };
      } else if (scope === 'network') {
        changed = { networkId: 'evm--10' };
      } else if (scope === 'provider') {
        changed = { providerName: 'other-provider' };
      } else if (scope === 'vault') {
        changed = { protocolVault: '0xother-vault' };
      } else if (scope === 'identity') {
        changed = { identity: 'other-position' };
      } else if (scope === 'input') {
        changed = { transactionInputTokenAddress: '0xother-input' };
      } else if (scope === 'max mode') {
        changed = { maxWithdrawAmountMode: 'fixed' };
      } else {
        changed = { transactionOutputTokenAddress: '0xother-output' };
      }
      screen.rerender(<UniversalWithdraw {...initial} {...changed} />);
      screen.rerender(<UniversalWithdraw {...initial} />);
      expect(isSendCurrent()).toBe(false);
    },
  );

  it('invalidates the old send guard after the form unmounts', async () => {
    const screen = render(
      <UniversalWithdraw {...props} approveTarget={undefined} />,
    );
    const isSendCurrent = await handOffWithdrawal(screen);
    expect(isSendCurrent()).toBe(true);
    screen.unmount();
    expect(isSendCurrent()).toBe(false);
  });

  it.each(['disabled', 'footer override'] as const)(
    'blocks the send guard but keeps the result current when %s appears after handoff',
    async (reason) => {
      const initial = { ...props, approveTarget: undefined };
      const screen = render(<UniversalWithdraw {...initial} />);
      const isSendCurrent = await handOffWithdrawal(screen);
      const isResultCurrent = mockConfirm.mock.calls[0][0].isResultCurrent;
      expect(isSendCurrent()).toBe(true);
      expect(isResultCurrent?.()).toBe(true);
      const blocked: Partial<IProps> =
        reason === 'disabled'
          ? { isDisabled: true }
          : {
              footerActionOverride: {
                text: 'Switch account',
                onPress: jest.fn(),
              },
            };
      screen.rerender(<UniversalWithdraw {...initial} {...blocked} />);
      expect(isSendCurrent()).toBe(false);
      expect(isResultCurrent?.()).toBe(true);
    },
  );

  it('invalidates the send guard when the synchronous protocol guard blocks', async () => {
    let allowed = true;
    const screen = render(
      <UniversalWithdraw
        {...props}
        approveTarget={undefined}
        actionGuard={{
          loading: false,
          blocked: false,
          verifyBeforeAction: mockVerify,
          isActionAllowed: () => allowed,
        }}
      />,
    );
    const isSendCurrent = await handOffWithdrawal(screen);
    expect(isSendCurrent()).toBe(true);
    allowed = false;
    expect(isSendCurrent()).toBe(false);
  });

  it.each(['account', 'unmount'] as const)(
    'keeps the result current when the protocol guard blocks but invalidates it on %s',
    async (invalidation) => {
      let allowed = true;
      const initial: IProps = {
        ...props,
        approveTarget: undefined,
        actionGuard: {
          loading: false,
          blocked: false,
          verifyBeforeAction: mockVerify,
          isActionAllowed: () => allowed,
        },
      };
      const screen = render(<UniversalWithdraw {...initial} />);
      const isSendCurrent = await handOffWithdrawal(screen);
      const isResultCurrent = mockConfirm.mock.calls[0][0].isResultCurrent;
      expect(isResultCurrent).toEqual(expect.any(Function));
      expect(isSendCurrent()).toBe(true);
      expect(isResultCurrent?.()).toBe(true);
      allowed = false;
      expect(isSendCurrent()).toBe(false);
      expect(isResultCurrent?.()).toBe(true);
      if (invalidation === 'account') {
        screen.rerender(
          <UniversalWithdraw {...initial} accountId="account-b" />,
        );
      } else {
        screen.unmount();
      }
      expect(isResultCurrent?.()).toBe(false);
    },
  );

  it('leaves the legacy withdrawal confirmation without a new send guard', async () => {
    const screen = render(
      <UniversalWithdraw
        {...props}
        approveTarget={undefined}
        withdrawalSafetyPolicy={undefined}
      />,
    );
    const button = await screen.findByRole(
      'button',
      { name: 'global.withdraw' },
      { timeout: 5000 },
    );
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false), {
      timeout: 5000,
    });
    fireEvent.click(button);
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
    expect(mockConfirm.mock.calls[0][0].isSendCurrent).toBeUndefined();
  });

  it('keeps the current policy usable after StrictMode replays effects', async () => {
    mockFetchAllowance.mockResolvedValue({ allowanceParsed: '0' });
    const screen = render(
      <StrictMode>
        <UniversalWithdraw {...props} />
      </StrictMode>,
    );
    const button = await screen.findByRole(
      'button',
      { name: 'global.approve' },
      { timeout: 5000 },
    );
    await waitFor(() => expect(mockCheckAmount).toHaveBeenCalled(), {
      timeout: 5000,
    });
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false), {
      timeout: 5000,
    });
    fireEvent.click(button);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
  });

  it('waits for the allowance and verifies the guard before continuing', async () => {
    const pending = deferred<{ allowanceParsed: string }>();
    mockFetchAllowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockReturnValueOnce(pending.promise);
    const screen = render(<UniversalWithdraw {...props} />);
    await beginApproval(screen);
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
    await act(async () => pending.resolve({ allowanceParsed: '2' }));
    expect(mockVerify).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
    expect(mockVerify).toHaveBeenCalledTimes(1);
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '1', withdrawType: 'queued' }),
    );
    expect(mockTrackAllowance).toHaveBeenCalledWith('synthetic');
  });

  it.each([false, true])(
    'keeps account B approval current when a saved account A handler runs: %s',
    async (runOldHandler) => {
      const receipt = deferred<EOnChainHistoryTxStatus | undefined>();
      mockWaitForStatus.mockReturnValueOnce(receipt.promise);
      mockFetchAllowance
        .mockResolvedValueOnce({ allowanceParsed: '0' })
        .mockResolvedValue({ allowanceParsed: '2' });
      const initial = { ...props, actionGuard: undefined };
      const screen = render(<UniversalWithdraw {...initial} />);
      const approve = await screen.findByRole('button', {
        name: 'global.approve',
      });
      await waitFor(
        () => expect(approve.hasAttribute('disabled')).toBe(false),
        {
          timeout: 5000,
        },
      );
      const oldAction = mockFooterAction.mock.calls.at(-1)?.[0];
      expect(oldAction).toEqual(expect.any(Function));

      screen.rerender(
        <UniversalWithdraw
          {...initial}
          accountId="account-b"
          accountAddress="0xaccount-b"
          approveTarget={{ ...approveTarget, accountId: 'account-b' }}
        />,
      );
      await waitFor(
        () =>
          expect(mockQuote).toHaveBeenCalledWith(
            expect.objectContaining({ accountAddress: '0xaccount-b' }),
          ),
        { timeout: 5000 },
      );
      await waitFor(
        () =>
          expect(mockCheckAmount).toHaveBeenCalledWith(
            expect.objectContaining({ accountId: 'account-b' }),
          ),
        { timeout: 5000 },
      );
      await waitFor(
        () => expect(approve.hasAttribute('disabled')).toBe(false),
        {
          timeout: 5000,
        },
      );
      fireEvent.click(approve);
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
      const confirmation = mockNavigate.mock.calls[0][0];
      await act(async () => {
        await confirmation.onBeforeSend?.();
        confirmation.onSuccess([{ decodedTx: { txid: 'synthetic-b' } }]);
      });
      await waitFor(() => expect(mockWaitForStatus).toHaveBeenCalled());
      expect(approve.getAttribute('data-loading')).toBe('true');

      if (runOldHandler) {
        await act(async () => {
          oldAction?.();
        });
      }
      await act(async () => receipt.resolve(EOnChainHistoryTxStatus.Success));
      await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(approve.getAttribute('data-loading')).toBe('false'),
      );
    },
  );

  it('does not continue when the synchronous action guard blocks during the post-approval check', async () => {
    const allowance = deferred<{ allowanceParsed: string }>();
    const verification = deferred<boolean>();
    let allowed = true;
    mockFetchAllowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockReturnValueOnce(allowance.promise);
    const screen = render(
      <UniversalWithdraw
        {...props}
        actionGuard={{
          loading: false,
          blocked: false,
          verifyBeforeAction: mockVerify,
          isActionAllowed: () => allowed,
        }}
      />,
    );
    await beginApproval(screen);
    mockVerify.mockImplementation(() => verification.promise);
    await act(async () => allowance.resolve({ allowanceParsed: '2' }));
    await waitFor(() => expect(mockVerify).toHaveBeenCalledTimes(1));
    expect(mockConfirm).not.toHaveBeenCalled();

    allowed = false;
    await act(async () => {
      verification.resolve(true);
      await verification.promise;
    });
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('rejects an opened approval when the synchronous guard blocks before send', async () => {
    let allowed = true;
    mockFetchAllowance.mockResolvedValue({ allowanceParsed: '0' });
    const screen = render(
      <UniversalWithdraw
        {...props}
        actionGuard={{
          loading: false,
          blocked: false,
          verifyBeforeAction: mockVerify,
          isActionAllowed: () => allowed,
        }}
      />,
    );
    const confirmation = await openApproval(screen);
    expect(confirmation.onBeforeSend).toEqual(expect.any(Function));
    await expect(
      Promise.resolve().then(() => confirmation.onBeforeSend?.()),
    ).resolves.toBeUndefined();

    allowed = false;
    await expect(
      Promise.resolve().then(() => confirmation.onBeforeSend?.()),
    ).rejects.toThrow();
    expect(mockTrackAllowance).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it.each(['disabled', 'token decimals'] as const)(
    'invalidates an opened approval when %s changes, even if it changes back',
    async (reason) => {
      mockFetchAllowance.mockResolvedValue({ allowanceParsed: '0' });
      const screen = render(<UniversalWithdraw {...props} />);
      const confirmation = await openApproval(screen);
      await expect(
        Promise.resolve().then(() => confirmation.onBeforeSend?.()),
      ).resolves.toBeUndefined();
      const changed =
        reason === 'disabled'
          ? { isDisabled: true }
          : {
              approveTarget: {
                ...approveTarget,
                token: { ...approveTarget.token, decimals: 6 },
              },
            };
      screen.rerender(<UniversalWithdraw {...props} {...changed} />);
      await expect(
        Promise.resolve().then(() => confirmation.onBeforeSend?.()),
      ).rejects.toThrow();
      screen.rerender(<UniversalWithdraw {...props} />);
      await expect(
        Promise.resolve().then(() => confirmation.onBeforeSend?.()),
      ).rejects.toThrow();
    },
  );

  it('tracks a sent approval after the form becomes disabled', async () => {
    const receipt = deferred<EOnChainHistoryTxStatus | undefined>();
    mockWaitForStatus.mockReturnValueOnce(receipt.promise);
    mockFetchAllowance.mockResolvedValue({ allowanceParsed: '0' });
    const screen = render(<UniversalWithdraw {...props} />);
    const confirmation = await openApproval(screen);
    await expect(
      Promise.resolve().then(() => confirmation.onBeforeSend?.()),
    ).resolves.toBeUndefined();
    screen.rerender(<UniversalWithdraw {...props} isDisabled />);
    act(() => confirmation.onSuccess([{ decodedTx: { txid: 'synthetic' } }]));
    expect(mockTrackAllowance).toHaveBeenCalledWith('synthetic');
    await act(async () => receipt.resolve(EOnChainHistoryTxStatus.Success));
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('tracks a sent approval but does not resume withdrawal after the form is disabled and re-enabled', async () => {
    const receipt = deferred<EOnChainHistoryTxStatus | undefined>();
    mockWaitForStatus.mockReturnValueOnce(receipt.promise);
    mockFetchAllowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockResolvedValue({ allowanceParsed: '2' });
    const screen = render(<UniversalWithdraw {...props} />);
    const confirmation = await openApproval(screen);
    await expect(
      Promise.resolve().then(() => confirmation.onBeforeSend?.()),
    ).resolves.toBeUndefined();
    act(() => confirmation.onSuccess([{ decodedTx: { txid: 'synthetic' } }]));
    expect(mockTrackAllowance).toHaveBeenCalledWith('synthetic');
    screen.rerender(<UniversalWithdraw {...props} isDisabled />);
    screen.rerender(<UniversalWithdraw {...props} />);
    await waitFor(
      () =>
        expect(
          screen
            .getByRole('button', { name: 'global.approve' })
            .hasAttribute('disabled'),
        ).toBe(false),
      { timeout: 5000 },
    );
    await act(async () => receipt.resolve(EOnChainHistoryTxStatus.Success));
    await act(async () => {});
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockFetchAllowance).toHaveBeenCalledTimes(1);
  });

  it('invalidates an opened approval when the withdrawal quote becomes unresolved', async () => {
    mockFetchAllowance.mockResolvedValue({ allowanceParsed: '0' });
    const screen = render(<UniversalWithdraw {...props} />);
    const confirmation = await openApproval(screen);
    await expect(
      Promise.resolve().then(() => confirmation.onBeforeSend?.()),
    ).resolves.toBeUndefined();
    const pending = deferred<unknown>();
    mockQuote.mockReturnValue(pending.promise);
    screen.rerender(<UniversalWithdraw {...props} pendleSlippage={1} />);
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: 'global.approve' })
          .hasAttribute('disabled'),
      ).toBe(true),
    );
    await expect(
      Promise.resolve().then(() => confirmation.onBeforeSend?.()),
    ).rejects.toThrow();
    mockQuote.mockResolvedValue({
      withdrawPath: {
        data: {
          confirmBoxes: [
            {
              withdrawType: 'queued',
              title: { text: 'Queued' },
              description: { text: '1' },
            },
          ],
        },
      },
    });
    screen.rerender(<UniversalWithdraw {...props} />);
    await waitFor(
      () =>
        expect(
          screen
            .getByRole('button', { name: 'global.approve' })
            .hasAttribute('disabled'),
        ).toBe(false),
      { timeout: 5000 },
    );
    await expect(
      Promise.resolve().then(() => confirmation.onBeforeSend?.()),
    ).rejects.toThrow();
  });

  it('keeps an opened approval valid when a disabled render suspends and is discarded', async () => {
    const suspended = new Promise<never>(() => undefined);
    let attempts = 0;
    function Suspend({ active }: { active: boolean }) {
      if (active) {
        attempts += 1;
        throw suspended;
      }
      return null;
    }
    function App() {
      const [disabled, setDisabled] = useState(false);
      return (
        <>
          <button
            type="button"
            onClick={() => startTransition(() => setDisabled(true))}
          >
            Suspend disabled
          </button>
          <button type="button" onClick={() => setDisabled(false)}>
            Discard disabled
          </button>
          <Suspense fallback={<span>Suspended</span>}>
            <UniversalWithdraw {...props} isDisabled={disabled} />
            <Suspend active={disabled} />
          </Suspense>
        </>
      );
    }
    mockFetchAllowance.mockResolvedValue({ allowanceParsed: '0' });
    const screen = render(<App />);
    const confirmation = await openApproval(screen);
    fireEvent.click(screen.getByRole('button', { name: 'Suspend disabled' }));
    await waitFor(() => expect(attempts).toBeGreaterThan(0));
    expect(screen.queryByText('Suspended')).toBeNull();
    await expect(
      Promise.resolve().then(() => confirmation.onBeforeSend?.()),
    ).resolves.toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Discard disabled' }));
    await expect(
      Promise.resolve().then(() => confirmation.onBeforeSend?.()),
    ).resolves.toBeUndefined();
  });

  it('keeps tracking an approval already sent when its guard later blocks', async () => {
    let allowed = true;
    const receipt = deferred<EOnChainHistoryTxStatus | undefined>();
    mockWaitForStatus.mockReturnValueOnce(receipt.promise);
    mockFetchAllowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockResolvedValue({ allowanceParsed: '2' });
    const screen = render(
      <UniversalWithdraw
        {...props}
        actionGuard={{
          loading: false,
          blocked: false,
          verifyBeforeAction: mockVerify,
          isActionAllowed: () => allowed,
        }}
      />,
    );
    const confirmation = await openApproval(screen);
    expect(confirmation.onBeforeSend).toEqual(expect.any(Function));
    await expect(
      Promise.resolve().then(() => confirmation.onBeforeSend?.()),
    ).resolves.toBeUndefined();

    allowed = false;
    act(() => confirmation.onSuccess([{ decodedTx: { txid: 'synthetic' } }]));
    expect(mockTrackAllowance).toHaveBeenCalledWith('synthetic');
    await act(async () => receipt.resolve(EOnChainHistoryTxStatus.Success));
    await waitFor(() => expect(mockFetchAllowance).toHaveBeenCalledTimes(2));
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('does not continue when approval confirmation is still pending', async () => {
    mockWaitForStatus.mockResolvedValue(undefined);
    mockFetchAllowance.mockResolvedValue({ allowanceParsed: '0' });
    const screen = render(<UniversalWithdraw {...props} />);
    const button = await screen.findByRole(
      'button',
      { name: 'global.approve' },
      { timeout: 5000 },
    );
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false), {
      timeout: 5000,
    });
    fireEvent.click(button);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    await act(async () =>
      mockNavigate.mock.calls[0][0].onSuccess([
        { decodedTx: { txid: 'synthetic' } },
      ]),
    );
    expect(mockWaitForStatus).toHaveBeenCalledTimes(1);
    expect(mockFetchAllowance).toHaveBeenCalledTimes(1);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('waits for confirmation with the safety policy even for non-share amounts', async () => {
    mockWaitForStatus.mockResolvedValue(undefined);
    mockFetchAllowance.mockResolvedValue({ allowanceParsed: '0' });
    const screen = render(
      <UniversalWithdraw {...props} amountUnit={undefined} />,
    );
    const button = await screen.findByRole(
      'button',
      { name: 'global.approve' },
      { timeout: 5000 },
    );
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false), {
      timeout: 5000,
    });
    fireEvent.click(button);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    await act(async () =>
      mockNavigate.mock.calls[0][0].onSuccess([
        { decodedTx: { txid: 'synthetic' } },
      ]),
    );
    expect(mockWaitForStatus).toHaveBeenCalledTimes(1);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it.each(['unavailable', 'invalid'] as const)(
    'does not open approval when live allowance is %s',
    async (failure) => {
      if (failure === 'unavailable') {
        mockFetchAllowance.mockRejectedValue('unavailable');
      } else {
        mockFetchAllowance.mockResolvedValue({ allowanceParsed: 'NaN' });
      }
      const screen = render(<UniversalWithdraw {...props} />);
      const button = await screen.findByRole(
        'button',
        { name: 'global.approve' },
        { timeout: 5000 },
      );
      await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false), {
        timeout: 5000,
      });
      fireEvent.click(button);
      await waitFor(() => expect(mockFetchAllowance).toHaveBeenCalledTimes(1));
      await act(async () => Promise.resolve());
      expect(mockNavigate).not.toHaveBeenCalled();
      if (failure === 'invalid')
        expect(mockToastError).toHaveBeenCalledTimes(1);
    },
  );

  it('does not continue when the broadcast result has no transaction id', async () => {
    mockFetchAllowance.mockResolvedValue({ allowanceParsed: '0' });
    const screen = render(<UniversalWithdraw {...props} />);
    const button = await screen.findByRole(
      'button',
      { name: 'global.approve' },
      { timeout: 5000 },
    );
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false), {
      timeout: 5000,
    });
    fireEvent.click(button);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    act(() => mockNavigate.mock.calls[0][0].onSuccess([]));
    expect(mockToastMessage).toHaveBeenCalledTimes(1);
    expect(mockWaitForStatus).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('does not continue an approval after the amount changes', async () => {
    const pending = deferred<{ allowanceParsed: string }>();
    mockFetchAllowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockReturnValueOnce(pending.promise);
    const screen = render(<UniversalWithdraw {...props} />);
    await beginApproval(screen);
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '1.5' },
    });
    await act(async () => pending.resolve({ allowanceParsed: '2' }));
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('does not continue an old approval after the safety policy changes', async () => {
    const pending = deferred<{ allowanceParsed: string }>();
    mockFetchAllowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockReturnValueOnce(pending.promise);
    const screen = render(<UniversalWithdraw {...props} />);
    await beginApproval(screen);
    screen.rerender(
      <UniversalWithdraw {...props} withdrawalSafetyPolicy={undefined} />,
    );
    await act(async () => pending.resolve({ allowanceParsed: '2' }));
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('does not continue a non-strict approval after enabling the safety policy', async () => {
    const pending = deferred<{ allowanceParsed: string }>();
    mockFetchAllowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockReturnValueOnce(pending.promise);
    const screen = render(
      <UniversalWithdraw {...props} withdrawalSafetyPolicy={undefined} />,
    );
    await beginApproval(screen);
    screen.rerender(<UniversalWithdraw {...props} />);
    await act(async () => pending.resolve({ allowanceParsed: '2' }));
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('does not open a stale approval when the safety policy is enabled during its allowance check', async () => {
    const pending = deferred<{ allowanceParsed: string }>();
    mockFetchAllowance.mockReturnValueOnce(pending.promise);
    const screen = render(
      <UniversalWithdraw {...props} withdrawalSafetyPolicy={undefined} />,
    );
    const button = await screen.findByRole(
      'button',
      { name: 'global.approve' },
      { timeout: 5000 },
    );
    await waitFor(() => expect(mockQuote).toHaveBeenCalledTimes(2), {
      timeout: 5000,
    });
    await waitFor(() => expect(mockCheckAmount).toHaveBeenCalled(), {
      timeout: 5000,
    });
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false), {
      timeout: 5000,
    });
    fireEvent.click(button);
    await waitFor(() => expect(mockFetchAllowance).toHaveBeenCalledTimes(1));
    screen.rerender(<UniversalWithdraw {...props} />);
    screen.rerender(
      <UniversalWithdraw {...props} withdrawalSafetyPolicy={undefined} />,
    );
    await act(async () => pending.resolve({ allowanceParsed: '0' }));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not continue an approval after the account changes', async () => {
    const pending = deferred<{ allowanceParsed: string }>();
    mockFetchAllowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockReturnValueOnce(pending.promise);
    const screen = render(<UniversalWithdraw {...props} />);
    await beginApproval(screen);
    screen.rerender(
      <UniversalWithdraw
        {...props}
        accountId="account-b"
        accountAddress="0xother"
        approveTarget={{ ...approveTarget, accountId: 'account-b' }}
      />,
    );
    await act(async () => pending.resolve({ allowanceParsed: '2' }));
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('does not continue an approval after the address changes on the same account', async () => {
    const pending = deferred<{ allowanceParsed: string }>();
    mockFetchAllowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockReturnValueOnce(pending.promise);
    const screen = render(<UniversalWithdraw {...props} />);
    await beginApproval(screen);
    screen.rerender(<UniversalWithdraw {...props} accountAddress="0xother" />);
    await act(async () => pending.resolve({ allowanceParsed: '2' }));
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('does not continue after allowance polling fails', async () => {
    const pending = deferred<{ allowanceParsed: string }>();
    mockFetchAllowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockReturnValueOnce(pending.promise)
      .mockRejectedValue(new Error('allowance lookup failed'));
    const screen = render(<UniversalWithdraw {...props} />);
    await beginApproval(screen);
    jest.useFakeTimers();
    try {
      await act(async () => {
        pending.resolve({ allowanceParsed: '0' });
        await jest.advanceTimersByTimeAsync(30_000);
      });
      expect(mockFetchAllowance).toHaveBeenCalledTimes(16);
      expect(mockTrackAllowance).toHaveBeenCalledWith('synthetic');
      expect(mockRetryAllowance).not.toHaveBeenCalled();
      expect(mockVerify).not.toHaveBeenCalled();
      expect(mockConfirm).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('blocks withdrawal after a failed amount check and retries explicitly', async () => {
    mockCheckAmount.mockRejectedValueOnce('temporary failure');
    const screen = render(<UniversalWithdraw {...props} />);
    const retry = await screen.findByRole(
      'button',
      { name: 'global.retry' },
      { timeout: 5000 },
    );
    expect(
      screen
        .getByRole('button', { name: 'global.approve' })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(mockNavigate).not.toHaveBeenCalled();

    mockCheckAmount.mockResolvedValue({ code: 0, data: { alerts: [] } });
    fireEvent.click(retry);
    await waitFor(
      () =>
        expect(
          screen
            .getByRole('button', { name: 'global.approve' })
            .hasAttribute('disabled'),
        ).toBe(false),
      { timeout: 5000 },
    );
  });

  it('blocks an amount check error without a server message', async () => {
    mockCheckAmount.mockResolvedValue({ code: 1, message: '' });
    const screen = render(<UniversalWithdraw {...props} />);
    await waitFor(() => expect(mockCheckAmount).toHaveBeenCalled(), {
      timeout: 5000,
    });
    await waitFor(() =>
      expect(screen.getByText('global.an_error_occurred')).toBeTruthy(),
    );
    expect(
      screen
        .getByRole('button', { name: 'global.approve' })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('ignores an amount check for the previous address on the same account', async () => {
    const oldCheck = deferred<unknown>();
    const newCheck = deferred<unknown>();
    mockCheckAmount
      .mockReturnValueOnce(oldCheck.promise)
      .mockReturnValueOnce(newCheck.promise);
    const screen = render(<UniversalWithdraw {...props} />);
    await waitFor(() => expect(mockCheckAmount).toHaveBeenCalledTimes(1), {
      timeout: 5000,
    });
    screen.rerender(<UniversalWithdraw {...props} accountAddress="0xother" />);
    await waitFor(() => expect(mockCheckAmount).toHaveBeenCalledTimes(2), {
      timeout: 5000,
    });
    await act(async () => oldCheck.resolve({ code: 0, data: { alerts: [] } }));
    expect(
      screen
        .getByRole('button', { name: 'global.approve' })
        .hasAttribute('disabled'),
    ).toBe(true);
    await act(async () => newCheck.resolve({ code: 0, data: { alerts: [] } }));
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: 'global.approve' })
          .hasAttribute('disabled'),
      ).toBe(false),
    );
  });
});
