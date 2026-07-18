import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ICheckedState } from '@onekeyhq/components';
import {
  Checkbox,
  Dialog,
  YStack,
  rootNavigationRef,
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
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useV4MigrationActions } from '../pages/V4Migration/hooks/useV4MigrationActions';

import {
  type ILaunchForeground,
  classifyLaunchForeground,
  createOnboardingLaunchRequestCoordinator,
  getOnboardingLaunchDecision,
  resetOnboardingLaunchGate,
  resolveOnboardingLaunchDecision,
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

type INavigationStateLike = Parameters<typeof classifyLaunchForeground>[0];

function OnboardingOnMountCmp() {
  const toOnBoardingPage = useToOnBoardingPage();
  const v4migrationActions = useV4MigrationActions();
  const navigationStateRef = useRef<INavigationStateLike>(undefined);
  const nativeV4MigrationCheckedRef = useRef(false);
  const nativeV4MigrationRouteRef = useRef(false);
  const foregroundWaitersRef = useRef(
    new Set<{
      foreground: ILaunchForeground;
      resolve: (matched: boolean) => void;
    }>(),
  );
  const [v4migrationPersistData, setV4MigrationPersistAtom] =
    useV4migrationPersistAtom();
  const downgradeWarningConfirmed =
    v4migrationPersistData?.downgradeWarningConfirmed;
  const downgradeWarningConfirmedRef = useRef(downgradeWarningConfirmed);
  downgradeWarningConfirmedRef.current = downgradeWarningConfirmed;

  const handleRouterChange = useCallback((state: INavigationStateLike) => {
    navigationStateRef.current = state;
    const foreground = platformEnv.isNative
      ? syncOnboardingLaunchForegroundFromNavigationState(state)
      : classifyLaunchForeground(state);
    foregroundWaitersRef.current.forEach((waiter) => {
      if (waiter.foreground === foreground) {
        foregroundWaitersRef.current.delete(waiter);
        waiter.resolve(true);
      }
    });
  }, []);
  useOnRouterChange(handleRouterChange);

  const waitForForeground = useCallback((foreground: ILaunchForeground) => {
    const currentState =
      navigationStateRef.current ?? rootNavigationRef.current?.getRootState();
    if (classifyLaunchForeground(currentState) === foreground) {
      return Promise.resolve(true);
    }
    return new Promise<boolean>((resolve) => {
      foregroundWaitersRef.current.add({ foreground, resolve });
    });
  }, []);

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
      // Dapp mode auto onboarding conflicts with URL account landing pages.
      if (
        !isOnboardingDone &&
        !platformEnv.isWebDappMode &&
        !platformEnv.isExtensionUiSidePanel
      ) {
        void toOnBoardingPage();
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
    const foregroundWaiters = foregroundWaitersRef.current;
    if (!platformEnv.isNative) {
      void checkStateOnMount();
      const handleWalletClear = () => {
        void checkOnboardingStateForOtherPlatforms({
          checkingV4Migration: false,
        });
      };
      appEventBus.on(EAppEventBusNames.WalletClear, handleWalletClear);
      return () => {
        appEventBus.off(EAppEventBusNames.WalletClear, handleWalletClear);
      };
    }

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
      onAuthoritativeStart: resetOnboardingLaunchGate,
      onAuthoritativeVerdict: async (isOnboardingDone, request) => {
        if (!request.isCurrent()) {
          return;
        }
        if (!isOnboardingDone && nativeV4MigrationRouteRef.current) {
          const didReachOnboarding = await waitForForeground('onboarding');
          if (!request.isCurrent()) {
            return;
          }
          nativeV4MigrationRouteRef.current = false;
          if (didReachOnboarding && request.isCurrent()) {
            setOnboardingLaunchDecision('onboarding');
          }
          return;
        }
        const decision = await resolveOnboardingLaunchDecision({
          isOnboardingDone,
          shouldOpenOnboarding:
            !platformEnv.isWebDappMode && !platformEnv.isExtensionUiSidePanel,
          openOnboarding: async () => {
            if (!request.isCurrent()) {
              return;
            }
            await toOnBoardingPage();
          },
        });
        if (!request.isCurrent()) {
          return;
        }
        if (decision === 'onboarding') {
          const didReachOnboarding = await waitForForeground('onboarding');
          if (!request.isCurrent() || !didReachOnboarding) {
            return;
          }
        }
        if (request.isCurrent()) {
          setOnboardingLaunchDecision(decision);
        }
      },
      onMaintenanceMain: async (request) => {
        if (request.isCurrent() && getOnboardingLaunchDecision() !== 'main') {
          setOnboardingLaunchDecision('main');
        }
      },
    });

    void coordinator.startAuthoritative();
    const handleWalletClear = () => {
      void coordinator.startAuthoritative();
    };
    const handleWalletUpdate = () => {
      void coordinator.enqueueMaintenance();
    };
    appEventBus.on(EAppEventBusNames.WalletClear, handleWalletClear);
    appEventBus.on(EAppEventBusNames.WalletUpdate, handleWalletUpdate);
    return () => {
      coordinator.dispose();
      foregroundWaiters.forEach((waiter) => waiter.resolve(false));
      foregroundWaiters.clear();
      appEventBus.off(EAppEventBusNames.WalletClear, handleWalletClear);
      appEventBus.off(EAppEventBusNames.WalletUpdate, handleWalletUpdate);
    };
  }, [
    checkOnboardingStateForOtherPlatforms,
    checkStateOnMount,
    migrateBaseSettings,
    toOnBoardingPage,
    v4migrationActions,
    waitForForeground,
  ]);

  return null;
}

export const OnboardingOnMount = memo(OnboardingOnMountCmp);
