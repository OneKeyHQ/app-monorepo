import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import type { ICheckedState } from '@onekeyhq/components';
import {
  Checkbox,
  Dialog,
  YStack,
  useOnRouterChange,
} from '@onekeyhq/components';
import {
  isOnboardingFromExtensionUrl,
  useToOnBoardingPage,
} from '@onekeyhq/kit/src/views/Onboarding/hooks/useToOnBoardingPage';
import { useV4migrationPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  appLaunchStateStorage,
  reconcileAppInstallation,
} from '@onekeyhq/shared/src/storage/launchStateStorage';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useV4MigrationActions } from '../pages/V4Migration/hooks/useV4MigrationActions';

import {
  type INavigationStateLike,
  createOnboardingLaunchRequestCoordinator,
  setOnboardingLaunchDecision,
  syncOnboardingLaunchForegroundFromNavigationState,
} from './onboardingLaunchGate';

let lastAutoStartV4MigrationTime = 0;
let isBaseSettingsMigrated = false;
let downgradeConfirmDialogShown = false;
let isAutoStartV4MigrationShown = false;

function DowngradeWarningDialogContent({
  onConfirm,
}: {
  onConfirm: (value: ICheckedState) => void;
}) {
  const intl = useIntl();
  const [checkState, setCheckState] = useState(false as ICheckedState);
  const handleConfirm = useCallback(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          onConfirm(checkState);
          resolve();
        }, 0);
      }),
    [checkState, onConfirm],
  );

  return (
    <YStack>
      <Dialog.Title>
        {intl.formatMessage({
          id: ETranslations.downgrade_warning_title,
        })}
      </Dialog.Title>
      <Dialog.Description>
        {intl.formatMessage({
          id: ETranslations.downgrade_warning_description,
        })}
      </Dialog.Description>
      <Checkbox
        testID="onboarding-handle-confirm-checkbox"
        value={checkState}
        label={intl.formatMessage({
          id: ETranslations.downgrade_warning_checkbox_label,
        })}
        onChange={setCheckState}
      />
      <Dialog.Footer
        confirmButtonProps={{
          disabled: !checkState,
        }}
        onConfirm={handleConfirm}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_i_understand,
        })}
        showCancelButton={false}
      />
    </YStack>
  );
}

