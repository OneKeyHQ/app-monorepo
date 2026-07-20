// cspell: words unifold Unifold
import { showPerpsUnifoldDepositDialog } from './PerpsUnifoldDepositModal.native';

const mockBeginDeposit = jest.fn().mockResolvedValue(undefined);
const mockShowPerpsUnifoldDepositMenuDialog = jest.fn(
  ({ onLaunchUnifold }: { onLaunchUnifold: (screen: string) => void }) => {
    onLaunchUnifold('transfer');
  },
);

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquidSubscription: {
      enableLedgerUpdatesSubscription: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeAndroid: false,
  },
}));

jest.mock('@onekeyhq/shared/types/hyperliquid/perp.constants', () => ({
  USDC_TOKEN_INFO: {
    address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
  },
}));

jest.mock('../../../consts/unifold', () => ({
  UNIFOLD_PERPS_PUBLISHABLE_KEY: 'pk_test_unifold',
}));

jest.mock('./PerpsUnifoldDepositShared', () => ({
  buildUnifoldDepositDestination: jest.fn(() => ({
    externalUserId: '0xrecipient',
    destinationChainType: 'ethereum',
    destinationChainId: '1337',
    destinationTokenAddress: '0x00000000000000000000000000000000',
    destinationTokenSymbol: 'USDC (Perp)',
    recipientAddress: '0xrecipient',
  })),
  runUnifoldDepositGuards: jest.fn().mockResolvedValue('0xrecipient'),
  showPerpsUnifoldDepositMenuDialog: (
    props: Parameters<typeof mockShowPerpsUnifoldDepositMenuDialog>[0],
  ) => mockShowPerpsUnifoldDepositMenuDialog(props),
}));

jest.mock('./unifoldNativeBridge', () => ({
  getNativeUnifoldBeginDeposit: () => mockBeginDeposit,
}));

describe('showPerpsUnifoldDepositDialog on native', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows the full-window backdrop to close the inline SDK sheet', async () => {
    showPerpsUnifoldDepositDialog({
      selectedAccount: { accountAddress: '0xrecipient' } as never,
      onOneKeyWalletPress: jest.fn(),
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(mockBeginDeposit).toHaveBeenCalledWith(
      expect.objectContaining({
        closeOnBackdropPress: true,
      }),
    );
  });

  it('does not log a user cancellation as an error', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockBeginDeposit.mockRejectedValueOnce({
      message: 'Deposit cancelled by user',
    });

    showPerpsUnifoldDepositDialog({
      selectedAccount: { accountAddress: '0xrecipient' } as never,
      onOneKeyWalletPress: jest.fn(),
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
