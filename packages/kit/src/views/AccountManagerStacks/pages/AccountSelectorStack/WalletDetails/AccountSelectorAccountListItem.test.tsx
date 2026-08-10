/** @jest-environment jsdom */

import type { ComponentProps, ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type {
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';

import { AccountSelectorAccountListItem } from './AccountSelectorAccountListItem';

const mockConfirmAccountSelect = jest.fn();
const mockResetAccountManagerStacksModal = jest.fn();

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);
  return {
    IconButton: Container,
    SizableText: Container,
    Stack: Container,
    XStack: Container,
    resetAccountManagerStacksModal: (): void => {
      mockResetAccountManagerStacksModal();
    },
  };
});

jest.mock('@onekeyhq/kit/src/components/AccountAvatar', () => ({
  AccountAvatar: Object.assign(
    ({ children }: { children?: ReactNode }) => children ?? null,
    { Loading: () => null },
  ),
}));

jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorCreateAddressButton',
  () => ({ AccountSelectorCreateAddressButton: () => null }),
);

jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function MockListItem({
    testID,
    onPress,
    renderAvatar,
    renderItemText,
  }: {
    testID?: string;
    onPress?: () => Promise<void>;
    renderAvatar?: ReactNode;
    renderItemText?: (props: Record<string, never>) => ReactNode;
  }) {
    return React.createElement(
      'button',
      {
        'data-testid': testID,
        onClick: onPress ? () => void onPress() : undefined,
        type: 'button',
      },
      renderAvatar,
      renderItemText?.({}),
    );
  }
  MockListItem.Text = ({
    primary,
    secondary,
  }: {
    primary?: ReactNode;
    secondary?: ReactNode;
  }) => React.createElement(React.Fragment, null, primary, secondary);
  return { ListItem: MockListItem };
});

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: { network: { id: 'evm--1' } },
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({
    useAccountSelectorActions: () => ({
      current: { confirmAccountSelect: mockConfirmAccountSelect },
    }),
  }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useAccountSelectorDeFiMapAtom: () => [{}],
  useAccountSelectorValuesMapAtom: () => [{}],
  useIndexedAccountAddressCreationStateAtom: () => [undefined],
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isE2E: true,
    isWebDappMode: false,
  },
}));

jest.mock('../../../components/AccountEdit', () => ({
  AccountEditButton: () => null,
}));

jest.mock('../../../hooks/useAccountSelectorAvatarNetwork', () => ({
  useAccountSelectorAvatarNetwork: () => ({ avatarNetworkId: 'evm--1' }),
}));

jest.mock('../../../testIDs', () => ({
  AccountManagerTestIDs: {
    accountItem: (index: number) => `account-item-${index}`,
  },
}));

jest.mock('./AccountAddress', () => ({ AccountAddress: () => null }));
jest.mock('./AccountValue', () => ({
  AccountValueWithSpotlight: () => null,
}));

function buildProps({
  wallet,
}: {
  wallet: IDBWallet;
}): ComponentProps<typeof AccountSelectorAccountListItem> {
  const item = {
    id: `${wallet.id}--0`,
    name: 'Account #1',
    walletId: wallet.id,
  } as IDBIndexedAccount;
  return {
    num: 0,
    linkedNetworkId: 'evm--1',
    item,
    section: { firstAccount: item } as never,
    index: 0,
    isOthersUniversal: false,
    selectedAccount: {
      walletId: 'hd-current',
      indexedAccountId: 'hd-current--0',
      focusedWallet: 'hd-current',
      networkId: 'evm--1',
      deriveType: 'default',
    } as IAccountSelectorSelectedAccount,
    linkNetwork: false,
    allowSelectEmptyAccount: false,
    editable: false,
    accountsCount: 1,
    focusedWalletInfo: { wallet, device: undefined },
    mergeDeriveAssetsEnabled: false,
    hideAddress: false,
    enabledNetworksCompatibleWithWalletId: [],
    networkInfoMap: {},
  };
}

describe('AccountSelectorAccountListItem wallet availability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirmAccountSelect.mockResolvedValue({ success: true });
  });

  it.each([
    { id: 'hw-deprecated', deprecated: true },
    { id: 'hw-mocked', isMocked: true },
  ] as IDBWallet[])(
    'does not select or close the modal for unavailable wallet $id',
    (wallet) => {
      render(<AccountSelectorAccountListItem {...buildProps({ wallet })} />);

      fireEvent.click(screen.getByTestId('account-item-0'));

      expect(mockConfirmAccountSelect).not.toHaveBeenCalled();
      expect(mockResetAccountManagerStacksModal).not.toHaveBeenCalled();
    },
  );

  it('selects a usable wallet account and closes the modal after success', async () => {
    const wallet = { id: 'hw-usable' } as IDBWallet;
    render(<AccountSelectorAccountListItem {...buildProps({ wallet })} />);

    fireEvent.click(screen.getByTestId('account-item-0'));

    await waitFor(() => {
      expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
      expect(mockResetAccountManagerStacksModal).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps the modal open when the core selection boundary rejects', async () => {
    mockConfirmAccountSelect.mockResolvedValue({
      success: false,
      reason: 'walletUnavailable',
    });
    const wallet = { id: 'hw-usable' } as IDBWallet;
    render(<AccountSelectorAccountListItem {...buildProps({ wallet })} />);

    fireEvent.click(screen.getByTestId('account-item-0'));

    await waitFor(() => {
      expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
    });
    expect(mockResetAccountManagerStacksModal).not.toHaveBeenCalled();
  });
});
