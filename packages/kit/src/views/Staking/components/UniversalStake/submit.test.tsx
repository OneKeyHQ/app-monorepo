/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { EApproveType } from '@onekeyhq/shared/types/staking';

import { useUniversalStake } from '../../hooks/useUniversalHooks';
import { UniversalStake } from '../UniversalStake';

const mockValidate = jest.fn<Promise<void>, unknown[]>();
const mockEstimate = jest.fn<
  Promise<{ coverFeeSeconds: number; feeFiatValue: string } | undefined>,
  unknown[]
>();
const mockBuild = jest.fn<
  Promise<{ tx: { to: string } | null; orderId: string }>,
  unknown[]
>();
const mockOrderDialog = jest.fn<
  Promise<{ status: string } | void>,
  unknown[]
>();
const mockSign = jest.fn<
  void,
  [{ onSuccess?: (data: { decodedTx: { txid: string } }[]) => void }]
>();
const mockFeeAlert = jest.fn<
  void,
  [
    {
      onConfirm: (dialog: { close: () => Promise<void> }) => Promise<void>;
      onClose: () => void;
    },
  ]
>();
let mockPress: () => Promise<void>;
let mockAllowance = '10';
const mockReadAllowance = jest.fn();
const mockTrackAllowance = jest.fn();

