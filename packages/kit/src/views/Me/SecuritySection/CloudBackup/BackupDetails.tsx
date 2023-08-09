import type { FC } from 'react';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import natsort from 'natsort';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Button,
  Center,
  Dialog,
  Icon,
  Spinner,
  Text,
  ToastManager,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { ICON_NAMES } from '@onekeyhq/components/src/Icon';
import { backupPlatform } from '@onekeyhq/shared/src/cloudfs';
import { RestoreResult } from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.enums';
import type {
  ISimpleDBBackUp,
  PublicBackupData,
} from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.types';
import type { Avatar } from '@onekeyhq/shared/src/utils/emojiUtils';
import { gtIgnore } from '@onekeyhq/shared/src/utils/semverUtils';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../../hooks';
import { useAppSelector } from '../../../../hooks/redux';
import useFormatDate from '../../../../hooks/useFormatDate';
import useImportBackupPasswordModal from '../../../../hooks/useImportBackupPasswordModal';
import useLocalAuthenticationModal from '../../../../hooks/useLocalAuthenticationModal';
import { useOnboardingDone } from '../../../../hooks/useOnboardingRequired';
import {
  type HomeRoutes,
  MainRoutes,
  RootRoutes,
  TabRoutes,
} from '../../../../routes/routesEnum';
import {
  selectIsPasswordSet,
  selectVersion,
} from '../../../../store/selectors';
import { showOverlay } from '../../../../utils/overlayUtils';

import BackupIcon from './BackupIcon';
import BackupSummary from './BackupSummary';
import { showUpgrateDialog } from './UpgrateDialog';
import Wrapper from './Wrapper';

import type {
  HomeRoutesParams,
  RootRoutesParams,
} from '../../../../routes/types';
import type { RouteProp } from '@react-navigation/core';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { IBoxProps } from 'native-base';

type BackupDetailsRouteProp = RouteProp<
  HomeRoutesParams,
  HomeRoutes.CloudBackupDetails
>;

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Main
>;

type ListItem = {
  icon?: Avatar | ICON_NAMES;
  iconType: 'Avatar' | 'Icon' | string;
  name: string;
  desc: string;
  uuid: string;
};

type Section = {
  title: string;
  items: ListItem[];
};

function SectionItems({ section }: { section: Section }) {
  const { title, items } = section;
  return (
    <Box>
      <Text typography="Body2" color="text-subdued" mb="12px">
        {title}
      </Text>
      <VStack space="16px">
        {items.map(({ icon, iconType, name, desc, uuid }) => (
          <Box
            key={uuid}
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Center rounded="full" size="8" bgColor="surface-neutral-default">
              {iconType === 'Avatar' ? (
                <Text typography="DisplayMedium">{(icon as Avatar).emoji}</Text>
              ) : (
                <Icon
                  name={icon as ICON_NAMES}
                  size={20}
                  color="icon-default"
                />
              )}
            </Center>
            <Text px="12px" typography="Body2Strong" flex="1" isTruncated>
              {name}
            </Text>
            <Text typography="Body2Strong" color="text-subdued">
              {desc}
            </Text>
          </Box>
        ))}
      </VStack>
    </Box>
  );
}

