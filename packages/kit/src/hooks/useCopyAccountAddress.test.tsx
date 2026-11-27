/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { walletLocalSecretEnvelopeStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/walletLocalSecretEnvelopeStatus';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import { getLocalSecretEnvelopeCredentialKey } from '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';

import { useCopyAccountAddress } from './useCopyAccountAddress';

const mockPushModal = jest.fn();
const mockCopyText = jest.fn();
const mockGetAccount = jest.fn(async (..._args: unknown[]) => undefined);

jest.mock(
  '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData',
  () => ({
    ...jest.requireActual<
      typeof import('@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData')
    >('@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData'),
    getLocalSecretEnvelopeCredentialKey: (sessionId: string, id: string) =>
      `${sessionId}:${id}`,
  }),
);

jest.mock('./useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal }),
}));

jest.mock('@onekeyhq/components', () => ({
  useClipboard: () => ({ copyText: mockCopyText }),
  Toast: { success: jest.fn() },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccount: (...args: unknown[]) => mockGetAccount(...args),
    },
    serviceNetwork: { getNetworkSafe: jest.fn() },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jotaiDefaultStore.set(walletLocalSecretEnvelopeStatusAtom.atom(), {
    sessionId: '',
    issues: {},
  });
});

it.each([
  ['hw-test', 'public'],
  ['hw-test', 'private'],
  ['qr-test', 'private'],
] as const)(
  'routes %s %s addresses through receive verification before copying',
  async (walletId, localWalletAddressForm) => {
    const accountId = `${walletId}--account`;
    const params = { accountId, networkId: 'zec--0', localWalletAddressForm };
    const { result } = renderHook(() => useCopyAccountAddress());

    await act(async () => {
      await result.current(params);
    });

    expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveToken,
      params: expect.objectContaining({
        accountId,
        walletId,
        networkId: 'zec--0',
        localWalletAddressForm,
        source: 'copyAddress',
      }),
    });
    expect(mockCopyText).not.toHaveBeenCalled();
    expect(mockGetAccount).not.toHaveBeenCalled();
  },
);

it('keeps ordinary hardware-chain receive parameters unchanged', async () => {
  const { result } = renderHook(() => useCopyAccountAddress());
  await act(async () => {
    await result.current({
      accountId: 'hw-test--account',
      networkId: 'btc--0',
    });
  });
  expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.ReceiveModal, {
    screen: EModalReceiveRoutes.ReceiveToken,
    params: {
      networkId: 'btc--0',
      accountId: 'hw-test--account',
      walletId: 'hw-test',
      token: undefined,
      onDeriveTypeChange: undefined,
      source: 'copyAddress',
    },
  });
  expect(mockCopyText).not.toHaveBeenCalled();
  expect(mockGetAccount).not.toHaveBeenCalled();
});

it('blocks copying address and opens the LSE recovery dialog when wallet LSE is unavailable', async () => {
  const sessionId = 'copy-lse-session';
  const credentialKey = getLocalSecretEnvelopeCredentialKey(sessionId, 'hd-1');
  const issue = {
    credentialKey,
    reason: 'key-missing' as const,
  };
  jotaiDefaultStore.set(walletLocalSecretEnvelopeStatusAtom.atom(), {
    sessionId,
    issues: { [credentialKey]: issue },
  });

  const onShowDialog = jest.fn();
  appEventBus.on(
    EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog,
    onShowDialog,
  );
  try {
    const { result } = renderHook(() => useCopyAccountAddress());
    await act(async () => {
      await result.current({
        accountId: "hd-1--m/44'/60'/0'/0/0",
        networkId: 'evm--1',
      });
    });

    expect(onShowDialog).toHaveBeenCalledWith(issue);
    expect(mockCopyText).not.toHaveBeenCalled();
    expect(mockGetAccount).not.toHaveBeenCalled();
    expect(mockPushModal).not.toHaveBeenCalled();
  } finally {
    appEventBus.off(
      EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog,
      onShowDialog,
    );
  }
});
