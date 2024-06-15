import { useState } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import {
  Button,
  Icon,
  Page,
  SizableText,
  usePreventRemove,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export function V4MigrationDone() {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const [preventClose, setPreventClose] = useState(true);
  usePreventRemove(preventClose, () => null);

  return (
    <Page>
      <Page.Header headerShown={false} />
      <Page.Body
        flex={1}
        justifyContent="center"
        alignItems="center"
        space="$5"
      >
        <Icon
          name="CheckRadioSolid"
          size="$24"
          $gtMd={{
            size: '$20',
          }}
          color="$iconSuccess"
        />
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
          }}
        >
          {intl.formatMessage({ id: ETranslations.global_explore_now })}
        </Button>
      </Page.Body>
    </Page>
  );
}

export default V4MigrationDone;
