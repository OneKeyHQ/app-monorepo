/**
 * @jest-environment jsdom
 */

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { act, render } from '@testing-library/react';

import { Dialog } from '@onekeyhq/components';
import { DeviceNotOpenedPassphrase } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import { globalErrorHandler } from '@onekeyhq/shared/src/errors/globalErrorHandler';
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

jest.mock('@onekeyhq/shared/src/errors/globalErrorHandler', () => ({
  globalErrorHandler: { addListener: jest.fn(), removeListener: jest.fn() },
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

  it('preserves the unhandled SDK error fallback and enables the same device', async () => {
    const addListener = jest.spyOn(globalErrorHandler, 'addListener');
    const enable = jest.spyOn(
      backgroundApiProxy.serviceHardware,
      'setPassphraseEnabled',
    );
    render(<GlobalErrorHandlerContainer />);

    act(() => {
      const error = convertDeviceError({
        code: HardwareErrorCode.DeviceNotOpenedPassphrase,
        connectId: 'disabled-device',
        deviceId: 'disabled-device-id',
      });
      expect(Dialog.show).not.toHaveBeenCalled();
      addListener.mock.calls[0][0](error);
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

  it('preserves the wallet target from the creation recovery event', async () => {
    const enable = jest.spyOn(
      backgroundApiProxy.serviceHardware,
      'setPassphraseEnabled',
    );
    render(<GlobalErrorHandlerContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.ShowHardwareErrorDialog, {
        errorType: HARDWARE_ERROR_DIALOG_TYPES.DEVICE_NOT_OPENED_PASSPHRASE,
        payload: { params: { walletId: 'hw-wallet' } },
      });
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
    const addListener = jest.spyOn(globalErrorHandler, 'addListener');
    const removeListener = jest.spyOn(globalErrorHandler, 'removeListener');
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
      addListener.mock.calls[0][0](new DeviceNotOpenedPassphrase());
    });
    expect(Dialog.show).toHaveBeenCalledTimes(1);

    await jest.mocked(Dialog.show).mock.calls[0][0].onClose?.();
    act(() => {
      emitError();
    });
    expect(Dialog.show).toHaveBeenCalledTimes(2);

    unmount();
    expect(removeListener).toHaveBeenCalledWith(addListener.mock.calls[0][0]);
    act(() => {
      emitError();
    });
    expect(Dialog.show).toHaveBeenCalledTimes(2);
  });

  it('leaves handled passphrase errors to the caller recovery dialog', async () => {
    const enable = jest.spyOn(
      backgroundApiProxy.serviceHardware,
      'setPassphraseEnabled',
    );
    render(<GlobalErrorHandlerContainer />);

    const error = convertDeviceError({
      code: HardwareErrorCode.DeviceNotOpenedPassphrase,
      connectId: 'disabled-device',
      deviceId: 'disabled-device-id',
    });
    await expect(Promise.reject(error)).rejects.toBe(error);

    expect(error.autoToast).toBe(false);
    expect(Dialog.show).not.toHaveBeenCalled();
    expect(enable).not.toHaveBeenCalled();
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
