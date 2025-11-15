import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Icon,
  Page,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IBackupDataEncryptedPayload } from '@onekeyhq/kit-bg/src/services/ServiceCloudBackupV2/backupProviders/IOneKeyBackupProvider';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import type {
  EOnboardingPagesV2,
  IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes';
import type { IAllWalletAvatarImageNames } from '@onekeyhq/shared/src/utils/avatarUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IPrimeTransferData,
  IPrimeTransferPublicDataWalletDetail,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { MultipleClickStack } from '../../../components/MultipleClickStack';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { CloudAccountBar } from '../components/CloudAccountBar';
import { CloudBackupDetailsEmptyView } from '../components/CloudBackupEmptyView';
import { CloudBackupLoadingSkeleton } from '../components/CloudBackupLoadingSkeleton';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { useCloudBackup } from '../hooks/useCloudBackup';

export default function ICloudBackupDetails({
  route,
}: IPageScreenProps<
  IOnboardingParamListV2,
  EOnboardingPagesV2.ICloudBackupDetails
>) {
  const intl = useIntl();
  const backupTime = route.params?.backupTime;
  const actionType = route.params?.actionType;
  const hideRestoreButton = route.params?.hideRestoreButton;
  const navigation = useAppNavigation();
  const {
    doBackup,
    doDeleteBackup,
    doRestoreBackup,
    checkLoading,
    goToPageBackupList,
  } = useCloudBackup();

  const { result: backupData, isLoading: fetchLoading } = usePromiseResult<
    IPrimeTransferData | IBackupDataEncryptedPayload | undefined
  >(
    async () => {
      await timerUtils.wait(1000);
      if (actionType === 'backup') {
        return backgroundApiProxy.serviceCloudBackupV2.buildBackupData();
      }
      if (actionType === 'restore') {
        if (!route.params?.backupId) {
          Toast.error({
            title: 'Backup ID is required for restore',
          });
          throw new OneKeyLocalError('Backup ID is required for restore');
        }
        const data = await backgroundApiProxy.serviceCloudBackupV2.download({
          recordId: route.params?.backupId,
        });
        return data?.payload;
      }
      return undefined;
    },
    [actionType, route.params?.backupId],
    {
      watchLoading: true,
    },
  );

  const walletDataFromBackup = useMemo(() => {
    return backupData?.publicData?.walletDetails ?? [];
  }, [backupData]);

  const [walletDataMocked, setWalletDataMocked] = useState<
    IPrimeTransferPublicDataWalletDetail[] | undefined
  >(undefined);
  const walletData = useMemo(() => {
    return walletDataMocked ?? walletDataFromBackup;
  }, [walletDataMocked, walletDataFromBackup]);

  const formattedDate = useMemo(() => {
    let dateTime: number | undefined;
    if (backupData?.publicData?.dataTime) {
      dateTime = backupData?.publicData?.dataTime;
    }
    if (!dateTime) {
      return '';
    }
    // return '';
    return formatDate(new Date(dateTime), {
      hideSeconds: true,
    });
  }, [backupData?.publicData?.dataTime]);

  const handleImport = useCallback(async () => {
    await doRestoreBackup({
      payload: backupData as IBackupDataEncryptedPayload,
    });
  }, [backupData, doRestoreBackup]);

  const handleBackup = useCallback(async () => {
    if (!backupData) {
      throw new OneKeyLocalError('Backup data not found');
    }
    await doBackup({ data: backupData as IPrimeTransferData });
  }, [backupData, doBackup]);

  const renderContent = () => {
    if (fetchLoading) {
      return <CloudBackupLoadingSkeleton />;
    }
    if (walletData.length === 0) {
      return <CloudBackupDetailsEmptyView />;
    }
    return walletData.map((item, index) => (
      <ListItem
        key={index}
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
        userSelect="none"
      >
        <WalletAvatar img={item.avatar} wallet={undefined} />
        <YStack gap={2} flex={1}>
          <SizableText
            size="$bodyMdMedium"
            $platform-native={{
              size: '$bodyLgMedium',
            }}
          >
            {item.name}
          </SizableText>
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            $platform-native={{
              size: '$bodyMd',
            }}
          >
            {intl.formatMessage(
              { id: ETranslations.global_number_accounts },
              { number: item.accountsCount },
            )}
          </SizableText>
        </YStack>
      </ListItem>
    ));
  };

  const isButtonDisabled = useMemo(() => {
    return fetchLoading || checkLoading || !backupData || !walletData.length;
  }, [fetchLoading, checkLoading, backupData, walletData.length]);
  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title={formattedDate} />
        <OnboardingLayout.Body>
          <YStack gap="$3">
            <CloudAccountBar />
            {renderContent()}
            <MultipleClickStack
              h="$10"
              showDevBgColor
              debugComponent={
                <YStack gap="$2">
                  <Button
                    onPress={async () => {
                      Dialog.debugMessage({
                        debugMessage: backupData,
                      });
                    }}
                  >
                    showBackupData
                  </Button>
                  <Button
                    onPress={async () => {
                      setWalletDataMocked([]);
                    }}
                  >
                    Mock Empty Wallets
                  </Button>
                  <Button
                    loading={checkLoading}
                    disabled={isButtonDisabled}
                    flex={1}
                    onPress={async () => {
                      await doBackup({
                        data: backupData as IPrimeTransferData,
                        backupTimes: 30,
                      });
                    }}
                  >
                    备份 30 份
                  </Button>
                </YStack>
              }
            />
          </YStack>
        </OnboardingLayout.Body>
        <OnboardingLayout.Footer>
          <XStack
            gap="$3"
            w="100%"
            $gtMd={{
              maxWidth: 400,
            }}
            py="$3"
          >
            {actionType === 'backup' ? (
              <>
                <Button
                  loading={checkLoading}
                  disabled={isButtonDisabled}
                  flex={1}
                  variant="primary"
                  size="large"
                  onPress={handleBackup}
                >
                  {intl.formatMessage({ id: ETranslations.backup_backup_now })}
                </Button>
                <Button
                  loading={checkLoading}
                  size="large"
                  onPress={async () => {
                    await goToPageBackupList({
                      hideRestoreButton: true,
                    });
                  }}
                  childrenAsText={false}
                >
                  <Icon name="SettingsOutline" />
                </Button>
              </>
            ) : null}

            {actionType === 'restore' ? (
              <>
                {!hideRestoreButton ? (
                  <Button
                    loading={checkLoading}
                    disabled={isButtonDisabled}
                    flex={1}
                    variant="primary"
                    size="large"
                    onPress={handleImport}
                  >
                    {intl.formatMessage({ id: ETranslations.global_import })}
                  </Button>
                ) : null}
                <Button
                  loading={checkLoading}
                  disabled={!route.params?.backupId}
                  size="large"
                  flex={hideRestoreButton ? 1 : undefined}
                  onPress={async () => {
                    doDeleteBackup({
                      recordID: route.params?.backupId ?? '',
                    });
                  }}
                  childrenAsText={false}
                >
                  <Icon name="DeleteOutline" />
                </Button>
              </>
            ) : null}
          </XStack>
        </OnboardingLayout.Footer>
      </OnboardingLayout>
    </Page>
  );
}
