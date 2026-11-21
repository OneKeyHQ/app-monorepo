/** @jest-environment jsdom */

import { isValidElement } from 'react';

import { CreateAddressContainer } from '.';

import { render } from '@testing-library/react';

import { Dialog, Toast } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  type IAddressCreationRequest,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import {
  getAccountIdOnNetwork,
  getAddressCreationRequestSignal,
} from '../../../views/ScanQrCode/utils/getAccountIdOnNetwork';

const mockCreateAddress = jest.fn<
  Promise<{ id: string } | undefined>,
  [unknown, { addressCreationRequest?: IAddressCreationRequest }]
>();
const mockResolveCallback = jest.fn<void, [unknown]>();

jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: jest.fn(), confirm: jest.fn() },
  Toast: { success: jest.fn() },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccountsInSameIndexedAccountId: async () => ({ accounts: [] }),
      createAddressIfNotExists: (
        ...args: Parameters<typeof mockCreateAddress>
      ) => mockCreateAddress(...args),
    },
    servicePromise: {
      resolveCallback: (args: unknown) => mockResolveCallback(args),
    },
  },
}));
jest.mock(
  '../../../components/AccountSelector/AccountSelectorProvider',
  () => ({
    AccountSelectorProviderMirror: ({
      children,
    }: {
      children: React.ReactNode;
    }) => children,
  }),
);

it('closes an open address dialog and ignores completion when its scan is aborted', async () => {
  jest.clearAllMocks();
  const controller = new AbortController();
  const close = jest.fn(async () => undefined);
  jest.mocked(Dialog.show).mockReturnValueOnce({
    close,
    getForm: () => undefined,
    isExist: () => true,
  });
  let reportDialogOpened: () => void = () => {};
  const dialogOpened = new Promise<void>((resolve) => {
    reportDialogOpened = resolve;
  });
  mockCreateAddress.mockImplementationOnce(
    async (_params, { addressCreationRequest }) =>
      new Promise((resolve) => {
        mockResolveCallback.mockImplementationOnce(() => resolve(undefined));
        appEventBus.emit(EAppEventBusNames.CreateAddressByDialog, {
          networkId: 'lightning--0',
          indexedAccountId: 'hd-1--0',
          deriveType: 'default',
          promiseId: 2,
          autoCreateAddress: true,
          addressCreationRequest,
        });
        reportDialogOpened();
      }),
  );
  render(<CreateAddressContainer />);
  const lookup = getAccountIdOnNetwork({
    account: {
      id: 'hd-1--0',
      indexedAccountId: 'hd-1--0',
    } as INetworkAccount,
    network: {
      id: 'lightning--0',
      impl: 'lightning',
    } as Parameters<typeof getAccountIdOnNetwork>[0]['network'],
    canApplyScanResult: () => !controller.signal.aborted,
    scanSignal: controller.signal,
  });
  await dialogOpened;
  expect(Dialog.show).toHaveBeenCalledTimes(1);
  const [{ renderContent }] = jest.mocked(Dialog.show).mock.calls[0];
  if (
    !isValidElement<{ onCreate: (value: unknown) => Promise<void> }>(
      renderContent,
    )
  ) {
    throw new OneKeyLocalError('Expected the address creation dialog content');
  }

  controller.abort();
  expect(mockResolveCallback).toHaveBeenCalledWith({ id: 2, data: false });
  expect(close).toHaveBeenCalledTimes(1);
  await expect(lookup).resolves.toBeUndefined();
  await renderContent.props.onCreate({ accounts: [{ id: 'test-account' }] });
  expect(mockResolveCallback).toHaveBeenCalledTimes(1);
  expect(Toast.success).not.toHaveBeenCalled();
});
jest.mock(
  '../../../components/AccountSelector/hooks/useAccountSelectorTrigger',
  () => ({
    useAccountSelectorTrigger: () => ({ showAccountSelector: jest.fn() }),
  }),
);
jest.mock(
  '../../../components/AccountSelector/LazyAccountSelectorCreateAddressButton',
  () => ({ LazyAccountSelectorCreateAddressButton: jest.fn() }),
);
jest.mock('../../../states/jotai/contexts/accountSelector/atoms', () => ({
  useActiveAccount: jest.fn(),
}));

