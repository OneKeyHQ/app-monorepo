import { NativeModules } from 'react-native';

import {
  configureRevenueCat,
  getRevenueCatRecurringPriceUnit,
} from './revenueCatNativeCompatibility.native';

const mockConfigure = jest.fn<void, [unknown]>();
const mockSetupPurchases = jest.fn();
let mockIsNative = true;
let mockIsNativeAndroid = true;

jest.mock('react-native', () => ({
  NativeModules: {
    RNPurchases: {
      setupPurchases: (...args: unknown[]) => {
        mockSetupPurchases(...args);
      },
    },
  },
}));

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: (params: unknown) => mockConfigure(params),
    PURCHASES_ARE_COMPLETED_BY_TYPE: { REVENUECAT: 'REVENUECAT' },
    // cspell:disable-next-line
    STOREKIT_VERSION: { DEFAULT: 'DEFAULT' },
    ENTITLEMENT_VERIFICATION_MODE: { DISABLED: 'DISABLED' },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
    get isNativeAndroid() {
      return mockIsNativeAndroid;
    },
  },
}));

type IMockRevenueCatNativeModule = {
  getVirtualCurrencies?: jest.Mock;
};

const mockNativeModule =
  NativeModules.RNPurchases as IMockRevenueCatNativeModule;

describe('revenueCatNativeCompatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsNative = true;
    mockIsNativeAndroid = true;
    delete mockNativeModule.getVirtualCurrencies;
  });

  it('uses the current bridge and major units when the native capability exists', () => {
    mockNativeModule.getVirtualCurrencies = jest.fn();

    configureRevenueCat({ apiKey: 'rc-key' });

    expect(mockConfigure).toHaveBeenCalledWith({ apiKey: 'rc-key' });
    expect(mockSetupPurchases).not.toHaveBeenCalled();
    expect(getRevenueCatRecurringPriceUnit()).toBe('major');
  });

  it('uses the legacy bridge signature and micros on an older Android shell', () => {
    configureRevenueCat({ apiKey: 'rc-key' });

    expect(mockConfigure).not.toHaveBeenCalled();
    expect(mockSetupPurchases).toHaveBeenCalledWith(
      'rc-key',
      null,
      'REVENUECAT',
      null,
      'DEFAULT',
      false,
      true,
      'DISABLED',
      false,
      false,
    );
    expect(getRevenueCatRecurringPriceUnit()).toBe('micros');
  });

  it('keeps legacy iOS recurring prices in major units', () => {
    mockIsNativeAndroid = false;

    expect(getRevenueCatRecurringPriceUnit()).toBe('major');
  });
});
