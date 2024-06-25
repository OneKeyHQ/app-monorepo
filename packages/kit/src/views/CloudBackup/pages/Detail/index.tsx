import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import semver from 'semver';

import {
  ActionList,
  Button,
  Dialog,
  Empty,
  Icon,
  Page,
  SectionList,
  SegmentControl,
  SizableText,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import type { IIconProps } from '@onekeyhq/components/src/primitives';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IPublicBackupData } from '@onekeyhq/kit-bg/src/services/ServiceCloudBackup/types';
import { ERestoreResult } from '@onekeyhq/kit-bg/src/services/ServiceCloudBackup/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  ECloudBackupRoutes,
  ICloudBackupParamList,
} from '@onekeyhq/shared/src/routes';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import BackupListLoading from '../../components/BackupListLoading';
import { useDeleteBackupDialog } from '../../components/useDeleteBackupDialog';
import { useRestorePasswordVerifyDialog } from '../../components/useResotrePasswordVerify';

import type { RouteProp } from '@react-navigation/core';

export default function Detail() {
  const intl = useIntl();
  const restorePasswordVerifyDialog = useRestorePasswordVerifyDialog();
  const deleteBackupDialog = useDeleteBackupDialog();
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<ICloudBackupParamList, ECloudBackupRoutes.CloudBackupDetail>
    >();

  const {
    item: { filename, backupTime },
  } = route.params;
  const title = formatDate(new Date(backupTime));
  const [segmentValue, setSegmentValue] = useState(0);
  const [submitLoading, setSubmitLoading] = useState(false);

  const createSectionListFromPublicData = useCallback(
    (publicData: IPublicBackupData) =>
      [
        Object.values(publicData.HDWallets).length > 0 && {
          title: intl.formatMessage({ id: ETranslations.global_app_wallet }),
          data: Object.values(publicData.HDWallets).map((wallet) => ({
            title: wallet.name,
            detail: intl.formatMessage(
              { id: ETranslations.global_number_accounts },
              { number: wallet.indexedAccountUUIDs.length },
            ),
            walletAvatar: wallet.avatar,
            infoList: [
              intl.formatMessage({ id: ETranslations.global_recovery_phrase }),
              intl.formatMessage({ id: ETranslations.global_wallet_avatar }),
              intl.formatMessage({
                id: ETranslations.global_names_of_wallets_and_accounts,
              }),
            ],
            footerDescription: intl.formatMessage({
              id: ETranslations.backup_only_accounts_with_addresses_will_be_backed_up,
            }),
          })),
        },
        Object.values(publicData.importedAccounts).length +
          Object.values(publicData.watchingAccounts).length >
          0 && {
          title: intl.formatMessage({ id: ETranslations.global_other_wallet }),
          data: [
            Object.values(publicData.importedAccounts).length > 0 && {
              title: intl.formatMessage({
                id: ETranslations.global_private_key,
              }),
              detail: intl.formatMessage(
                { id: ETranslations.global_number_accounts },
                { number: Object.keys(publicData.importedAccounts).length },
              ),
              icon: 'PasswordOutline',
              infoList: [
                intl.formatMessage({ id: ETranslations.global_private_key }),
                intl.formatMessage({ id: ETranslations.global_account_name }),
              ],
            },
            Object.values(publicData.watchingAccounts).length > 0 && {
              title: intl.formatMessage({ id: ETranslations.global_watchlist }),
              detail: intl.formatMessage(
                { id: ETranslations.global_number_accounts },
                { number: Object.keys(publicData.watchingAccounts).length },
              ),
              icon: 'EyeOutline',
              infoList: [
                intl.formatMessage({ id: ETranslations.global_address }),
                intl.formatMessage({ id: ETranslations.global_account_name }),
              ],
            },
          ].filter((item) => item),
        },
        Object.keys(publicData.contacts).length > 0 && {
          title: intl.formatMessage({
            id: ETranslations.backup_address_book_labels,
          }),
          data: [
            Object.keys(publicData.contacts).length > 0 && {
              title: intl.formatMessage({
                id: ETranslations.settings_address_book,
              }),
              detail: intl.formatMessage(
                { id: ETranslations.global_number_items },
                { number: Object.keys(publicData.contacts).length },
              ),
              icon: 'BookOpenOutline',
              infoList: [
                intl.formatMessage({ id: ETranslations.global_address }),
                intl.formatMessage({ id: ETranslations.global_name }),
                intl.formatMessage({ id: ETranslations.global_network_type }),
              ],
            },
          ].filter((item) => item),
        },
        (publicData?.discoverBookmarks?.length ?? 0) > 0 && {
          title: intl.formatMessage({ id: ETranslations.global_browser }),
          data: [
            (publicData?.discoverBookmarks?.length ?? 0) > 0 && {
              title: intl.formatMessage({ id: ETranslations.browser_bookmark }),
              detail: intl.formatMessage(
                { id: ETranslations.global_number_items },
                { number: publicData?.discoverBookmarks?.length ?? 0 },
              ),
              icon: 'BookmarkOutline',
              infoList: [
                intl.formatMessage({ id: ETranslations.global_url }),
                intl.formatMessage({ id: ETranslations.global_name }),
              ],
            },
          ].filter((item) => item),
        },
      ].filter((item) => item) as [{ title: string; data: any[] }],
    [intl],
  );

  const diffData = usePromiseResult(async () => {
    const diffList =
      await backgroundApiProxy.serviceCloudBackup.getBackupDiffListWithFilename(
        filename,
      );
    const alreadyOnDeviceSectionList = createSectionListFromPublicData(
      diffList.alreadyOnDevice,
    );
    const notOnDeviceSectionList = createSectionListFromPublicData(
      diffList.notOnDevice,
    );
    return {
      ...diffList,
      alreadyOnDeviceSectionList,
      notOnDeviceSectionList,
    };
  }, [filename, createSectionListFromPublicData]).result;

  const segmentValueSections = useMemo(() => {
    if (!diffData) {
      return [];
    }
    const sections =
      segmentValue === 0
        ? diffData.notOnDeviceSectionList
        : diffData.alreadyOnDeviceSectionList;
    return sections ?? [];
  }, [segmentValue, diffData]);

  const showDeleteActionList = useCallback(() => {
    if (submitLoading) {
      return;
    }
    ActionList.show({
      title,
      items: [
        {
          label: intl.formatMessage({ id: ETranslations.global_delete }),
          icon: 'DeleteOutline',
          destructive: true,
          onPress: async () => {
            await deleteBackupDialog.show(filename);
            navigation.pop();
          },
        },
      ],
    });
  }, [intl, deleteBackupDialog, title, filename, navigation, submitLoading]);

  const renderHeaderRight = useCallback(
    () => (
      <HeaderIconButton icon="DotVerOutline" onPress={showDeleteActionList} />
    ),
    [showDeleteActionList],
  );

  const handlerImportFromPassword = useCallback(
    async (remotePassword?: string) => {
      if (!diffData) {
        return;
      }
      const { password: localPassword } =
        await backgroundApiProxy.servicePassword.promptPasswordVerify();
      return backgroundApiProxy.serviceCloudBackup.restoreFromPrivateBackup({
        privateString: diffData.backupData.privateData,
        notOnDevice: diffData.notOnDevice,
        localPassword,
        remotePassword: remotePassword ?? localPassword,
      });
    },
    [diffData],
  );

  const handlerImport = useCallback(async () => {
    if (
      semver.gt(
        diffData?.backupData.appVersion ?? '',
        process.env.VERSION ?? '1.0.0',
      )
    ) {
      Dialog.show({
        icon: 'InfoCircleOutline',
        title: intl.formatMessage({
          id: ETranslations.backup_upgrade_required,
        }),
        description: intl.formatMessage({
          id: ETranslations.backup_please_upgrade_app_to_import_data,
        }),
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_upgrade,
        }),
      });
      return;
    }
    setSubmitLoading(true);
    try {
      const { isOnboardingDone } =
        await backgroundApiProxy.serviceOnboarding.isOnboardingDone();

      let result = await handlerImportFromPassword();
      if (result === ERestoreResult.WRONG_PASSWORD) {
        const remotePassword = await restorePasswordVerifyDialog.show();
        result = await handlerImportFromPassword(
          await backgroundApiProxy.servicePassword.encodeSensitiveText({
            text: remotePassword,
          }),
        );
      }
      if (
        result === ERestoreResult.UNKNOWN_ERROR ||
        result === ERestoreResult.WRONG_PASSWORD
      ) {
        Toast.error({
          title: result,
        });
      } else {
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.backup_backup_imported,
          }),
        });
        if (!isOnboardingDone) {
          navigation.navigate(ERootRoutes.Main);
        } else {
          navigation.pop();
        }
      }
    } catch (e) {
      Toast.error({
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        title: `${e?.message ?? e}`,
      });
    } finally {
      setSubmitLoading(false);
    }
  }, [
    intl,
    restorePasswordVerifyDialog,
    diffData,
    navigation,
    handlerImportFromPassword,
  ]);

  return (
    <Page>
      <Page.Header title={title} headerRight={renderHeaderRight} />
      <Page.Body>
        <Stack m="$5">
          <SegmentControl
            fullWidth
            value={segmentValue}
            onChange={(v) => {
              setSegmentValue(v as number);
            }}
            options={[
              {
                label: intl.formatMessage(
                  { id: ETranslations.backup_off_device },
                  { number: diffData?.diffCount ?? 0 },
                ),
                value: 0,
              },
              {
                label: intl.formatMessage({
                  id: ETranslations.backup_on_device,
                }),
                value: 1,
              },
            ]}
          />
        </Stack>
        {diffData ? (
          <SectionList
            sections={segmentValueSections}
            renderItem={({
              item,
            }: {
              item: {
                title: string;
                detail: string;
                icon?: IIconProps['name'];
                walletAvatar?: IPublicBackupData['HDWallets'][string]['avatar'];
                infoList: string[];
                footerDescription?: string;
              };
            }) => (
              <ListItem
                title={item.title}
                renderIcon={
                  item.walletAvatar ? (
                    <WalletAvatar
                      // @ts-expect-error
                      wallet={{
                        avatarInfo: item.walletAvatar,
                      }}
                    />
                  ) : (
                    <Stack bg="$bgStrong" p="$2" borderRadius="$3">
                      <Icon name={item.icon} size="$6" color="$icon" />
                    </Stack>
                  )
                }
              >
                <XStack
                  space="$1"
                  onPress={() => {
                    ActionList.show({
                      title: intl.formatMessage({
                        id: ETranslations.backup_encrypted_backup_contents,
                      }),
                      items: item.infoList.map((infoString) => ({
                        label: `  •\t${infoString}`,
                      })),
                      renderItems: item?.footerDescription
                        ? () => (
                            <SizableText
                              mx="$3"
                              my="$3"
                              size="$bodyMd"
                              color="$textSubdued"
                            >
                              {item?.footerDescription}
                            </SizableText>
                          )
                        : undefined,
                    });
                  }}
                >
                  <ListItem.Text secondary={item.detail} align="right" />
                  <Icon
                    name="InfoCircleOutline"
                    color="$iconSubdued"
                    size="small"
                    bg="transparent"
                  />
                </XStack>
              </ListItem>
            )}
            estimatedItemSize="$16"
            ListEmptyComponent={
              <Empty
                icon="SearchOutline"
                title={intl.formatMessage({
                  id: ETranslations.backup_no_data,
                })}
                description={intl.formatMessage({
                  id: ETranslations.backup_data_already_present,
                })}
              />
            }
            renderSectionHeader={({
              section,
            }: {
              section: { title: string };
            }) => <SectionList.SectionHeader title={section.title} />}
          />
        ) : (
          <BackupListLoading />
        )}

        <Button
          m="$5"
          borderRadius="$3"
          py="$3"
          variant="primary"
          loading={submitLoading}
          disabled={!diffData || diffData.notOnDeviceSectionList.length <= 0}
          onPress={handlerImport}
        >
          {intl.formatMessage({ id: ETranslations.global_import })}
        </Button>
      </Page.Body>
    </Page>
  );
}
