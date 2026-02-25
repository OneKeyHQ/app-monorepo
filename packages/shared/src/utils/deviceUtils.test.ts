import {
  EHardwareUiStateAction,
  getDeviceFirmwareVersion,
  getDeviceType,
} from './deviceUtils';

describe('deviceUtils', () => {
  describe('EHardwareUiStateAction', () => {
    it('should have all required action types', () => {
      expect(EHardwareUiStateAction.REQUEST_PIN).toBe('ui-request_pin');
      expect(EHardwareUiStateAction.REQUEST_BUTTON).toBe('ui-button');
      expect(EHardwareUiStateAction.REQUEST_PASSPHRASE).toBe('ui-request_passphrase');
      expect(EHardwareUiStateAction.CLOSE_UI_WINDOW).toBe('ui-close_window');
    });

    it('should have firmware related actions', () => {
      expect(EHardwareUiStateAction.FIRMWARE_PROCESSING).toBe('ui-firmware-processing');
      expect(EHardwareUiStateAction.FIRMWARE_PROGRESS).toBe('ui-firmware-progress');
      expect(EHardwareUiStateAction.FIRMWARE_TIP).toBe('ui-firmware-tip');
    });

    it('should have bluetooth related actions', () => {
      expect(EHardwareUiStateAction.BLUETOOTH_PERMISSION).toBe('ui-bluetooth_permission');
      expect(EHardwareUiStateAction.BLUETOOTH_POWERED_OFF).toBe('ui-bluetooth_powered_off');
    });
  });

  describe('getDeviceType', () => {
    it('should return device type from features', () => {
      const mockFeatures = {
        onekey_device_type: 'touch',
      };
      const result = getDeviceType(mockFeatures as any);
      expect(result).toBe('touch');
    });

    it('should return unknown for undefined features', () => {
      const result = getDeviceType(undefined);
      expect(result).toBe('unknown');
    });

    it('should return unknown for null device type', () => {
      const mockFeatures = {
        onekey_device_type: null,
      };
      const result = getDeviceType(mockFeatures as any);
      expect(result).toBe('unknown');
    });
  });

  describe('getDeviceFirmwareVersion', () => {
    it('should return firmware version from features', () => {
      const mockFeatures = {
        major_version: 4,
        minor_version: 9,
        patch_version: 0,
      };
      const result = getDeviceFirmwareVersion(mockFeatures as any);
      expect(result).toBe('4.9.0');
    });

    it('should return undefined for undefined features', () => {
      const result = getDeviceFirmwareVersion(undefined);
      expect(result).toBeUndefined();
    });

    it('should handle single digit versions', () => {
      const mockFeatures = {
        major_version: 1,
        minor_version: 0,
        patch_version: 5,
      };
      const result = getDeviceFirmwareVersion(mockFeatures as any);
      expect(result).toBe('1.0.5');
    });
  });
});
