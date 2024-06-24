import { memo, useCallback, useEffect } from 'react';

import { useV4migrationPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useV4MigrationActions } from '../pages/V4Migration/hooks/useV4MigrationActions';

function OnboardingOnMountCmp() {
  const navigation = useAppNavigation();
  const v4migrationActions = useV4MigrationActions();
  const [, setV4MigrationPersistAtom] = useV4migrationPersistAtom();

  const checkOnboardingState = useCallback(
    async ({ checkingV4Migration }: { checkingV4Migration?: boolean } = {}) => {
      // if (!isFocused) {
      //   return;
      // }

      console.log('OnboardingOnMount: call checkOnboardingState');

      try {
        if (checkingV4Migration) {
          const shouldMigrateFromV4: boolean =
            await backgroundApiProxy.serviceV4Migration.checkShouldMigrateV4OnMount();
          if (shouldMigrateFromV4) {
            await timerUtils.wait(600);
            await v4migrationActions.navigateToV4MigrationPage({
              isAutoStartOnMount: true,
            });
            setV4MigrationPersistAtom((v) => ({
              ...v,
              v4migrationAutoStartCount: (v.v4migrationAutoStartCount || 0) + 1,
            }));
            return;
          }
        }
      } catch (error) {
        //
      }

      const { isOnboardingDone } =
        await backgroundApiProxy.serviceOnboarding.isOnboardingDone();
      if (!isOnboardingDone) {
        navigation.pushFullModal(EModalRoutes.OnboardingModal, {
          screen: EOnboardingPages.GetStarted,
        });
      }
    },
    [navigation, setV4MigrationPersistAtom, v4migrationActions],
  );

  useEffect(() => {
    console.log('OnboardingOnMountOnMount');
  }, []);

  useEffect(() => {
    console.log('OnboardingOnMount changed: setV4MigrationPersistAtom changed');
  }, [setV4MigrationPersistAtom]);

  useEffect(() => {
    console.log('OnboardingOnMount changed: navigation changed');
  }, [navigation]);

  useEffect(() => {
    console.log('OnboardingOnMount changed: v4migrationActions changed');
  }, [v4migrationActions]);

  useEffect(() => {
    console.log('OnboardingOnMount: checkOnboardingState on mount');
    void checkOnboardingState({ checkingV4Migration: true });
  }, [checkOnboardingState]);

  useEffect(() => {
    console.log('OnboardingOnMount: checkOnboardingState on appEventBus');
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
