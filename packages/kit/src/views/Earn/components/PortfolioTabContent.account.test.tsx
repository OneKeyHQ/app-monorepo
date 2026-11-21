/** @jest-environment jsdom */

import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { EStakingActionType } from '@onekeyhq/shared/types/staking';

import {
  PortfolioPendingTxsProvider,
  WrappedActionButton,
} from './PortfolioTabContent';

const mockRetryAccount = jest.fn();
const mockHandleAction = jest.fn();
let mockDesktopLayout = false;
let mockAccountId = 'account';
let mockPendingOnRefresh: (() => void | Promise<void>) | undefined;
let mockPendingResult: {
  filteredTxs: Array<{ id: string }>;
  isPendingHistoryVerified: boolean;
} = {
  filteredTxs: [],
  isPendingHistoryVerified: true,
};

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => {
      if (id === 'global.failed') return 'Failed';
      if (id === 'global.retry') return 'Retry';
      return id;
    },
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const Placeholder = () => null;
  return {
    Button: ({
      children,
      disabled,
      loading,
      onPress,
    }: {
      children: React.ReactNode;
      disabled?: boolean;
      loading?: boolean;
      onPress?: () => void;
    }) =>
      ReactModule.createElement(
        'button',
        { disabled: disabled || loading, onClick: onPress },
        children,
      ),
    Divider: Placeholder,
    Empty: Placeholder,
    SizableText: Placeholder,
    Skeleton: Placeholder,
    Stack: Placeholder,
    XStack: Placeholder,
    YStack: Placeholder,
    useMedia: () => ({ gtSm: mockDesktopLayout }),
  };
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/kit/src/components/ListView/TableList', () => ({}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../../../components/Currency', () => ({}));
jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      account: { id: mockAccountId },
      indexedAccount: undefined,
    },
  }),
}));
jest.mock('../../Staking/components/ProtocolDetails/EarnText', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    EarnText: ({ text }: { text: { text: string } }) =>
      ReactModule.createElement('span', null, text.text),
  };
});
jest.mock('../../Staking/components/ProtocolDetails/EarnTooltip', () => ({}));
jest.mock('../../Staking/components/StakingActivityIndicator', () => ({}));
jest.mock('../../Staking/utils/utils', () => ({
  buildLocalTxStatusSyncId: () => 'tag',
}));
jest.mock('../earnUtils', () => ({}));
jest.mock('../hooks/usePortfolioAction', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    usePortfolioAction: () => {
      const [accountResolutionFailed, setAccountResolutionFailed] =
        ReactModule.useState(true);
      return {
        loading: false,
        accountResolutionFailed,
        accountUnavailable: false,
        retryAccount: () => {
          mockRetryAccount();
          setAccountResolutionFailed(false);
        },
        handleAction: mockHandleAction,
      };
    },
  };
});
jest.mock('../hooks/useStakingPendingTxs', () => ({
  useStakingPendingTxsByInfo: ({
    onRefresh,
  }: {
    onRefresh?: () => void | Promise<void>;
  }) => {
    mockPendingOnRefresh = onRefresh;
    return mockPendingResult;
  },
}));
jest.mock('../utils/portfolioClaimUtils', () => ({
  resolvePortfolioClaimProtocolIdentity: () => ({
    symbol: 'ETH',
    vault: 'vault',
  }),
}));

const asset = {
  token: { info: { symbol: 'ETH', logoURI: '' } },
  deposit: { title: { text: 'Deposit' }, description: { text: '0' } },
  earnings24h: { title: { text: 'Earnings' } },
  rewardAssets: [],
  assetsStatus: [],
  buttons: [],
  metadata: {
    network: { networkId: 'evm--1', name: 'Ethereum', logoURI: '' },
    protocol: {
      symbol: 'ETH',
      vault: 'vault',
      providerDetail: { code: 'etherfi', name: 'EtherFi', logoURI: '' },
    },
  },
} satisfies React.ComponentProps<typeof WrappedActionButton>['asset'];

const reward = {
  title: { text: 'Withdrawal' },
  description: { text: 'Pending' },
  button: {
    type: EStakingActionType.CancelWithdrawal,
    disabled: false,
    text: { text: 'Cancel withdrawal' },
  },
} satisfies React.ComponentProps<typeof WrappedActionButton>['reward'];

describe('portfolio action account resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccountId = 'account';
    mockPendingOnRefresh = undefined;
    mockPendingResult = { filteredTxs: [], isPendingHistoryVerified: true };
  });

  it.each([false, true])(
    'retries failed account resolution without starting an action (desktop=%s)',
    (desktop) => {
      mockDesktopLayout = desktop;
      const onBeforeAction = jest.fn();
      render(
        <WrappedActionButton
          asset={asset}
          reward={reward}
          onBeforeAction={onBeforeAction}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Failed · Retry' }));
      expect(mockRetryAccount).toHaveBeenCalledTimes(1);
      expect(mockHandleAction).not.toHaveBeenCalled();
      expect(onBeforeAction).not.toHaveBeenCalled();

      fireEvent.click(
        screen.getByRole('button', { name: 'Cancel withdrawal' }),
      );
      expect(mockHandleAction).toHaveBeenCalledTimes(1);
      expect(onBeforeAction).toHaveBeenCalledTimes(1);
    },
  );

  it('does not refresh the new account when a pending result becomes unverified during an account switch', () => {
    const onRefresh = jest.fn(async () => undefined);
    mockPendingResult = {
      filteredTxs: [{ id: 'old-tx' }],
      isPendingHistoryVerified: true,
    };
    const view = render(
      <PortfolioPendingTxsProvider value={{ onRefresh }}>
        <WrappedActionButton asset={asset} reward={reward} />
      </PortfolioPendingTxsProvider>,
    );
    mockAccountId = 'account-b';
    mockPendingResult = { filteredTxs: [], isPendingHistoryVerified: false };
    view.rerender(
      <PortfolioPendingTxsProvider value={{ onRefresh }}>
        <WrappedActionButton asset={asset} reward={reward} />
      </PortfolioPendingTxsProvider>,
    );
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('refreshes the matching provider when the pending tracker reports completion', async () => {
    const onRefresh = jest.fn(async () => undefined);
    render(
      <PortfolioPendingTxsProvider value={{ onRefresh }}>
        <WrappedActionButton asset={asset} reward={reward} />
      </PortfolioPendingTxsProvider>,
    );
    await mockPendingOnRefresh?.();
    expect(onRefresh).toHaveBeenCalledWith({ provider: 'etherfi' });
  });
});
