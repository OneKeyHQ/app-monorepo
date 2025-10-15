import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Anchor,
  Button,
  Form,
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

import InfoBlock from './InfoBlock';
import MainInfoBlock from './MainBlock';

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

  // TODO fix help link
  const referralHelpLink = useHelpLink({ path: 'articles/11461265' });
  const securityFeaturesLink = useHelpLink({ path: 'articles/11829439' });
  const sendAndReceiveLink = useHelpLink({ path: 'articles/11829440' });
  const swapAndBridgeLink = useHelpLink({ path: 'articles/11829441' });

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
    <Stack flexDirection="column" gap="$10" px="$5" pb="$6">
      <Stack flexDirection="column" $gtMd={{ flexDirection: 'row' }} gap="$5">
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
      <YStack gap="$3">
        <SizableText size="$headingXs" textTransform="uppercase">
          Learn
        </SizableText>
        <Stack
          flexDirection="column"
          gap="$5"
          $gtMd={{
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <InfoBlock
            iconProps={{ name: 'ShieldCheckDoneOutline' }}
            title="Security Features of OneKey App"
            url={securityFeaturesLink}
          />
          <InfoBlock
            iconProps={{ name: 'CoinsAddOutline' }}
            title="Send and receive cryptos"
            url={sendAndReceiveLink}
          />
          <InfoBlock
            iconProps={{ name: 'TradeOutline' }}
            title="Swap and bridge cryptos"
            url={swapAndBridgeLink}
          />
        </Stack>
      </YStack>
    </Stack>
  );
}

export default memo(NotBackedUp);
