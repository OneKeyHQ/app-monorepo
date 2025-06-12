import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Badge, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useShowAddressBook } from '@onekeyhq/kit/src/hooks/useShowAddressBook';
import { useBackupEntryStatus } from '@onekeyhq/kit/src/views/CloudBackup/components/useBackupEntryStatus';
import { usePrimeAuthV2 } from '@onekeyhq/kit/src/views/Prime/hooks/usePrimeAuthV2';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ECloudBackupRoutes,
  EDAppConnectionModal,
  ELiteCardRoutes,
  EModalKeyTagRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';

export const useOnLock = () => {
  const [passwordSetting] = usePasswordPersistAtom();
  const onLock = useCallback(async () => {
    if (passwordSetting.isPasswordSet) {
      await backgroundApiProxy.servicePassword.lockApp();
    } else {
      await backgroundApiProxy.servicePassword.promptPasswordVerify();
      await backgroundApiProxy.servicePassword.lockApp();
    }
    defaultLogger.setting.page.lockNow();
  }, [passwordSetting.isPasswordSet]);
  return onLock;
};

const AddressBookItem = () => {
  const intl = useIntl();
  const onPress = useShowAddressBook({
    useNewModal: false,
  });
  return (
    <ListItem
      icon="ContactsOutline"
      title={intl.formatMessage({ id: ETranslations.settings_address_book })}
      drillIn
      onPress={onPress}
      testID="setting-address-book"
    />
  );
};

const LockNowButton = () => {
  const intl = useIntl();
  const onLock = useOnLock();
  const navigation = useAppNavigation();
  const handlePress = useCallback(() => {
    void onLock();
    setTimeout(() => {
      navigation.popStack();
    }, 0);
  }, [navigation, onLock]);
  return (
    <ListItem
      icon="LockOutline"
      title={intl.formatMessage({ id: ETranslations.settings_lock_now })}
      onPress={handlePress}
    />
  );
};

const PrimeOneKeyCloudButton = () => {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { isPrimeSubscriptionActive } = usePrimeAuthV2();

  const handlePress = useCallback(() => {
    if (isPrimeSubscriptionActive) {
      navigation.pushModal(EModalRoutes.PrimeModal, {
        screen: EPrimePages.PrimeCloudSync,
      });
    } else {
      navigation.pushModal(EModalRoutes.PrimeModal, {
        screen: EPrimePages.PrimeFeatures,
        params: {
          showAllFeatures: false,
          selectedFeature: EPrimeFeatures.OneKeyCloud,
          selectedSubscriptionPeriod: 'P1Y',
        },
      });
    }
  }, [isPrimeSubscriptionActive, navigation]);
  return (
    <ListItem
      drillIn
      icon="CloudSyncOutline"
      title={intl.formatMessage({ id: ETranslations.global_onekey_cloud })}
      onPress={handlePress}
    >
      <XStack>
        <Badge badgeSize="sm">
          <Badge.Text>Prime</Badge.Text>
        </Badge>
        {/* <ListItem.Text primary="Prime" align="right" /> */}
      </XStack>
    </ListItem>
  );
};

const DefaultWalletSetting = () => {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { result, isLoading, run } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceContextMenu.getDefaultWalletSettingsWithIcon(),
    [],
    { checkIsFocused: false },
  );
  useEffect(() => {
    appEventBus.addListener(EAppEventBusNames.ExtensionContextMenuUpdate, run);
    return () => {
      appEventBus.removeListener(
        EAppEventBusNames.ExtensionContextMenuUpdate,
        run,
      );
    };
  }, [run]);
  return (
    <ListItem
      icon="ThumbtackOutline"
      title={intl.formatMessage({
        id: ETranslations.settings_default_wallet_settings,
      })}
      drillIn
      onPress={() => {
        navigation.pushModal(EModalRoutes.DAppConnectionModal, {
          screen: EDAppConnectionModal.DefaultWalletSettingsModal,
        });
      }}
    >
      {isLoading ? null : (
        <ListItem.Text
          primary={
            result?.isDefaultWallet
              ? intl.formatMessage({ id: ETranslations.global_on })
              : intl.formatMessage({ id: ETranslations.global_off })
          }
          align="right"
        />
      )}
    </ListItem>
  );
};

export const DefaultSection = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const intl = useIntl();
  const navigation = useAppNavigation();
  const backupEntryStatus = useBackupEntryStatus();
  return (
    <YStack>
      <LockNowButton />
      {platformEnv.isExtension ? <DefaultWalletSetting /> : null}
      <AddressBookItem />
      <PrimeOneKeyCloudButton />
      {platformEnv.isNative ? (
        <ListItem
          icon="RepeatOutline"
          title={intl.formatMessage({
            id: platformEnv.isNativeAndroid
              ? ETranslations.settings_google_drive_backup
              : ETranslations.settings_icloud_backup,
          })}
          drillIn
          onPress={async () => {
            await backupEntryStatus.check();
            defaultLogger.setting.page.enterBackup();
            navigation.pushModal(EModalRoutes.CloudBackupModal, {
              screen: ECloudBackupRoutes.CloudBackupHome,
            });
          }}
        />
      ) : null}
      {platformEnv.isNative ? (
        <ListItem
          icon="OnekeyLiteOutline"
          title={intl.formatMessage({ id: ETranslations.global_onekey_lite })}
          drillIn
          onPress={() => {
            navigation.pushModal(EModalRoutes.LiteCardModal, {
              screen: ELiteCardRoutes.LiteCardHome,
            });
          }}
        />
      ) : null}
      <ListItem
        icon="OnekeyKeytagOutline"
        title={intl.formatMessage({ id: ETranslations.global_onekey_keytag })}
        drillIn
        onPress={() => {
          defaultLogger.setting.page.enterKeyTag();
          navigation.pushModal(EModalRoutes.KeyTagModal, {
            screen: EModalKeyTagRoutes.UserOptions,
          });
        }}
      />
    </YStack>
  );
};
