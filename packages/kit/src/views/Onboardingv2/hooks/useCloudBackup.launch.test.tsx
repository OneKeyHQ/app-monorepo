/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */

import { Fragment, Suspense, createElement, lazy } from 'react';
import type { PropsWithChildren } from 'react';

import {
  BaseNavigationContainer,
  createNavigationContainerRef,
  createNavigatorFactory,
  useNavigationBuilder,
} from '@react-navigation/core';
import { StackRouter } from '@react-navigation/routers';
import { act, render, renderHook } from '@testing-library/react';

import { Dialog, Toast } from '@onekeyhq/components';
import type { IBackupDataEncryptedPayload } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useBackUpWallet } from '../../../hooks/useBackUpWallet';
import { showCloudBackupPasswordDialog } from '../components/CloudBackupDialogs';

import { useCloudBackup } from './useCloudBackup';

import type { ParamListBase } from '@react-navigation/routers';

let mockActualRootNavigation:
  | ReturnType<typeof createNavigationContainerRef<ParamListBase>>
  | undefined;

function TestStackNavigator({ children }: PropsWithChildren) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(
    StackRouter,
    { children },
  );
  return createElement(
    NavigationContent,
    null,
    state.routes.map((route) =>
      createElement(
        Fragment,
        { key: route.key },
        descriptors[route.key].render(),
      ),
    ),
  );
}
const TestStack = createNavigatorFactory(TestStackNavigator)();

const mockNavigationStateListeners = new Set<() => void>();
const mockRootNavigation = {
  isReady: jest.fn(() => true),
  addListener: jest.fn((_event: string, listener: () => void) => {
    mockNavigationStateListeners.add(listener);
    return () => {
      mockNavigationStateListeners.delete(listener);
    };
  }),
  navigate: jest.fn(),
  getCurrentRoute: jest.fn(() => ({ name: 'source' })),
  getRootState: jest.fn(() => ({
    routes: [{ key: 'source', name: 'source' }],
    index: 0,
  })),
};
const mockNavigation = {
  pop: jest.fn(),
  popStack: jest.fn(),
  navigate: jest.fn(),
};
const mockPasswordDialog = { close: jest.fn(async () => undefined) };
const mockProgressDialog = { close: jest.fn(async () => undefined) };

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: {
    get current() {
      return mockActualRootNavigation?.current ?? mockRootNavigation;
    },
  },
  Dialog: { confirm: jest.fn(), loading: jest.fn(() => mockProgressDialog) },
  Toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  cloudBackupExitPreventAtom: { set: jest.fn() },
  useCloudBackupStatusAtom: () => [{ supportCloudBackup: true }],
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrimeTransfer: {
      prepareImportTask: jest.fn(async () => 'import-task'),
      resetImportProgress: jest.fn(),
    },
    serviceCloudBackupV2: {
      getCloudAccountInfo: jest.fn(async () => ({
        iCloud: {
          cloudKitAvailable: true,
          cloudKitContainerUserId: 'synthetic-account',
        },
        googleDrive: {
          googlePlayServiceAvailable: true,
          userInfo: { user: { id: 'synthetic-google-id' } },
        },
      })),
      loginCloudIfNeed: jest.fn(async () => undefined),
      buildBackupData: jest.fn(),
      isBackupPasswordSet: jest.fn(async () => true),
      verifyBackupPassword: jest.fn(async () => true),
      backup: jest.fn(async () => ({ recordID: 'new-backup' })),
      prepareLocalRestore: jest.fn(),
      restorePreparedLocalBackup: jest.fn(),
      restorePreparePrivateData: jest.fn(),
      restore: jest.fn(async () => ({ success: true })),
    },
  },
}));
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('../components/CloudBackupDialogs', () => ({
  showCloudBackupPasswordDialog: jest.fn(() => mockPasswordDialog),
  showCloudBackupDeleteDialog: jest.fn(),
}));
jest.mock(
  '../../Prime/pages/PagePrimeTransfer/components/PrimeTransferImportProcessingDialog',
  () => ({
    showPrimeTransferImportProcessingDialog: jest.fn(() => mockProgressDialog),
  }),
);

const payload: IBackupDataEncryptedPayload = {
  privateDataEncrypted: 'synthetic-ciphertext',
  publicData: {
    dataTime: 1,
    totalWalletsCount: 0,
    totalAccountsCount: 0,
    walletDetails: [],
  },
  appVersion: 'test',
  isEmptyData: false,
  isWatchingOnly: false,
};

