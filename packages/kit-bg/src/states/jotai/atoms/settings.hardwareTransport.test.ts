import { EHardwareTransportType } from '@onekeyhq/shared/types';

import { settingsAtomInitialValue } from './settings';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktopLinux: true,
    isNative: false,
    isSupportWebUSB: true,
  },
}));

jest.mock('../utils', () => ({
  globalAtom: jest.fn(() => ({ target: {}, use: jest.fn() })),
}));

describe('settings default hardware transport', () => {
  it('prefers WebUSB on Linux desktop when it is supported', () => {
    expect(settingsAtomInitialValue.hardwareTransportType).toBe(
      EHardwareTransportType.WEBUSB,
    );
  });
});