function OnboardingOnMountCmp() {
  const toOnBoardingPage = useToOnBoardingPage();
  const v4migrationActions = useV4MigrationActions();
  const nativeV4MigrationCheckedRef = useRef(false);
  const nativeV4MigrationRouteRef = useRef(false);
  const [v4migrationPersistData, setV4MigrationPersistAtom] =
    useV4migrationPersistAtom();
  const downgradeWarningConfirmed =
    v4migrationPersistData?.downgradeWarningConfirmed;
  const downgradeWarningConfirmedRef = useRef(downgradeWarningConfirmed);
  downgradeWarningConfirmedRef.current = downgradeWarningConfirmed;
  const localLaunchDecisionResolvedRef = useRef(false);
  const shouldOpenOnboarding =
    !platformEnv.isWebDappMode && !platformEnv.isExtensionUiSidePanel;

  useLayoutEffect(() => {
    if (localLaunchDecisionResolvedRef.current) {
      return;
    }
    if (!shouldOpenOnboarding) {
      localLaunchDecisionResolvedRef.current = true;
      setOnboardingLaunchDecision('main');
      return;
    }
    const launchStatus = appLaunchStateStorage.getStatus();
    if (launchStatus === 'completed') {
      localLaunchDecisionResolvedRef.current = true;
      setOnboardingLaunchDecision('main');
      return;
    }
    if (launchStatus === 'onboardingPending') {
      localLaunchDecisionResolvedRef.current = true;
      setOnboardingLaunchDecision('onboarding');
      void toOnBoardingPage();
      return;
    }
    if (!platformEnv.isNative || platformEnv.isNativeIOS) {
      localLaunchDecisionResolvedRef.current = true;
      setOnboardingLaunchDecision('main');
    }
  }, [shouldOpenOnboarding, toOnBoardingPage]);

  const handleRouterChange = useCallback(
    (state: INavigationStateLike | undefined) => {
      if (platformEnv.isNative) {
        syncOnboardingLaunchForegroundFromNavigationState(state);
      }
    },
    [],
  );
  useOnRouterChange(handleRouterChange);

  const migrateBaseSettings = useCallback(async () => {
    const shouldMigrateFromV4: boolean =
      await backgroundApiProxy.serviceV4Migration.checkShouldMigrateV4OnMount();
    if (shouldMigrateFromV4) {
      if (!isBaseSettingsMigrated) {
        isBaseSettingsMigrated = true;
        await backgroundApiProxy.serviceV4Migration.migrateBaseSettings();
      }
    }
  }, []);

  const checkOnboardingStateForOtherPlatforms = useCallback(
    async ({ checkingV4Migration }: { checkingV4Migration?: boolean } = {}) => {
      // if (!isFocused) {
      //   return;
      // }

      // console.log('OnboardingOnMount: call checkOnboardingState');

      try {
        if (checkingV4Migration) {
          const shouldMigrateFromV4: boolean =
            await backgroundApiProxy.serviceV4Migration.checkShouldMigrateV4OnMount();
          if (shouldMigrateFromV4) {
            await migrateBaseSettings();
            await timerUtils.wait(600);
            if (!isAutoStartV4MigrationShown) {
              isAutoStartV4MigrationShown = true;
              await v4migrationActions.navigateToV4MigrationPage({
                isAutoStartOnMount: true,
              });
              const now = Date.now();
              if (now - lastAutoStartV4MigrationTime > 3000) {
                lastAutoStartV4MigrationTime = now;
                setV4MigrationPersistAtom((v) => ({
                  ...v,
                  v4migrationAutoStartCount:
                    (v.v4migrationAutoStartCount || 0) + 1,
                }));
              }
            }
            return;
          }
        }
      } catch (_error) {
        //
      }

      if (isOnboardingFromExtensionUrl()) {
        return;
      }
      if (
        platformEnv.isDesktop &&
        (platformEnv.isE2E || process.env.DESKTOP_E2E_MODE === 'true')
      ) {
        return;
      }
      const { isOnboardingDone } =
        await backgroundApiProxy.serviceOnboarding.isOnboardingDone();
      if (isOnboardingDone) {
        nativeV4MigrationRouteRef.current = false;
        appLaunchStateStorage.markOnboardingCompleted();
        setOnboardingLaunchDecision('main');
        return;
      }
      if (nativeV4MigrationRouteRef.current) {
        return;
      }
      // Dapp mode auto onboarding conflicts with URL account landing pages.
      if (!platformEnv.isWebDappMode && !platformEnv.isExtensionUiSidePanel) {
        appLaunchStateStorage.markOnboardingPending();
        await toOnBoardingPage();
        setOnboardingLaunchDecision('onboarding');
      }
    },
    [
      migrateBaseSettings,
      setV4MigrationPersistAtom,
      toOnBoardingPage,
      v4migrationActions,
    ],
  );

  const checkStateOnMount = useCallback(async () => {
    if (platformEnv.isDesktop && !downgradeWarningConfirmedRef.current) {
      const isV4DbExist =
        await backgroundApiProxy.serviceV4Migration.checkIfV4DbExist();
      if (isV4DbExist && !downgradeConfirmDialogShown) {
        downgradeConfirmDialogShown = true;
        downgradeWarningConfirmedRef.current = true;
        await migrateBaseSettings();
        await timerUtils.wait(600);
        const dialog = Dialog.show({
          tone: 'warning',
          icon: 'ShieldCheckDoneOutline',
          showExitButton: false,
          // TODO disable gesture close
          showCancelButton: false,
          dismissOnOverlayPress: false,
          renderContent: (
            <DowngradeWarningDialogContent
              onConfirm={() => {
                setV4MigrationPersistAtom((v) => ({
                  ...v,
                  downgradeWarningConfirmed: true,
                }));
                void checkOnboardingStateForOtherPlatforms({
                  checkingV4Migration: true,
                });
                void dialog.close();
              }}
            />
          ),
        });
        return;
      }
    }

    await checkOnboardingStateForOtherPlatforms({ checkingV4Migration: true });
  }, [
    checkOnboardingStateForOtherPlatforms,
    migrateBaseSettings,
    setV4MigrationPersistAtom,
  ]);

  useEffect(() => {
    // console.log('OnboardingOnMountOnMount');
  }, []);

  useEffect(() => {
    // console.log('OnboardingOnMount changed: setV4MigrationPersistAtom changed');
  }, [setV4MigrationPersistAtom]);

  useEffect(() => {
    // console.log('OnboardingOnMount changed: v4migrationActions changed');
  }, [v4migrationActions]);

  useEffect(() => {
    let disposed = false;
    let maintenanceTimer: ReturnType<typeof setTimeout> | undefined;
    const resolveLocalLaunch = async () => {
      const installation = await reconcileAppInstallation();
      if (disposed) {
        return false;
      }
      const launchStatus = appLaunchStateStorage.getStatus();
      if (
        installation.classification === 'freshInstall' &&
        shouldOpenOnboarding
      ) {
        appLaunchStateStorage.markOnboardingPending(
          installation.installationTime,
        );
        localLaunchDecisionResolvedRef.current = true;
        setOnboardingLaunchDecision('onboarding');
        void toOnBoardingPage();
        return false;
      }
      if (launchStatus === 'onboardingPending') {
        return true;
      }
      if (launchStatus === 'completed') {
        setOnboardingLaunchDecision('main');
        return true;
      }
      localLaunchDecisionResolvedRef.current = true;
      setOnboardingLaunchDecision('main');
      return true;
    };

    if (!platformEnv.isNative) {
      void resolveLocalLaunch().then((shouldValidate) => {
        if (!disposed && shouldValidate) {
          maintenanceTimer = setTimeout(() => {
            void checkStateOnMount();
          }, 0);
        }
      });
      const handleWalletClear = () => {
        void checkOnboardingStateForOtherPlatforms({
          checkingV4Migration: false,
        });
      };
      const handleWalletUpdate = () => {
        void checkOnboardingStateForOtherPlatforms({
          checkingV4Migration: false,
        });
      };
      appEventBus.on(EAppEventBusNames.WalletClear, handleWalletClear);
      appEventBus.on(EAppEventBusNames.WalletUpdate, handleWalletUpdate);
      return () => {
        disposed = true;
        if (maintenanceTimer) {
          clearTimeout(maintenanceTimer);
        }
        appEventBus.off(EAppEventBusNames.WalletClear, handleWalletClear);
        appEventBus.off(EAppEventBusNames.WalletUpdate, handleWalletUpdate);
      };
    }

    const applyMaintenanceVerdict = async (
      isOnboardingDone: boolean,
      request: { isCurrent: () => boolean },
    ) => {
      if (!request.isCurrent()) {
        return;
      }
      if (isOnboardingDone) {
        nativeV4MigrationRouteRef.current = false;
        appLaunchStateStorage.markOnboardingCompleted();
        setOnboardingLaunchDecision('main');
        return;
      }
      if (nativeV4MigrationRouteRef.current) {
        return;
      }
      if (!shouldOpenOnboarding) {
        setOnboardingLaunchDecision('main');
        return;
      }
      appLaunchStateStorage.markOnboardingPending();
      await toOnBoardingPage();
      if (request.isCurrent()) {
        setOnboardingLaunchDecision('onboarding');
      }
    };
    const coordinator = createOnboardingLaunchRequestCoordinator({
      readVerdict: async () => {
        if (!nativeV4MigrationCheckedRef.current) {
          const shouldMigrateFromV4 =
            await backgroundApiProxy.serviceV4Migration.checkShouldMigrateV4OnMount();
          if (shouldMigrateFromV4) {
            await migrateBaseSettings();
            await timerUtils.wait(600);
            if (!isAutoStartV4MigrationShown) {
              isAutoStartV4MigrationShown = true;
              await v4migrationActions.navigateToV4MigrationPage({
                isAutoStartOnMount: true,
              });
            }
            nativeV4MigrationRouteRef.current = true;
          }
          nativeV4MigrationCheckedRef.current = true;
        }
        const { isOnboardingDone } =
          await backgroundApiProxy.serviceOnboarding.isOnboardingDone();
        return isOnboardingDone;
      },
      onAuthoritativeStart: () => undefined,
      onAuthoritativeVerdict: applyMaintenanceVerdict,
      onMaintenanceVerdict: applyMaintenanceVerdict,
    });

    void resolveLocalLaunch().then((shouldValidate) => {
      if (!disposed && shouldValidate) {
        maintenanceTimer = setTimeout(() => {
          void coordinator.enqueueMaintenance();
        }, 0);
      }
    });
    const handleWalletClear = () => {
      void coordinator.enqueueMaintenance();
    };
    const handleWalletUpdate = () => {
      void coordinator.enqueueMaintenance();
    };
    appEventBus.on(EAppEventBusNames.WalletClear, handleWalletClear);
    appEventBus.on(EAppEventBusNames.WalletUpdate, handleWalletUpdate);
    return () => {
      disposed = true;
      if (maintenanceTimer) {
        clearTimeout(maintenanceTimer);
      }
      coordinator.dispose();
      appEventBus.off(EAppEventBusNames.WalletClear, handleWalletClear);
      appEventBus.off(EAppEventBusNames.WalletUpdate, handleWalletUpdate);
    };
  }, [
    checkOnboardingStateForOtherPlatforms,
    checkStateOnMount,
    migrateBaseSettings,
    shouldOpenOnboarding,
    toOnBoardingPage,
    v4migrationActions,
  ]);

  return null;
}

export const OnboardingOnMount = memo(OnboardingOnMountCmp);
