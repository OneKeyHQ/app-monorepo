import type { ReactNode } from 'react';

import { render } from '@testing-library/react-native';

import { EAddressInteractionStatus } from '@onekeyhq/shared/types/address';

import { AddressInputWarnings } from './AddressInputWarnings';

type IMockStackProps = {
  children?: ReactNode;
  testID?: string;
};

let warningText: ReactNode;
let mockRenderedButtons: string[] = [];

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  function Stack({ children }: IMockStackProps) {
    return <>{children}</>;
  }

  function SizableText(props: IMockStackProps) {
    if (props.testID === 'address-input-cex-deposit-warning') {
      warningText = props.children;
    }
    return <>{props.children}</>;
  }

  function Button(props: IMockStackProps) {
    if (props.testID) {
      mockRenderedButtons.push(props.testID);
    }
    return <>{props.children}</>;
  }

  return {
    Button,
    SizableText,
    Stack,
    XStack: Stack,
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn() }),
}));

jest.mock('./hooks', () => ({
  useIsEnableTransferAllowList: () => false,
}));

jest.mock('../AddressBadge', () => ({
  AddressBadge: () => null,
}));

function renderWarnings(depositEnable: boolean) {
  return render(
    <AddressInputWarnings
      networkId="evm--1"
      queryResult={{
        cexSupportedInfo: {
          cexLabel: 'Binance',
          depositEnable,
        },
      }}
    />,
  );
}

const ADD_TO_ADDRESS_BOOK = 'address-input-add-to-address-book-btn';
const TRANSFERRED_ADDRESS = '0x96223d0b3f1e9a2c77d41e58b0c2f9e6a1384F4f';

function renderTransferredAddress({
  similarAddress,
  isLookalikeAddress,
}: {
  similarAddress?: string;
  isLookalikeAddress?: (address: string) => boolean;
} = {}) {
  return render(
    <AddressInputWarnings
      networkId="evm--1"
      queryResult={{
        input: TRANSFERRED_ADDRESS,
        validAddress: TRANSFERRED_ADDRESS,
        addressInteractionStatus: EAddressInteractionStatus.INTERACTED,
        similarAddress,
      }}
      isLookalikeAddress={isLookalikeAddress}
    />,
  );
}

describe('AddressInputWarnings', () => {
  beforeEach(() => {
    warningText = undefined;
    mockRenderedButtons = [];
  });

  it('offers the address book for an address paid before', () => {
    renderTransferredAddress();

    expect(mockRenderedButtons).toContain(ADD_TO_ADDRESS_BOOK);
  });

  it('does not offer the address book for an address flagged as similar', () => {
    renderTransferredAddress({
      similarAddress: '0x96223d67518AAedcBed163098fA4BC3fa2384F4f',
    });

    expect(mockRenderedButtons).not.toContain(ADD_TO_ADDRESS_BOOK);
  });

  it('does not offer the address book for a lookalike the page lists', () => {
    const isLookalikeAddress = jest.fn(() => true);
    renderTransferredAddress({ isLookalikeAddress });

    expect(isLookalikeAddress).toHaveBeenCalledWith(TRANSFERRED_ADDRESS);
    expect(mockRenderedButtons).not.toContain(ADD_TO_ADDRESS_BOOK);
  });

  it('shows a static warning when CEX deposits are explicitly disabled', () => {
    renderWarnings(false);

    expect(warningText).toBe('confirm_exchange_deposit_support__desc');
  });

  it('does not show a warning when deposits are supported', () => {
    renderWarnings(true);

    expect(warningText).toBeUndefined();
  });
});
