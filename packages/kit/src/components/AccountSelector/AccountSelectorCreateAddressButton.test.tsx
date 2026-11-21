/** @jest-environment jsdom */

import { act, render, waitFor } from '@testing-library/react';

import { AccountSelectorCreateAddressButton } from './AccountSelectorCreateAddressButton';

const mockCanAutoCreate = jest.fn<Promise<boolean>, [unknown]>();
const mockCreateAddress = jest.fn(async () => undefined);

jest.mock('@onekeyhq/components', () => ({ Button: () => null }));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useAccountIsAutoCreatingAtom: () => [undefined, jest.fn()],
  useAccountManualCreatingAtom: () => [{ isLoading: false }, jest.fn()],
  useIndexedAccountAddressCreationStateAtom: () => [undefined],
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    account: {
      accountCreatePerf: {
        createAddressRunStart: jest.fn(),
        createAddressRunFinished: jest.fn(),
      },
    },
  },
}));
jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      canAutoCreateAddressInSilentMode: (params: unknown) =>
        mockCanAutoCreate(params),
    },
  },
}));
jest.mock('./hooks/useAccountSelectorCreateAddress', () => ({
  useAccountSelectorCreateAddress: () => ({ createAddress: mockCreateAddress }),
}));

it.each([true, false])(
  'starts silent creation only while the dialog is still active (%s)',
  async (stillActive) => {
    jest.clearAllMocks();
    let finishEligibility: (value: boolean) => void = () => {};
    mockCanAutoCreate.mockReturnValueOnce(
      new Promise((resolve) => {
        finishEligibility = resolve;
      }),
    );
    let active = true;
    const dialog = render(
      <AccountSelectorCreateAddressButton
        num={0}
        autoCreateAddress
        account={{
          walletId: 'hd-test-wallet',
          indexedAccountId: 'hd-test-wallet--0',
          networkId: 'lightning--0',
          deriveType: 'default',
        }}
        canStartAddressCreation={() => active}
      />,
    );
    await waitFor(() => expect(mockCanAutoCreate).toHaveBeenCalledTimes(1));

    active = stillActive;
    if (!active) dialog.unmount();
    await act(async () => {
      finishEligibility(true);
    });
    expect(mockCreateAddress).toHaveBeenCalledTimes(active ? 1 : 0);
  },
);
