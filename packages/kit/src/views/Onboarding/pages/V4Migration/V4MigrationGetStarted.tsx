import { useState } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps, IPageScreenProps } from '@onekeyhq/components';
import {
  Button,
  Heading,
  Image,
  LinearGradient,
  Page,
  SizableText,
  Stack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

import { V4MigrationLogCopy } from './components/V4MigrationLogCopy';
import { V4MigrationModalPage } from './components/V4MigrationModalPage';

export function V4MigrationGetStarted({
  route,
}: IPageScreenProps<
  IOnboardingParamList,
  EOnboardingPages.V4MigrationGetStarted
>) {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const isAutoStartOnMount = route?.params?.isAutoStartOnMount;

  const [isLoading, setIsLoading] = useState(false);

  const handleNavigateToV4MigrationPreview = async () => {
    try {
      setIsLoading(true);
      const res =
        await backgroundApiProxy.serviceV4Migration.prepareMigration();
      if (res.shouldBackup) {
        navigation.push(EOnboardingPages.V4MigrationPreview);
      } else {
        // navigate to process page directly
        navigation.push(EOnboardingPages.V4MigrationProcess);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <V4MigrationModalPage
      onMounted={() => {
        void backgroundApiProxy.serviceV4Migration.clearV4MigrationLogs();
      }}
      isAutoStartOnMount={isAutoStartOnMount}
    >
      <Page.Header headerShown={false} />
      <Page.Body flex={1} justifyContent="center" alignItems="center">
        <V4MigrationLogCopy>
          <Image
            w={360}
            h={360}
            source={require('@onekeyhq/kit/assets/logo-press.png')}
          />
        </V4MigrationLogCopy>
        <Stack p="$5" pb="$0" mt="$-16" maxWidth="$96">
          <LinearGradient
            position="absolute"
            top="$0"
            left="$0"
            right="$0"
            bottom="$0"
            colors={['transparent', '$bgApp']}
            $platform-native={{
              display: 'none',
            }}
          />
          <Stack zIndex={1}>
            <Heading size="$heading4xl" textAlign="center">
              {intl.formatMessage({
                id: ETranslations.v4_migration_welcome_message,
              })}
            </Heading>
            <SizableText
              mt="$3"
              size="$bodyLg"
              textAlign="center"
              color="$textSubdued"
            >
              {intl.formatMessage({
                id: ETranslations.v4_migration_welcome_message_desc,
              })}
            </SizableText>
          </Stack>
        </Stack>
        <Button
          mt="$8"
          size="large"
          $gtMd={
            {
              size: 'medium',
            } as IButtonProps
          }
          variant="primary"
          loading={isLoading}
          onPress={handleNavigateToV4MigrationPreview}
        >
          {intl.formatMessage({ id: ETranslations.global_start_migration })}
        </Button>
      </Page.Body>
    </V4MigrationModalPage>
  );
}

export default V4MigrationGetStarted;
