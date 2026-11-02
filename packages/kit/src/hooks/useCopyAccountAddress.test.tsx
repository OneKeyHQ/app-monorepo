/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';

import { useCopyAccountAddress } from './useCopyAccountAddress';

const mockPushModal = jest.fn();
const mockCopyText = jest.fn();
const mockGetAccount = jest.fn(async (..._args: unknown[]) => undefined);

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
