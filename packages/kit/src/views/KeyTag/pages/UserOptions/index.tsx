import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { ImageBackground } from 'react-native';

import {
  Button,
  Icon,
  Page,
  SizableText,
  Stack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ONEKEY_KEY_TAG_PURCHASE_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalKeyTagRoutes,
  EModalRoutes,
  EOnboardingPages,
} from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

const UserOptions = () => {
  const md = useMedia();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const onBackup = useCallback(() => {
    navigation.pushModal(EModalRoutes.KeyTagModal, {
      screen: EModalKeyTagRoutes.BackupWallet,
    });
  }, [navigation]);
  const onImport = useCallback(async () => {
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ImportKeyTag,
    });
  }, [navigation]);
  const onGetOne = useCallback(() => {
    openUrlExternal(ONEKEY_KEY_TAG_PURCHASE_URL);
  }, []);
  return (
    <Page>
      <Page.Header title="OneKey KeyTag" />
      <Page.Body>
        <Stack mx="$5" mt="$2" mb="$5" borderRadius="$3">
          <Stack borderRadius={12} overflow="hidden">
            <ImageBackground
              resizeMode="stretch"
              source={
                md.md
                  ? require('@onekeyhq/kit/assets/keytag/keytag_banner1.png')
                  : require('@onekeyhq/kit/assets/keytag/keytag_banner0.png')
              }
            >
              <Stack px="$5" pt="$9" pb="$6">
                <SizableText size="$headingXl" color="rgba(0, 0, 0, 0.95)">
                  {intl.formatMessage({
                    id: ETranslations.global_onekey_keytag,
                  })}
                </SizableText>
                <SizableText size="$bodyMd" color="rgba(0, 0, 0, 0.6)" pr={130}>
                  {intl.formatMessage({
                    id: ETranslations.settings_onekey_keytag_desc,
                  })}
                </SizableText>
                <Button
                  bg="rgba(0, 0, 0, 0.95)"
                  mt="$6"
                  alignSelf="flex-start"
                  size="small"
                  color="white"
                  iconAfter="OpenOutline"
                  iconColor="white"
                  focusStyle={{ bg: 'rgba(0, 0, 0, 0.75)' }}
                  hoverStyle={{ bg: 'rgba(0, 0, 0, 0.75)' }}
                  onPress={onGetOne}
                >
                  {intl.formatMessage({ id: ETranslations.global_get_one })}
                </Button>
              </Stack>
            </ImageBackground>
          </Stack>
        </Stack>
        <YStack>
          <ListItem
            icon="FolderUploadOutline"
            title={intl.formatMessage({ id: ETranslations.global_backup })}
            subtitle={intl.formatMessage({
              id: ETranslations.settings_backup_recovery_phrase_to_onekey_keytag,
            })}
            drillIn
            onPress={onBackup}
            renderIcon={
              <Stack bg="$bgStrong" p="$2" borderRadius="$3">
                <Icon name="FolderUploadOutline" size="$6" color="$icon" />
              </Stack>
            }
          />
          <ListItem
            icon="FolderDownloadOutline"
            title={intl.formatMessage({ id: ETranslations.global_import })}
            subtitle={intl.formatMessage({
              id: ETranslations.settings_import_recovery_phrase_from_onekey_keytag,
            })}
            onPress={onImport}
            renderIcon={
              <Stack bg="$bgStrong" p="$2" borderRadius="$3">
                <Icon name="FolderDownloadOutline" size="$6" color="$icon" />
              </Stack>
            }
          />
        </YStack>
      </Page.Body>
    </Page>
  );
};

export default UserOptions;
