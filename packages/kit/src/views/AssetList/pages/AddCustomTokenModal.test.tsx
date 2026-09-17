/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import AddCustomTokenModal from './AddCustomTokenModal';

const mockPageProps = jest.fn();

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({
    params: {
      walletId: 'hd-1',
      networkId: 'evm--1',
      indexedAccountId: 'hd-1--0',
      accountId: 'hd-1--m/44h/60h/0h/0/0',
      isOthersWallet: false,
      deriveType: 'default',
    },
  }),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  const Container = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);
  const Empty = () => null;
  const Page = Object.assign(
    (props: { children?: ReactNode }) => {
      mockPageProps(props);
      return React.createElement('div', null, props.children);
    },
    {
      Header: Empty,
      Body: Container,
      Footer: Container,
    },
  );
  const Form = Object.assign(Container, { Field: Container });

  return {
    Button: Container,
    Form,
    Icon: Empty,
    Input: Empty,
    Page,
    SizableText: Container,
    Stack: Container,
    Toast: { error: jest.fn(), success: jest.fn() },
    XStack: Container,
  };
});

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    AccountSelectorProviderMirror: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    ControlledNetworkSelectorTrigger: () => null,
  };
});

jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorCreateAddressButton',
  () => ({
    AccountSelectorCreateAddressButton: () => null,
  }),
);

jest.mock('@onekeyhq/kit/src/hooks/useDappApproveAction', () => ({
  __esModule: true,
  default: () => ({ resolve: jest.fn(), reject: jest.fn() }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useDappQuery', () => ({
  __esModule: true,
  default: () => ({}),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    account: { wallet: { addCustomToken: jest.fn() } },
  },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {},
  appEventBus: { emit: jest.fn() },
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../../components/NetworkAvatar/NetworkAvatar', () => ({
  NetworkAvatar: () => null,
}));

jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: (
    _fn: unknown,
    _deps: unknown,
    options?: { initResult?: unknown },
  ) => ({
    result: options?.initResult,
    run: jest.fn(),
  }),
}));

jest.mock('../../DAppConnection/pages/DappOpenModalPage', () => ({
  useDappCloseHandler: () => jest.fn(),
}));

jest.mock('../hooks/useAddToken', () => ({
  useAddTokenForm: () => ({
    form: {},
    isEmptyContract: false,
    setIsEmptyContractState: jest.fn(),
    selectedNetworkIdValue: 'evm--1',
    contractAddressValue: '',
    symbolValue: '',
    decimalsValue: '',
    isSymbolEditable: false,
    setIsSymbolEditable: jest.fn(),
  }),
  useCheckAccountExist: () => ({
    hasExistAccount: true,
    runCheckAccountExist: jest.fn(),
    checkAccountIsExist: jest.fn(),
  }),
  useAddToken: () => ({
    availableNetworks: undefined,
    searchedTokenRef: { current: undefined },
    isSearching: false,
  }),
}));

describe('AddCustomTokenModal', () => {
  it('scrolls the form so a blank tap or drag dismisses the keyboard (OK-61527)', () => {
    render(<AddCustomTokenModal />);

    expect(mockPageProps).toHaveBeenCalledWith(
      expect.objectContaining({
        scrollEnabled: true,
        scrollProps: expect.objectContaining({
          keyboardDismissMode: 'on-drag',
          keyboardShouldPersistTaps: 'handled',
        }),
      }),
    );
  });
});
