import type { ReactNode } from 'react';

import { render } from '@testing-library/react-native';

import { AddressInputWarnings } from './AddressInputWarnings';

type IAlertProps = {
  description: string;
  icon: string;
  testID: string;
  title: string;
  type: string;
};

let warningAlert: IAlertProps | undefined;

jest.mock('react-intl', () => {
  const actualIntl =
    jest.requireActual<typeof import('react-intl')>('react-intl');
  const messages = {} as Parameters<
    typeof actualIntl.createIntl
  >[0]['messages'];
  const intl = actualIntl.createIntl({ locale: 'en', messages });
  return {
    ...actualIntl,
    useIntl: () => intl,
  };
});

jest.mock('@onekeyhq/components', () => {
  function Stack({ children }: { children?: ReactNode }) {
    return children;
  }

  function Alert(props: IAlertProps) {
    if (props.testID === 'address-input-cex-deposit-warning') {
      warningAlert = props;
    }
    return null;
  }

  return {
    Alert,
    Button: Stack,
    Stack,
    XStack: Stack,
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn() }),
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isLightningNetworkByNetworkId: (networkId: string) =>
      networkId === 'lightning',
  },
}));

jest.mock('./hooks', () => ({
  useIsEnableTransferAllowList: () => false,
}));

jest.mock('../AddressBadge', () => ({
  AddressBadge: () => null,
}));

function renderWarnings({
  depositEnable,
  cexLabel = 'Binance',
  tokenSymbol = 'DAI',
  networkName = 'Ethereum',
  networkId = 'evm--1',
}: {
  depositEnable?: boolean | null;
  cexLabel?: string;
  tokenSymbol?: string;
  networkName?: string;
  networkId?: string;
}) {
  return render(
    <AddressInputWarnings
      networkId={networkId}
      tokenSymbol={tokenSymbol}
      networkName={networkName}
      queryResult={{
        cexSupportedInfo: {
          cexLabel,
          depositEnable,
        },
      }}
    />,
  );
}

describe('AddressInputWarnings', () => {
  beforeEach(() => {
    warningAlert = undefined;
  });

  it('shows the complete warning with a warning icon and existing test ID', () => {
    renderWarnings({ depositEnable: false });

    expect(warningAlert).toEqual({
      testID: 'address-input-cex-deposit-warning',
      type: 'warning',
      icon: 'ErrorOutline',
      title: 'Binance may not accept DAI on Ethereum',
      description:
        'Check supported networks for your asset on the exchange’s deposit page.',
    });
  });

  it('uses generic exchange wording when the exchange label is missing', () => {
    renderWarnings({ depositEnable: false, cexLabel: '' });

    expect(warningAlert).toEqual({
      testID: 'address-input-cex-deposit-warning',
      type: 'warning',
      icon: 'ErrorOutline',
      title: 'This exchange may not accept DAI on Ethereum',
      description:
        'Check supported networks for your asset on the exchange’s deposit page.',
    });
  });

  it('uses generic deposit wording when asset or network details are missing', () => {
    renderWarnings({
      depositEnable: false,
      tokenSymbol: '',
      networkName: '',
    });

    expect(warningAlert).toEqual({
      testID: 'address-input-cex-deposit-warning',
      type: 'warning',
      icon: 'ErrorOutline',
      title: 'Binance may not accept this deposit',
      description:
        'Check supported networks for your asset on the exchange’s deposit page.',
    });
  });

  it('uses the fully generic wording when all warning details are missing', () => {
    renderWarnings({
      depositEnable: false,
      cexLabel: '',
      tokenSymbol: '',
      networkName: '',
    });

    expect(warningAlert).toEqual({
      testID: 'address-input-cex-deposit-warning',
      type: 'warning',
      icon: 'ErrorOutline',
      title: 'This exchange may not accept this deposit',
      description:
        'Check supported networks for your asset on the exchange’s deposit page.',
    });
  });

  it.each([true, null, undefined])(
    'does not show a warning when deposits are %s',
    (depositEnable) => {
      renderWarnings({ depositEnable });

      expect(warningAlert).toBeUndefined();
    },
  );

  it('does not show a warning for Lightning deposits', () => {
    renderWarnings({ depositEnable: false, networkId: 'lightning' });

    expect(warningAlert).toBeUndefined();
  });
});