export const GroupedBackupDetails = ({
  title,
  publicBackupData,
}: {
  title?: string;
  publicBackupData: PublicBackupData;
}) => {
  const intl = useIntl();
  const [listData, setListData] = useState<Section[]>([]);

  useEffect(() => {
    const datas: Section[] = [];

    const walletsItems: ListItem[] = Object.entries(publicBackupData.HDWallets)
      .map(([uuid, info]) => ({
        uuid,
        iconType: 'Avatar',
        name: info.name,
        icon: info.avatar,
        desc: intl.formatMessage(
          { id: 'form__str_accounts' },
          { count: info.accountUUIDs.length },
        ),
      }))
      .sort((a, b) => natsort({ insensitive: true })(a.name, b.name));
    const importedAccountsData = Object.entries(
      publicBackupData.importedAccounts,
    ).map(([uuid, info]) => ({ uuid, ...info }));

    if (importedAccountsData.length > 0) {
      walletsItems.push({
        uuid: importedAccountsData[0].uuid,
        name: intl.formatMessage({ id: 'wallet__imported_accounts' }),
        iconType: 'Icon',
        icon: 'InboxArrowDownOutline',
        desc: intl.formatMessage(
          { id: 'form__str_accounts' },
          { count: importedAccountsData.length },
        ),
      });
    }
    const watchingAccountsData = Object.entries(
      publicBackupData.watchingAccounts,
    ).map(([uuid, info]) => ({ uuid, ...info }));

    if (watchingAccountsData.length > 0) {
      walletsItems.push({
        uuid: watchingAccountsData[0].uuid,
        name: intl.formatMessage({ id: 'wallet__watched_accounts' }),
        iconType: 'Icon',
        icon: 'EyeOutline',
        desc: intl.formatMessage(
          { id: 'form__str_accounts' },
          { count: watchingAccountsData.length },
        ),
      });
    }

    if (walletsItems.length > 0) {
      datas.push({
        title: intl.formatMessage({ id: 'wallet__app_wallet' }),
        items: walletsItems,
      });
    }

    const tokenItems: ListItem[] = [];
    const marketFavorites = publicBackupData.marketFavorites ?? [];
    if (marketFavorites.length > 0) {
      tokenItems.push({
        uuid: marketFavorites[0],
        name: intl.formatMessage({ id: 'form__Watchlist' }),
        iconType: 'Icon',
        icon: 'HeartOutline',
        desc: intl.formatMessage(
          { id: 'content__int_items' },
          { 0: marketFavorites.length },
        ),
      });
    }

    if (tokenItems.length > 0) {
      datas.push({
        title: intl.formatMessage({ id: 'form__token' }),
        items: tokenItems,
      });
    }

    const addressBookAndLabs: ListItem[] = [];
    const contactsData = Object.entries(publicBackupData.contacts).map(
      ([uuid, info]) => ({ uuid, ...info }),
    );
    if (contactsData.length > 0) {
      addressBookAndLabs.push({
        uuid: contactsData[0].name,
        name: intl.formatMessage({ id: 'title__address_book' }),
        iconType: 'Icon',
        icon: 'BookOpenOutline',
        desc: intl.formatMessage(
          { id: 'content__int_items' },
          { 0: contactsData.length },
        ),
      });
    }
    const utxos = publicBackupData?.simpleDb?.utxoAccounts?.utxos;
    if (utxos && utxos.length > 0) {
      addressBookAndLabs.push({
        uuid: utxos[0].key,
        name: intl.formatMessage({ id: 'form__utxo_label' }),
        iconType: 'Icon',
        icon: 'TagOutline',
        desc: intl.formatMessage(
          { id: 'content__int_items' },
          { 0: utxos.length },
        ),
      });
    }
    if (addressBookAndLabs.length > 0) {
      datas.push({
        title: intl.formatMessage({
          id: 'form__address_book_labels_uppercase',
        }),
        items: addressBookAndLabs,
      });
    }

    const discoverBookmarks = publicBackupData.discoverBookmarks ?? [];
    const exploreItems: ListItem[] = [];
    if (discoverBookmarks.length > 0) {
      exploreItems.push({
        uuid: discoverBookmarks[0].id,
        name: 'Favorite dApps',
        iconType: 'Icon',
        icon: 'StarOutline',
        desc: intl.formatMessage(
          { id: 'content__int_items' },
          { 0: discoverBookmarks.length },
        ),
      });
    }
    // const browserHistories = publicBackupData.browserHistories ?? [];

    // if (browserHistories.length > 0) {
    //   exploreItems.push({
    //     uuid: browserHistories[0].url,
    //     name: intl.formatMessage({ id: 'transaction__history' }),
    //     iconType: 'Icon',
    //     icon: 'ClockOutline',
    //     desc: intl.formatMessage(
    //       { id: 'content__int_items' },
    //       { 0: browserHistories.length },
    //     ),
    //   });
    // }
    if (exploreItems.length > 0) {
      datas.push({
        title: intl.formatMessage({ id: 'title__explore' }),
        items: exploreItems,
      });
    }
    setListData(datas);
  }, [intl, publicBackupData]);

  return (
    <Box mx={12}>
      {title && (
        <Text typography="Heading" pb="4">
          {title}
        </Text>
      )}
      <VStack space="32px">
        {listData.map((section) => (
          <SectionItems section={section} key={section.title} />
        ))}
      </VStack>
    </Box>
  );
};

