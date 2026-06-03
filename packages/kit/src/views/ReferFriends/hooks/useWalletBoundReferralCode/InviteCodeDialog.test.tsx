/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

import { InviteCodeDialog } from './InviteCodeDialog';

import type { IWalletWithReferralBindStatus } from './useFetchWalletsWithBoundStatus';

type ISelectItem = {
  value: string;
  disabled?: boolean;
};

type ISelectProps = {
  items: ISelectItem[];
};

type IFooterProps = {
  confirmButtonProps?: {
    disabled?: boolean;
  };
};

const mockForm = {
  getValues: jest.fn((name?: string) => (name ? '' : { referralCode: '' })),
  setValue: jest.fn(),
  watch: jest.fn(() => ({
    unsubscribe: jest.fn(),
  })),
  trigger: jest.fn(async () => true),
  setError: jest.fn(),
};

const mockInviteCodeDialogBag = globalThis as typeof globalThis & {
  __inviteCodeDialog?: {
    fetchReturn: {
      walletsWithStatus: IWalletWithReferralBindStatus[] | undefined;
      isLoading: boolean;
    };
    selectProps?: ISelectProps;
    footerProps?: IFooterProps;
  };
};

function getMockBag() {
  if (!mockInviteCodeDialogBag.__inviteCodeDialog) {
    mockInviteCodeDialogBag.__inviteCodeDialog = {
      fetchReturn: {
        walletsWithStatus: [],
        isLoading: false,
      },
    };
  }
  return mockInviteCodeDialogBag.__inviteCodeDialog;
}

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const Form = ({ children }: { children?: ReactNode }) => (
    <form>{children}</form>
  );
  (Form as any).Field = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );

  return {
    __esModule: true,
    Dialog: {
      Footer: (props: IFooterProps) => {
        getMockBag().footerProps = props;
        return (
          <button
            data-testid="confirm-button"
            disabled={props.confirmButtonProps?.disabled}
            type="button"
          >
            confirm
          </button>
        );
      },
    },
    Form,
    Icon: () => <span />,
    Input: () => <input />,
    Select: (props: ISelectProps) => {
      getMockBag().selectProps = props;
      return <div data-testid="wallet-select" />;
    },
    SizableText: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    Spinner: () => <div data-testid="spinner" />,
    XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    useForm: () => mockForm,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceReferralCode: {
      getCachedInviteCode: jest.fn(async () => undefined),
      setCachedInviteCode: jest.fn(async () => undefined),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/WalletAvatar/WalletAvatar', () => ({
  WalletAvatar: () => <div data-testid="wallet-avatar" />,
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: null,
    isLoading: false,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({
    navigationToMessageConfirmAsync: jest.fn(),
  }),
}));

jest.mock('./AllWalletsBoundEmpty', () => ({
  AllWalletsBoundEmpty: () => <div data-testid="all-bound" />,
  AllWalletsUnavailableEmpty: () => <div data-testid="all-unavailable" />,
}));

jest.mock('./NoWalletEmpty', () => ({
  NoWalletEmpty: () => <div data-testid="no-wallet" />,
}));

jest.mock('./useFetchWalletsWithBoundStatus', () => ({
  useFetchWalletsWithBoundStatus: () => getMockBag().fetchReturn,
}));

jest.mock('./useGetReferralCodeWalletInfo', () => ({
  useGetReferralCodeWalletInfo: () => jest.fn(async () => null),
}));

function createWallet(id: string, name = id): IDBWallet {
  return {
    id,
    name,
  } as IDBWallet;
}

describe('InviteCodeDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInviteCodeDialogBag.__inviteCodeDialog = {
      fetchReturn: {
        walletsWithStatus: [],
        isLoading: false,
      },
    };
  });

  it('disables unknown wallet rows and the apply action', () => {
    const unknownWallet = createWallet('hd-unknown', 'Unknown Wallet');
    const bindableWallet = createWallet('hd-bindable', 'Bindable Wallet');

    getMockBag().fetchReturn = {
      isLoading: false,
      walletsWithStatus: [
        {
          wallet: unknownWallet,
          isBound: false,
          status: 'unknown',
        },
        {
          wallet: bindableWallet,
          isBound: false,
          bindable: true,
          status: 'bindable',
        },
      ],
    };

    render(
      <InviteCodeDialog
        wallet={unknownWallet}
        confirmBindReferralCode={jest.fn()}
      />,
    );

    expect(getMockBag().selectProps?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: 'hd-unknown',
          disabled: true,
        }),
        expect.objectContaining({
          value: 'hd-bindable',
          disabled: false,
        }),
      ]),
    );
    expect(getMockBag().footerProps?.confirmButtonProps?.disabled).toBe(true);
    const confirmButton = screen.getByTestId(
      'confirm-button',
    ) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);
  });

  it('treats all unknown wallets as unavailable', () => {
    const unknownWallet = createWallet('hd-unknown', 'Unknown Wallet');

    getMockBag().fetchReturn = {
      isLoading: false,
      walletsWithStatus: [
        {
          wallet: unknownWallet,
          isBound: false,
          status: 'unknown',
        },
      ],
    };

    render(
      <InviteCodeDialog
        wallet={unknownWallet}
        confirmBindReferralCode={jest.fn()}
      />,
    );

    expect(screen.getByTestId('all-unavailable')).toBeTruthy();
    expect(getMockBag().selectProps).toBeUndefined();
  });
});
