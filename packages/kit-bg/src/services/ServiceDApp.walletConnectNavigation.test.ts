import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EDAppConnectionModal,
  EModalRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';

const mockNavigate = jest.fn<void, unknown[]>();
const mockPlatform = platformEnv;
const mockNavigation = { ready: true };
jest.mock('@onekeyhq/shared/src/appGlobals', () => ({
  __esModule: true,
  default: {
    $navigationRef: {
      get current() {
        return mockNavigation.ready
          ? { navigate: (...args: unknown[]) => mockNavigate(...args) }
          : undefined;
      },
    },
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/platformEnv')
  >('@onekeyhq/shared/src/platformEnv');
  return {
    ...actual,
    __esModule: true,
    default: {
      ...actual.default,
      isExtension: false,
      isNative: true,
      runtimeRole: actual.ERuntimeRole.Standalone,
    },
  };
});
jest.mock('../providers/backgroundProviders', () => ({
  providerApiLoaders: {},
}));
jest.mock('../vaults/factory', () => ({ vaultFactory: {} }));

beforeEach(() => {
  mockNavigate.mockReset();
  mockPlatform.isNative = true;
  mockNavigation.ready = true;
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
});

it.each([ERootRoutes.Modal, ERootRoutes.iOSFullScreen])(
  'delivers a native proposal directly in %s before the navigation relay listener mounts',
  async (root) => {
    const { default: ServiceDApp } = await import('./ServiceDApp');
    const service = new ServiceDApp({ backgroundApi: {} });
    const emit = jest.spyOn(appEventBus, 'emit');
    const modalParams = {
      screen: root,
      params: {
        screen: EModalRoutes.DAppConnectionModal,
        params: {
          screen: EDAppConnectionModal.WalletConnectSessionProposalModal,
          params: { query: 'proposal' },
        },
      },
    };
    expect(appGlobals.$navigationRef.current).toBeDefined();
    expect(
      appEventBus.listenerCount(
        EAppEventBusNames.NavigateModalFromBackgroundThread,
      ),
    ).toBe(0);
    const opening = service._doOpenModalByRouteParams({
      modalParams,
      routeNames: [
        root,
        EModalRoutes.DAppConnectionModal,
        EDAppConnectionModal.WalletConnectSessionProposalModal,
      ],
      routeParams: { query: 'proposal' },
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(root, modalParams.params);
    await opening;
    expect(emit).not.toHaveBeenCalledWith(
      EAppEventBusNames.NavigateModalFromBackgroundThread,
      expect.anything(),
    );
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.WalletConnectCloseConnectionProgress,
      undefined,
    );
  },
);

it('does not block direct approval navigation when the progress signal fails', async () => {
  const { default: ServiceDApp } = await import('./ServiceDApp');
  const service = new ServiceDApp({ backgroundApi: {} });
  const emit = jest.spyOn(appEventBus, 'emit').mockImplementation(() => {
    throw new OneKeyLocalError('Progress signal failed');
  });
  const opening = service._doOpenModalByRouteParams({
    modalParams: { screen: ERootRoutes.Modal, params: {} },
    routeNames: [
      ERootRoutes.Modal,
      EModalRoutes.DAppConnectionModal,
      EDAppConnectionModal.WalletConnectSessionProposalModal,
    ],
    routeParams: { query: 'proposal' },
  });
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(emit).not.toHaveBeenCalled();
  await expect(opening).resolves.toBeUndefined();
  await Promise.resolve();
  expect(emit).toHaveBeenCalledTimes(1);
});

it.each([
  {
    name: 'signing',
    root: ERootRoutes.Modal,
    modal: EModalRoutes.DAppConnectionModal,
    page: EDAppConnectionModal.SignMessageModal,
    native: true,
  },
  {
    name: 'an injected-provider connection',
    root: ERootRoutes.Modal,
    modal: EModalRoutes.DAppConnectionModal,
    page: EDAppConnectionModal.ConnectionModal,
    native: true,
  },
  {
    name: 'another modal',
    root: ERootRoutes.Modal,
    modal: EModalRoutes.SettingModal,
    page: EDAppConnectionModal.WalletConnectSessionProposalModal,
    native: true,
  },
  {
    name: 'another root',
    root: ERootRoutes.Main,
    modal: EModalRoutes.DAppConnectionModal,
    page: EDAppConnectionModal.WalletConnectSessionProposalModal,
    native: true,
  },
  {
    name: 'a non-native proposal',
    root: ERootRoutes.Modal,
    modal: EModalRoutes.DAppConnectionModal,
    page: EDAppConnectionModal.WalletConnectSessionProposalModal,
    native: false,
  },
])(
  'does not signal progress dismissal for $name',
  async ({ root, modal, page, native }) => {
    const { default: ServiceDApp } = await import('./ServiceDApp');
    const service = new ServiceDApp({ backgroundApi: {} });
    mockPlatform.isNative = native;
    const emit = jest.spyOn(appEventBus, 'emit');
    await service._doOpenModalByRouteParams({
      modalParams: {
        screen: root,
        params: { screen: modal, params: { screen: page } },
      },
      routeNames: [root, modal, page],
      routeParams: { query: 'request' },
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(emit).not.toHaveBeenCalled();
  },
);

it('keeps using the background navigation relay when the ref belongs to another runtime', async () => {
  const { default: ServiceDApp } = await import('./ServiceDApp');
  const service = new ServiceDApp({ backgroundApi: {} });
  mockNavigation.ready = false;
  const emit = jest.spyOn(appEventBus, 'emit');
  const modalParams = {
    screen: ERootRoutes.Modal,
    params: {
      screen: EModalRoutes.DAppConnectionModal,
      params: {
        screen: EDAppConnectionModal.WalletConnectSessionProposalModal,
        params: { query: 'proposal' },
      },
    },
  };
  await service._doOpenModalByRouteParams({
    modalParams,
    routeNames: [
      ERootRoutes.Modal,
      EModalRoutes.DAppConnectionModal,
      EDAppConnectionModal.WalletConnectSessionProposalModal,
    ],
    routeParams: { query: 'proposal' },
  });
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(emit).toHaveBeenCalledTimes(1);
  expect(emit).toHaveBeenCalledWith(
    EAppEventBusNames.NavigateModalFromBackgroundThread,
    modalParams,
  );
});
