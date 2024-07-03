import { useState } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps, IPageScreenProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Heading,
  IconButton,
  Image,
  Input,
  LinearGradient,
  Page,
  SizableText,
  Stack,
  Toast,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

import { V4MigrationLogCopy } from './components/V4MigrationLogCopy';
import { V4MigrationModalPage } from './components/V4MigrationModalPage';
import { useIsV4MigrationAutoStartFirstTime } from './hooks/useV4MigrationExitPrevent';

export function V4MigrationGetStarted({
  route,
}: IPageScreenProps<
  IOnboardingParamList,
  EOnboardingPages.V4MigrationGetStarted
>) {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const isAutoStartOnMount = Boolean(route?.params?.isAutoStartOnMount);

  const [isLoading, setIsLoading] = useState(false);

  const handleNavigateToV4MigrationPreview = async () => {
    if (platformEnv.isWebDappMode) {
      Toast.message({
        title: 'V4Migration Not supported in web dapp mode',
      });
      throw new Error('V4Migration Not supported in web dapp mode');
    }
    try {
      setIsLoading(true);
      const res = await backgroundApiProxy.serviceV4Migration.prepareMigration({
        isAutoStartOnMount,
      });
      console.log('prepareMigration result', res);
      const goNext = () => {
        if (res.shouldBackup) {
          navigation.push(EOnboardingPages.V4MigrationPreview);
        } else {
          // navigate to process page directly
          navigation.push(EOnboardingPages.V4MigrationProcess);
        }
        setIsLoading(false);
      };

      if (!res.isV4PasswordEqualToV5) {
        setTimeout(() => {
          setIsLoading(true);
        }, 600);
        let v4password = '';
        Dialog.show({
          showCancelButton: true,
          onClose: () => {
            setIsLoading(false);
          },
          onConfirm: async () => {
            if (
              await backgroundApiProxy.serviceV4Migration.setV4Password({
                v4password:
                  await backgroundApiProxy.servicePassword.encodeSensitiveText({
                    text: v4password,
                  }),
              })
            ) {
              goNext();
            } else {
              setIsLoading(false);
            }
          },
          title: intl.formatMessage({
            id: ETranslationsMock.v4_migration_input_v4_password,
          }),
          renderContent: (
            <Stack>
              <SizableText>
                {intl.formatMessage({
                  id: ETranslationsMock.v4_migration_input_v4_password_desc,
                })}
              </SizableText>
              <Stack mt="$4">
                <Input
                  secureTextEntry
                  onChangeText={(v) => {
                    v4password = v;
                  }}
                />
              </Stack>
            </Stack>
          ),
        });
        return;
      }
      goNext();
    } finally {
      setIsLoading(false);
    }
  };

  const isAutoStartInFirstTime = useIsV4MigrationAutoStartFirstTime();

  let showCloseButton = true;
  if (isAutoStartOnMount && isAutoStartInFirstTime) {
    showCloseButton = false;
  }

  return (
    <V4MigrationModalPage
      scrollEnabled={false}
      onMounted={() => {
        void backgroundApiProxy.serviceV4Migration.clearV4MigrationLogs();
        void backgroundApiProxy.serviceV4Migration.clearV4MigrationPayload();
      }}
      isAutoStartOnMount={isAutoStartOnMount}
    >
      <Page.Header headerShown={false} />
      <Page.Body>
        {showCloseButton ? (
          <Page.Close>
            <IconButton
              icon="CrossedLargeOutline"
              position="absolute"
              variant="tertiary"
              left="$5"
              top="$5"
              zIndex={1}
            />
          </Page.Close>
        ) : null}

        <Stack flex={1} justifyContent="center" alignItems="center">
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
        </Stack>
      </Page.Body>
    </V4MigrationModalPage>
  );
}

export default V4MigrationGetStarted;
