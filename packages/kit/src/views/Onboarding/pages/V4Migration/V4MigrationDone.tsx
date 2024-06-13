import { useState } from 'react';

import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Button,
  Icon,
  Page,
  ScrollView,
  SizableText,
  Stack,
  usePreventRemove,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  type EOnboardingPages,
  ERootRoutes,
  ETabRoutes,
  type IOnboardingParamList,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export function V4MigrationDone({
  route,
}: IPageScreenProps<IOnboardingParamList, EOnboardingPages.GetStarted>) {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const [preventClose, setPreventClose] = useState(true);
  usePreventRemove(preventClose, () => null);

  return (
    <Page>
      <Page.Header headerShown={false} />
      <Page.Body>
        <ScrollView>
          <Stack py="$4" alignItems="center" justifyContent="center">
            <Icon name="CheckRadioOutline" />
            <SizableText textAlign="center" size="$heading3xl">
              Migration completed
            </SizableText>
            <SizableText textAlign="center">
              You are all set to explore our new features and improvements.
            </SizableText>
            <Button
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
              Explore now
            </Button>
          </Stack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

export default V4MigrationDone;
