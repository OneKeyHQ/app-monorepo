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
  createThirdPartyDeviceSelectionDialogCallbacks,
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

  it('builds a Keystone QR response with the scanned UR payload', () => {
    expect(
      buildThirdPartyHardwareUiResponse(
        EThirdPartyHardwareUiAction.requestKeystoneQrScan,
        true,
        {
          qrResponse: {
            urType: 'crypto-response',
            urData: 'a1b2',
          },
        },
      ),
    ).toEqual({
      type: UI_RESPONSE.RECEIVE_QR_RESPONSE,
      payload: {
        urType: 'crypto-response',
        urData: 'a1b2',
      },
    });
  });

  it('returns null when a Keystone QR request is cancelled', () => {
    expect(
      buildThirdPartyHardwareUiResponse(
        EThirdPartyHardwareUiAction.requestKeystoneQrDisplay,
        false,
      ),
    ).toBeNull();
  });

  it('does not clear a newer Trezor UI request when an older request finishes', async () => {
    const passphraseState: IThirdPartyHardwareUiState = {
      uiRequestId: 'old-prompt',
      action: EThirdPartyHardwareUiAction.requestTrezorPassphrase,
      vendor: EHardwareVendor.trezor,
      payload: { connectId: 'trezor-connect-id' },
    };
    const clearInBackground = jest.fn(async () => false);

    const cleared = await clearThirdPartyHardwareUiStateIfCurrent({
      expectedState: passphraseState,
      clearInBackground,
    });

    expect(cleared).toBe(false);
    expect(clearInBackground).toHaveBeenCalledWith({
      expectedRequestId: 'old-prompt',
    });
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

  it('returns an SDK target once for operation-first device selection', async () => {
    const uiResponse = jest.fn(async () => undefined);
    const cancel = jest.fn(async () => undefined);
    const clearState = jest.fn(async () => undefined);
    const dialogInstanceRef = { current: {} };
    const settledRef = { current: false };
    const callbacks = createThirdPartyDeviceSelectionDialogCallbacks({
      vendor: EHardwareVendor.ledger,
      requestId: 'selection-1',
      dialogInstanceRef,
      settledRef,
      uiResponse,
      cancel,
      clearState,
    });

    await callbacks.onSelected('ledger-target-b');
    await callbacks.onSelected('ledger-target-c');
    await callbacks.onClose();

    expect(uiResponse).toHaveBeenCalledTimes(1);
    expect(uiResponse).toHaveBeenCalledWith({
      vendor: EHardwareVendor.ledger,
      response: {
        type: UI_RESPONSE.RECEIVE_SELECT_DEVICE,
        payload: { sdkConnectId: 'ledger-target-b', requestId: 'selection-1' },
      },
    });
    expect(cancel).not.toHaveBeenCalled();
    expect(clearState).toHaveBeenCalledTimes(2);
    expect(dialogInstanceRef.current).toBeNull();
  });

  it('cancels the SDK wait when operation-first selection closes', async () => {
    const uiResponse = jest.fn(async () => undefined);
    const cancel = jest.fn(async () => undefined);
    const clearState = jest.fn(async () => undefined);
    const dialogInstanceRef = { current: {} };
    const settledRef = { current: false };
    const callbacks = createThirdPartyDeviceSelectionDialogCallbacks({
      vendor: EHardwareVendor.ledger,
      dialogInstanceRef,
      settledRef,
      uiResponse,
      cancel,
      clearState,
    });

    await callbacks.onClose();

    expect(uiResponse).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledWith({
      vendor: EHardwareVendor.ledger,
    });
    expect(clearState).toHaveBeenCalledTimes(1);
    expect(dialogInstanceRef.current).toBeNull();
  });

  it('closes only its correlated request without a vendor-wide cancel', async () => {
    const uiResponse = jest.fn(async () => undefined);
    const cancel = jest.fn(async () => undefined);
    const callbacks = createThirdPartyDeviceSelectionDialogCallbacks({
      vendor: EHardwareVendor.trezor,
      requestId: 'selection-old',
      dialogInstanceRef: { current: {} },
      settledRef: { current: false },
      uiResponse,
      cancel,
      clearState: jest.fn(async () => undefined),
    });
    await callbacks.onClose();
    await callbacks.onClose();
    expect(uiResponse).toHaveBeenCalledTimes(1);
    expect(uiResponse).toHaveBeenCalledWith({
      vendor: EHardwareVendor.trezor,
      response: {
        type: UI_RESPONSE.RECEIVE_SELECT_DEVICE,
        payload: { requestId: 'selection-old', cancelled: true },
      },
    });
    expect(cancel).not.toHaveBeenCalled();
  });

  it('does not issue an unconditional clear without an expected request', async () => {
    const clearInBackground = jest.fn(async () => true);
    const cleared = await clearThirdPartyHardwareUiStateIfCurrent({
      expectedState: undefined,
      clearInBackground,
    });
    expect(cleared).toBe(false);
    expect(clearInBackground).not.toHaveBeenCalled();
  });
});
