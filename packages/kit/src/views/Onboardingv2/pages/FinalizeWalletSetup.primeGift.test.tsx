/** @jest-environment jsdom */

import type { ComponentProps, ReactNode } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { resetOnboardingModal } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IDBDevice,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  EAppEventBusNames,
  EFinalizeWalletSetupSteps,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import type { IPrimeGiftEligibility } from '@onekeyhq/shared/types/prime/primeGiftTypes';

import { enterWalletAfterOnboarding } from '../utils/enterWalletAfterOnboarding';

import FinalizeWalletSetup from './FinalizeWalletSetup';

import type { IShowOnboardingInviteCodeDialog } from '../components/OnboardingInviteCodeDialog';

const mockListeners = new Map<string, Set<(event: unknown) => void>>();
const mockCacheListeners = new Set<() => void>();
let mockCache: Record<string, IPrimeGiftEligibility> = {};
let mockActiveWallet = { id: 'hw--pro', associatedDevice: 'db-pro' };
const mockConnectDevice = jest.fn();
const mockCreateHWWallet = jest.fn();
const mockEnsureBurst = jest.fn();
const mockEndBurst = jest.fn();
const mockShowInviteDialog = jest.fn<
  ReturnType<IShowOnboardingInviteCodeDialog>,
  Parameters<IShowOnboardingInviteCodeDialog>
