/** @jest-environment jsdom */
import { cleanup, render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import TxConfirmAlert from './TxConfirmAlert';

// react-intl is mocked to echo the message id, so the rendered text is the key.
const SOL_SIGN_WINDOW_HINT = ETranslations.wallet_sol_hw_sign_time_limit__desc;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  Alert: ({ title }: { title: string }) => <div>{title}</div>,
}));
jest.mock('@onekeyhq/kit/src/hooks/useAccountData', () => ({
  useAccountData: () => ({ network: undefined }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm', () => ({
  useCustomRpcStatusAtom: () => [{}],
  useNativeTokenInfoAtom: () => [{}],
  usePayWithTokenInfoAtom: () => [{ enabled: false }],
  usePreCheckTxStatusAtom: () => [{}],
  useSendFeeStatusAtom: () => [{ status: 'idle', errMessage: '' }],
  useSendSelectedFeeInfoAtom: () => [undefined],
  useSendTxStatusAtom: () => [{}],
  useSignatureConfirmActions: () => ({
    current: {
      updateCustomRpcStatus: jest.fn(),
      clearCustomRpcStatus: jest.fn(),
    },
  }),
  useTronResourceRentalInfoAtom: () => [{}],
}));
jest.mock(
  '@onekeyhq/kit/src/views/Send/components/CustomRpcFallbackDialog',
  () => ({ showCustomRpcFallbackDialog: jest.fn() }),
);
jest.mock(
  '@onekeyhq/kit/src/views/SignatureConfirm/hooks/useGasAccountAnalyticsContext',
  () => ({ useGasAccountAnalyticsContext: () => ({}) }),
);

afterEach(() => {
  cleanup();
});

describe('TxConfirmAlert Solana signing-window hint', () => {
  it('shows the hint for a hardware account on Solana', () => {
    const { queryByText } = render(
      <TxConfirmAlert
        accountId="hw-da1--m/44h/501h/0h/0h"
        networkId="sol--101"
      />,
    );

    expect(queryByText(SOL_SIGN_WINDOW_HINT)).not.toBeNull();
  });

  it('shows the hint for a QR account on Solana', () => {
    const { queryByText } = render(
      <TxConfirmAlert
        accountId="qr-xfp1--m/44h/501h/0h/0h"
        networkId="sol--101"
      />,
    );

    expect(queryByText(SOL_SIGN_WINDOW_HINT)).not.toBeNull();
  });

  it('stays silent for a software account on Solana', () => {
    const { queryByText } = render(
      <TxConfirmAlert
        accountId="hd-1--m/44h/501h/0h/0h"
        networkId="sol--101"
      />,
    );

    expect(queryByText(SOL_SIGN_WINDOW_HINT)).toBeNull();
  });

  it('stays silent for a hardware account on another network', () => {
    const { queryByText } = render(
      <TxConfirmAlert
        accountId="hw-da1--m/44h/60h/0h/0/0"
        networkId="evm--1"
      />,
    );

    expect(queryByText(SOL_SIGN_WINDOW_HINT)).toBeNull();
  });
});