jest.mock('../../../hooks/useAccountData', () => ({
  useAccountData: () => ({ wallet: undefined }),
}));
jest.mock('../../LiteCard/hooks/useLiteCard', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('../../../hooks/usePageNavigation', () => ({}));

const data = {
  ...payload,
  privateData: {
    credentials: {},
    wallets: {},
    importedAccounts: {},
    watchingAccounts: {},
  },
};

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe.each(['Android', 'iOS', 'desktop'])(
  '%s backup launch ownership',
  (platform) => {
    const original = {
      isNativeIOS: platformEnv.isNativeIOS,
      isNativeAndroid: platformEnv.isNativeAndroid,
      isNative: platformEnv.isNative,
      isDesktopMac: platformEnv.isDesktopMac,
    };
    const service = jest.mocked(backgroundApiProxy.serviceCloudBackupV2);
    beforeEach(() => {
      jest.clearAllMocks();
      mockActualRootNavigation = undefined;
      mockNavigationStateListeners.clear();
      mockRootNavigation.isReady.mockReturnValue(true);
      mockRootNavigation.navigate.mockReset();
      mockRootNavigation.getCurrentRoute.mockReturnValue({ name: 'source' });
      mockNavigation.navigate.mockReset();
      mockNavigation.popStack.mockReset();
      Object.assign(platformEnv, {
        isNativeIOS: platform === 'iOS',
        isNativeAndroid: platform === 'Android',
        isNative: platform !== 'desktop',
        isDesktopMac: platform === 'desktop',
      });
      service.loginCloudIfNeed.mockReset().mockResolvedValue(undefined);
      service.buildBackupData.mockReset().mockResolvedValue(data);
      jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    });
    afterEach(() => {
      Object.assign(platformEnv, original);
      jest.restoreAllMocks();
    });

    function expectDetailNavigation() {
      expect(mockRootNavigation.navigate).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({
            screen: EOnboardingPagesV2.ICloudBackupDetails,
            params: expect.objectContaining({ actionType: 'backup' }),
          }),
        }),
      );
    }

    it('hands off the Settings popStack-before-start sequence without authorizing in the unmounted source', async () => {
      const source = renderHook(() => useCloudBackup());
      const startBackup = source.result.current.startBackup;
      mockNavigation.popStack.mockImplementationOnce(() => source.unmount());
      mockNavigation.popStack();
      await act(async () => {
        await startBackup({ alwaysGoToBackupDetail: true });
      });
      expectDetailNavigation();
      expect(service.getCloudAccountInfo).not.toHaveBeenCalled();
      expect(service.loginCloudIfNeed).not.toHaveBeenCalled();
      expect(service.buildBackupData).not.toHaveBeenCalled();

      const destination = renderHook(() => useCloudBackup());
      await act(async () => {
        expect(await destination.result.current.prepareBackup()).toEqual(data);
      });
      expect(service.getCloudAccountInfo).toHaveBeenCalledTimes(1);
      expect(service.loginCloudIfNeed).toHaveBeenCalledTimes(
        platform === 'Android' ? 1 : 0,
      );
      expect(service.buildBackupData).toHaveBeenCalledTimes(1);
    });

    it('preserves the wallet hook navigation plus 100ms handoff after the source unmounts', async () => {
      const source = renderHook(() =>
        useBackUpWallet({ walletId: 'synthetic-wallet' }),
      );
      const handleBackUpByCloud = source.result.current.handleBackUpByCloud;
      mockNavigation.navigate.mockImplementationOnce(() => source.unmount());
      await act(async () => {
        await Promise.all([handleBackUpByCloud(), handleBackUpByCloud()]);
      });
      expect(mockRootNavigation.navigate).toHaveBeenCalledTimes(1);
      expect(timerUtils.wait).toHaveBeenCalledWith(100);
      expectDetailNavigation();
      expect(service.getCloudAccountInfo).not.toHaveBeenCalled();
    });

    it('alwaysGoToBackupDetail navigates before any asynchronous availability or password work', async () => {
      const source = renderHook(() => useCloudBackup());
      await act(async () => {
        await source.result.current.startBackup({
          alwaysGoToBackupDetail: true,
        });
      });
      expectDetailNavigation();
      expect(service.getCloudAccountInfo).not.toHaveBeenCalled();
      expect(service.buildBackupData).not.toHaveBeenCalled();
      expect(showCloudBackupPasswordDialog).not.toHaveBeenCalled();
    });

    it('deduplicates handoffs after source teardown but allows re-entry 100ms after exiting details', async () => {
      const source = renderHook(() => useCloudBackup());
      const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
      const launch = () =>
        source.result.current.startBackup({ alwaysGoToBackupDetail: true });
      await act(async () => {
        await launch();
      });
      source.rerender();
      const startBackup = source.result.current.startBackup;
      source.unmount();
      await act(async () => {
        await Promise.all([
          startBackup({ alwaysGoToBackupDetail: true }),
          startBackup({ alwaysGoToBackupDetail: true }),
        ]);
      });
      expect(mockRootNavigation.navigate).toHaveBeenCalledTimes(1);
      mockRootNavigation.getCurrentRoute.mockReturnValue({
        name: EOnboardingPagesV2.ICloudBackupDetails,
      });
      mockNavigationStateListeners.forEach((listener) => listener());
      now.mockReturnValue(1100);
      await act(async () => {
        await startBackup({ alwaysGoToBackupDetail: true });
      });
      expect(mockRootNavigation.navigate).toHaveBeenCalledTimes(1);
      expect(service.loginCloudIfNeed).not.toHaveBeenCalled();
      mockRootNavigation.getCurrentRoute.mockReturnValue({ name: 'source' });
      mockNavigationStateListeners.forEach((listener) => listener());
      await act(async () => {
        await startBackup({ alwaysGoToBackupDetail: true });
      });
      expect(mockRootNavigation.navigate).toHaveBeenCalledTimes(2);
    });

    it('releases a cold Onboarding handoff after back before its child navigator mounts', async () => {
      const root = createNavigationContainerRef<ParamListBase>();
      mockActualRootNavigation = root;
      let startBackup: ReturnType<
        typeof useCloudBackup
      >['startBackup'] = async () => {
        throw new OneKeyLocalError('Home has not mounted');
      };
      function Home() {
        startBackup = useCloudBackup().startBackup;
        return null;
      }
      const Detail = () => null;
      function DetailsStack() {
        return createElement(
          TestStack.Navigator,
          null,
          createElement(TestStack.Screen, {
            name: EOnboardingPagesV2.ICloudBackupDetails,
            component: Detail,
          }),
        );
      }
      function OnboardingStack() {
        return createElement(
          TestStack.Navigator,
          null,
          createElement(TestStack.Screen, {
            name: EOnboardingV2Routes.OnboardingV2,
            component: DetailsStack,
          }),
        );
      }
      const moduleReady = deferred<{ default: typeof OnboardingStack }>();
      const LazyOnboarding = lazy(() => moduleReady.promise);
      function Onboarding() {
        return createElement(
          Suspense,
          { fallback: null },
          createElement(LazyOnboarding),
        );
      }
      const onUnhandledAction = jest.fn();
      render(
        <BaseNavigationContainer
          ref={root}
          onUnhandledAction={onUnhandledAction}
        >
          <TestStack.Navigator>
            <TestStack.Screen name={ERootRoutes.Main} component={Home} />
            <TestStack.Screen
              name={ERootRoutes.Onboarding}
              component={Onboarding}
            />
          </TestStack.Navigator>
        </BaseNavigationContainer>,
      );
      const launch = () => startBackup({ alwaysGoToBackupDetail: true });
      await act(async () => {
        await launch();
      });
      expect(root.getCurrentRoute()?.name).toBe(ERootRoutes.Onboarding);
      const firstKey = root.getRootState().routes[1].key;
      await act(async () => {
        await launch();
      });
      expect(root.getRootState().routes).toHaveLength(2);
      expect(root.getRootState().routes[1].key).toBe(firstKey);
      act(() => root.goBack());
      expect(root.getCurrentRoute()?.name).toBe(ERootRoutes.Main);
      await act(async () => {
        await launch();
      });
      expect(root.getCurrentRoute()?.name).toBe(ERootRoutes.Onboarding);
      expect(root.getRootState().routes[1].key).not.toBe(firstKey);
      await act(async () => {
        moduleReady.resolve({ default: OnboardingStack });
        await moduleReady.promise;
      });
      expect(root.getCurrentRoute()?.name).toBe(
        EOnboardingPagesV2.ICloudBackupDetails,
      );
      act(() => root.goBack());
      expect(root.getCurrentRoute()?.name).toBe(ERootRoutes.Main);
      await act(async () => {
        await launch();
      });
      expect(root.getCurrentRoute()?.name).toBe(
        EOnboardingPagesV2.ICloudBackupDetails,
      );
      expect(root.getRootState().routes).toHaveLength(2);
      expect(onUnhandledAction).not.toHaveBeenCalled();
    });

    it('keeps a slow navigation handoff single-flight beyond 600ms', async () => {
      const source = renderHook(() => useCloudBackup());
      const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
      await act(async () => {
        await source.result.current.startBackup({
          alwaysGoToBackupDetail: true,
        });
      });
      now.mockReturnValue(2000);
      await act(async () => {
        await source.result.current.startBackup({
          alwaysGoToBackupDetail: true,
        });
      });
      expect(mockRootNavigation.navigate).toHaveBeenCalledTimes(1);
    });

    it('allows retry once the root navigator is ready', async () => {
      const source = renderHook(() => useCloudBackup());
      mockRootNavigation.isReady.mockReturnValue(false);
      await act(async () => {
        await source.result.current.startBackup({
          alwaysGoToBackupDetail: true,
        });
      });
      expect(mockRootNavigation.navigate).not.toHaveBeenCalled();
      mockRootNavigation.isReady.mockReturnValue(true);
      await act(async () => {
        await source.result.current.startBackup({
          alwaysGoToBackupDetail: true,
        });
      });
      expect(mockRootNavigation.navigate).toHaveBeenCalledTimes(1);
    });

    it('allows a handoff retry after navigation throws', async () => {
      const source = renderHook(() => useCloudBackup());
      mockRootNavigation.navigate.mockImplementationOnce(() => {
        throw new OneKeyLocalError('navigation failed');
      });
      await expect(
        source.result.current.startBackup({ alwaysGoToBackupDetail: true }),
      ).rejects.toThrow('navigation failed');
      await act(async () => {
        await source.result.current.startBackup({
          alwaysGoToBackupDetail: true,
        });
      });
      expect(mockRootNavigation.navigate).toHaveBeenCalledTimes(2);
    });

    it('does not treat a genuinely abandoned page as an explicit handoff', async () => {
      const source = renderHook(() => useCloudBackup());
      const startBackup = source.result.current.startBackup;
      source.unmount();
      await act(async () => {
        await startBackup();
      });
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
      expect(mockRootNavigation.navigate).not.toHaveBeenCalled();
      expect(service.getCloudAccountInfo).not.toHaveBeenCalled();
      expect(Dialog.confirm).not.toHaveBeenCalled();
    });

    it('does not start availability work after exit while authorization code loads', async () => {
      const source = renderHook(() => useCloudBackup());
      const pending = source.result.current.prepareBackup();
      source.unmount();
      await act(async () => {
        await pending;
      });
      expect(service.getCloudAccountInfo).not.toHaveBeenCalled();
      expect(service.loginCloudIfNeed).not.toHaveBeenCalled();
      expect(service.buildBackupData).not.toHaveBeenCalled();
      expect(Dialog.confirm).not.toHaveBeenCalled();
    });

    it.each(['doBackup', 'prepareBackup'] as const)(
      'suppresses prompts after teardown during %s availability',
      async (operation) => {
        const availability =
          deferred<Awaited<ReturnType<typeof service.getCloudAccountInfo>>>();
        service.getCloudAccountInfo.mockReturnValueOnce(availability.promise);
        const source = renderHook(() => useCloudBackup());
        let pending: Promise<unknown> | undefined;
        await act(async () => {
          pending =
            operation === 'doBackup'
              ? source.result.current.doBackup({ data })
              : source.result.current.prepareBackup();
        });
        source.unmount();
        await act(async () => {
          availability.resolve({
            userId: '',
            userEmail: '',
            providerType: ECloudBackupProviderType.GoogleDrive,
            googleDrive: { googlePlayServiceAvailable: true, userInfo: null },
          });
          await pending;
        });
        expect(Dialog.confirm).not.toHaveBeenCalled();
        expect(service.loginCloudIfNeed).not.toHaveBeenCalled();
        expect(service.buildBackupData).not.toHaveBeenCalled();
        expect(showCloudBackupPasswordDialog).not.toHaveBeenCalled();
      },
    );

    it('still displays availability guidance for an active owner', async () => {
      service.getCloudAccountInfo.mockResolvedValueOnce({
        userId: '',
        userEmail: '',
        providerType: ECloudBackupProviderType.GoogleDrive,
        googleDrive: { googlePlayServiceAvailable: false, userInfo: null },
      });
      const source = renderHook(() => useCloudBackup());
      await act(async () => {
        await source.result.current.doBackup({ data });
      });
      expect(Dialog.confirm).toHaveBeenCalledTimes(1);
      expect(source.result.current.checkLoading).toBe(false);
    });

    it('preserves the default launch while its page remains mounted', async () => {
      const source = renderHook(() => useCloudBackup());
      await act(async () => {
        await source.result.current.startBackup();
      });
      if (platform === 'Android') {
        expectDetailNavigation();
        expect(service.buildBackupData).not.toHaveBeenCalled();
      } else {
        expect(mockNavigation.navigate).not.toHaveBeenCalled();
        expect(mockRootNavigation.navigate).not.toHaveBeenCalled();
        expect(service.buildBackupData).toHaveBeenCalledTimes(1);
        expect(showCloudBackupPasswordDialog).toHaveBeenCalledTimes(1);
      }
    });

    if (platform !== 'Android') {
      it('cancels default launch when the user exits during availability', async () => {
        const availability =
          deferred<Awaited<ReturnType<typeof service.getCloudAccountInfo>>>();
        service.getCloudAccountInfo.mockReturnValueOnce(availability.promise);
        const source = renderHook(() => useCloudBackup());
        let pending: Promise<unknown> | undefined;
        await act(async () => {
          pending = source.result.current.startBackup();
        });
        source.unmount();
        await act(async () => {
          availability.resolve({
            userId: '',
            userEmail: '',
            providerType: ECloudBackupProviderType.GoogleDrive,
          });
          await pending;
        });
        expect(Dialog.confirm).not.toHaveBeenCalled();
        expect(service.buildBackupData).not.toHaveBeenCalled();
        expect(mockNavigation.navigate).not.toHaveBeenCalled();
        expect(mockRootNavigation.navigate).not.toHaveBeenCalled();
      });
    }

    if (platform === 'Android') {
      it('requires native sign-in in the destination for an unsigned account', async () => {
        service.getCloudAccountInfo.mockResolvedValueOnce({
          userId: '',
          userEmail: '',
          providerType: ECloudBackupProviderType.GoogleDrive,
          googleDrive: { googlePlayServiceAvailable: true, userInfo: null },
        });
        const destination = renderHook(() => useCloudBackup());
        await act(async () => {
          expect(await destination.result.current.prepareBackup()).toEqual(
            data,
          );
        });
        expect(service.loginCloudIfNeed).toHaveBeenCalledTimes(1);
        expect(service.buildBackupData).toHaveBeenCalledTimes(1);
        expect(Dialog.confirm).not.toHaveBeenCalled();
      });

      it('drops continuation when the destination unmounts during native authorization', async () => {
        const auth = deferred<void>();
        service.loginCloudIfNeed.mockReturnValueOnce(auth.promise);
        const destination = renderHook(() => useCloudBackup());
        let pending: Promise<unknown> | undefined;
        await act(async () => {
          pending = destination.result.current.prepareBackup();
        });
        expect(service.loginCloudIfNeed).toHaveBeenCalledTimes(1);
        destination.unmount();
        await act(async () => {
          auth.resolve(undefined);
          await pending;
        });
        expect(service.buildBackupData).not.toHaveBeenCalled();
        expect(jest.mocked(Toast).success).not.toHaveBeenCalled();
      });

      it('settles failed authorization and lets the active destination retry', async () => {
        service.loginCloudIfNeed.mockRejectedValueOnce(new Error('cancelled'));
        const destination = renderHook(() => useCloudBackup());
        await act(async () => {
          await expect(
            destination.result.current.prepareBackup(),
          ).rejects.toThrow('cancelled');
        });
        expect(destination.result.current.checkLoading).toBe(false);
        expect(service.buildBackupData).not.toHaveBeenCalled();
        await act(async () => {
          expect(await destination.result.current.prepareBackup()).toEqual(
            data,
          );
        });
        expect(service.buildBackupData).toHaveBeenCalledTimes(1);
      });
    }
  },
);