>();
const mockOpenKeylessDapp = jest.fn();
const mockNavigation = {
  push: jest.fn(),
  pop: jest.fn(),
  pushModal: jest.fn(),
};

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const Container = ({
    children,
    testID,
    onPress,
  }: {
    children?: ReactNode;
    testID?: string;
    onPress?: () => void;
  }) =>
    React.createElement(
      onPress ? 'button' : 'div',
      {
        'data-testid': testID,
        onClick: onPress,
      },
      children,
    );
  return {
    Alert: Container,
    AnimatePresence: Container,
    Button: Container,
    Icon: () => null,
    LinearGradient: Container,
    SizableText: Container,
    XStack: Container,
    YStack: Container,
    Dialog: { show: jest.fn() },
    resetOnboardingModal: jest.fn(),
    useMedia: () => ({ gtMd: true }),
    useTheme: () => ({}),
    useThemeName: () => 'light',
  };
});
jest.mock('@react-navigation/core', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    useNavigation: () => ({ isFocused: () => true }),
    useIsFocused: () => true,
    useFocusEffect: (effect: () => void | (() => void)) =>
      React.useEffect(effect, [effect]),
  };
});
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('react-native-reanimated', () => ({
  Easing: { inOut: jest.fn(), sin: jest.fn() },
  useSharedValue: (value: number) => ({ value }),
  withRepeat: jest.fn(),
  withTiming: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDesktop: true, isNative: false },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    FinalizeWalletSetupStep: 'FinalizeWalletSetupStep',
    PrimeGiftRedeemed: 'PrimeGiftRedeemed',
  },
  EFinalizeWalletSetupSteps: {
    ConnectingDevice: 'ConnectingDevice',
    CreatingWallet: 'CreatingWallet',
    GeneratingAccounts: 'GeneratingAccounts',
    EncryptingData: 'EncryptingData',
    Ready: 'Ready',
  },
  appEventBus: {
    on: (name: string, listener: (event: unknown) => void) => {
      const listeners = mockListeners.get(name) ?? new Set();
      listeners.add(listener);
      mockListeners.set(name, listeners);
    },
    off: (name: string, listener: (event: unknown) => void) =>
      mockListeners.get(name)?.delete(listener),
    emit: (name: string, event: unknown) =>
      mockListeners.get(name)?.forEach((listener) => listener(event)),
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{}],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    usePrimeGiftEligibilityPersistAtom: () => [
      React.useSyncExternalStore(
        (listener) => {
          mockCacheListeners.add(listener);
          return () => mockCacheListeners.delete(listener);
        },
        () => mockCache,
      ),
    ],
  };
});
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: { getWallets: jest.fn(), getWalletDevice: jest.fn() },
    servicePrime: { apiGetPrimeGiftEligibility: jest.fn() },
    serviceHardware: { clearForceTransportType: jest.fn() },
    serviceReferralCode: {
      getReferralCodeWalletInfo: jest.fn(),
      cacheWalletCreationRecordTimestamp: jest.fn(),
      recordWalletCreation: jest.fn(),
      checkWalletBindStatus: jest.fn(),
    },
  },
}));
jest.mock('../../../states/jotai/contexts/accountSelector/atoms', () => ({
  useActiveAccount: () => ({ activeAccount: { wallet: mockActiveWallet } }),
}));
jest.mock('../../../states/jotai/contexts/accountSelector/actions', () => ({
  useAccountSelectorActions: () => ({ current: {} }),
}));
jest.mock('../../../components/AccountSelector', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    AccountSelectorProviderMirror: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('../../../hooks/useDeviceStageBurst', () => ({
  useDeviceStageBurst: () => ({
    ensureBurst: mockEnsureBurst,
    endBurst: mockEndBurst,
  }),
}));
jest.mock('../../../hooks/useUserWalletProfile', () => ({
  useUserWalletProfile: () => ({ isSoftwareWalletOnlyUser: false }),
}));
jest.mock('../hooks/useDeviceConnect', () => ({
  useDeviceConnect: () => ({
    connectDevice: mockConnectDevice,
    createHWWallet: mockCreateHWWallet,
  }),
  useConnectDeviceError: jest.fn(),
}));
jest.mock('../../../hooks/useWebDapp/useKeylessWebFlow', () => ({
  useKeylessWebFlowAutoConnectDapp: () => ({
    openKeylessAutoConnectDappModal: mockOpenKeylessDapp,
  }),
}));
jest.mock('../../../components/KeylessWallet/useKeylessWallet', () => ({
  getKeylessOnboardingPin: jest.fn(),
}));
jest.mock(
  '../../../provider/Container/DeviceStageContainer/waitForDeviceStageExit',
  () => ({ waitForDeviceStageExit: jest.fn() }),
);
jest.mock(
  '../../../provider/Container/ThirdPartyHardwareUiStateContainer/LedgerInstallCoreAppsDialog',
  () => ({ ensureLedgerCoreAppsReady: jest.fn() }),
);
jest.mock('../../../utils/passwordUtils', () => ({
  withPromptPasswordVerify: jest.fn(),
}));
jest.mock('../../../utils/toastExistingWalletSwitch', () => ({
  flushPendingExistingWalletSwitchToast: jest.fn(),
  setExistingWalletSwitchToastDeferred: jest.fn(),
}));
jest.mock('../components/Layout', () => ({
  OnboardingPage: jest.requireMock('@onekeyhq/components').YStack,
}));
jest.mock('../components/OrbShader', () => ({ OrbShader: () => null }));
jest.mock('../components/OnboardingInviteCodeDialog', () => ({
  useShowOnboardingInviteCodeDialog: () => mockShowInviteDialog,
}));
jest.mock('../utils', () => ({
  getForceTransportType: jest.fn(),
  getHardwareCommunicationTypeString: jest.fn(),
  trackHardwareWalletConnection: jest.fn(),
}));
jest.mock('../../Prime/hooks/usePrimeGiftMessages', () => ({
  usePrimeGiftMessages: () => (key: string) => key,
}));
jest.mock('../../ReferFriends/hooks/useWalletBoundReferralCode', () => ({
  useWalletBoundReferralCode: () => ({}),
}));

const serviceAccount = jest.mocked(backgroundApiProxy.serviceAccount);
const servicePrime = jest.mocked(backgroundApiProxy.servicePrime);
const serviceHardware = jest.mocked(backgroundApiProxy.serviceHardware);
const serviceReferral = jest.mocked(backgroundApiProxy.serviceReferralCode);
const dbDevice: IDBDevice = {
  id: 'db-pro',
  name: 'OneKey Pro',
  deviceType: EDeviceType.Pro,
  connectId: 'ble-address',
  deviceId: 'device-id',
  uuid: 'PRO-SERIAL',
  features: '{}',
  settingsRaw: '{}',
  createdAt: 0,
  updatedAt: 0,
};
const offer: IPrimeGiftEligibility = {
  sno: dbDevice.uuid,
  eligible: true,
  hasUnclaimedGift: true,
  giftDays: 180,
  giftMonths: 6,
};

function completionPage(
  withDiscoveryDevice = true,
  deviceType: EDeviceType = EDeviceType.Pro,
) {
  return (
    <FinalizeWalletSetup
      navigation={
        mockNavigation as unknown as ComponentProps<
          typeof FinalizeWalletSetup
        >['navigation']
      }
      route={{
        key: 'finalize',
        name: EOnboardingPagesV2.FinalizeWalletSetup,
        params: withDiscoveryDevice
          ? {
              isFirmwareVerified: true,
              deviceData: {
                title: 'OneKey Pro',
                src: { uri: '' },
                device: {
                  connectId: dbDevice.connectId,
                  deviceId: dbDevice.deviceId,
                  serialNo: null,
                  uuid: '',
                  commType: 'electron-ble',
                  name: dbDevice.name,
                  deviceType,
                },
              },
            }
          : {},
      }}
    />
  );
}

function renderCompletion(withDiscoveryDevice = true) {
  return render(completionPage(withDiscoveryDevice));
}

describe('onboarding Prime gift with a Pro discovery record without a serial', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListeners.clear();
    mockCacheListeners.clear();
    mockCache = {};
    mockActiveWallet = { id: 'hw--pro', associatedDevice: dbDevice.id };
    serviceAccount.getWallets.mockResolvedValue({ wallets: [] });
    serviceAccount.getWalletDevice.mockResolvedValue(dbDevice);
    serviceReferral.getReferralCodeWalletInfo.mockResolvedValue({
      walletId: 'hw--pro',
      accountId: 'account',
      address: 'address',
      networkId: 'evm--1',
    });
    serviceReferral.checkWalletBindStatus.mockResolvedValue({
      data: false,
      bindable: true,
      reason: undefined,
    });
    servicePrime.apiGetPrimeGiftEligibility.mockImplementation(
      async ({ serialNo }) => {
        mockCache = { ...mockCache, [serialNo]: offer };
        mockCacheListeners.forEach((listener) => listener());
        return offer;
      },
    );
    mockCreateHWWallet.mockImplementation(async () => {
      appEventBus.emit(EAppEventBusNames.FinalizeWalletSetupStep, {
        step: EFinalizeWalletSetupSteps.Ready,
      });
    });
  });

  it('queries and displays the same gift as device details after creation', async () => {
    renderCompletion();
    await screen.findByText(ETranslations.your_wallet_is_ready);
    await waitFor(() =>
      expect(servicePrime.apiGetPrimeGiftEligibility.mock.calls).toContainEqual(
        [{ serialNo: dbDevice.uuid }],
      ),
    );
    expect(serviceAccount.getWalletDevice.mock.calls).toContainEqual([
      { walletId: mockActiveWallet.id },
    ]);
    expect(
      await screen.findByTestId('prime-gift-offer-onboarding'),
    ).toBeTruthy();
    expect(
      screen.getByText(ETranslations.prime_gift_offer__title),
    ).toBeTruthy();
    fireEvent.click(screen.getByTestId('prime-gift-offer-onboarding'));
    expect(mockNavigation.pushModal).toHaveBeenCalledWith(
      EModalRoutes.PrimeGiftModal,
      expect.objectContaining({
        params: expect.objectContaining({
          source: 'onboarding',
          onboardingRouteKey: 'finalize',
        }),
      }),
    );
  });

  it('does not query a previously selected device before creation finishes', async () => {
    mockCreateHWWallet.mockImplementation(() => new Promise<void>(() => {}));
    renderCompletion();
    await waitFor(() => expect(mockCreateHWWallet).toHaveBeenCalled());
    expect(servicePrime.apiGetPrimeGiftEligibility.mock.calls).toHaveLength(0);
    expect(serviceAccount.getWalletDevice.mock.calls).toHaveLength(0);
  });

  it('prefetches from DB during account generation even when BLE discovery has no serial', async () => {
    mockActiveWallet = {
      id: 'previous-wallet',
      associatedDevice: 'previous-device',
    };
    let finishCreation!: () => void;
    mockCreateHWWallet.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          appEventBus.emit(EAppEventBusNames.FinalizeWalletSetupStep, {
            step: EFinalizeWalletSetupSteps.GeneratingAccounts,
            walletId: 'hw--pro',
            dbDeviceId: dbDevice.id,
          });
          finishCreation = () => {
            mockActiveWallet = { id: 'hw--pro', associatedDevice: dbDevice.id };
            appEventBus.emit(EAppEventBusNames.FinalizeWalletSetupStep, {
              step: EFinalizeWalletSetupSteps.Ready,
            });
            resolve();
          };
        }),
    );
    renderCompletion();
    await waitFor(() =>
      expect(servicePrime.apiGetPrimeGiftEligibility.mock.calls).toHaveLength(
        1,
      ),
    );
    expect(servicePrime.apiGetPrimeGiftEligibility.mock.calls).toEqual([
      [{ serialNo: dbDevice.uuid }],
    ]);
    expect(serviceAccount.getWalletDevice.mock.calls).toEqual([
      [{ walletId: 'hw--pro' }],
    ]);
    expect(screen.queryByTestId('prime-gift-offer-onboarding')).toBeNull();

    await act(async () => finishCreation());
    expect(
      await screen.findByTestId('prime-gift-offer-onboarding'),
    ).toBeTruthy();
    expect(servicePrime.apiGetPrimeGiftEligibility.mock.calls).toHaveLength(1);
  });

  it.each(['pending', 'failed'] as const)(
    'allows entering the wallet when the prefetched eligibility is %s',
    async (status) => {
      let finishCreation!: () => void;
      mockCreateHWWallet.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            appEventBus.emit(EAppEventBusNames.FinalizeWalletSetupStep, {
              step: EFinalizeWalletSetupSteps.GeneratingAccounts,
              walletId: mockActiveWallet.id,
              dbDeviceId: dbDevice.id,
            });
            finishCreation = () => {
              appEventBus.emit(EAppEventBusNames.FinalizeWalletSetupStep, {
                step: EFinalizeWalletSetupSteps.Ready,
              });
              resolve();
            };
          }),
      );
      if (status === 'pending') {
        servicePrime.apiGetPrimeGiftEligibility.mockImplementation(
          () => new Promise<IPrimeGiftEligibility>(() => {}),
        );
      } else {
        servicePrime.apiGetPrimeGiftEligibility.mockRejectedValue(
          new Error('Eligibility unavailable'),
        );
      }
      renderCompletion();
      await waitFor(() =>
        expect(servicePrime.apiGetPrimeGiftEligibility.mock.calls).toHaveLength(
          1,
        ),
      );
      await act(async () => finishCreation());
      expect(screen.queryByTestId('prime-gift-offer-onboarding')).toBeNull();
      expect(
        screen.queryByText(ETranslations.failed_to_create_wallet),
      ).toBeNull();
      fireEvent.click(
        screen.getByTestId('onboarding-finalize-setup-enter-wallet-btn'),
      );
      await waitFor(() =>
        expect(resetOnboardingModal).toHaveBeenCalledTimes(1),
      );
      expect(servicePrime.apiGetPrimeGiftEligibility.mock.calls).toHaveLength(
        1,
      );
    },
  );

  it('also queries when the completion route has no discovery device', async () => {
    renderCompletion(false);
    await act(async () => {
      appEventBus.emit(EAppEventBusNames.FinalizeWalletSetupStep, {
        step: EFinalizeWalletSetupSteps.Ready,
      });
    });
    expect(
      await screen.findByTestId('prime-gift-offer-onboarding'),
    ).toBeTruthy();
    expect(servicePrime.apiGetPrimeGiftEligibility.mock.calls).toContainEqual([
      { serialNo: dbDevice.uuid },
    ]);
  });

  it('keeps wallet setup successful if loading the saved device fails', async () => {
    serviceAccount.getWalletDevice.mockRejectedValueOnce(
      new Error('Device unavailable'),
    );
    renderCompletion();
    await waitFor(() =>
      expect(serviceAccount.getWalletDevice.mock.calls).toHaveLength(1),
    );
    expect(screen.getByText(ETranslations.your_wallet_is_ready)).toBeTruthy();
    expect(
      screen.queryByText(ETranslations.failed_to_create_wallet),
    ).toBeNull();
    expect(servicePrime.apiGetPrimeGiftEligibility.mock.calls).toHaveLength(0);
  });

  it.each([
    ['onboarding', EDeviceType.Pro],
    ['gift', EDeviceType.Pro],
    ['onboarding', EDeviceType.Pro2],
    ['gift', EDeviceType.Pro2],
  ] as const)(
    'keeps referral and cleanup for the %s action on %s',
    async (entry, deviceType) => {
      const wallet: IDBWallet = {
        id: 'hw--pro',
        name: 'Pro',
        type: 'hw',
        backuped: true,
        accounts: [],
        nextIds: {},
        walletNo: 1,
        associatedDevice: dbDevice.id,
      };
      serviceAccount.getWallets
        .mockResolvedValueOnce({ wallets: [] })
        .mockResolvedValue({ wallets: [wallet] });
      render(completionPage(true, deviceType));
      await screen.findByTestId('prime-gift-offer-onboarding');
      if (entry === 'gift') {
        await act(async () => {
          await enterWalletAfterOnboarding('finalize');
        });
      } else {
        fireEvent.click(
          screen.getByTestId('onboarding-finalize-setup-enter-wallet-btn'),
        );
      }
      await waitFor(() =>
        expect(mockShowInviteDialog).toHaveBeenCalledTimes(1),
      );
      expect(mockShowInviteDialog.mock.calls[0][0].wallet).toEqual(wallet);
      expect(screen.queryByTestId('prime-gift-open-invite')).toBeNull();
      expect(resetOnboardingModal).not.toHaveBeenCalled();
      act(() => mockShowInviteDialog.mock.calls[0][0].onDone());
      expect(resetOnboardingModal).toHaveBeenCalledTimes(1);
      expect(serviceHardware.clearForceTransportType.mock.calls).toHaveLength(
        1,
      );
      await waitFor(() => expect(mockOpenKeylessDapp).toHaveBeenCalledTimes(1));
    },
  );
});
