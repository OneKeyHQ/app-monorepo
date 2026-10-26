/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { TradingGuardWrapper } from './TradingGuardWrapper';

const mockBeforeDeposit = jest.fn();
const mockShowDeposit = jest.fn(async () => undefined);
const mockCloseSteps = jest.fn();
const mockRequest = jest.fn(
  async ({ beforeDeposit }: { beforeDeposit?: () => void }) => {
    beforeDeposit?.();
    return { shouldContinue: false, status: undefined };
  },
);
const mockShowSteps = jest.fn(
  async ({
    onConfirm,
  }: {
    onConfirm: (options: { closeDialog: () => void }) => Promise<unknown>;
  }) => onConfirm({ closeDialog: mockCloseSteps }),
);
let mockRequiresSteps = false;
let mockDecision = 'deposit';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  Button: ({
    children,
    onPress,
    testID,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button data-testid={testID} onClick={onPress}>
      {children}
    </button>
  ),
  Spinner: () => null,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      checkPerpsAccountStatus: jest.fn(async () => undefined),
    },
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  perpsActiveAccountStatusAtom: { get: jest.fn(async () => ({})) },
  usePerpsAccountLoadingInfoAtom: () => [
    { selectAccountLoading: false, enableTradingLoading: false },
  ],
  usePerpsActiveAccountEnableTradingModeAtom: () => [
    { requiresExplicitEnableTrading: mockRequiresSteps },
  ],
  usePerpsActiveAccountIsAgentReadyAtom: () => [{ isAgentReady: false }],
  usePerpsActiveAccountStatusAtom: () => [{}],
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: { toastIfError: jest.fn() },
}));
jest.mock('../hooks/useEnableTradingWithDepositFallback', () => ({
  useConfirmHyperliquidTerms: () => async () => true,
  useRequestEnableTradingWithDepositFallback: () => mockRequest,
}));
jest.mock('../hooks/useShowDepositWithdrawModal', () => ({
  useShowDepositWithdrawModal: () => ({
    showDepositWithdrawModal: mockShowDeposit,
  }),
}));
jest.mock('../utils/enableTradingDialogConfirm', () => ({
  getEnableTradingDialogConfirmDecision: () => mockDecision,
}));
jest.mock('../utils/styleUtils', () => ({
  getTradingButtonStyleProps: () => ({
    bg: '',
    hoverStyle: {},
    pressStyle: {},
    textColor: '',
  }),
}));
jest.mock('./TradingPanel/modals/EnableTradingStepsDialog', () => ({
  showEnableTradingStepsDialog: (options: {
    onConfirm: (options: { closeDialog: () => void }) => Promise<unknown>;
  }) => mockShowSteps(options),
}));

describe('TradingGuardWrapper deposit cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequiresSteps = false;
    mockDecision = 'deposit';
  });

  function renderGuard() {
    render(
      <TradingGuardWrapper beforeDeposit={mockBeforeDeposit}>
        <button data-testid="submit-order">Submit order</button>
      </TradingGuardWrapper>,
    );
    fireEvent.click(screen.getByTestId('perp-is-disabled-btn'));
  }

  it('closes the parent before a direct deposit without exposing order submission', async () => {
    mockRequiresSteps = true;
    renderGuard();
    await waitFor(() =>
      expect(mockShowDeposit).toHaveBeenCalledWith('deposit'),
    );
    expect(mockBeforeDeposit).toHaveBeenCalledTimes(1);
    expect(mockBeforeDeposit.mock.invocationCallOrder[0]).toBeLessThan(
      mockShowDeposit.mock.invocationCallOrder[0],
    );
    expect(screen.queryByTestId('submit-order')).toBeNull();
  });

  it('closes steps and parent before a deposit from the steps request', async () => {
    mockRequiresSteps = true;
    mockDecision = 'stop';
    renderGuard();
    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));
    expect(mockCloseSteps).toHaveBeenCalledTimes(1);
    expect(mockBeforeDeposit).toHaveBeenCalledTimes(1);
    expect(mockCloseSteps.mock.invocationCallOrder[0]).toBeLessThan(
      mockBeforeDeposit.mock.invocationCallOrder[0],
    );
    expect(screen.queryByTestId('submit-order')).toBeNull();
  });

  it('passes parent cleanup into the ordinary enable request', async () => {
    renderGuard();
    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));
    expect(mockBeforeDeposit).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('submit-order')).toBeNull();
  });
});
