import { useCallback, useMemo, useState } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Dialog,
  Icon,
  Page,
  SizableText,
  Toast,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type {
  IBackupDataManifest,
  IBackupDataManifestItem,
} from '@onekeyhq/kit-bg/src/services/ServiceCloudBackupV2/backupProviders/IOneKeyBackupProvider';
import {
  onboardingCloudBackupListRefreshAtom,
  useOnboardingCloudBackupListRefreshAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { MultipleClickStack } from '../../../components/MultipleClickStack';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { CloudAccountBar } from '../components/CloudAccountBar';
import { showCloudBackupPasswordDialog } from '../components/CloudBackupDialogs';
import { CloudBackupListEmptyView } from '../components/CloudBackupEmptyView';
import { CloudBackupLoadingSkeleton } from '../components/CloudBackupLoadingSkeleton';
import { OnboardingLayout } from '../components/OnboardingLayout';

export default function ICloudBackup() {
  const navigation = useAppNavigation();
  const [refreshHook] = useOnboardingCloudBackupListRefreshAtom();
  const intl = useIntl();

  const { result: allBackupsFromCloud, isLoading } = usePromiseResult(
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
  const [allBackupsMocked, setAllBackupsMocked] = useState<
    IBackupDataManifest | undefined
  >(undefined);

  const allBackups = useMemo(() => {
    return allBackupsMocked ?? allBackupsFromCloud;
  }, [allBackupsMocked, allBackupsFromCloud]);

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
      return <CloudBackupListEmptyView />;
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
        <OnboardingLayout.Body>
          <CloudAccountBar />
          {renderContent()}
          <MultipleClickStack
            h="$10"
            showDevBgColor
            debugComponent={
              <YStack gap="$2">
                <Button
                  onPress={async () => {
                    setAllBackupsMocked({
                      items: [],
                      total: 0,
                      backupPasswordVerify: undefined,
                    });
                  }}
                >
                  Mock Empty Backups
                </Button>
                <Button
                  onPress={async () =>
                    Dialog.debugMessage({
                      debugMessage:
                        await backgroundApiProxy.serviceCloudBackupV2.isBackupPasswordSet(),
                    })
                  }
                >
                  isBackupPasswordSet
                </Button>
                <Button
                  onPress={async () =>
                    showCloudBackupPasswordDialog({
                      onSubmit: async (password) => {
                        const result =
                          await backgroundApiProxy.serviceCloudBackupV2.verifyBackupPassword(
                            {
                              password,
                            },
                          );
                        Dialog.debugMessage({
                          debugMessage: result,
                        });
                      },
                    })
                  }
                >
                  verifyBackupPassword
                </Button>
                <Button
                  onPress={async () => {
                    showCloudBackupPasswordDialog({
                      onSubmit: async (password) => {
                        const result =
                          await backgroundApiProxy.serviceCloudBackupV2.setBackupPassword(
                            {
                              password,
                            },
                          );
                        Dialog.debugMessage({
                          debugMessage: result,
                        });
                      },
                    });
                  }}
                >
                  setBackupPassword
                </Button>

                <Button
                  onPress={async () =>
                    Dialog.debugMessage({
                      debugMessage:
                        await backgroundApiProxy.serviceCloudBackupV2.getAllBackups(),
                    })
                  }
                >
                  getAllBackups
                </Button>
                <Button
                  onPress={async () =>
                    Dialog.debugMessage({
                      debugMessage:
                        await backgroundApiProxy.serviceCloudBackupV2.iOSQueryAllRecords(),
                    })
                  }
                >
                  iOSQueryAllRecords
                </Button>
                <Button
                  variant="destructive"
                  onPress={async () => {
                    const data =
                      await backgroundApiProxy.serviceCloudBackupV2.getAllBackups();
                    const items = data?.items ?? [];
                    if (!items.length) {
                      Toast.success({
                        title: 'No backups to delete',
                      });
                      return;
                    }
                    Dialog.show({
                      icon: 'DeleteOutline',
                      tone: 'destructive',
                      title: 'Delete all backups?',
                      description:
                        "This will permanently delete all backups from iCloud. Make sure you've saved Recovery phrases, otherwise you won't be able to restore the wallets.",
                      onConfirmText: 'Delete',
                      confirmButtonProps: {
                        variant: 'destructive',
                      },
                      onCancelText: 'Cancel',
                      onConfirm: async () => {
                        for (const item of items) {
                          try {
                            await backgroundApiProxy.serviceCloudBackupV2.delete(
                              {
                                recordId: item.recordID,
                              },
                            );
                          } catch (e) {
                            // continue deleting other items; errors are already toasted by @toastIfError
                          }
                        }
                        await onboardingCloudBackupListRefreshAtom.set(
                          (v) => v + 1,
                        );
                        Toast.success({
                          title: 'All backups deleted',
                        });
                      },
                    });
                  }}
                >
                  Remove All Backups
                </Button>
              </YStack>
            }
          />
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}
