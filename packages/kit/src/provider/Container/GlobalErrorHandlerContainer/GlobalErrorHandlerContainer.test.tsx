/**
 * @jest-environment jsdom
 */

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { act, render } from '@testing-library/react';

import { Dialog } from '@onekeyhq/components';
import { DeviceNotOpenedPassphrase } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import {
  EAppEventBusNames,
  HARDWARE_ERROR_DIALOG_TYPES,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { GlobalErrorHandlerContainer } from './GlobalErrorHandlerContainer';

jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: jest.fn() },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  serviceHardware: { setPassphraseEnabled: jest.fn() },
}));

describe('passphrase-disabled recovery dialog', () => {
  const instance = {
    close: jest.fn(),
    getForm: () => undefined,
    isExist: jest.fn(() => true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    instance.isExist.mockReturnValue(true);
    jest.mocked(Dialog.show).mockReturnValue(instance);
  });

  it('opens from a handled SDK error and enables the same device', async () => {
    const enable = jest.spyOn(
      backgroundApiProxy.serviceHardware,
      'setPassphraseEnabled',
    );
    render(<GlobalErrorHandlerContainer />);

    act(() => {
      convertDeviceError({
        code: HardwareErrorCode.DeviceNotOpenedPassphrase,
        connectId: 'disabled-device',
        deviceId: 'disabled-device-id',
      });
    });

    expect(Dialog.show).toHaveBeenCalledTimes(1);
    const props = jest.mocked(Dialog.show).mock.calls[0][0];
    expect(props.isOverTopAllViews).toBe(true);
    await props.onConfirm?.({ ...instance, preventClose: jest.fn() });

    expect(enable).toHaveBeenCalledWith({
      walletId: '',
      connectId: 'disabled-device',
      featuresDeviceId: 'disabled-device-id',
      passphraseEnabled: true,
    });
  });

  it('preserves the wallet target when creation returns an empty state', async () => {
    const enable = jest.spyOn(
      backgroundApiProxy.serviceHardware,
      'setPassphraseEnabled',
    );
    render(<GlobalErrorHandlerContainer />);

    act(() => {
      // This error can originate in the background without an SDK response.
      const error = new DeviceNotOpenedPassphrase({
        payload: { params: { walletId: 'hw-wallet' } },
      });
      expect(error.autoToast).toBe(false);
    });

    expect(Dialog.show).toHaveBeenCalledTimes(1);
    const props = jest.mocked(Dialog.show).mock.calls[0][0];
    await props.onConfirm?.({ ...instance, preventClose: jest.fn() });

    expect(enable).toHaveBeenCalledWith({
      walletId: 'hw-wallet',
      connectId: undefined,
      featuresDeviceId: undefined,
      passphraseEnabled: true,
    });
  });

  it('deduplicates events before mounting and allows another dialog after dismissal', async () => {
    instance.isExist.mockReturnValue(false);
    const { unmount } = render(<GlobalErrorHandlerContainer />);
    const emitError = () =>
      appEventBus.emit(EAppEventBusNames.ShowHardwareErrorDialog, {
        errorType: HARDWARE_ERROR_DIALOG_TYPES.DEVICE_NOT_OPENED_PASSPHRASE,
        payload: { connectId: 'disabled-device' },
      });

    act(() => {
      emitError();
      emitError();
    });
    expect(Dialog.show).toHaveBeenCalledTimes(1);

    await jest.mocked(Dialog.show).mock.calls[0][0].onClose?.();
    act(() => {
      emitError();
    });
    expect(Dialog.show).toHaveBeenCalledTimes(2);

    unmount();
    act(() => {
      emitError();
    });
    expect(Dialog.show).toHaveBeenCalledTimes(2);
  });

  it('does not open the dialog for silent calls or unrelated errors', () => {
    render(<GlobalErrorHandlerContainer />);

    act(() => {
      convertDeviceError(
        { code: HardwareErrorCode.DeviceNotOpenedPassphrase },
        { silentMode: true },
      );
      appEventBus.emit(EAppEventBusNames.ShowHardwareErrorDialog, {
        errorType: HARDWARE_ERROR_DIALOG_TYPES.BLE_DEVICE_BOND_ERROR,
      });
    });

    expect(Dialog.show).not.toHaveBeenCalled();
  });
});
