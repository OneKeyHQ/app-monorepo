const mockStoreHook = jest.fn<void, []>();
const mockWebHook = jest.fn<void, []>();
let mockIsMas = true;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isMas() {
      return mockIsMas;
    },
  },
}));

jest.mock('./desktopStorePurchasesSdk', () => ({
  desktopStorePurchasesSdk: {},
}));
jest.mock('./usePrimePaymentMethodsStore', () => ({
  usePrimePaymentMethodsStore: () => mockStoreHook(),
}));
jest.mock('./usePrimePaymentMethodsWeb', () => ({
  usePrimePaymentMethodsWeb: () => mockWebHook(),
}));

describe('desktop payment provider', () => {
  it.each([true, false])(
    'selects the expected provider for MAS=%s',
    (isMas) => {
      jest.clearAllMocks();
      mockIsMas = isMas;
      jest.isolateModules(() => {
        const { usePrimePaymentMethods: runPaymentProvider } =
          require('./usePrimePaymentMethods.desktop') as typeof import('./usePrimePaymentMethods.desktop');
        runPaymentProvider();
      });
      expect(mockStoreHook).toHaveBeenCalledTimes(isMas ? 1 : 0);
      expect(mockWebHook).toHaveBeenCalledTimes(isMas ? 0 : 1);
    },
  );
});
