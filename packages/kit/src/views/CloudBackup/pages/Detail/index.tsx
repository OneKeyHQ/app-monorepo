import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
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
  Stack,
  Toast,
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
import type {
  ECloudBackupRoutes,
  ICloudBackupParamList,
} from '@onekeyhq/shared/src/routes';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { showDeleteBackupDialog } from '../../components/DeleteBackupDialog';
import { showRestorePasswordVerifyDialog } from '../../components/ResotrePasswordVerify';

import type { RouteProp } from '@react-navigation/core';

export default function Detail() {
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
        Object.values(publicData.HDWallets).length > 0
          ? {
              title: 'App Wallet',
              data: Object.values(publicData.HDWallets).map((wallet) => ({
                title: wallet.name,
                detail: `${wallet.accountUUIDs.length} Accounts`,
                walletAvatar: wallet.avatar,
              })),
            }
          : null,
        Object.values(publicData.importedAccounts).length +
          Object.values(publicData.watchingAccounts).length >
        0
          ? {
              title: 'Other Wallet',
              data: [
                Object.values(publicData.importedAccounts).length > 0 && {
                  title: 'Private Key',
                  detail: `${
                    Object.keys(publicData.importedAccounts).length
                  } Accounts`,
                  icon: 'PasswordOutline',
                },
                Object.values(publicData.watchingAccounts).length > 0 && {
                  title: 'Watchlist',
                  detail: `${Object.keys(publicData.watchingAccounts).length}`,
                  icon: 'EyeOutline',
                },
              ].filter((item) => item),
            }
          : null,
        Object.keys(publicData.contacts).length +
          (publicData?.discoverBookmarks?.length ?? 0) >
        0
          ? {
              title: 'Address Book & Labels',
              data: [
                Object.keys(publicData.contacts).length > 0 && {
                  title: 'Address Book',
                  detail: `${Object.keys(publicData.contacts).length} Items`,
                  icon: 'BookOpenOutline',
                },
                (publicData?.discoverBookmarks?.length ?? 0) > 0 && {
                  title: 'Discovery bookmarks',
                  detail: `${publicData?.discoverBookmarks?.length ?? 0} Items`,
                  icon: 'BookmarkOutline',
                },
              ].filter((item) => item),
            }
          : null,
      ].filter((item) => item),
    [],
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
    ActionList.show({
      title,
      sections: [
        {
          items: [
            {
              label: 'Delete',
              icon: 'DeleteOutline',
              destructive: true,
              onPress: async () => {
                await showDeleteBackupDialog(filename);
                navigation.pop();
              },
            },
          ],
        },
      ],
    });
  }, [title, filename, navigation]);

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
        title: 'Upgrade Required',
        description:
          'Please upgrade your app to import the data from a newer version',
        onConfirmText: 'Upgrade',
      });
      return;
    }
    setSubmitLoading(true);

    let result = await handlerImportFromPassword();
    if (result === ERestoreResult.WRONG_PASSWORD) {
      const remotePassword = await showRestorePasswordVerifyDialog();
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
      setSubmitLoading(false);
      return;
    }
    setSubmitLoading(false);
    Toast.success({
      title: 'Backup Imported',
    });
    navigation.pop();
  }, [diffData, navigation, handlerImportFromPassword]);

  return (
    <Page>
      <Page.Header title={title} headerRight={renderHeaderRight} />
      <Page.Body>
        <Stack m="$5">
          <SegmentControl
            value={segmentValue}
            onChange={(v) => {
              setSegmentValue(v as number);
            }}
            options={[
              { label: `Not here(${diffData?.diffCount ?? 0})`, value: 0 },
              { label: 'On-device', value: 1 },
            ]}
          />
        </Stack>
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
              <ListItem.Text secondary={item.detail} align="right" />
            </ListItem>
          )}
          estimatedItemSize="$16"
          ListEmptyComponent={
            <Empty
              icon="SearchOutline"
              title="No Data"
              description="All the data in this backup is already present on the current device."
            />
          }
          renderSectionHeader={({
            section,
          }: {
            section: { title: string };
          }) => <SectionList.SectionHeader title={section.title} />}
        />
        <Button
          m="$5"
          borderRadius="$3"
          py="$3"
          variant="primary"
          loading={submitLoading}
          disabled={!diffData || diffData.notOnDeviceSectionList.length <= 0}
          onPress={handlerImport}
        >
          Import
        </Button>
      </Page.Body>
    </Page>
  );
}
