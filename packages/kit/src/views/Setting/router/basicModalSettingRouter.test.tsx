import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

let mockIsDev = true;
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isDev() {
      return mockIsDev;
    },
  },
}));
jest.mock('@onekeyhq/kit/src/components/LazyLoadPage', () => ({
  LazyLoadPage: () => () => null,
}));
jest.mock('../../AddressBook/router', () => ({ ModalAddressBookRouter: [] }));

const galleries = [
  EModalSettingRoutes.SettingDevPerpGalleryModal,
  EModalSettingRoutes.SettingDevCryptoGalleryModal,
  EModalSettingRoutes.SettingDevCloudBackupGalleryModal,
  EModalSettingRoutes.SettingDevAuthGalleryModal,
  EModalSettingRoutes.SettingDevKeylessWalletGallery,
  EModalSettingRoutes.SettingDevStorageGalleryModal,
];

afterEach(() => jest.restoreAllMocks());
it.each([
  ['development', true, true],
  ['production', true, false],
  ['development', false, false],
] as const)(
  'exports the actual registry for NODE_ENV=%s / isDev=%s',
  (environment, dev, allowed) => {
    mockIsDev = dev;
    jest.replaceProperty(process.env, 'NODE_ENV', environment);
    let registry: typeof import('./basicModalSettingRouter').BasicModalSettingStack =
      [];
    jest.isolateModules(() => {
      registry = jest.requireActual<typeof import('./basicModalSettingRouter')>(
        './basicModalSettingRouter',
      ).BasicModalSettingStack;
    });
    const names = registry.map(({ name }) => name);
    for (const name of galleries) expect(names.includes(name)).toBe(allowed);
    expect(names).toContain(
      EModalSettingRoutes.SettingDevDesktopApiProxyTestModal,
    );
  },
);
