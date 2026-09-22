const mockStoreHook = jest.fn<void, [unknown]>();
const mockWebHook = jest.fn<void, []>();
const mockIntl = { formatMessage: jest.fn() };
const mockSdk = {};
const mockCreateDesktopStorePurchasesSdk = jest.fn((_intl: unknown) => mockSdk);
let mockIsMas = true;

jest.mock('react', () => ({
  useMemo: (factory: () => unknown) => factory(),
}));
jest.mock('react-intl', () => ({
  useIntl: () => mockIntl,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isMas() {
      return mockIsMas;
    },
  },
}));

jest.mock('./desktopStorePurchasesSdk', () => ({
  createDesktopStorePurchasesSdk: (intl: unknown) =>
    mockCreateDesktopStorePurchasesSdk(intl),
}));
jest.mock('./usePrimePaymentMethodsStore', () => ({
  usePrimePaymentMethodsStore: (sdk: unknown) => mockStoreHook(sdk),
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
      if (isMas) {
        expect(mockCreateDesktopStorePurchasesSdk).toHaveBeenCalledWith(
          mockIntl,
        );
        expect(mockStoreHook).toHaveBeenCalledWith(mockSdk);
      } else {
        expect(mockCreateDesktopStorePurchasesSdk).not.toHaveBeenCalled();
      }
    },
  );
});