const BackupActions = ({
  size,
  ready,
  onImport,
  onDelete,
  ...rest
}: {
  size: 'base' | 'xl';
  ready: boolean;
  onImport?: () => void;
  onDelete?: () => void;
} & IBoxProps) => {
  const intl = useIntl();

  return (
    <Box flexDirection="row" {...rest}>
      {typeof onImport !== 'undefined' && !ready ? (
        <Button
          onPress={onImport}
          type="primary"
          size={size}
          flexGrow={{ base: 1, sm: 0 }}
        >
          {intl.formatMessage({ id: 'action__import' })}
        </Button>
      ) : undefined}
      {typeof onDelete !== 'undefined' && !ready ? (
        <Button
          onPress={onDelete}
          type="destructive"
          size={size}
          ml={4}
          flexGrow={{ base: 1, sm: 0 }}
        >
          {intl.formatMessage({ id: 'action__delete' })}
        </Button>
      ) : undefined}
    </Box>
  );
};

export function checkHasData(notOnDevice: PublicBackupData): boolean {
  if (notOnDevice?.simpleDb?.utxoAccounts?.utxos.length) {
    return true;
  }
  return (
    Object.entries(notOnDevice).filter(
      ([key, value]) => key !== 'simpleDb' && Object.keys(value).length > 0,
    ).length > 0
  );
}