it('aborts the QR wallet request as soon as its dialog is dismissed', async () => {
  jest.clearAllMocks();
  const scanController = new AbortController();
  let dialogReady: (signal: AbortSignal | undefined) => void = () => {};
  const opened = new Promise<AbortSignal | undefined>((resolve) => {
    dialogReady = resolve;
  });
  let finishLookup: () => void = () => {};
  mockCreateAddress.mockImplementationOnce(
    async (_params, { addressCreationRequest }) =>
      new Promise((resolve) => {
        finishLookup = () => resolve(undefined);
        appEventBus.emit(EAppEventBusNames.CreateAddressByDialog, {
          networkId: 'eth--1',
          indexedAccountId: 'qr-1--0',
          deriveType: 'default',
          promiseId: 3,
          autoCreateAddress: false,
          addressCreationRequest,
        });
        dialogReady(getAddressCreationRequestSignal(addressCreationRequest));
      }),
  );
  jest.mocked(Dialog.show).mockReturnValueOnce({
    close: jest.fn(async () => undefined),
    getForm: () => undefined,
    isExist: () => true,
  });
  render(<CreateAddressContainer />);
  const lookup = getAccountIdOnNetwork({
    account: { id: 'qr-1--0', indexedAccountId: 'qr-1--0' } as INetworkAccount,
    network: { id: 'eth--1', impl: 'evm' } as Parameters<
      typeof getAccountIdOnNetwork
    >[0]['network'],
    canApplyScanResult: () => true,
    scanSignal: scanController.signal,
  });

  const requestSignal = await opened;
  expect(requestSignal?.aborted).toBe(false);
  const [{ onCloseStart, onClose }] = jest.mocked(Dialog.show).mock.calls[0];
  try {
    onCloseStart?.();
    await onClose?.();
    expect(requestSignal?.aborted).toBe(true);
    expect(scanController.signal.aborted).toBe(false);
    expect(mockResolveCallback).toHaveBeenCalledTimes(1);
    expect(mockResolveCallback).toHaveBeenCalledWith({ id: 3, data: false });
  } finally {
    finishLookup();
    await lookup;
  }
});

it.each([true, false])(
  'only opens the missing address dialog for its active scanner (%s)',
  async (stillActive) => {
    jest.clearAllMocks();
    let scanActive = true;
    let finishLookup: () => void = () => {};
    let startLookup: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      startLookup = resolve;
    });

    mockCreateAddress.mockImplementationOnce(
      async (_params, { addressCreationRequest }) => {
        await new Promise<void>((resolve) => {
          finishLookup = resolve;
          startLookup();
        });
        const event = {
          networkId: 'lightning--0',
          indexedAccountId: 'hd-1--0',
          deriveType: 'default' as const,
          promiseId: 1,
          autoCreateAddress: true,
          addressCreationRequest,
        };
        if (addressCreationRequest) {
          appEventBus.emit(EAppEventBusNames.CreateAddressByDialog, {
            ...event,
            addressCreationRequest: {
              ...addressCreationRequest,
              nodeId: 'another-window',
            },
          });
        }
        appEventBus.emit(EAppEventBusNames.CreateAddressByDialog, event);
        return undefined;
      },
    );

    render(<CreateAddressContainer />);
    const lookup = getAccountIdOnNetwork({
      account: {
        id: 'hd-1--0',
        indexedAccountId: 'hd-1--0',
      } as INetworkAccount,
      network: {
        id: 'lightning--0',
        impl: 'lightning',
      } as Parameters<typeof getAccountIdOnNetwork>[0]['network'],
      canApplyScanResult: () => scanActive,
    });

    await started;
    scanActive = stillActive;
    finishLookup();
    await lookup;

    expect(Dialog.show).toHaveBeenCalledTimes(stillActive ? 1 : 0);
    expect(mockResolveCallback).toHaveBeenCalledTimes(stillActive ? 0 : 1);
    if (!stillActive) {
      expect(mockResolveCallback).toHaveBeenCalledWith({ id: 1, data: false });
    }
  },
);
