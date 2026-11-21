/** @jest-environment jsdom */

import { CreateAddressContainer } from '.';

import { render } from '@testing-library/react';

import { Dialog } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  type IAddressCreationRequest,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { getAccountIdOnNetwork } from '../../../views/ScanQrCode/utils/getAccountIdOnNetwork';

const mockCreateAddress = jest.fn<
  Promise<{ id: string } | undefined>,
  [unknown, { addressCreationRequest?: IAddressCreationRequest }]
>();
const mockResolveCallback = jest.fn<void, [unknown]>();

jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: jest.fn(), confirm: jest.fn() },
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
