import { DataManager } from '@onekeyfe/hd-core';
import { Root } from 'protobufjs/light';

describe('Protocol V2 DeviceSettings schema', () => {
  it('decodes the 32-byte payload shape emitted by firmware-pro2 dev', () => {
    const root = Root.fromJSON(
      DataManager.messages.v2Schema as unknown as Parameters<
        typeof Root.fromJSON
      >[0],
    );
    const deviceSettings = root.lookupType('DeviceSettings');
    const payload = Uint8Array.from(
      Buffer.from(
        '08011205656e2d55531a0020502801300138014001480050005801b006b0ea01',
        'hex',
      ),
    );

    expect(payload).toHaveLength(32);
    expect(deviceSettings.toObject(deviceSettings.decode(payload))).toEqual({
      bt_enable: true,
      language: 'en-US',
      wallpaper_path: '',
      brightness: 80,
      animation_enable: true,
      tap_to_wake: true,
      haptic_feedback: true,
      device_name_display_enabled: true,
      airgap_mode: false,
      usb_lock_enable: false,
      random_keypad: true,
      // cspell:disable-next-line
      autolock_delay_ms: 30_000,
    });
  });
});
