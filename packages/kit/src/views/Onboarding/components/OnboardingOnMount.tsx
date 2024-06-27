import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox, Dialog, SizableText, YStack } from '@onekeyhq/components';
import { useV4migrationPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useV4MigrationActions } from '../pages/V4Migration/hooks/useV4MigrationActions';

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
      <SizableText>
        {intl.formatMessage({
          id: 'downgrade_warning_description',
        })}
      </SizableText>
      <Checkbox
        value={checkState}
        label={intl.formatMessage({
          id: 'downgrade_warning_checkbox_label',
        })}
        onChange={setCheckState}
      />
      <Dialog.Footer
        confirmButtonProps={{
          disabled: !checkState,
        }}
        onConfirm={handleConfirm}
        onConfirmText={intl.formatMessage({
          id: 'global_continue',
        })}
        showCancelButton={false}
      />
    </YStack>
  );
}

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

  const checkStateOnMount = useCallback(async () => {
    if (!downgradeWarningConfirmedRef.current && platformEnv.isDesktop) {
      const dialog = Dialog.show({
        tone: 'warning',
        icon: 'ShieldCheckDone', // ShieldCheckDone
        showExitButton: false,
        // TODO disable gesture close
        showCancelButton: false,
        dismissOnOverlayPress: false,
        title: intl.formatMessage({ id: 'downgrade_warning_title' }),
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
