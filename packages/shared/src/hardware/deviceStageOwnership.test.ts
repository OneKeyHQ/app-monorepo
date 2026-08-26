import { EHardwareUiStateAction } from '../../types/hardwareUi';

import {
  isDeviceStageOwnedHardwareUiAction,
  shouldLegacyContainerRaiseHardwareErrorDialog,
} from './deviceStageOwnership';

describe('isDeviceStageOwnedHardwareUiAction', () => {
  it('claims the interactions the stage plays', () => {
    expect(
      isDeviceStageOwnedHardwareUiAction({
        action: EHardwareUiStateAction.REQUEST_PIN,
      }),
    ).toBe(true);
    expect(
      isDeviceStageOwnedHardwareUiAction({
        action: EHardwareUiStateAction.REQUEST_BUTTON,
      }),
    ).toBe(true);
  });

  it('leaves bluetooth pairing to the legacy container', () => {
    expect(
      isDeviceStageOwnedHardwareUiAction({
        action: EHardwareUiStateAction.DeviceChecking,
        eventType: EHardwareUiStateAction.BLUETOOTH_DEVICE_PAIRING,
      }),
    ).toBe(false);
  });

  it('stands down for the whole firmware update workflow', () => {
    expect(
      isDeviceStageOwnedHardwareUiAction({
        action: EHardwareUiStateAction.REQUEST_BUTTON,
        firmwareUpdateRunning: true,
      }),
    ).toBe(false);
  });

  it('claims nothing without an action', () => {
    expect(isDeviceStageOwnedHardwareUiAction({ action: undefined })).toBe(
      false,
    );
  });
});

describe('shouldLegacyContainerRaiseHardwareErrorDialog', () => {
  it('speaks for failures the stage is not carrying', () => {
    expect(
      shouldLegacyContainerRaiseHardwareErrorDialog({
        errorType: 'DeviceNotFound',
        stageIsShowing: false,
      }),
    ).toBe(true);
  });

  it('stands down while the stage is on — it lands the failure itself', () => {
    expect(
      shouldLegacyContainerRaiseHardwareErrorDialog({
        errorType: 'DeviceNotFound',
        stageIsShowing: true,
      }),
    ).toBe(false);
  });

  it('only ever speaks for DeviceNotFound', () => {
    expect(
      shouldLegacyContainerRaiseHardwareErrorDialog({
        errorType: 'SomethingElse',
        stageIsShowing: false,
      }),
    ).toBe(false);
  });
});
