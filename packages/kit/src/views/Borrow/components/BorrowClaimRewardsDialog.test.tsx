/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';

import type {
  IEarnRewardClaimItem,
  IEarnRewardsDetails,
} from '@onekeyhq/shared/types/staking';

import { showBorrowClaimRewardsDialog } from './BorrowClaimRewardsDialog';

type IDialogConfig = {
  renderContent: ReactElement;
};

const mockDialogShow = jest.fn();
const mockDialogClose = jest.fn<Promise<void>, []>();
let mockFooterOnConfirm: (() => Promise<void>) | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  function Container({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  }
  return {
    Button: ({
      children,
      disabled,
      onPress,
      testID,
    }: {
      children?: ReactNode;
      disabled?: boolean;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button
        data-testid={testID}
        disabled={disabled}
        onClick={onPress}
        type="button"
      >
        {children}
      </button>
    ),
    Dialog: {
      Footer: ({
        confirmButtonProps,
        onConfirm,
        onConfirmText,
      }: {
        confirmButtonProps?: {
          disabled?: boolean;
          testID?: string;
        };
        onConfirm: () => Promise<void>;
        onConfirmText?: string;
      }) => {
        mockFooterOnConfirm = onConfirm;
        return (
          <button
            data-testid={confirmButtonProps?.testID}
            disabled={confirmButtonProps?.disabled}
            type="button"
          >
            {onConfirmText}
          </button>
        );
      },
      show: (config: IDialogConfig) => {
        mockDialogShow(config);
      },
      // The rewards list scrolls through Dialog.ScrollView so the sheet's drag
      // gesture and the list's scroll stay separate (OK-61140).
      ScrollView: Container,
    },
    ScrollView: Container,
    XStack: Container,
    YStack: Container,
    useDialogInstance: () => ({
      close: mockDialogClose,
    }),
    useMedia: () => ({ gtMd: true }),
  };
});

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: {
    defi_claim_all: 'defi_claim_all',
    defi_claimable_rewards: 'defi_claimable_rewards',
  },
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: {
      formatMessage: ({ id }: { id: string }) => id,
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

jest.mock('../../Staking/components/ProtocolDetails/EarnText', () => ({
  EarnText: ({ text }: { text: { text: string } }) => <span>{text.text}</span>,
}));

const claimItem: IEarnRewardClaimItem = {
  id: 'reward-1',
  title: { text: '1 ONE' },
  token: {
    networkId: 'evm--1',
    address: '0xToken',
    name: 'OneKey',
    symbol: 'ONE',
    decimals: 18,
    logoURI: 'https://example.com/token.png',
  },
  button: {
    type: 'claim',
    disabled: false,
    text: { text: 'Claim' },
  },
};

const rewardsDetails: IEarnRewardsDetails = {
  type: 'rewardsDetails',
  disabled: false,
  text: { text: 'Rewards' },
  data: {
    rewardsDetail: {
      claimable: [
        {
          items: [claimItem],
        },
      ],
      button: {
        type: 'claim',
        disabled: false,
        text: { text: 'Claim all' },
      },
    },
  },
};

function renderClaimDialog(onClaimAll: () => Promise<boolean | void>) {
  showBorrowClaimRewardsDialog({
    rewardsDetails,
    onClaimItem: jest.fn(async () => undefined),
    onClaimAll,
  });
  const config = mockDialogShow.mock.calls[0][0] as IDialogConfig;
  return render(config.renderContent);
}

function getFooterOnConfirm() {
  return mockFooterOnConfirm as () => Promise<void>;
}

describe('BorrowClaimRewardsDialog Claim All lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFooterOnConfirm = undefined;
    mockDialogClose.mockResolvedValue(undefined);
  });

  it('closes exactly once after Claim All navigation resolves', async () => {
    let resolveClaimAll!: () => void;
    const claimAllPromise = new Promise<void>((resolve) => {
      resolveClaimAll = resolve;
    });
    const onClaimAll = jest.fn(() => claimAllPromise);
    const view = renderClaimDialog(onClaimAll);
    mockDialogClose.mockImplementation(async () => {
      view.unmount();
    });

    let confirmPromise!: Promise<void>;
    act(() => {
      confirmPromise = getFooterOnConfirm()();
    });

    expect(onClaimAll).toHaveBeenCalledTimes(1);
    expect(mockDialogClose).not.toHaveBeenCalled();
    expect(
      screen.getByTestId<HTMLButtonElement>('borrow-claim-all-btn').disabled,
    ).toBe(true);

    await act(async () => {
      resolveClaimAll();
      await confirmPromise;
    });

    expect(mockDialogClose).toHaveBeenCalledTimes(1);
    expect(onClaimAll).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('borrow-claim-all-btn')).toBeNull();
  });

  it('keeps the dialog open and resets loading when Claim All rejects', async () => {
    const claimFailure = new Error('claim failed');
    const onClaimAll = jest.fn(() => Promise.reject(claimFailure));
    renderClaimDialog(onClaimAll);

    await act(async () => {
      await expect(getFooterOnConfirm()()).rejects.toBe(claimFailure);
    });

    expect(onClaimAll).toHaveBeenCalledTimes(1);
    expect(mockDialogClose).not.toHaveBeenCalled();
    expect(
      screen.getByTestId<HTMLButtonElement>('borrow-claim-all-btn').disabled,
    ).toBe(false);
  });
});

describe('BorrowClaimRewardsDialog risk disclaimer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFooterOnConfirm = undefined;
    mockDialogClose.mockResolvedValue(undefined);
  });

  it('stays open when Claim All reports the flow never started', async () => {
    // useUniversalBorrowClaim resolves false when the one-time disclaimer is
    // declined: nothing was submitted, so the rewards list must remain.
    const onClaimAll = jest.fn(async () => false);
    renderClaimDialog(onClaimAll);

    await act(async () => {
      await getFooterOnConfirm()();
    });

    expect(onClaimAll).toHaveBeenCalledTimes(1);
    expect(mockDialogClose).not.toHaveBeenCalled();
    expect(
      screen.getByTestId<HTMLButtonElement>('borrow-claim-all-btn').disabled,
    ).toBe(false);
  });
});
