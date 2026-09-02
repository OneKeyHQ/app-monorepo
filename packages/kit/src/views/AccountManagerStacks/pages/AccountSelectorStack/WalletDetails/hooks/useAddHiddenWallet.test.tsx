/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { Dialog, Toast } from '@onekeyhq/components';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';

import { useAddHiddenWallet } from './useAddHiddenWallet';

const mockCreateHWHiddenWallet = jest.fn();
const mockGetWalletDeviceSafe = jest.fn();
const mockCloseHardwareUiStateDialog = jest.fn();
const mockSetPassphraseEnabled = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: jest.fn(),
  },
  Toast: {
    success: jest.fn(),
  },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getWalletDeviceSafe: (...args: unknown[]) =>
        mockGetWalletDeviceSafe(...args) as Promise<{ connectId: string }>,
    },
    serviceHardware: {
      setPassphraseEnabled: (...args: unknown[]) =>
        mockSetPassphraseEnabled(...args) as Promise<void>,
    },
    serviceHardwareUI: {
      closeHardwareUiStateDialog: (...args: unknown[]) =>
        mockCloseHardwareUiStateDialog(...args) as Promise<void>,
    },
  },
}));

jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/hooks/useCreateQrWallet',
  () => ({
    useCreateQrWallet: () => ({ createQrWallet: jest.fn() }),
  }),
);

jest.mock('@onekeyhq/kit/src/components/HyperlinkText', () => ({
  HyperlinkText: () => null,
}));

jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({
    useAccountSelectorActions: () => ({
      current: {
        createHWHiddenWallet: (...args: unknown[]) =>
          mockCreateHWHiddenWallet(...args) as Promise<void>,
      },
    }),
  }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/settings', () => ({
  useSettingsPersistAtom: () => [{}, jest.fn()],
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorUtils', () => ({
  __esModule: true,
  default: {
    isErrorByClassName: ({
      error,
      className,
    }: {
      error: { className?: string };
      className: string;
    }) => error?.className === className,
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {},
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isHwWallet: () => true,
    isQrWallet: () => false,
  },
}));

describe('useAddHiddenWallet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetWalletDeviceSafe.mockResolvedValue({ connectId: 'connect-1' });
    mockCloseHardwareUiStateDialog.mockResolvedValue(undefined);
    mockSetPassphraseEnabled.mockResolvedValue(undefined);
    jest.mocked(Dialog.show).mockImplementation((options) => {
      void options.onConfirm?.({} as never);
      return {} as never;
    });
  });

  it('enables Passphrase without retrying hidden wallet creation', async () => {
    mockCreateHWHiddenWallet.mockRejectedValueOnce({
      className: EOneKeyErrorClassNames.DeviceNotOpenedPassphrase,
    });
    const wallet = { id: 'hw-test' } as IDBWallet;
    const { result } = renderHook(() => useAddHiddenWallet());

    await act(async () => {
      await result.current.createHiddenWallet({ wallet });
    });

    expect(mockSetPassphraseEnabled).toHaveBeenCalledTimes(1);
    expect(mockSetPassphraseEnabled).toHaveBeenCalledWith({
      walletId: wallet.id,
      passphraseEnabled: true,
    });
    expect(mockCreateHWHiddenWallet).toHaveBeenCalledTimes(1);
    expect(mockCloseHardwareUiStateDialog).toHaveBeenCalledTimes(2);
    expect(Toast.success).not.toHaveBeenCalled();
  });
});
