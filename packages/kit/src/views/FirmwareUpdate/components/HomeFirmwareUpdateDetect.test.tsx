/** @jest-environment jsdom */

import { render, waitFor } from '@testing-library/react';

import type { IDetectActiveAccountFirmwareUpdatesResult } from '@onekeyhq/kit-bg/src/services/ServiceFirmwareUpdate/ServiceFirmwareUpdate';

import { HomeFirmwareUpdateDetectWithProvider } from './HomeFirmwareUpdateDetect';

let mockIsInternetReachable: boolean | null = null;
const mockDetectActiveAccountFirmwareUpdates = jest.fn<
  Promise<IDetectActiveAccountFirmwareUpdatesResult>,
  [{ connectId: string }]
>();

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useAppIsLockedAtom: () => [false],
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isHwWallet: () => true,
  },
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceFirmwareUpdate: {
      detectActiveAccountFirmwareUpdates: (params: { connectId: string }) =>
        mockDetectActiveAccountFirmwareUpdates(params),
    },
  },
}));

jest.mock('../../../components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({
    children,
  }: {
    children: React.ReactNode;
  }) => children,
}));

jest.mock('../../../hooks/useNetworkRestore', () => ({
  useNetworkRestore: () => ({
    isInternetReachable: mockIsInternetReachable,
    restoreNonce: 0,
  }),
}));

jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      device: { connectId: 'device-connect-id' },
      wallet: { id: 'hw-wallet-id' },
    },
  }),
}));

describe('HomeFirmwareUpdateDetect', () => {
  beforeEach(() => {
    mockIsInternetReachable = null;
    mockDetectActiveAccountFirmwareUpdates.mockReset();
    mockDetectActiveAccountFirmwareUpdates.mockResolvedValue({
      status: 'finished',
    });
  });

  it.each([false, null])(
    'does not touch the hardware while network reachability is %s',
    (isInternetReachable) => {
      mockIsInternetReachable = isInternetReachable;

      render(<HomeFirmwareUpdateDetectWithProvider />);

      expect(mockDetectActiveAccountFirmwareUpdates).not.toHaveBeenCalled();
    },
  );

  it('starts firmware detection after the network reconnects', async () => {
    mockIsInternetReachable = false;
    const view = render(<HomeFirmwareUpdateDetectWithProvider />);

    mockIsInternetReachable = true;
    view.rerender(<HomeFirmwareUpdateDetectWithProvider />);

    await waitFor(() => {
      expect(mockDetectActiveAccountFirmwareUpdates).toHaveBeenCalledTimes(1);
      expect(mockDetectActiveAccountFirmwareUpdates).toHaveBeenCalledWith({
        connectId: 'device-connect-id',
      });
    });
  });
});
