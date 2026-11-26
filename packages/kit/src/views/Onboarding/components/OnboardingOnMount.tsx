import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ICheckedState } from '@onekeyhq/components';
import {
  Checkbox,
  Dialog,
  YStack,
  resetAboveMainRoute,
  rootNavigationRef,
  useSplitMainView,
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
  EModalRoutes,
  EOnboardingPagesV2,
  ERootRoutes,
  ETabHomeRoutes,
  ETabMarketRoutes,
} from '@onekeyhq/shared/src/routes';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  isColdStartOnboardingRoute,
  useColdStart,
} from '../../../routes/config/coldStartOnboardingState';
import { EModalMarketRoutes } from '../../Market/router/types';
import { useV4MigrationActions } from '../pages/V4Migration/hooks/useV4MigrationActions';

let lastAutoStartV4MigrationTime = 0;
let isBaseSettingsMigrated = false;
let downgradeConfirmDialogShown = false;
let isAutoStartV4MigrationShown = false;

function isOnboardingRouteOnTop() {
  const rootState = rootNavigationRef.current?.getRootState();
  return (
    rootState?.routes[rootState.index ?? 0]?.name === ERootRoutes.Onboarding
  );
}
function isNativeBackgroundReady() {
  const runtime = globalThis as typeof globalThis & {
    __onekeyBackgroundThreadReadyPayload?: unknown;
  };
  return Boolean(runtime.__onekeyBackgroundThreadReadyPayload);
}

function getInitialWalletScreenKey() {
  const navigation = rootNavigationRef.current;
  const state = navigation?.getRootState();
  const root = state?.routes[state.index ?? 0];
  const screen = navigation?.getCurrentRoute();
  return root?.name === ERootRoutes.Main &&
    screen?.name === ETabHomeRoutes.TabHome
    ? screen.key
    : undefined;
}

function getUntouchedColdStartOnboardingKey() {
  const navigation = rootNavigationRef.current;
  const state = navigation?.getRootState();
  const root = state?.routes[state.index ?? 0];
  const screen = navigation?.getCurrentRoute();
  return isColdStartOnboardingRoute(root) &&
    screen?.name === EOnboardingPagesV2.GetStarted
    ? screen.key
    : undefined;
}

