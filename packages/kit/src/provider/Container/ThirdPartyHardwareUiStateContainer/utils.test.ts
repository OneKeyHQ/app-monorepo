import { UI_RESPONSE } from '@onekeyfe/hwk-adapter-core';

import {
  EThirdPartyHardwareUiAction,
  type IThirdPartyHardwareUiState,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  buildThirdPartyHardwareUiResponse,
  cancelThirdPartyHardwareUiRequest,
  clearThirdPartyHardwareUiStateIfCurrent,
  createTrezorBleBindingDialogCallbacks,
} from './utils';

describe('ThirdPartyHardwareUiStateContainer utils', () => {
  it('builds a declined device-connect response', () => {
    expect(
      buildThirdPartyHardwareUiResponse(
        EThirdPartyHardwareUiAction.requestDeviceNotFound,
        false,
      ),
    ).toEqual({
      type: UI_RESPONSE.RECEIVE_DEVICE_CONNECT,
      payload: { confirmed: false },
    });
  });

  it('builds a declined BTC high-index response', () => {
    expect(
      buildThirdPartyHardwareUiResponse(
        EThirdPartyHardwareUiAction.requestBtcHighIndexConfirm,
        false,
      ),
    ).toEqual({
      type: UI_RESPONSE.RECEIVE_BTC_HIGH_INDEX_CONFIRM,
      payload: { confirmed: false },
    });
  });

  it('builds a Trezor passphrase response without exposing it to logs', () => {
    expect(
      buildThirdPartyHardwareUiResponse(
        EThirdPartyHardwareUiAction.requestTrezorPassphrase,
        true,
        {
          passphrase: 'hidden-passphrase',
          passphraseOnDevice: false,
          save: true,
        },
      ),
    ).toEqual({
      type: UI_RESPONSE.RECEIVE_PASSPHRASE,
      payload: {
        value: 'hidden-passphrase',
        passphraseOnDevice: false,
        save: true,
      },
    });
  });

  it('builds a Trezor on-device passphrase response', () => {
    expect(
      buildThirdPartyHardwareUiResponse(
        EThirdPartyHardwareUiAction.requestTrezorPassphrase,
        true,
        {
          passphraseOnDevice: true,
          save: true,
        },
      ),
    ).toEqual({
      type: UI_RESPONSE.RECEIVE_PASSPHRASE,
      payload: {
        value: '',
        passphraseOnDevice: true,
        save: true,
      },
    });
  });

  it('builds a Trezor PIN response from the matrix position string', () => {
    expect(
      buildThirdPartyHardwareUiResponse(
        EThirdPartyHardwareUiAction.requestTrezorPin,
        true,
        { pin: '7913' },
      ),
    ).toEqual({
      type: UI_RESPONSE.RECEIVE_PIN,
      payload: '7913',
    });
  });

  it('returns null for a cancelled Trezor PIN request', () => {
    expect(
      buildThirdPartyHardwareUiResponse(
        EThirdPartyHardwareUiAction.requestTrezorPin,
        false,
        { pin: '7913' },
      ),
    ).toBeNull();
  });

  it('does not clear a newer Trezor UI request when an older request finishes', async () => {
    const passphraseState: IThirdPartyHardwareUiState = {
      action: EThirdPartyHardwareUiAction.requestTrezorPassphrase,
      vendor: EHardwareVendor.trezor,
      payload: { connectId: 'trezor-connect-id' },
    };
    const confirmOnDeviceState: IThirdPartyHardwareUiState = {
      action: EThirdPartyHardwareUiAction.confirmOnDevice,
      vendor: EHardwareVendor.trezor,
    };
    const setState = jest.fn(async () => undefined);

    await clearThirdPartyHardwareUiStateIfCurrent({
      expectedState: passphraseState,
      getState: () => confirmOnDeviceState,
      setState,
    });

    expect(setState).not.toHaveBeenCalled();
  });

  it('sends the declined UI response and clears state when a request dialog is cancelled', async () => {
    const uiResponse = jest.fn(async () => undefined);
    const cancel = jest.fn(async () => undefined);
    const clearState = jest.fn(async () => undefined);
    const state: IThirdPartyHardwareUiState = {
      action: EThirdPartyHardwareUiAction.requestDeviceNotFound,
      vendor: EHardwareVendor.ledger,
    };

    await cancelThirdPartyHardwareUiRequest({
      state,
      uiResponse,
      cancel,
      clearState,
    });

    expect(uiResponse).toHaveBeenCalledWith({
      vendor: EHardwareVendor.ledger,
      response: {
        type: UI_RESPONSE.RECEIVE_DEVICE_CONNECT,
        payload: { confirmed: false },
      },
    });
    expect(cancel).not.toHaveBeenCalled();
    expect(clearState).toHaveBeenCalledTimes(1);
  });

  it('still clears state if the SDK response rejects', async () => {
    const uiResponse = jest.fn(async () => {
      throw new OneKeyLocalError('response failed');
    });
    const cancel = jest.fn(async () => undefined);
    const clearState = jest.fn(async () => undefined);
    const state: IThirdPartyHardwareUiState = {
      action: EThirdPartyHardwareUiAction.requestBtcHighIndexConfirm,
      vendor: EHardwareVendor.ledger,
    };

    await expect(
      cancelThirdPartyHardwareUiRequest({
        state,
        uiResponse,
        cancel,
        clearState,
      }),
    ).rejects.toThrow('response failed');

    expect(cancel).not.toHaveBeenCalled();
    expect(clearState).toHaveBeenCalledTimes(1);
  });

  it('resolves a Trezor BLE binding once and clears UI state', async () => {
    const resolveCallback = jest.fn(async () => undefined);
    const clearState = jest.fn(async () => undefined);
    const dialogInstanceRef = { current: {} };
    const settledRef = { current: false };

    const callbacks = createTrezorBleBindingDialogCallbacks({
      promiseId: 123,
      dialogInstanceRef,
      settledRef,
      resolveCallback,
      clearState,
    });

    callbacks.onBound('BLE_CONNECT_ID');
    await callbacks.onClose();

    expect(resolveCallback).toHaveBeenCalledTimes(1);
    expect(resolveCallback).toHaveBeenCalledWith({
      id: 123,
      data: 'BLE_CONNECT_ID',
    });
    expect(clearState).toHaveBeenCalledTimes(2);
    expect(dialogInstanceRef.current).toBeNull();
  });

  it('resolves null when the Trezor BLE binding dialog is closed before binding', async () => {
    const resolveCallback = jest.fn(async () => undefined);
    const clearState = jest.fn(async () => undefined);
    const dialogInstanceRef = { current: {} };
    const settledRef = { current: false };

    const callbacks = createTrezorBleBindingDialogCallbacks({
      promiseId: 123,
      dialogInstanceRef,
      settledRef,
      resolveCallback,
      clearState,
    });

    await callbacks.onClose();

    expect(resolveCallback).toHaveBeenCalledTimes(1);
    expect(resolveCallback).toHaveBeenCalledWith({
      id: 123,
      data: null,
    });
    expect(clearState).toHaveBeenCalledTimes(1);
    expect(dialogInstanceRef.current).toBeNull();
  });
});
