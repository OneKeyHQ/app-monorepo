import type { ReactNode } from 'react';

import { render } from '@testing-library/react-native';

import { AddressInputWarnings } from './AddressInputWarnings';

type IMockStackProps = {
  children?: ReactNode;
  testID?: string;
};

let warningText: ReactNode;

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

  return {
    Button: Stack,
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

describe('AddressInputWarnings', () => {
  beforeEach(() => {
    warningText = undefined;
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
