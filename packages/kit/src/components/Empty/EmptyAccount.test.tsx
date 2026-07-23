import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react-native';

import { EmptyAccount } from './EmptyAccount';

const mockCreateAddress = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const EmptyButton = ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) =>
    ReactModule.createElement(
      'Pressable',
      { onPress, testID: 'empty-account-create-address' },
      ReactModule.createElement('Text', null, children),
    );
  const Empty = Object.assign(
    ({
      button,
      testID,
      title,
    }: {
      button?: ReactNode;
      testID?: string;
      title?: ReactNode;
    }) =>
      ReactModule.createElement(
        'View',
        { testID },
        ReactModule.createElement('Text', null, title),
        button,
      ),
    { Button: EmptyButton },
  );
  return { Empty };
});

jest.mock('../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      canCreateAddress: true,
      deriveType: 'default',
      indexedAccount: { id: 'indexed-1' },
      network: { id: 'ton--mainnet', name: 'TON' },
      wallet: { id: 'wallet-1' },
    },
  }),
}));

jest.mock('../AccountSelector/LazyAccountSelectorCreateAddressButton', () => ({
  LazyAccountSelectorCreateAddressButton: ({
    account,
    buttonRender,
  }: {
    account: {
      deriveType?: string;
      indexedAccountId?: string;
      networkId?: string;
      walletId?: string;
    };
    buttonRender: (props: {
      children: ReactNode;
      onPress: () => void;
    }) => ReactNode;
  }) =>
    buttonRender({
      children: 'Create address',
      onPress: () => {
        mockCreateAddress(account);
      },
    }),
}));

describe('EmptyAccount', () => {
  beforeEach(() => {
    mockCreateAddress.mockClear();
  });

  it('keeps the missing-account terminal actionable with the active scope', () => {
    const view = render(<EmptyAccount chain="ton" name="TON" type="default" />);

    expect(
      view.UNSAFE_root.findByProps({ testID: 'Wallet-No-Address-Empty' }),
    ).toBeTruthy();
    act(() => {
      const onPress = view.UNSAFE_root.findByProps({
        testID: 'empty-account-create-address',
      }).props.onPress as () => void;
      onPress();
    });
    expect(mockCreateAddress).toHaveBeenCalledTimes(1);
    expect(mockCreateAddress).toHaveBeenCalledWith({
      deriveType: 'default',
      indexedAccountId: 'indexed-1',
      networkId: 'ton--mainnet',
      walletId: 'wallet-1',
    });
  });
});
