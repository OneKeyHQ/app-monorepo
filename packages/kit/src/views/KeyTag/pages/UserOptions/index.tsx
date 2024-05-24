import { useCallback } from 'react';

import { ImageBackground } from 'react-native';

import {
  Button,
  Dialog,
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
import {
  EModalKeyTagRoutes,
  EModalRoutes,
  EOnboardingPages,
} from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

const UserOptions = () => {
  const md = useMedia();
  const navigation = useAppNavigation();
  const onBackup = useCallback(() => {
    navigation.pushModal(EModalRoutes.KeyTagModal, {
      screen: EModalKeyTagRoutes.BackupWallet,
    });
  }, [navigation]);
  const onImport = useCallback(() => {
    const dialog = Dialog.show({
      tone: 'warning',
      icon: 'ErrorOutline',
      title: 'Security Alert',
      description:
        "For the safety of your assets, please do not import the recovery phrase of your hardware wallet. Use 'Connect Hardware Wallet' to maintain the highest level of security.",
      renderContent: (
        <Stack>
          <Button
            variant="secondary"
            onPress={async () => {
              await dialog.close();
              await backgroundApiProxy.servicePassword.promptPasswordVerify();
              navigation.pushModal(EModalRoutes.OnboardingModal, {
                screen: EOnboardingPages.ImportKeyTag,
              });
            }}
            testID="acknowledged"
          >
            Acknowledged
          </Button>
        </Stack>
      ),
      showFooter: false,
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
                  OneKey KeyTag
                </SizableText>
                <SizableText size="$bodyMd" color="rgba(0, 0, 0, 0.6)" pr={130}>
                  Powerful wallet backup kit made of titanium alloy
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
                  Buy One
                </Button>
              </Stack>
            </ImageBackground>
          </Stack>
        </Stack>
        <YStack>
          <ListItem
            icon="FolderUploadOutline"
            title="Back up"
            subtitle="Backup your recovery phrase to OneKey KeyTag"
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
            title="Import"
            subtitle="Import recovery phrase from your OneKey KeyTag"
            drillIn
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
