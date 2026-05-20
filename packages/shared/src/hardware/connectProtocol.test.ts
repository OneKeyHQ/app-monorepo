import { HARDWARE_CONNECT_PROTOCOL } from '@onekeyfe/hd-shared';

import {
  getHardwareConnectProtocolFromDevice,
  getHardwareConnectProtocolFromDeviceType,
  isHardwareConnectProtocolV2Device,
} from './connectProtocol';

describe('getHardwareConnectProtocolFromDevice', () => {
  it('returns V2 when the scanner reports Protocol V2', () => {
    expect(
      getHardwareConnectProtocolFromDevice({
        protocolType: HARDWARE_CONNECT_PROTOCOL.V2,
      }),
    ).toBe(HARDWARE_CONNECT_PROTOCOL.V2);
  });

  it('returns V1 when the scanner reports Protocol V1', () => {
    expect(
      getHardwareConnectProtocolFromDevice({
        protocolType: HARDWARE_CONNECT_PROTOCOL.V1,
      }),
    ).toBe(HARDWARE_CONNECT_PROTOCOL.V1);
  });

  it('ignores missing or unknown protocol values', () => {
    expect(getHardwareConnectProtocolFromDevice()).toBeUndefined();
    expect(
      getHardwareConnectProtocolFromDevice({ protocolType: 'PRO2' }),
    ).toBeUndefined();
  });

  it('falls back to V2 for Pro2 devices when protocolType is not reported', () => {
    expect(getHardwareConnectProtocolFromDevice({ deviceType: 'pro2' })).toBe(
      HARDWARE_CONNECT_PROTOCOL.V2,
    );
  });

  it('falls back to V2 when the scanner only reports a Pro2 device name', () => {
    expect(
      getHardwareConnectProtocolFromDevice({
        deviceType: 'pro',
        name: 'OneKey Pro2',
      }),
    ).toBe(HARDWARE_CONNECT_PROTOCOL.V2);
    expect(
      getHardwareConnectProtocolFromDevice({
        deviceType: 'pro',
        name: 'Pro 2 54BB',
      }),
    ).toBe(HARDWARE_CONNECT_PROTOCOL.V2);
  });
});

describe('getHardwareConnectProtocolFromDeviceType', () => {
  it('returns V2 for Pro2 device type', () => {
    expect(getHardwareConnectProtocolFromDeviceType('pro2')).toBe(
      HARDWARE_CONNECT_PROTOCOL.V2,
    );
  });

  it('does not force protocol for legacy device types', () => {
    expect(getHardwareConnectProtocolFromDeviceType('pro')).toBeUndefined();
  });
});

describe('isHardwareConnectProtocolV2Device', () => {
  it('returns true for Protocol V2 devices', () => {
    expect(
      isHardwareConnectProtocolV2Device({
        protocolType: HARDWARE_CONNECT_PROTOCOL.V2,
      }),
    ).toBe(true);
  });

  it('returns false for legacy or unknown devices', () => {
    expect(
      isHardwareConnectProtocolV2Device({
        protocolType: HARDWARE_CONNECT_PROTOCOL.V1,
      }),
    ).toBe(false);
    expect(isHardwareConnectProtocolV2Device()).toBe(false);
  });
});
