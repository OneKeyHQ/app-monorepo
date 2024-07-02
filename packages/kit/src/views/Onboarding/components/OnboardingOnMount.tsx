import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox, Dialog, YStack } from '@onekeyhq/components';
import { useV4migrationPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useV4MigrationActions } from '../pages/V4Migration/hooks/useV4MigrationActions';

let lastAutoStartV4MigrationTime = 0;
let isBaseSettingsMigrated = false;

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
      <Checkbox
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

let downgradeConfirmDialogShown = false;

function OnboardingOnMountCmp() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const v4migrationActions = useV4MigrationActions();
  const [v4migrationPersistData, setV4MigrationPersistAtom] =
    useV4migrationPersistAtom();
  const downgradeWarningConfirmed =
    v4migrationPersistData?.downgradeWarningConfirmed;
  const downgradeWarningConfirmedRef = useRef(downgradeWarningConfirmed);
  downgradeWarningConfirmedRef.current = downgradeWarningConfirmed;

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
            if (!isBaseSettingsMigrated) {
              isBaseSettingsMigrated = true;
              await backgroundApiProxy.serviceV4Migration.migrateBaseSettings();
            }
            await timerUtils.wait(600);
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

  const checkStateOnMount = useCallback(async () => {
    if (platformEnv.isDesktop && !downgradeWarningConfirmedRef.current) {
      const isV4DbExist =
        await backgroundApiProxy.serviceV4Migration.checkIfV4DbExist();
      if (isV4DbExist && !downgradeConfirmDialogShown) {
        downgradeConfirmDialogShown = true;
        const dialog = Dialog.show({
          tone: 'warning',
          icon: 'ShieldCheckDoneOutline',
          showExitButton: false,
          // TODO disable gesture close
          showCancelButton: false,
          dismissOnOverlayPress: false,
          title: intl.formatMessage({
            id: ETranslations.downgrade_warning_title,
          }),
          description: intl.formatMessage({
            id: ETranslations.downgrade_warning_description,
          }),
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
  }, [checkOnboardingState, intl, setV4MigrationPersistAtom]);

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
    console.log('OnboardingOnMount: checkStateOnMount on mount');
    void checkStateOnMount();
  }, [checkStateOnMount]);

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
