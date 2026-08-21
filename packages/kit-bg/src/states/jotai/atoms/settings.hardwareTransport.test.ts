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
  globalAtomComputedR: jest.fn(() => ({ use: jest.fn() })),
}));

describe('settings default hardware transport', () => {
  it('uses WebUSB on Linux desktop', () => {
    expect(settingsAtomInitialValue.hardwareTransportType).toBe(
      EHardwareTransportType.WEBUSB,
    );
  });
});