const BackupDetails: FC<{ onboarding: boolean }> = ({ onboarding = false }) => {
  const intl = useIntl();

  const isSmallScreen = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<BackupDetailsRouteProp>();
  const localVersion = useAppSelector(selectVersion);

  const isPasswordSet = useAppSelector(selectIsPasswordSet);
  const { serviceCloudBackup } = backgroundApiProxy;
  const { showVerify } = useLocalAuthenticationModal();
  const { requestBackupPassword } = useImportBackupPasswordModal();
  const onboardingDone = useOnboardingDone();

  useLayoutEffect(() => {
    const title = intl.formatMessage({ id: 'title__backup_details' });
    navigation.setOptions({
      title,
    });
  }, [navigation, intl]);
  const formatDate = useFormatDate();

  const { backupUUID, backupTime, numOfHDWallets, numOfAccounts } =
    route.params;

  const [dataReady, setDataReady] = useState(true);
  const [backupData, setBackupData] = useState<{
    alreadyOnDevice: PublicBackupData;
    notOnDevice: PublicBackupData;
  }>({
    alreadyOnDevice: {
      contacts: {},
      importedAccounts: {},
      watchingAccounts: {},
      HDWallets: {},
      simpleDb: {} as ISimpleDBBackUp,
      discoverBookmarks: [],
      // browserHistories: [],
    },
    notOnDevice: {
      contacts: {},
      importedAccounts: {},
      watchingAccounts: {},
      HDWallets: {},
      simpleDb: {} as ISimpleDBBackUp,
      discoverBookmarks: [],
      // browserHistories: [],
    },
  });
  const [hasLocalData, setHasLocalData] = useState(false);
  const [version, setVersion] = useState<string | undefined>();
  const [hasRemoteData, setHasRemoteData] = useState(false);

  const checkVersion = useCallback(() => {
    // old version
    if (version === undefined) {
      return true;
    }
    // data version >= local version
    if (version && gtIgnore(version, localVersion, 'patch')) {
      return false;
    }
    return true;
  }, [localVersion, version]);

  useEffect(() => {
    serviceCloudBackup
      .getBackupDetails(backupUUID)
      .then(({ backupDetails, appVersion }) => {
        setVersion(appVersion);
        setBackupData(backupDetails);
        setHasLocalData(checkHasData(backupDetails.alreadyOnDevice));
        setHasRemoteData(checkHasData(backupDetails.notOnDevice));
        setDataReady(false);
      });
  }, [setDataReady, serviceCloudBackup, backupUUID]);

  const onImportDone = useCallback(async () => {
    ToastManager.show({
      title: intl.formatMessage({ id: 'msg__backup_imported' }),
    });
    if (onboarding) {
      await onboardingDone({ delay: 200 });
    } else {
      navigation?.popToTop();
      navigation?.navigate(RootRoutes.Main, {
        screen: MainRoutes.Tab,
        params: {
          screen: TabRoutes.Home,
        },
      });
    }
  }, [intl, onboarding, onboardingDone, navigation]);

  const onImportError = useCallback(() => {
    ToastManager.show(
      {
        title: intl.formatMessage({
          id: 'msg__import_icloud_backup_failed_version',
        }),
      },
      { type: 'error' },
    );
    navigation.goBack();
  }, [intl, navigation]);

  const onImport = useCallback(() => {
    if (checkVersion() === false) {
      showUpgrateDialog();
      return;
    }
    if (isPasswordSet) {
      showVerify(
        (localPassword) => {
          serviceCloudBackup
            .restoreFromBackup({
              backupUUID,
              notOnDevice: backupData.notOnDevice,
              localPassword,
            })
            .then((r) => {
              if (r === RestoreResult.SUCCESS) {
                onImportDone();
              } else if (r === RestoreResult.WRONG_PASSWORD) {
                requestBackupPassword(
                  (remotePassword) =>
                    serviceCloudBackup.restoreFromBackup({
                      backupUUID,
                      notOnDevice: backupData.notOnDevice,
                      localPassword,
                      remotePassword,
                    }),
                  onImportDone,
                  onImportError,
                );
              } else {
                onImportError();
              }
            });
        },
        () => {},
      );
    } else {
      requestBackupPassword(
        (remotePassword) =>
          serviceCloudBackup.restoreFromBackup({
            backupUUID,
            notOnDevice: backupData.notOnDevice,
            localPassword: remotePassword,
            remotePassword,
          }),
        onImportDone,
        onImportError,
      );
    }
  }, [
    isPasswordSet,
    checkVersion,
    showVerify,
    serviceCloudBackup,
    backupUUID,
    backupData.notOnDevice,
    onImportDone,
    requestBackupPassword,
    onImportError,
  ]);

  const onDelete = useCallback(() => {
    showOverlay((onClose) => (
      <Dialog
        visible
        onClose={onClose}
        footerButtonProps={{
          primaryActionTranslationId: 'action__delete',
          secondaryActionTranslationId: 'action__cancel',
          primaryActionProps: {
            type: 'destructive',
            onPromise: async () => {
              await serviceCloudBackup.removeBackup(backupUUID);
              onClose();
              navigation.pop(2);
            },
          },
        }}
        contentProps={{
          iconType: 'danger',
          title: intl.formatMessage({
            id: 'dialog__delete_backup',
          }),
          content: intl.formatMessage(
            {
              id: 'dialog__delete_backup_desc',
            },
            { 'cloudName': backupPlatform().cloudName },
          ),
        }}
      />
    ));
  }, [backupUUID, intl, navigation, serviceCloudBackup]);

  return (
    <Wrapper
      footer={
        isSmallScreen ? (
          <BackupActions
            ready={dataReady}
            onImport={hasRemoteData ? onImport : undefined}
            onDelete={onboarding ? undefined : onDelete}
            size="xl"
            position="absolute"
            bottom={0}
          />
        ) : undefined
      }
    >
      {/* Header */}
      <Box flexDirection={isSmallScreen ? 'column' : 'row'} alignItems="center">
        <Box mb={{ base: 6, sm: 0 }} mr={{ sm: 6 }}>
          <BackupIcon size="lg" enabled />
        </Box>
        <Text typography="PageHeading">
          {formatDate.format(new Date(backupTime), 'MMM d, yyyy, HH:mm')}
        </Text>
        <Text typography="Body2" mt="12px" color="text-subdued">
          {`${intl.formatMessage(
            { id: 'form__str_wallets' },
            { 0: numOfHDWallets },
          )} · ${intl.formatMessage(
            { id: 'form__str_accounts' },
            { count: numOfAccounts },
          )}`}
        </Text>
        {isSmallScreen ? undefined : (
          <BackupActions
            ready={dataReady}
            onImport={hasRemoteData ? onImport : undefined}
            onDelete={onboarding ? undefined : onDelete}
            size="base"
            ml="auto"
          />
        )}
      </Box>
      {/* Divider */}
      <Box
        borderBottomWidth={StyleSheet.hairlineWidth}
        borderBottomColor="divider"
        my={{ base: 8, sm: 6 }}
      />
      {dataReady ? (
        <Spinner size="lg" />
      ) : (
        <Box flexDirection={isSmallScreen ? 'column' : 'row'} mx={-12}>
          {hasLocalData ? (
            <GroupedBackupDetails
              title={intl.formatMessage({
                id: 'content__active_on_this_device',
              })}
              publicBackupData={backupData.alreadyOnDevice}
            />
          ) : undefined}
          {hasRemoteData ? (
            <GroupedBackupDetails
              title={intl.formatMessage({ id: 'content__not_on_this_device' })}
              publicBackupData={backupData.notOnDevice}
            />
          ) : undefined}
        </Box>
      )}
    </Wrapper>
  );
};

export default BackupDetails;
