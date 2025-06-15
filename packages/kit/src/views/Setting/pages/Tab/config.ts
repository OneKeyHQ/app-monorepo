import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ECloudBackupRoutes,
  EDAppConnectionModal,
  ELiteCardRoutes,
  EModalAddressBookRoutes,
  EModalKeyTagRoutes,
  EModalSettingRoutes,
} from '@onekeyhq/shared/src/routes';
import { EModalShortcutsRoutes } from '@onekeyhq/shared/src/routes/shortcuts';

export const SettingsConfig = [
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
              navigateTo: ECloudBackupRoutes.CloudBackupHome,
            }
          : null,
        {
          icon: 'CloudOutline',
          translationId: ETranslations.global_onekey_cloud,
        },
      ],
      [
        platformEnv.isNative
          ? {
              icon: 'OnekeyLiteOutline',
              translationId: ETranslations.global_onekey_lite,
              navigateTo: ELiteCardRoutes.LiteCardHome,
            }
          : undefined,
        {
          icon: 'OnekeyKeytagOutline',
          translationId: ETranslations.global_onekey_keytag,
          navigateTo: EModalKeyTagRoutes.UserOptions,
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
              navigateTo: EDAppConnectionModal.DefaultWalletSettingsModal,
            }
          : undefined,
      ],
      [
        {
          icon: 'TranslateOutline',
          translationId: ETranslations.global_language,
        },
        {
          icon: 'DollarOutline',
          translationId: ETranslations.settings_default_currency,
        },
        {
          icon: 'PaletteOutline',
          translationId: ETranslations.settings_theme,
        },
      ],
      [
        !platformEnv.isWeb
          ? {
              icon: 'BellOutline',
              translationId: ETranslations.global_notifications,
              navigateTo: EModalSettingRoutes.SettingNotifications,
            }
          : undefined,
      ],
      [
        platformEnv.isExtension
          ? {
              icon: 'MenuCircleHorOutline',
              translationId: ETranslations.setting_floating_icon,
              navigateTo: EModalSettingRoutes.SettingFloatingIconModal,
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
          navigateTo: EModalAddressBookRoutes.ListItemModal,
        },
      ],
      [
        !platformEnv.isWeb
          ? {
              icon: 'RefreshCcwOutline',
              translationId: ETranslations.settings_account_sync_modal_title,
              navigateTo: EModalSettingRoutes.SettingAlignPrimaryAccount,
            }
          : undefined,
        {
          icon: 'LabOutline',
          translationId: ETranslations.global_customize_transaction,
          navigateTo: EModalSettingRoutes.SettingCustomTransaction,
        },
      ],
      [
        {
          icon: 'BranchesOutline',
          translationId: ETranslations.settings_account_derivation_path,
          navigateTo: EModalSettingRoutes.SettingAccountDerivationModal,
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
          translationId: ETranslations.global_face_id,
          renderElement: () => 'face_id',
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
          translationId: ETranslations.custom_network_add_network_action_text,
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
];
