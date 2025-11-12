import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  IconButton,
  Theme,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { WalletBackupActions } from '@onekeyhq/kit/src/components/WalletBackup';
import { useBackUpWallet } from '@onekeyhq/kit/src/hooks/useBackUpWallet';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import InfoBlock from './InfoBlock';
import MainInfoBlock from './MainBlock';
import ReferralCodeBlock from './ReferralCodeBlock';

function NotBackedUp() {
  const intl = useIntl();
  const themeVariant = useThemeVariant();
  const {
    activeAccount: { wallet },
  } = useActiveAccount({
    num: 0,
  });

  const howToDepositLink = useHelpLink({ path: 'articles/11461136' });
  const depositFaqLink = useHelpLink({ path: 'articles/12569147' });
  const swapAndBridgeLink = useHelpLink({ path: 'articles/11461146' });

  const { handleBackUpByCloud, handleBackUpByPhrase, supportCloudBackup } =
    useBackUpWallet({
      walletId: wallet?.id ?? '',
    });

  const handleBackupWallet = useCallback(() => {
    if (supportCloudBackup) {
      void handleBackUpByCloud();
      return;
    }

    void handleBackUpByPhrase();
  }, [handleBackUpByCloud, handleBackUpByPhrase, supportCloudBackup]);

  const backupText = useMemo(() => {
    if (
      platformEnv.isNativeIOS ||
      (platformEnv.isDesktop && platformEnv.isDesktopMac)
    ) {
      return intl.formatMessage({ id: ETranslations.backup_backup_to_icloud });
    }

    if (platformEnv.isNativeAndroid) {
      return intl.formatMessage({
        id: ETranslations.backup_backup_to_google_drive,
      });
    }

    return intl.formatMessage({ id: ETranslations.backup_backup_now });
  }, [intl]);

  const renderBackupWalletActions = useCallback(() => {
    return (
      <XStack alignItems="center" gap="$4">
        <Button variant="primary" size="large" onPress={handleBackupWallet}>
          {backupText}
        </Button>
        <WalletBackupActions wallet={wallet} hidePhrase={!supportCloudBackup}>
          <IconButton
            icon="DotHorOutline"
            bg="$gray4"
            size="large"
            onPress={() => {}}
          />
        </WalletBackupActions>
      </XStack>
    );
  }, [backupText, handleBackupWallet, supportCloudBackup, wallet]);

  return (
    <YStack gap="$5" px="$5" pb="$6">
      <YStack $gtMd={{ flexDirection: 'row' }} gap="$5">
        <Theme inverse>
          <MainInfoBlock
            bgSource={
              themeVariant === 'dark'
                ? require('@onekeyhq/kit/assets/wallet-backup-bg.png')
                : require('@onekeyhq/kit/assets/wallet-backup-bg-dark.png')
            }
            title={intl.formatMessage({
              id: ETranslations.wallet_backup_prompt,
            })}
            iconProps={{ name: 'ShieldCheckDoneOutline' }}
            iconContainerProps={{ bg: '$brand8' }}
            containerProps={{
              minHeight: 256,
              bg: '$bgApp',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: '$borderSubdued',
              $gtMd: { flexBasis: 0, flexShrink: 1, flexGrow: 1 },
            }}
            actions={renderBackupWalletActions()}
          />
        </Theme>
        <ReferralCodeBlock closable />
      </YStack>
      <YStack
        gap="$5"
        $gtMd={{
          flexDirection: 'row',
        }}
      >
        <InfoBlock
          iconProps={{ name: 'ArrowBottomOutline' }}
          title={intl.formatMessage({
            id: ETranslations.wallet_empty_article_deposit,
          })}
          url={howToDepositLink}
          containerProps={{
            $gtMd: {
              flexBasis: 0,
              flexShrink: 1,
              flexGrow: 1,
            },
          }}
        />
        <InfoBlock
          iconProps={{ name: 'HelpSupportOutline' }}
          title={intl.formatMessage({
            id: ETranslations.wallet_empty_article_deposit_faq,
          })}
          url={depositFaqLink}
          containerProps={{
            $gtMd: {
              flexBasis: 0,
              flexShrink: 1,
              flexGrow: 1,
            },
          }}
        />
        <InfoBlock
          iconProps={{ name: 'SwapHorOutline' }}
          title={intl.formatMessage({
            id: ETranslations.wallet_empty_article_trade,
          })}
          url={swapAndBridgeLink}
          containerProps={{
            $gtMd: {
              flexBasis: 0,
              flexShrink: 1,
              flexGrow: 1,
            },
          }}
        />
      </YStack>
    </YStack>
  );
}

export default memo(NotBackedUp);