jest.mock('@onekeyhq/components', () => {
  const Box = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    Stack: Box,
    YStack: Box,
    XStack: Box,
    Skeleton: { BodyMd: () => null, BodyLg: () => null },
    Page: {
      FooterActions: ({
        confirmButtonProps,
      }: {
        confirmButtonProps: {
          onPress: () => Promise<void>;
          loading: boolean;
          disabled: boolean;
        };
      }) => {
        mockPress = confirmButtonProps.onPress;
        return (
          <button
            type="button"
            disabled={confirmButtonProps.disabled || confirmButtonProps.loading}
          >
            Deposit
          </button>
        );
      },
    },
  };
});
jest.mock('react-native', () => ({
  ...jest.requireActual<typeof import('react-native')>('react-native'),
  Keyboard: { dismiss: jest.fn() },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: { getAccount: () => ({ address: 'account' }) },
    serviceStaking: {
      checkAmount: () => ({ code: 0 }),
      getTransactionConfirmation: () => undefined,
      assertEarnApproval: (...args: unknown[]) => mockValidate(...args),
      estimateFee: (...args: unknown[]) => mockEstimate(...args),
      buildStakeTransaction: (...args: unknown[]) => mockBuild(...args),
      buildInternalDappTx: () => ({ to: 'staking-contract' }),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => () => ({}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({}),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));
jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({ navigationToTxConfirm: mockSign }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/discovery', () => ({
  useBrowserAction: () => ({ current: {} }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/earn', () => ({
  useEarnActions: () => ({ current: {} }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: { symbol: '$' } }],
}));
jest.mock('@onekeyhq/kit/src/utils/botWalletAccountUtils', () => ({
  isAccountIdDeactivatedBotWallet: () => false,
}));
jest.mock('@onekeyhq/kit/src/utils/botWalletWarningDialog', () => ({}));
jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => ({}));
jest.mock('@onekeyhq/kit/src/components/PercentageStageOnKeyboard', () => ({
  PercentageStageOnKeyboard: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/components/PercentageStageOnKeyboard/useAmountInputFocus',
  () => ({ useAmountInputFocus: () => ({}) }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Earn/components/EarnAprSuffixText',
  () => ({}),
);
jest.mock(
  '@onekeyhq/kit/src/views/Earn/components/showProtocolListDialog',
  () => ({}),
);
jest.mock('../../hooks/useEarnPermitApprove', () => ({
  useEarnPermitApprove: () => ({}),
}));
jest.mock('../../hooks/useEarnSignMessageWithoutVerify', () => ({
  useEarnSignMessageWithoutVerify: () => undefined,
}));
jest.mock('../../hooks/usePendleLayoutState', () => ({
  usePendleLayoutState: () => ({}),
}));
jest.mock('../../hooks/useQuoteRefresh', () => ({
  useQuoteRefresh: () => ({}),
}));
jest.mock('../../hooks/useUtilsHooks', () => ({
  useTrackTokenAllowance: () => ({
    allowance: mockAllowance,
    fetchAllowanceResponse: mockReadAllowance,
    trackAllowance: mockTrackAllowance,
  }),
}));
jest.mock('../StakingAmountInput', () => ({
  StakingAmountInput: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input
      aria-label="amount"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
  useOnBlurAmountValue: () => undefined,
}));
jest.mock('../EstimateNetworkFee', () => ({
  ...jest.requireActual<typeof import('../EstimateNetworkFee')>(
    '../EstimateNetworkFee',
  ),
  EstimateNetworkFee: () => null,
  useShowStakeEstimateGasAlert: () => mockFeeAlert,
}));
jest.mock('../EarnRiskWarningDialog', () => ({
  showEarnRiskWarningDialog: () => true,
}));
jest.mock('../ServerExecutedOrderDialog', () => ({
  showServerExecutedOrderDialog: (...args: unknown[]) =>
    mockOrderDialog(...args),
}));
jest.mock('../ClaimConversionDialog', () => ({}));
jest.mock('../StakeProgress', () => ({
  EStakeProgressStep: { approve: 1 },
  StakeProgress: () => null,
}));
jest.mock('../TradeOrBuy', () => ({ TradeOrBuy: () => null }));
jest.mock('../ManagePageV2ReceiveInput', () => ({
  ManagePageV2ReceiveInput: () => null,
}));
jest.mock('../StakingAmountInput/StakingAmountInputSkeleton', () => ({}));
jest.mock('../ProtocolDisplayShared', () => ({}));
jest.mock('../ProtocolDetails/PendleSharedComponents', () => ({}));
jest.mock('../ProtocolDetails/EarnValidatorSelect', () => ({}));
jest.mock('../ProtocolDetails/EarnPlatformBonusSection', () => ({}));
jest.mock('../ProtocolDetails/EarnActionIcon', () => ({}));
jest.mock('../ProtocolDetails/EarnTooltip', () => ({}));
jest.mock('../ProtocolDetails/EarnText', () => ({}));
jest.mock('../BtcFeeRateInput', () => ({}));
jest.mock('../CalculationList', () => ({}));

const accountId = 'account';
const networkId = 'evm--56';
const token = {
  symbol: 'USDT',
  name: 'Tether',
  decimals: 18,
  address: '0x55d398326f99059ff775485246999027b3197955',
  isNative: false,
};
const spenderAddress = '0xe9e8573bb351da16c6ee7ddac0cbc70b7f9784ae';

function StakeForm({ provider }: { provider: string }) {
  const stake = useUniversalStake({ accountId, networkId });
  return (
    <UniversalStake
      accountId={accountId}
      networkId={networkId}
      balance="10"
      decimals={18}
      tokenSymbol="USDT"
      providerName={provider}
      approveType={EApproveType.Legacy}
      approveTarget={{ accountId, networkId, spenderAddress, token }}
      onConfirm={({ amount }) =>
        stake({
          amount,
          provider,
          symbol: 'USDT',
          protocolVault: spenderAddress,
        })
      }
    />
  );
}

async function enterAmount(provider = 'Unitas') {
  render(<StakeForm provider={provider} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '1' } });
  await waitFor(() =>
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(
      false,
    ),
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  mockAllowance = '10';
  mockReadAllowance.mockResolvedValue({ allowanceParsed: '10' });
  mockBuild.mockResolvedValue({ tx: null, orderId: 'order-1' });
  mockOrderDialog.mockResolvedValue({ status: 'success' });
});

it('builds one Unitas order for repeated presses before validation and while the order dialog is open', async () => {
  let validate!: () => void;
  let close!: () => void;
  mockValidate.mockReturnValue(
    new Promise<void>((resolve) => {
      validate = resolve;
    }),
  );
  mockOrderDialog.mockReturnValue(
    new Promise<void>((resolve) => {
      close = resolve;
    }),
  );
  await enterAmount();
  const press = mockPress;
  let first!: Promise<void>;
  act(() => {
    first = press();
    void press();
  });
  expect(mockBuild).not.toHaveBeenCalled();
  await act(async () => {
    validate();
  });
  expect(mockBuild).toHaveBeenCalledWith(
    expect.objectContaining({ provider: 'Unitas', amount: '1' }),
  );
  await act(async () => {
    const repeated = press();
    close();
    await repeated;
    await first;
  });
  expect(mockBuild).toHaveBeenCalledTimes(1);
  expect(mockValidate).toHaveBeenCalledTimes(1);
  expect(mockOrderDialog).toHaveBeenCalledTimes(1);
  expect(mockSign).not.toHaveBeenCalled();

  fireEvent.change(screen.getByRole('textbox'), { target: { value: '1' } });
  await waitFor(() =>
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(
      false,
    ),
  );
  await act(async () => {
    await mockPress();
  });
  expect(mockBuild).toHaveBeenCalledTimes(2);
});

it('allows another attempt after approval validation rejects', async () => {
  mockValidate.mockRejectedValueOnce(new Error('invalid approval'));
  await enterAmount();
  await act(async () => {
    await expect(mockPress()).rejects.toThrow('invalid approval');
  });
  expect(mockBuild).not.toHaveBeenCalled();
  await act(async () => {
    await mockPress();
  });
  expect(mockBuild).toHaveBeenCalledTimes(1);
});

it('holds a signed deposit through its fee warning and allows retry after dismissal', async () => {
  mockEstimate.mockResolvedValue({
    coverFeeSeconds: 6 * 86_400,
    feeFiatValue: '1',
  });
  mockBuild.mockResolvedValue({
    tx: { to: 'staking-contract' },
    orderId: 'order-2',
  });
  await enterAmount('Aave');
  const press = mockPress;
  let first!: Promise<void>;
  await act(async () => {
    first = press();
  });
  await act(async () => {
    await press();
    mockFeeAlert.mock.lastCall![0].onClose();
    await first;
  });
  expect(mockFeeAlert).toHaveBeenCalledTimes(1);
  expect(mockBuild).not.toHaveBeenCalled();
  let second!: Promise<void>;
  await act(async () => {
    second = mockPress();
  });
  await act(async () => {
    const warning = mockFeeAlert.mock.lastCall![0];
    await warning.onConfirm({ close: async () => {} });
    warning.onClose();
    await second;
  });
  expect(mockBuild).toHaveBeenCalledTimes(1);
  expect(mockSign).toHaveBeenCalledTimes(1);
  expect(mockOrderDialog).not.toHaveBeenCalled();
});

it('continues from a legacy approval into one signed deposit after the allowance is visible', async () => {
  mockAllowance = '0';
  mockReadAllowance.mockResolvedValueOnce({ allowanceParsed: '0' });
  mockBuild.mockResolvedValue({
    tx: { to: 'staking-contract' },
    orderId: 'order-2',
  });
  await enterAmount('Aave');
  await act(async () => {
    await mockPress();
  });
  expect(mockBuild).not.toHaveBeenCalled();
  expect(mockSign).toHaveBeenCalledWith(
    expect.objectContaining({
      approvesInfo: [
        expect.objectContaining({ spender: spenderAddress, amount: '1' }),
      ],
    }),
  );
  await act(async () => {
    mockSign.mock.calls[0][0].onSuccess!([
      { decodedTx: { txid: 'approval-hash' } },
    ]);
  });
  expect(mockTrackAllowance).toHaveBeenCalledWith('approval-hash');
  expect(mockBuild).toHaveBeenCalledTimes(1);
  expect(mockSign).toHaveBeenCalledTimes(2);
  expect(mockOrderDialog).not.toHaveBeenCalled();
});
