import { memo, useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Illustration,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import { WalletBackupActions } from '@onekeyhq/kit/src/components/WalletBackup';
import { useBackUpWallet } from '@onekeyhq/kit/src/hooks/useBackUpWallet';
import { useAccountOverviewActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EHomeTab } from '@onekeyhq/shared/types';

function NotBackedUp() {
  const intl = useIntl();
  const {
    activeAccount: { wallet, account, network },
  } = useActiveAccount({
    num: 0,
  });

  const { updateAccountOverviewState } = useAccountOverviewActions().current;

  const {
    handleBackUpByCloud,
    handleBackUpByPhrase,
    supportCloudBackup,
    cloudBackupFeatureInfo,
  } = useBackUpWallet({
    walletId: wallet?.id ?? '',
  });

  const enableCloudBackup = useMemo(() => {
    return (
      supportCloudBackup &&
      cloudBackupFeatureInfo &&
      wallet?.id &&
      accountUtils.isHdWallet({ walletId: wallet?.id ?? '' })
    );
  }, [supportCloudBackup, cloudBackupFeatureInfo, wallet?.id]);

  const handlePrimaryBackup = useCallback(() => {
    if (enableCloudBackup) {
      void handleBackUpByCloud();
      return;
    }
    void handleBackUpByPhrase();
  }, [enableCloudBackup, handleBackUpByPhrase, handleBackUpByCloud]);

  const primaryButtonText = useMemo(() => {
    if (enableCloudBackup) {
      if (
        platformEnv.isNativeIOS ||
        (platformEnv.isDesktop && platformEnv.isDesktopMac)
      ) {
        return intl.formatMessage({
          id: ETranslations.backup_backup_to_icloud,
        });
      }
      if (platformEnv.isNativeAndroid) {
        return intl.formatMessage({
          id: ETranslations.backup_backup_to_google_drive,
        });
      }
    }
    return intl.formatMessage({ id: ETranslations.backup_backup_now });
  }, [intl, enableCloudBackup]);

  useEffect(() => {
    updateAccountOverviewState({
      isRefreshing: false,
      initialized: true,
    });
    appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
      isRefreshing: false,
      type: EHomeTab.ALL,
      accountId: account?.id ?? '',
      networkId: network?.id ?? '',
    });
  }, [account?.id, network?.id, updateAccountOverviewState]);

  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      mx="$5"
      py="$10"
      $gtMd={{
        py: '$20',
      }}
      borderTopWidth={1}
      borderTopColor="$neutral3"
    >
      <Illustration name="WalletBackup" ml="$-1" size={180} />

      {/* Title + description */}
      <YStack gap="$2" alignItems="center" mb="$12">
        <SizableText size="$heading2xl" textAlign="center">
          {intl.formatMessage({ id: ETranslations.wallet_backup_prompt })}
        </SizableText>
        <SizableText size="$bodyLg" color="$textSubdued" textAlign="center">
          {intl.formatMessage({ id: ETranslations.wallet_no_backup_desc })}
        </SizableText>
      </YStack>

      <YStack gap="$4" w="100%" $gtMd={{ w: 280 }}>
        <Button
          variant="primary"
          size="large"
          onPress={handlePrimaryBackup}
          testID="home-not-backed-up-primary-backup"
        >
          {primaryButtonText}
        </Button>
        <WalletBackupActions
          wallet={wallet}
          hidePhrase={!enableCloudBackup}
          hideCloud={!!enableCloudBackup}
        >
          <Button size="large" testID="home-not-backed-up-more-backup-options">
            {intl.formatMessage({ id: ETranslations.more_backup_options })}
          </Button>
        </WalletBackupActions>
      </YStack>
    </YStack>
  );
}

export default memo(NotBackedUp);
