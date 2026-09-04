import type { ComponentType } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type {
  IIconProps,
  IKeyOfIcons,
  ISizableTextProps,
  IStackStyle,
} from '@onekeyhq/components';
import { isNativeTablet } from '@onekeyhq/components';
import {
  isShowAppUpdateUIWhenUpdating,
  useAppUpdateInfo,
} from '@onekeyhq/kit/src/components/AppUpdate';
import { useKeylessWalletExistsLocal } from '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import type useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBiometricAuthInfo } from '@onekeyhq/kit/src/hooks/useBiometricAuthInfo';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { useShowAddressBook } from '@onekeyhq/kit/src/hooks/useShowAddressBook';
import {
  useDevSettingsPersistAtom,
  usePasswordBiologyAuthInfoAtom,
  usePasswordPersistAtom,
  usePasswordWebAuthInfoAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  APP_STORE_LINK,
  BRIDGE_STATUS_URL,
  PLAY_STORE_LINK,
} from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EDAppConnectionModal,
  ELiteCardRoutes,
  EModalKeyTagRoutes,
  EModalRoutes,
  EModalSettingRoutes,
  ESettingsTabNames,
} from '@onekeyhq/shared/src/routes';
import { EManualBackupRoutes } from '@onekeyhq/shared/src/routes/manualBackup';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { EModalShortcutsRoutes } from '@onekeyhq/shared/src/routes/shortcuts';
import { getOneKeyExtensionStoreUrl } from '@onekeyhq/shared/src/utils/extensionStoreUtils';
import {
  openUrlExternal,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';

import { useCloudBackup } from '../../../Onboardingv2/hooks/useCloudBackup';
import { SettingTestIDs, settingsSidebarTabTestID } from '../../testIDs';

import {
  AutoLockListItem,
  BTCFreshAddressListItem,
  BiologyAuthListItem,
  ChangeOrSetPasswordListItem,
  ClearAppCacheListItem,
  ClearPendingTransactionsListItem,
  CurrencyListItem,
  DesktopBluetoothListItem,
  HapticFeedbackListItem,
  HardwareTransportTypeListItem,
  LanguageListItem,
  ListVersionItem,
  MenuBarTrayListItem,
  ResetAppListItem,
  ResetPinListItem,
  SplitViewListItem,
  ThemeListItem,
  UseGasAccountByDefaultListItem,
} from './CustomElement';
import { showExportLogsDialog } from './exportLogs/showExportLogsDialog';
import { OFFICIAL_CHANNELS_SEARCH_KEYWORDS } from './officialChannels';
import { getSettingsDisplayTitle } from './settingsDisplay';
import { SETTINGS_SIDEBAR_ORDER } from './settingsRootLayout';
// import { OneKeyIdSubSettings } from './OneKeyIdSubSettings';
// import { OneKeyIdTabItem } from './OneKeyIdTabItem';
import { SubSearchSettings } from './SubSettings';
import {
  SubConnectionsSettings,
  SubNotificationsSettings,
} from './SubSettingsLinkPanes';
import { useSettingsLayout } from './useIsTabNavigator';

import type { RouteProp } from '@react-navigation/native';

const DevSettingsSection = LazyLoadPage(
  () =>
    import('./DevSettingsSection').then(
      ({ DevSettingsSection: Component }) => ({
        default: Component,
      }),
    ),
  undefined,
  true,
);

/**
 * Panes backing the sidebar tabs derived from `desktopTab` annotations.
 * `desktopTab` is typed against this map, so annotating an item with a tab
 * that has no pane component is a compile error instead of a blank tab.
 */
const settingsLinkTabComponents = {
  [ESettingsTabNames.Notifications]: SubNotificationsSettings,
  [ESettingsTabNames.Connections]: SubConnectionsSettings,
};

const SETTINGS_CONFIG_ORDER = new Map(
  [...SETTINGS_SIDEBAR_ORDER, ESettingsTabNames.Search].map((name, index) => [
    name,
    index,
  ]),
);

interface ISubSettingConfigBase {
  icon: string | IKeyOfIcons;
  title: string;
  mobileTitle?: string;
  subtitle?: string;
  keywords?: string[];
  /**
   * Phone layouts promote this item to the settings home cards; its own
   * category page hides it there.
   */
  mobileHome?: boolean;
  /**
   * Tab-navigator layouts promote this item to its own sidebar tab. The
   * synthetic tab category is derived from the item, so platform gating and
   * copy never fork from the source item. Must key into
   * `settingsLinkTabComponents` so every annotated tab has a pane.
   */
  desktopTab?: keyof typeof settingsLinkTabComponents;
  testID?: string;
  badgeProps?: {
    badgeSize: 'sm' | 'md' | 'lg';
    badgeText: string;
  };
  onPress?: (navigation?: ReturnType<typeof useAppNavigation>) => void;
  renderElement?: React.ReactElement<any>;
  /** If true, shows ArrowTopRightOutline icon instead of drill-in arrow for external links */
  isExternalLink?: boolean;
}

/**
 * Every item is search-indexed, so each needs a stable identity for analytics
 * and recent-search records (it must survive copy changes): an explicit
 * kebab-case `id`, or a `settingRoute` (the route within the SettingModal
 * navigator for direct navigation from universal search) that already
 * identifies it. Enforced here so an item with neither cannot compile.
 */
type ISubSettingIdentity =
  | { id: string; settingRoute?: EModalSettingRoutes }
  | { id?: string; settingRoute: EModalSettingRoutes };

export type ISubSettingConfig = ISubSettingConfigBase & ISubSettingIdentity;

export type ISettingsConfig = (
  | {
      icon: string;
      mobileIcon?: string | IKeyOfIcons;
      title: string;
      mobileTitle?: string;
      subtitle?: string;
      name: ESettingsTabNames;
      testID?: string;
      isHidden?: boolean;
      /**
       * Synthetic category derived from an item's `desktopTab` annotation.
       * Rendered only by the tab navigator; list layouts must skip it.
       */
      desktopOnlyTab?: boolean;
      showDot?: boolean;
      tabBarItemStyle?: IStackStyle;
      tabBarIconStyle?: IIconProps;
      tabBarLabelStyle?: ISizableTextProps;
      Component?: ComponentType<{
        route: RouteProp<any, any>;
        name: string;
        settingsConfig: ISettingsConfig;
      }>;
      configs: (ISubSettingConfig | undefined | null)[][];
      // Custom tab item renderer for special tabs like OneKey ID
      renderTabItem?: ComponentType<{
        selected?: boolean;
        onPress?: () => void;
      }>;
    }
  | undefined
)[];

export type ISettingCategoryConfig = NonNullable<ISettingsConfig[number]>;

export const useSettingsConfig: () => ISettingsConfig = () => {
  const appUpdateInfo = useAppUpdateInfo();
  const isShowAppUpdateUI = useMemo(() => {
    return isShowAppUpdateUIWhenUpdating({
      updateStrategy: appUpdateInfo.data.updateStrategy,
      updateStatus: appUpdateInfo.data.status,
    });
  }, [appUpdateInfo.data.updateStrategy, appUpdateInfo.data.status]);
  const shouldShowUpdate = isShowAppUpdateUI && appUpdateInfo.isNeedUpdate;
  const intl = useIntl();
  const { isMobileLayout } = useSettingsLayout();
  const onPressAddressBook = useShowAddressBook({
    useNewModal: false,
  });
  const [{ isPasswordSet }] = usePasswordPersistAtom();
  const [{ isSupport: biologyAuthIsSupport }] =
    usePasswordBiologyAuthInfoAtom();
  const [{ isSupport: webAuthIsSupport }] = usePasswordWebAuthInfoAtom();
  const biometricAuthInfo = useBiometricAuthInfo();
  const userAgreementUrl = useHelpLink({ path: 'articles/11461297' });
  const privacyPolicyUrl = useHelpLink({ path: 'articles/11461298' });
  const helpCenterUrl = useHelpLink({ path: '' });
  const [devSettings] = useDevSettingsPersistAtom();
  const [settings] = useSettingsPersistAtom();
  const { isPrimeActive } = useOneKeyAuth();

  const { cloudBackupFeatureInfo, startBackup } = useCloudBackup();

  const isKeylessWalletExistsLocal = useKeylessWalletExistsLocal();

  return useMemo(() => {
    const clearPendingTransactionsItem: ISubSettingConfig = {
      id: 'clear-pending-transactions',
      icon: 'ClockTimeHistoryOutline',
      title: intl.formatMessage({
        id: ETranslations.settings_clear_pending_transactions,
      }),
      renderElement: <ClearPendingTransactionsListItem />,
    };
    const config: ISettingsConfig = [
      // OneKey ID tab with custom rendering
      // {
      //   name: ESettingsTabNames.OneKeyID,
      //   icon: 'PeopleSolid' as const,
      //   title: 'OneKey ID',
      //   renderTabItem: OneKeyIdTabItem,
      //   Component: OneKeyIdSubSettings,
      //   configs: [],
      // },
      platformEnv.isWebDappMode
        ? undefined
        : {
            name: ESettingsTabNames.Backup,
            icon: 'CloudUploadSolid',
            mobileIcon: 'CloudUploadOutline',
            title: intl.formatMessage({
              id: ETranslations.global_backup,
            }),
            configs: [
              [
                cloudBackupFeatureInfo?.supportCloudBackup
                  ? {
                      id: 'cloud-backup',
                      icon: cloudBackupFeatureInfo?.icon,
                      title: cloudBackupFeatureInfo?.title,
                      onPress: (navigation) => {
                        navigation?.popStack();
                        void startBackup({ alwaysGoToBackupDetail: true });
                        // void goToPageBackupList();
                        // navigation?.pushModal(EModalRoutes.CloudBackupModal, {
                        //   screen: ECloudBackupRoutes.CloudBackupHome,
                        // });
                      },
                    }
                  : null,
                {
                  // OneKey Cloud
                  id: 'onekey-cloud',
                  icon: 'CloudOutline',
                  title: intl.formatMessage({
                    id: ETranslations.global_onekey_cloud,
                  }),
                  onPress: (navigation) => {
                    defaultLogger.prime.subscription.primeEntryClick({
                      featureName: EPrimeFeatures.OneKeyCloud,
                      entryPoint: 'settingsPage',
                      isPrimeActive,
                    });

                    navigation?.pushModal(EModalRoutes.PrimeModal, {
                      screen: EPrimePages.PrimeCloudSync,
                    });
                  },
                },
              ],
              [
                !platformEnv.isWebDappMode
                  ? {
                      // OneKey Transfer
                      id: 'onekey-transfer',
                      icon: 'MultipleDevicesOutline',
                      title: intl.formatMessage({
                        id: ETranslations.transfer_transfer,
                      }),
                      subtitle: intl.formatMessage({
                        id: ETranslations.prime_transfer_description,
                      }),
                      onPress: (navigation) => {
                        navigation?.pushModal(EModalRoutes.PrimeModal, {
                          screen: EPrimePages.PrimeTransfer,
                        });
                      },
                    }
                  : undefined,
              ],
              [
                !platformEnv.isWebDappMode
                  ? {
                      id: 'manual-backup',
                      icon: 'SignatureOutline',
                      title: intl.formatMessage({
                        id: ETranslations.manual_backup,
                      }),
                      onPress: (navigation) => {
                        navigation?.pushModal(EModalRoutes.ManualBackupModal, {
                          screen: EManualBackupRoutes.ManualBackupSelectWallet,
                        });
                      },
                    }
                  : undefined,
                platformEnv.isNative && !platformEnv.isNativeIOSMacCatalyst
                  ? {
                      id: 'onekey-lite',
                      icon: 'OnekeyLiteOutline',
                      title: intl.formatMessage({
                        id: ETranslations.global_onekey_lite,
                      }),
                      onPress: (navigation) => {
                        navigation?.pushModal(EModalRoutes.LiteCardModal, {
                          screen: ELiteCardRoutes.LiteCardHome,
                        });
                      },
                    }
                  : undefined,
                {
                  // OneKey Keytag
                  id: 'onekey-keytag',
                  icon: 'OnekeyKeytagOutline',
                  title: intl.formatMessage({
                    id: ETranslations.global_onekey_keytag,
                  }),
                  onPress: (navigation) => {
                    navigation?.pushModal(EModalRoutes.KeyTagModal, {
                      screen: EModalKeyTagRoutes.UserOptions,
                    });
                  },
                },
              ],
            ],
          },
      {
        name: ESettingsTabNames.Preferences,
        // No solid pair exists for SliderThree; both states use the outline.
        icon: 'SliderThreeOutline',
        mobileIcon: 'SliderThreeOutline',
        title: intl.formatMessage({
          id: ETranslations.global_preferences,
        }),
        configs: [
          [
            !platformEnv.isWeb
              ? {
                  id: 'notifications',
                  icon: 'BellOutline',
                  title: intl.formatMessage({
                    id: ETranslations.global_notifications,
                  }),
                  mobileHome: true,
                  desktopTab: ESettingsTabNames.Notifications,
                  testID: SettingTestIDs.notificationsItem,
                  settingRoute: EModalSettingRoutes.SettingNotifications,
                  onPress: (
                    navigation?: ReturnType<typeof useAppNavigation>,
                  ) => {
                    navigation?.push(EModalSettingRoutes.SettingNotifications);
                  },
                }
              : undefined,
            {
              id: 'language',
              icon: 'TranslateOutline',
              title: intl.formatMessage({
                id: ETranslations.global_language,
              }),
              renderElement: <LanguageListItem />,
            },
            {
              id: 'currency',
              icon: 'DollarOutline',
              title: intl.formatMessage({
                id: ETranslations.settings_default_currency,
              }),
              renderElement: <CurrencyListItem />,
            },
            {
              id: 'theme',
              icon: 'PaletteOutline',
              title: intl.formatMessage({
                id: ETranslations.settings_theme,
              }),
              renderElement: <ThemeListItem />,
            },
            platformEnv.isNative
              ? {
                  id: 'haptic-feedback',
                  icon: 'HandPointerOutline',
                  title: intl.formatMessage({
                    id: ETranslations.global_vibration_haptic,
                  }),
                  renderElement: <HapticFeedbackListItem />,
                }
              : undefined,
          ],
          [
            platformEnv.isSupportDesktopBle
              ? {
                  id: 'desktop-bluetooth',
                  icon: 'BluetoothOutline',
                  title: intl.formatMessage({
                    id: ETranslations.global_bluetooth,
                  }),
                  renderElement: <DesktopBluetoothListItem />,
                }
              : undefined,
            platformEnv.isDesktopMac
              ? {
                  id: 'menu-bar-tray',
                  icon: 'DockOutline',
                  title: intl.formatMessage({
                    id: ETranslations.settings_menu_bar_tray,
                  }),
                  subtitle: intl.formatMessage({
                    id: ETranslations.settings_menu_bar_tray_desc,
                  }),
                  renderElement: <MenuBarTrayListItem />,
                }
              : undefined,
            isNativeTablet()
              ? {
                  id: 'split-view',
                  icon: 'LayoutColumnOutline',
                  title: intl.formatMessage({
                    id: ETranslations.settings_split_view,
                  }),
                  subtitle: intl.formatMessage({
                    id: ETranslations.settings_split_view_desc,
                  }),
                  renderElement: <SplitViewListItem />,
                }
              : undefined,
          ],
          [
            platformEnv.isDesktop
              ? {
                  id: 'shortcuts',
                  icon: 'ShortcutsCustom',
                  title: intl.formatMessage({
                    id: ETranslations.settings_shortcuts,
                  }),
                  onPress: (navigation) => {
                    navigation?.pushModal(EModalRoutes.ShortcutsModal, {
                      screen: EModalShortcutsRoutes.ShortcutsPreview,
                    });
                  },
                }
              : undefined,
          ],
          [
            platformEnv.isExtension
              ? {
                  id: 'default-wallet-settings',
                  icon: 'ThumbtackOutline',
                  title: intl.formatMessage({
                    id: ETranslations.settings_default_wallet_settings,
                  }),
                  onPress: (navigation) => {
                    navigation?.pushModal(EModalRoutes.DAppConnectionModal, {
                      screen: EDAppConnectionModal.DefaultWalletSettingsModal,
                    });
                  },
                }
              : undefined,
          ],
        ],
      },
      {
        name: ESettingsTabNames.AppData,
        icon: 'StorageSolid',
        mobileIcon: 'StorageOutline',
        title: intl.formatMessage({
          id: ETranslations.app_data__title,
        }),
        configs: [
          [
            {
              id: 'clear-cache',
              icon: 'BroomOutline',
              testID: SettingTestIDs.clearAppCacheItem,
              title: intl.formatMessage({
                id: ETranslations.settings_clear_cache_on_app,
              }),
              renderElement: <ClearAppCacheListItem />,
            },
            platformEnv.isWebDappMode
              ? clearPendingTransactionsItem
              : undefined,
          ],
          [
            {
              id: 'reset-app',
              icon: 'FolderDeleteOutline',
              title: intl.formatMessage({
                id: ETranslations.settings_reset_app,
              }),
              renderElement: <ResetAppListItem />,
            },
          ],
        ],
      },
      platformEnv.isWebDappMode
        ? undefined
        : {
            name: ESettingsTabNames.Wallet,
            icon: 'WalletSolid',
            mobileIcon: 'WalletOutline',
            title: intl.formatMessage({
              id: ETranslations.global_wallet,
            }),
            configs: [
              [
                {
                  id: 'address-book',
                  icon: 'ContactsOutline',
                  title: intl.formatMessage({
                    id: ETranslations.settings_address_book,
                  }),
                  testID: SettingTestIDs.addressBookItem,
                  onPress: (navigation) => {
                    void onPressAddressBook(navigation);
                  },
                },
                !platformEnv.isWeb
                  ? {
                      id: 'account-sync',
                      icon: 'RefreshCcwOutline',
                      title: intl.formatMessage({
                        id: ETranslations.settings_account_sync_modal_title,
                      }),
                      settingRoute:
                        EModalSettingRoutes.SettingAlignPrimaryAccount,
                      onPress: (navigation) => {
                        navigation?.push(
                          EModalSettingRoutes.SettingAlignPrimaryAccount,
                        );
                      },
                    }
                  : undefined,
              ],
              [
                {
                  id: 'customize-transaction',
                  icon: 'LabOutline',
                  title: intl.formatMessage({
                    id: ETranslations.global_customize_transaction,
                  }),
                  keywords: [
                    intl.formatMessage({
                      id: ETranslations.global_customize_nonce,
                    }),
                    'nonce',
                    intl.formatMessage({
                      id: ETranslations.global_hex_data_title,
                    }),
                    'hex',
                  ],
                  settingRoute: EModalSettingRoutes.SettingCustomTransaction,
                  onPress: (navigation) => {
                    navigation?.push(
                      EModalSettingRoutes.SettingCustomTransaction,
                    );
                  },
                },
                {
                  id: 'gas-account',
                  icon: 'GasOutline',
                  title: intl.formatMessage({
                    id: ETranslations.settings_prefer_gas_account__title,
                  }),
                  subtitle: intl.formatMessage({
                    id: ETranslations.settings_prefer_gas_account__desc,
                  }),
                  renderElement: <UseGasAccountByDefaultListItem />,
                },
              ],
              [
                {
                  id: 'account-derivation',
                  icon: 'BranchesOutline',
                  title: intl.formatMessage({
                    id: ETranslations.settings_account_derivation_path,
                  }),
                  settingRoute:
                    EModalSettingRoutes.SettingAccountDerivationModal,
                  onPress: (navigation) => {
                    navigation?.push(
                      EModalSettingRoutes.SettingAccountDerivationModal,
                    );
                  },
                },
                {
                  id: 'btc-multiple-addresses',
                  icon: 'FlashCardSolid',
                  title: intl.formatMessage({
                    id: ETranslations.settings_btc_multiple_addresses,
                  }),
                  subtitle: intl.formatMessage({
                    id: ETranslations.settings_btc_multiple_addresses_description,
                  }),
                  renderElement: <BTCFreshAddressListItem />,
                },
              ],
              [clearPendingTransactionsItem],
            ],
          },
      platformEnv.isWebDappMode
        ? undefined
        : {
            name: ESettingsTabNames.Security,
            icon: 'Shield2CheckSolid',
            mobileIcon: 'Shield2CheckOutline',
            testID: SettingTestIDs.securityItem,
            title: intl.formatMessage({
              id: ETranslations.global_security,
            }),
            configs: [
              [
                isPasswordSet &&
                (biologyAuthIsSupport || webAuthIsSupport) &&
                !platformEnv.isWebDappMode
                  ? {
                      id: 'biometric-auth',
                      title: biometricAuthInfo.title,
                      icon: biometricAuthInfo.icon,
                      renderElement: <BiologyAuthListItem />,
                    }
                  : null,
                isPasswordSet && !platformEnv.isWebDappMode
                  ? {
                      id: 'auto-lock',
                      icon: 'ClockTimeHistoryOutline',
                      title: intl.formatMessage({
                        id: ETranslations.settings_auto_lock,
                      }),
                      renderElement: <AutoLockListItem />,
                    }
                  : null,
                platformEnv.isWebDappMode
                  ? undefined
                  : {
                      id: 'passcode',
                      icon: 'KeyOutline',
                      title: intl.formatMessage({
                        id: isPasswordSet
                          ? ETranslations.global_change_passcode
                          : ETranslations.global_set_passcode,
                      }),
                      renderElement: <ChangeOrSetPasswordListItem />,
                    },
                platformEnv.isWebDappMode || !isKeylessWalletExistsLocal
                  ? undefined
                  : {
                      id: 'reset-pin',
                      icon: 'InputOutline',
                      title: intl.formatMessage({
                        id: ETranslations.reset_pin,
                      }),
                      renderElement: <ResetPinListItem />,
                    },
              ],
              [
                platformEnv.isWebDappMode
                  ? undefined
                  : {
                      id: 'protection',
                      icon: 'ShieldCheckDoneOutline',
                      title: intl.formatMessage({
                        id: ETranslations.settings_protection,
                      }),
                      keywords: [
                        intl.formatMessage({
                          id: ETranslations.settings_token_risk_reminder,
                        }),
                        intl.formatMessage({
                          id: ETranslations.settings_protection_allowlist_title,
                        }),
                        intl.formatMessage({
                          id: ETranslations.settings_create_transactions,
                        }),
                        intl.formatMessage({
                          id: ETranslations.settings_create_remove_wallets,
                        }),
                        'allowlist',
                      ],
                      settingRoute: EModalSettingRoutes.SettingProtectModal,
                      onPress: (navigation) => {
                        navigation?.push(
                          EModalSettingRoutes.SettingProtectModal,
                        );
                      },
                    },
                platformEnv.isWebDappMode
                  ? undefined
                  : {
                      id: 'dapp-connections',
                      icon: 'LinkOutline',
                      title: intl.formatMessage({
                        id: ETranslations.settings_connected_sites,
                      }),
                      mobileTitle: intl.formatMessage({
                        id: ETranslations.explore_dapp_connections,
                      }),
                      mobileHome: true,
                      desktopTab: ESettingsTabNames.Connections,
                      keywords: [
                        intl.formatMessage({
                          id: ETranslations.settings_connected_sites,
                        }),
                        intl.formatMessage({
                          id: ETranslations.explore_dapp_connections,
                        }),
                        'dApp',
                        'WalletConnect',
                      ],
                      settingRoute:
                        EModalSettingRoutes.SettingDAppConnectionList,
                      onPress: (navigation) => {
                        navigation?.push(
                          EModalSettingRoutes.SettingDAppConnectionList,
                        );
                      },
                    },
                platformEnv.isWebDappMode
                  ? undefined
                  : {
                      id: 'signature-record',
                      icon: 'NoteOutline',
                      title: intl.formatMessage({
                        id: ETranslations.settings_signature_record,
                      }),
                      settingRoute:
                        EModalSettingRoutes.SettingSignatureRecordModal,
                      onPress: (navigation) => {
                        navigation?.push(
                          EModalSettingRoutes.SettingSignatureRecordModal,
                        );
                      },
                    },
              ],
              [
                platformEnv.isExtension
                  ? {
                      id: 'floating-icon',
                      icon: 'MenuCircleHorOutline',
                      title: intl.formatMessage({
                        id: ETranslations.setting_floating_icon,
                      }),
                      settingRoute:
                        EModalSettingRoutes.SettingFloatingIconModal,
                      onPress: (navigation) => {
                        navigation?.push(
                          EModalSettingRoutes.SettingFloatingIconModal,
                        );
                      },
                    }
                  : undefined,
              ],
            ],
          },
      platformEnv.isWebDappMode
        ? undefined
        : {
            name: ESettingsTabNames.Network,
            icon: 'GlobusSolid',
            mobileIcon: 'GlobusOutline',
            title: intl.formatMessage({
              id: ETranslations.global_network,
            }),
            mobileTitle: intl.formatMessage({
              id: ETranslations.global_networks,
            }),
            configs: [
              [
                {
                  id: 'add-network',
                  icon: 'GlobusOutline',
                  title: intl.formatMessage({
                    id: ETranslations.custom_network_add_network_action_text,
                  }),
                  settingRoute: EModalSettingRoutes.SettingChainListSearch,
                  onPress: (navigation) => {
                    navigation?.push(
                      EModalSettingRoutes.SettingChainListSearch,
                    );
                  },
                },
                {
                  id: 'custom-rpc',
                  icon: 'BezierNodesOutline',
                  title: intl.formatMessage({
                    id: ETranslations.custom_rpc_title,
                  }),
                  settingRoute: EModalSettingRoutes.SettingCustomRPC,
                  onPress: (navigation) => {
                    navigation?.push(EModalSettingRoutes.SettingCustomRPC);
                  },
                },
                platformEnv.isDev
                  ? {
                      id: 'hardware-communication',
                      icon: 'UsbOutline',
                      title: intl.formatMessage({
                        id: ETranslations.device_hardware_communication,
                      }),
                      renderElement: <HardwareTransportTypeListItem />,
                    }
                  : undefined,
                (platformEnv.isExtension || platformEnv.isWeb) &&
                settings.hardwareTransportType !== EHardwareTransportType.WEBUSB
                  ? {
                      id: 'hardware-bridge-status',
                      icon: 'ApiConnectionOutline',
                      title: intl.formatMessage({
                        id: ETranslations.settings_hardware_bridge_status,
                      }),
                      isExternalLink: true,
                      onPress: () => {
                        openUrlExternal(BRIDGE_STATUS_URL);
                      },
                    }
                  : undefined,
              ],
              [
                {
                  id: 'export-network-config',
                  icon: 'FileDownloadOutline',
                  title: intl.formatMessage({
                    id: ETranslations.settings_export_network_config_label,
                  }),
                  settingRoute:
                    EModalSettingRoutes.SettingExportCustomNetworkConfig,
                  onPress: (navigation) => {
                    navigation?.push(
                      EModalSettingRoutes.SettingExportCustomNetworkConfig,
                    );
                  },
                },
              ],
            ],
          },
      {
        name: ESettingsTabNames.About,
        icon: 'InfoCircleSolid',
        mobileIcon: 'InfoCircleOutline',
        testID: SettingTestIDs.aboutItem,
        title: intl.formatMessage({
          id: ETranslations.about_onekey__title,
        }),
        showDot: shouldShowUpdate,
        configs: [
          [
            {
              id: 'whats-new',
              icon: 'InfoCircleOutline',
              title: intl.formatMessage({
                id: shouldShowUpdate
                  ? ETranslations.settings_app_update_available
                  : ETranslations.settings_whats_new,
              }),
              renderElement: <ListVersionItem />,
            },
          ],
          [
            {
              id: 'help-center',
              icon: 'BookOpenOutline',
              title: intl.formatMessage({
                id: ETranslations.settings_help_center,
              }),
              onPress: () => {
                if (platformEnv.isDesktop || platformEnv.isNative) {
                  openUrlInDiscovery({ url: helpCenterUrl });
                } else {
                  openUrlExternal(helpCenterUrl);
                }
              },
            },
            {
              id: 'contact-us',
              icon: 'HelpSupportOutline',
              title: intl.formatMessage({
                id: ETranslations.global_contact_us,
              }),
              mobileHome: true,
              onPress: () => {
                void showIntercom();
              },
            },
            isMobileLayout
              ? {
                  icon: 'SpeakerPromoteOutline',
                  title: intl.formatMessage({
                    id: ETranslations.official_channels__title,
                  }),
                  keywords: [...OFFICIAL_CHANNELS_SEARCH_KEYWORDS],
                  mobileHome: true,
                  settingRoute: EModalSettingRoutes.SettingOfficialChannels,
                  testID: SettingTestIDs.officialChannelsItem,
                  onPress: (navigation) => {
                    navigation?.push(
                      EModalSettingRoutes.SettingOfficialChannels,
                    );
                  },
                }
              : undefined,
            platformEnv.isExtension ||
            platformEnv.isNativeAndroidGooglePlay ||
            platformEnv.isNativeIOS
              ? {
                  id: 'rate-app',
                  icon: 'StarOutline',
                  title: intl.formatMessage({
                    id: ETranslations.settings_rate_app,
                  }),
                  isExternalLink: true,
                  onPress: () => {
                    if (platformEnv.isExtension) {
                      window.open(
                        getOneKeyExtensionStoreUrl(),
                        intl.formatMessage({
                          id: ETranslations.settings_rate_app,
                        }),
                      );
                    } else if (platformEnv.isNativeAndroidGooglePlay) {
                      // Store hosts are forced to the system browser by the
                      // central openUrlExternal policy.
                      openUrlExternal(PLAY_STORE_LINK);
                    } else if (platformEnv.isNativeIOS) {
                      openUrlExternal(APP_STORE_LINK);
                    }
                  },
                }
              : undefined,
          ],
          [
            {
              id: 'user-agreement',
              icon: 'PeopleOutline',
              title: intl.formatMessage({
                id: ETranslations.settings_user_agreement,
              }),
              onPress: () => {
                if (platformEnv.isDesktop || platformEnv.isNative) {
                  openUrlInDiscovery({ url: userAgreementUrl });
                } else {
                  openUrlExternal(userAgreementUrl);
                }
              },
            },
            {
              id: 'privacy-policy',
              icon: 'FileTextOutline',
              title: intl.formatMessage({
                id: ETranslations.settings_privacy_policy,
              }),
              onPress: () => {
                if (platformEnv.isDesktop || platformEnv.isNative) {
                  openUrlInDiscovery({ url: privacyPolicyUrl });
                } else {
                  openUrlExternal(privacyPolicyUrl);
                }
              },
            },
          ],
          [
            {
              id: 'export-state-logs',
              icon: 'FileDownloadOutline',
              title: intl.formatMessage({
                id: ETranslations.settings_export_state_logs,
              }),
              onPress: () => {
                showExportLogsDialog({
                  title: intl.formatMessage({
                    id: ETranslations.settings_upload_state_logs,
                  }),
                });
              },
            },
          ],
        ],
      },
      devSettings.enabled
        ? {
            icon: 'CodeSolid',
            mobileIcon: 'CodeOutline',
            name: ESettingsTabNames.Dev,
            title: intl.formatMessage({
              id: ETranslations.global_dev_mode,
            }),
            testID: SettingTestIDs.devModeItem,
            tabBarItemStyle: {
              backgroundColor: '$bgCritical',
            },
            tabBarIconStyle: {
              color: '$iconCritical',
            },
            tabBarLabelStyle: {
              color: '$textCritical',
            },
            configs: [
              [
                {
                  id: 'dev-mode',
                  icon: 'CodeOutline',
                  title: intl.formatMessage({
                    id: ETranslations.global_dev_mode,
                  }),
                  renderElement: <DevSettingsSection />,
                },
              ],
            ],
          }
        : undefined,
      {
        icon: 'SearchOutline',
        name: ESettingsTabNames.Search,
        title: intl.formatMessage({
          id: ETranslations.settings_search_title,
        }),
        isHidden: true,
        configs: [],
        Component: SubSearchSettings,
      },
    ];
    // Desktop link tabs are derived from the annotated items so their
    // platform gating and copy never fork from the source item.
    const linkTabCategories: ISettingsConfig = config.flatMap(
      (category) =>
        category?.configs
          .flat()
          .filter(
            (
              item,
            ): item is ISubSettingConfig &
              Required<Pick<ISubSettingConfig, 'desktopTab'>> =>
              Boolean(item?.desktopTab),
          )
          .map((item) => ({
            name: item.desktopTab,
            icon: item.icon,
            mobileIcon: item.icon,
            title: getSettingsDisplayTitle(item, true),
            testID: item.testID
              ? settingsSidebarTabTestID(item.testID)
              : undefined,
            desktopOnlyTab: true,
            Component: settingsLinkTabComponents[item.desktopTab],
            configs: [],
          })) ?? [],
    );
    return [...config, ...linkTabCategories].toSorted((a, b) => {
      const aOrder = a
        ? (SETTINGS_CONFIG_ORDER.get(a.name) ?? SETTINGS_CONFIG_ORDER.size)
        : SETTINGS_CONFIG_ORDER.size + 1;
      const bOrder = b
        ? (SETTINGS_CONFIG_ORDER.get(b.name) ?? SETTINGS_CONFIG_ORDER.size)
        : SETTINGS_CONFIG_ORDER.size + 1;
      return aOrder - bOrder;
    });
  }, [
    intl,
    cloudBackupFeatureInfo?.supportCloudBackup,
    cloudBackupFeatureInfo?.icon,
    cloudBackupFeatureInfo?.title,
    isPasswordSet,
    biologyAuthIsSupport,
    webAuthIsSupport,
    biometricAuthInfo.title,
    biometricAuthInfo.icon,
    settings.hardwareTransportType,
    shouldShowUpdate,
    devSettings.enabled,
    isKeylessWalletExistsLocal,
    startBackup,
    onPressAddressBook,
    helpCenterUrl,
    userAgreementUrl,
    privacyPolicyUrl,
    isPrimeActive,
    isMobileLayout,
  ]);
};