const publicMarketRoutes = new Set<string>([
  EModalMarketRoutes.MarketWidgetEditor,
  EModalMarketRoutes.MarketWidgetList,
  ETabMarketRoutes.TabMarket,
  ETabMarketRoutes.MarketDetailV2,
  ETabMarketRoutes.MarketStockDetail,
  ETabMarketRoutes.MarketNativeDetail,
]);

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
  const navigation = useAppNavigation();
  const isSplitMainView = useSplitMainView();
  const startup = useColdStart();
  const coldStart = startup?.state;
  const claimReconciliation = startup?.claimReconciliation;
  const coldStartEntry =
    coldStart?.phase === 'ready' ? coldStart.entry : undefined;
  const v4migrationActions = useV4MigrationActions();
  const [v4migrationPersistData, setV4MigrationPersistAtom] =
    useV4migrationPersistAtom();
  const downgradeWarningConfirmed =
    v4migrationPersistData?.downgradeWarningConfirmed;
  const downgradeWarningConfirmedRef = useRef(downgradeWarningConfirmed);
  downgradeWarningConfirmedRef.current = downgradeWarningConfirmed;

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

  const checkOnboardingState = useCallback(
    async ({
      checkingV4Migration,
      coldStartOnboardingKey,
      initialWalletScreenKey,
    }: {
      checkingV4Migration?: boolean;
      coldStartOnboardingKey?: string;
      initialWalletScreenKey?: string;
    } = {}) => {
      // if (!isFocused) {
      //   return;
      // }

      if (
        travelModeManager.getRuntimeEnvironmentSync().profile.kind ===
        'travel-mode'
      ) {
        return;
      }

      const canApplyLateStartupResult = () =>
        !initialWalletScreenKey ||
        getInitialWalletScreenKey() === initialWalletScreenKey;

      try {
        if (checkingV4Migration) {
          const shouldMigrateFromV4: boolean =
            await backgroundApiProxy.serviceV4Migration.checkShouldMigrateV4OnMount();
          if (shouldMigrateFromV4) {
            if (!canApplyLateStartupResult()) return;
            await migrateBaseSettings();
            await timerUtils.wait(600);
            if (!canApplyLateStartupResult()) return;
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
        // Continue with the usual onboarding check if migration did not start.
      }

      if (!canApplyLateStartupResult() || isOnboardingFromExtensionUrl()) {
        return;
      }
      if (
        platformEnv.isDesktop &&
        (platformEnv.isE2E || process.env.DESKTOP_E2E_MODE === 'true')
      ) {
        return;
      }
      if (
        coldStartOnboardingKey &&
        getUntouchedColdStartOnboardingKey() !== coldStartOnboardingKey
      ) {
        return;
      }
      const { isOnboardingDone } =
        await backgroundApiProxy.serviceOnboarding.isOnboardingDone();
      if (!canApplyLateStartupResult()) return;
      if (coldStartOnboardingKey) {
        if (
          isOnboardingDone &&
          getUntouchedColdStartOnboardingKey() === coldStartOnboardingKey
        ) {
          resetAboveMainRoute();
        }
        return;
      }

      // dapp mode auto onboarding is conflict with url account landing page
      if (
        !isOnboardingDone &&
        !platformEnv.isWebDappMode &&
        !platformEnv.isExtensionUiSidePanel
      ) {
        if (platformEnv.isNative && checkingV4Migration) {
          // A cold widget link may navigate while the startup status is pending.
          const route = rootNavigationRef.current?.getCurrentRoute();
          let pendingMarketParams: unknown;
          if (
            route?.name === ERootRoutes.Modal &&
            route.params &&
            'screen' in route.params &&
            route.params.screen === EModalRoutes.MarketModal &&
            'params' in route.params
          ) {
            pendingMarketParams = route.params.params;
          } else if (route?.name === EModalRoutes.MarketModal) {
            pendingMarketParams = route.params;
          }
          // The focused modal's lazy child may not have mounted a route yet.
          const pendingWidgetEditor =
            pendingMarketParams !== null &&
            typeof pendingMarketParams === 'object' &&
            'screen' in pendingMarketParams &&
            (pendingMarketParams.screen ===
              EModalMarketRoutes.MarketWidgetEditor ||
              pendingMarketParams.screen ===
                EModalMarketRoutes.MarketWidgetList);
          if (
            (route && publicMarketRoutes.has(route.name)) ||
            pendingWidgetEditor
          ) {
            return;
          }
        }
        // Read the active route after the check: native may have cold-started
        // on GetStarted and the browser may restore onboarding, while wallet
        // clear may leave an inactive entry.
        if (isOnboardingRouteOnTop()) {
          return;
        }
        // Automatic entry replaces Main without the slide-in, so the Wallet
        // page is not shown sliding away (OK-46368).
        void toOnBoardingPage({ disableAnimation: true });
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
                void checkOnboardingState({ checkingV4Migration: true });
                void dialog.close();
              }}
            />
          ),
        });
        return;
      }
    }

    await checkOnboardingState({ checkingV4Migration: true });
  }, [checkOnboardingState, migrateBaseSettings, setV4MigrationPersistAtom]);

  useEffect(() => {
    // console.log('OnboardingOnMountOnMount');
  }, []);

  useEffect(() => {
    // console.log('OnboardingOnMount changed: setV4MigrationPersistAtom changed');
  }, [setV4MigrationPersistAtom]);

  useEffect(() => {
    // console.log('OnboardingOnMount changed: navigation changed');
  }, [navigation]);

  useEffect(() => {
    // console.log('OnboardingOnMount changed: v4migrationActions changed');
  }, [v4migrationActions]);

  useEffect(() => {
    if (!platformEnv.isNative || !coldStart) {
      void checkStateOnMount();
      return;
    }
    if (
      isSplitMainView ||
      (coldStartEntry !== 'wallet' && coldStartEntry !== 'onboarding')
    ) {
      return;
    }

    const run = () => {
      if (!claimReconciliation?.()) {
        return;
      }
      const coldStartOnboardingKey =
        coldStartEntry === 'onboarding'
          ? getUntouchedColdStartOnboardingKey()
          : undefined;
      if (coldStartEntry === 'onboarding' && !coldStartOnboardingKey) {
        return;
      }

      const isLateOrdinaryLaunch =
        coldStart.phase === 'ready' && coldStart.lateOrdinaryLaunch;
      const initialWalletScreenKey = isLateOrdinaryLaunch
        ? getInitialWalletScreenKey()
        : undefined;
      if (isLateOrdinaryLaunch && !initialWalletScreenKey) return;

      // Preserve migration-first behavior inside onboarding, after reveal.
      void checkOnboardingState({
        checkingV4Migration: true,
        coldStartOnboardingKey,
        initialWalletScreenKey,
      }).catch(() => undefined);
    };

    if (!platformEnv.enableNativeBackgroundThread) {
      run();
      return;
    }

    // Neither the first frame nor the background runtime waits on this check.
    const afterReveal = requestAnimationFrame(() => {
      appEventBus.on(EAppEventBusNames.BackgroundThreadReady, run);
      if (isNativeBackgroundReady()) {
        run();
      }
    });
    return () => {
      cancelAnimationFrame(afterReveal);
      appEventBus.off(EAppEventBusNames.BackgroundThreadReady, run);
    };
  }, [
    checkOnboardingState,
    checkStateOnMount,
    claimReconciliation,
    coldStart,
    coldStartEntry,
    isSplitMainView,
  ]);

  useEffect(() => {
    // console.log('OnboardingOnMount: checkOnboardingState on appEventBus');
    const fn = () => {
      void checkOnboardingState({ checkingV4Migration: false });
    };
    appEventBus.on(EAppEventBusNames.WalletClear, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletClear, fn);
    };
  }, [checkOnboardingState]);

  return null;
}

export const OnboardingOnMount = memo(OnboardingOnMountCmp);
