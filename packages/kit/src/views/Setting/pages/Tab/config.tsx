import { useMemo } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBiometricAuthInfo } from '@onekeyhq/kit/src/hooks/useBiometricAuthInfo';
import { useShowAddressBook } from '@onekeyhq/kit/src/hooks/useShowAddressBook';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ECloudBackupRoutes,
  EDAppConnectionModal,
  ELiteCardRoutes,
  EModalKeyTagRoutes,
  EModalRoutes,
  EModalSettingRoutes,
} from '@onekeyhq/shared/src/routes';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { EModalShortcutsRoutes } from '@onekeyhq/shared/src/routes/shortcuts';

import { usePrimeAuthV2 } from '../../../Prime/hooks/usePrimeAuthV2';

import {
  BiologyAuthListItem,
  LanguageListItem,
  ThemeListItem,
} from './CustomElement';

export const useSettingsConfig = () => {
  const navigation = useAppNavigation();
  const { isPrimeSubscriptionActive } = usePrimeAuthV2();
  const onPressAddressBook = useShowAddressBook({
    useNewModal: false,
  });
  const biometricAuthInfo = useBiometricAuthInfo();
  return useMemo(
    () => [
      {
        icon: 'CloudUploadSolid',
        translationId: ETranslations.global_backup,
        configs: [
          [
            platformEnv.isNative
              ? {
                  icon: 'RepeatOutline',
                  translationId: platformEnv.isNativeAndroid
                    ? ETranslations.settings_google_drive_backup
                    : ETranslations.settings_icloud_backup,
                  onPress: () => {
                    navigation.pushModal(EModalRoutes.CloudBackupModal, {
                      screen: ECloudBackupRoutes.CloudBackupHome,
                    });
                  },
                }
              : null,
            {
              icon: 'CloudSyncOutline',
              translationId: ETranslations.global_onekey_cloud,
              onPress: () => {
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
              },
            },
          ],
          [
            platformEnv.isNative
              ? {
                  icon: 'OnekeyLiteOutline',
                  translationId: ETranslations.global_onekey_lite,
                  onPress: () => {
                    navigation.pushModal(EModalRoutes.LiteCardModal, {
                      screen: ELiteCardRoutes.LiteCardHome,
                    });
                  },
                }
              : undefined,
            {
              icon: 'OnekeyKeytagOutline',
              translationId: ETranslations.global_onekey_keytag,
              onPress: () => {
                defaultLogger.setting.page.enterKeyTag();
                navigation.pushModal(EModalRoutes.KeyTagModal, {
                  screen: EModalKeyTagRoutes.UserOptions,
                });
              },
            },
          ],
        ],
      },
      {
        icon: 'SettingsSolid',
        translationId: ETranslations.global_preferences,
        configs: [
          [
            platformEnv.isExtension
              ? {
                  icon: 'ThumbtackOutline',
                  translationId: ETranslations.settings_default_wallet_settings,
                  onPress: () => {
                    navigation.pushModal(EModalRoutes.DAppConnectionModal, {
                      screen: EDAppConnectionModal.DefaultWalletSettingsModal,
                    });
                  },
                }
              : undefined,
          ],
          [
            {
              icon: 'TranslateOutline',
              translationId: ETranslations.global_language,
              renderElement: <LanguageListItem />,
            },
            {
              icon: 'DollarOutline',
              translationId: ETranslations.settings_default_currency,
              onPress: () => {
                navigation.push(EModalSettingRoutes.SettingCurrencyModal);
              },
            },
            {
              icon: 'PaletteOutline',
              translationId: ETranslations.settings_theme,
              renderElement: <ThemeListItem />,
            },
          ],
          [
            !platformEnv.isWeb
              ? {
                  icon: 'BellOutline',
                  translationId: ETranslations.global_notifications,
                  onPress: () => {
                    navigation.push(EModalSettingRoutes.SettingNotifications);
                  },
                }
              : undefined,
          ],
          [
            platformEnv.isExtension
              ? {
                  icon: 'MenuCircleHorOutline',
                  translationId: ETranslations.setting_floating_icon,
                  onPress: () => {
                    navigation.push(
                      EModalSettingRoutes.SettingFloatingIconModal,
                    );
                  },
                }
              : undefined,
          ],
        ],
      },
      {
        icon: 'WalletSolid',
        translationId: ETranslations.global_wallet,
        configs: [
          [
            {
              icon: 'ContactsOutline',
              translationId: ETranslations.settings_address_book,
              onPress: () => {
                void onPressAddressBook();
              },
            },
          ],
          [
            !platformEnv.isWeb
              ? {
                  icon: 'RefreshCcwOutline',
                  translationId:
                    ETranslations.settings_account_sync_modal_title,
                  onPress: () => {
                    navigation.push(
                      EModalSettingRoutes.SettingAlignPrimaryAccount,
                    );
                  },
                }
              : undefined,
            {
              icon: 'LabOutline',
              translationId: ETranslations.global_customize_transaction,
              onPress: () => {
                defaultLogger.setting.page.enterCustomizeTransaction();
                navigation.push(EModalSettingRoutes.SettingCustomTransaction);
              },
            },
          ],
          [
            {
              icon: 'BranchesOutline',
              translationId: ETranslations.settings_account_derivation_path,
              onPress: () => {
                navigation.push(
                  EModalSettingRoutes.SettingAccountDerivationModal,
                );
              },
            },
          ],
        ],
      },
      {
        icon: 'Shield2CheckSolid',
        translationId: ETranslations.global_security,
        configs: [
          [
            {
              translationId: biometricAuthInfo.titleId,
              icon: biometricAuthInfo.icon,
              renderElement: <BiologyAuthListItem />,
            },
            {
              icon: 'ClockTimeHistoryOutline',
              translationId: ETranslations.settings_auto_lock,
              navigateTo: EModalSettingRoutes.SettingAppAutoLockModal,
            },
            {
              icon: 'KeyOutline',
              translationId: ETranslations.global_change_passcode,
            },
          ],
          [
            {
              icon: 'LinkOutline',
              translationId: ETranslations.settings_connected_sites,
              navigateTo: EDAppConnectionModal.ConnectionList,
            },
            {
              icon: 'NoteOutline',
              translationId: ETranslations.settings_signature_record,
              navigateTo: EModalSettingRoutes.SettingSignatureRecordModal,
            },
          ],
          [
            {
              icon: 'FolderDeleteOutline',
              translationId: ETranslations.settings_clear_data,
              navigateTo: EModalSettingRoutes.SettingClearAppCache,
            },
          ],
        ],
      },
      {
        icon: 'GlobusSolid',
        translationId: ETranslations.global_network,
        configs: [
          [
            {
              icon: 'GlobeOutline',
              translationId:
                ETranslations.custom_network_add_network_action_text,
              navigateTo: EModalSettingRoutes.SettingCustomNetwork,
            },
            {
              icon: 'BezierNodesOutline',
              translationId: ETranslations.custom_rpc_title,
              navigateTo: EModalSettingRoutes.SettingCustomNetwork,
            },
            {
              icon: 'UsbOutline',
              renderElement: () => 'usb',
            },
          ],
          [
            {
              icon: 'FileDownloadOutline',
              translationId: ETranslations.settings_export_network_config_label,
              navigateTo: EModalSettingRoutes.SettingExportCustomNetworkConfig,
            },
          ],
        ],
      },
      {
        icon: 'InfoCircleSolid',
        translationId: ETranslations.global_about,
        configs: [
          [
            {
              icon: 'InfoCircleOutline',
              translationId: ETranslations.settings_whats_new,
            },
            {
              icon: 'HelpSupportOutline',
              translationId: ETranslations.settings_help_center,
            },
            {
              icon: 'EditOutline',
              translationId: ETranslations.global_contact_us,
            },
            platformEnv.isExtension ||
            platformEnv.isNativeAndroidGooglePlay ||
            platformEnv.isNativeIOS
              ? {
                  icon: 'StarOutline',
                  translationId: ETranslations.settings_rate_app,
                }
              : undefined,
          ],
          [
            {
              icon: 'PeopleOutline',
              translationId: ETranslations.settings_user_agreement,
            },
            {
              icon: 'FileTextOutline',
              translationId: ETranslations.settings_privacy_policy,
            },
          ],
          [
            {
              icon: 'ShortcutsCustom',
              translationId: ETranslations.settings_shortcuts,
              navigateTo: EModalShortcutsRoutes.ShortcutsPreview,
            },
          ],
          [
            {
              icon: 'FileDownloadOutline',
              translationId: ETranslations.settings_export_state_logs,
            },
          ],
        ],
      },
    ],
    [
      biometricAuthInfo.titleId,
      biometricAuthInfo.icon,
      navigation,
      isPrimeSubscriptionActive,
      onPressAddressBook,
    ],
  );
};
