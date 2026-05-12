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
});
