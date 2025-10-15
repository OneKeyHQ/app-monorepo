import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type {
  IIconProps,
  IStackProps,
  IYStackProps,
} from '@onekeyhq/components';
import {
  Anchor,
  Button,
  Form,
  Icon,
  Input,
  SizableText,
  Stack,
  XStack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import { WalletBackupActions } from '@onekeyhq/kit/src/components/WalletBackup';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type IProps = {
  title: string;
  actions: React.ReactNode;
  containerProps?: IYStackProps;
  iconContainerProps?: IStackProps;
  iconProps?: IIconProps;
};

function MainInfoBlock(props: IProps) {
  const { title, actions, containerProps, iconProps, iconContainerProps } =
    props;
  return (
    <YStack
      p="$6"
      justifyContent="space-between"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$4"
      overflow="hidden"
      $platform-web={{
        boxShadow:
          '0 1px 1px 0 rgba(255, 255, 255, 0.25) inset, 0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      }}
      height={285}
      flex={1}
      {...containerProps}
    >
      <YStack gap="$6">
        <XStack>
          <Stack
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderSubdued"
            borderRadius="$2"
            p="$2"
            $platform-web={{
              boxShadow:
                '0 1px 1px 0 rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 4px 6px 0 rgba(0, 0, 0, 0.04), 0 24px 68px 0 rgba(0, 0, 0, 0.05), 0 2px 3px 0 rgba(0, 0, 0, 0.04)',
            }}
            {...iconContainerProps}
          >
            <Icon color="$iconOnColor" size="$6" {...iconProps} />
          </Stack>
        </XStack>
        <SizableText size="$heading2xl" maxWidth={240}>
          {title}
        </SizableText>
      </YStack>
      <Stack>{actions}</Stack>
    </YStack>
  );
}

function NotBackedUp() {
  const intl = useIntl();
  const {
    activeAccount: { wallet },
  } = useActiveAccount({
    num: 0,
  });

  const form = useForm({
    defaultValues: {
      code: '',
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const [isJoiningReferral, setIsJoiningReferral] = useState(false);

  // TODO referral help link
  const referralHelpLink = useHelpLink({ path: 'articles/11461265' });

  const handleBackupWallet = useCallback(() => {
    if (platformEnv.isNativeIOS || platformEnv.isDesktopMac) {
      // TODO backup to iCloud
    }
    if (platformEnv.isNativeAndroid || platformEnv.isDesktopWin) {
      // TODO backup to Google Drive
    }
  }, []);

  const handleJoinReferral = useCallback(() => {
    // TODO join referral
  }, []);

  const backupText = useMemo(() => {
    if (platformEnv.isNativeIOS || platformEnv.isDesktopMac) {
      return 'Backup to iCloud';
    }

    if (platformEnv.isNativeAndroid || platformEnv.isDesktopWin) {
      return 'Backup to Google Drive';
    }

    return intl.formatMessage({ id: ETranslations.backup_backup_now });
  }, [intl]);
  return (
    <Stack>
      <Stack
        flexDirection="column"
        $gtMd={{ flexDirection: 'row' }}
        gap="$5"
        px="$5"
      >
        <MainInfoBlock
          title="Backup your wallet"
          iconProps={{ name: 'ShieldCheckDoneOutline' }}
          iconContainerProps={{ bg: '$brand8' }}
          containerProps={{ bg: '$brand1' }}
          actions={
            <XStack>
              {platformEnv.isNativeIOS ||
              platformEnv.isDesktopMac ||
              platformEnv.isDesktopWin ||
              platformEnv.isNativeAndroid ? (
                <Button
                  variant="primary"
                  size="medium"
                  onPress={handleBackupWallet}
                >
                  {backupText}
                </Button>
              ) : (
                <WalletBackupActions wallet={wallet}>
                  <Button variant="primary" size="medium" onPress={() => {}}>
                    {backupText}
                  </Button>
                </WalletBackupActions>
              )}
            </XStack>
          }
        />
        <MainInfoBlock
          title="Join the OneKey Referral Program"
          iconProps={{ name: 'GiftOutline' }}
          iconContainerProps={{ bg: '$info8' }}
          containerProps={{ bg: '$blue2' }}
          actions={
            <Form form={form}>
              <YStack gap="$6">
                <Anchor
                  href={referralHelpLink}
                  color="$textSubdued"
                  size="$bodyMd"
                  textDecorationLine="underline"
                >
                  How to get a referral code?
                </Anchor>
                <XStack alignItems="center" gap="$2">
                  <Stack flex={1}>
                    <Form.Field name="code" rules={{ required: true }}>
                      <Input
                        size="medium"
                        w="100%"
                        placeholder="Referral code"
                        backgroundColor="$bgApp"
                      />
                    </Form.Field>
                  </Stack>
                  <Button
                    size="medium"
                    variant="secondary"
                    onPress={handleJoinReferral}
                    loading={isJoiningReferral}
                    disabled={
                      form.formState.isSubmitting ||
                      !form.formState.isValid ||
                      isJoiningReferral
                    }
                  >
                    {intl.formatMessage({
                      id: ETranslations.global_join,
                    })}
                  </Button>
                </XStack>
              </YStack>
            </Form>
          }
        />
      </Stack>
    </Stack>
  );
}

export default memo(NotBackedUp);
