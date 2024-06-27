import { useState } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps, IPageScreenProps } from '@onekeyhq/components';
import { Button, Icon, Page, SizableText } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EOnboardingPages,
  IOnboardingParamList,
} from '@onekeyhq/shared/src/routes';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { V4MigrationLogCopy } from './components/V4MigrationLogCopy';
import { V4MigrationModalPage } from './components/V4MigrationModalPage';
import { EModalExitPreventMode } from './hooks/useV4MigrationExitPrevent';

export function V4MigrationDone({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  route,
}: IPageScreenProps<IOnboardingParamList, EOnboardingPages.V4MigrationDone>) {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const [preventClose, setPreventClose] = useState(true);

  return (
    <V4MigrationModalPage
      scrollEnabled={false}
      exitPreventMode={
        preventClose
          ? EModalExitPreventMode.always
          : EModalExitPreventMode.disabled
      }
    >
      <Page.Header headerShown={false} />
      <Page.Body
        flex={1}
        justifyContent="center"
        alignItems="center"
        space="$5"
        p="$5"
      >
        <V4MigrationLogCopy>
          <Icon
            name="CheckRadioSolid"
            size="$24"
            $gtMd={{
              size: '$20',
            }}
            color="$iconSuccess"
          />
        </V4MigrationLogCopy>
        <SizableText textAlign="center" size="$heading2xl">
          {intl.formatMessage({
            id: ETranslations.v4_migration_completed_title,
          })}
        </SizableText>
        <SizableText textAlign="center" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.v4_migration_completed_desc,
          })}
        </SizableText>
        <Button
          size="large"
          $gtMd={
            {
              size: 'medium',
            } as IButtonProps
          }
          variant="primary"
          onPress={async () => {
            setPreventClose(false);
            await timerUtils.wait(300);
            navigation.popStack();
            await timerUtils.wait(300);

            // navigation.dispatch(
            //   StackActions.replace(ETabHomeRoutes.TabHome, undefined),
            // );

            navigation.navigate(ERootRoutes.Main, {
              screen: ETabRoutes.Home,
            });

            setTimeout(() => {
              void backgroundApiProxy.serviceCloudBackup.requestAutoBackup();
            }, 3000);
          }}
        >
          {intl.formatMessage({ id: ETranslations.global_explore_now })}
        </Button>
      </Page.Body>
    </V4MigrationModalPage>
  );
}

export default V4MigrationDone;
