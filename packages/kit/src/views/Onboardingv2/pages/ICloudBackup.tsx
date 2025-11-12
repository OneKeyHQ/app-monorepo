import { useCallback } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Dialog,
  Icon,
  Page,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IBackupDataManifestItem } from '@onekeyhq/kit-bg/src/services/ServiceCloudBackupV2/backupProviders/IOneKeyBackupProvider';
import { useOnboardingCloudBackupListRefreshAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import CloudBackupEmptyView from '../components/CloudBackupEmptyView';
import { CloudBackupLoadingSkeleton } from '../components/CloudBackupLoadingSkeleton';
import { OnboardingLayout } from '../components/OnboardingLayout';

export default function ICloudBackup() {
  const navigation = useAppNavigation();
  const [refreshHook] = useOnboardingCloudBackupListRefreshAtom();
  const intl = useIntl();

  const { result: allBackups, isLoading } = usePromiseResult(
    async () => {
      await timerUtils.wait(1000);
      noop(refreshHook);
      return backgroundApiProxy.serviceCloudBackupV2.getAllBackups();
    },
    [refreshHook],
    {
      watchLoading: true,
    },
  );

  const handleBackupPress = useCallback(
    (item: IBackupDataManifestItem) => {
      const params: IOnboardingParamListV2[EOnboardingPagesV2.ICloudBackupDetails] =
        {
          backupTime: item.dataTime,
          backupId: item.recordID,
          actionType: 'restore',
        };
      navigation.push(EOnboardingPagesV2.ICloudBackupDetails, params);
    },
    [navigation],
  );

  const renderContent = () => {
    if (isLoading) {
      return <CloudBackupLoadingSkeleton />;
    }

    if (allBackups?.items?.length === 0) {
      return <CloudBackupEmptyView />;
    }

    return (
      <>
        {allBackups?.items?.map((item, index) => (
          <ListItem
            key={`${item.dataTime}-${index}`}
            gap="$3"
            bg="$bg"
            $platform-web={{
              boxShadow:
                '0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            }}
            $theme-dark={{
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: '$neutral3',
            }}
            $platform-native={{
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: '$borderSubdued',
            }}
            borderRadius="$5"
            borderCurve="continuous"
            p="$3"
            m="$0"
            onPress={() => handleBackupPress(item)}
            userSelect="none"
          >
            <YStack gap={2} flex={1}>
              <SizableText
                size="$bodyMdMedium"
                $platform-native={{
                  size: '$bodyLgMedium',
                }}
              >
                {item.dataTime
                  ? formatDate(new Date(item.dataTime), { hideSeconds: true })
                  : 'ERROR: Invalid Backup'}
              </SizableText>
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                $platform-native={{
                  size: '$bodyMd',
                }}
              >
                {intl.formatMessage(
                  { id: ETranslations.global_count_wallets },
                  { count: item.totalWalletsCount },
                )}
                {', '}
                {intl.formatMessage(
                  { id: ETranslations.global_count_accounts },
                  { count: item.totalAccountsCount },
                )}
              </SizableText>
            </YStack>
            <Icon name="ChevronRightSmallOutline" color="$iconDisabled" />
          </ListItem>
        ))}
        {/* <SizableText size="$bodySm" color="$textSubdued" px="$3">
          {intl.formatMessage({
            id: ETranslations.backup_securely_store_recent_backups,
          })}
        </SizableText> */}
        <Button
          onPress={() => Dialog.debugMessage({ debugMessage: allBackups })}
        >
          ShowDebugMessage
        </Button>
      </>
    );
  };

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header
          title={
            platformEnv.isNativeIOS
              ? intl.formatMessage({ id: ETranslations.settings_icloud_backup })
              : intl.formatMessage({
                  id: ETranslations.settings_google_drive_backup,
                })
          }
        />
        <OnboardingLayout.Body>{renderContent()}</OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}
