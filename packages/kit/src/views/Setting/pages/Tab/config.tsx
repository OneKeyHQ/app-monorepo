import type { ComponentType } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type {
  IIconProps,
  IKeyOfIcons,
  ISizableTextProps,
  IStackStyle,
} from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useKeylessWalletFeatureIsEnabled } from '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import PasswordUpdateContainer from '@onekeyhq/kit/src/components/Password/container/PasswordUpdateContainer';
import {
  isShowAppUpdateUIWhenUpdating,
  useAppUpdateInfo,
} from '@onekeyhq/kit/src/components/UpdateReminder/hooks';
import type useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBiometricAuthInfo } from '@onekeyhq/kit/src/hooks/useBiometricAuthInfo';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { useShowAddressBook } from '@onekeyhq/kit/src/hooks/useShowAddressBook';
import {
  useDevSettingsPersistAtom,
  usePasswordBiologyAuthInfoAtom,
  usePasswordPersistAtom,
  usePasswordWebAuthInfoAtom,
  usePerpsCommonConfigPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  APP_STORE_LINK,
  BRIDGE_STATUS_URL,
  EXT_RATE_URL,
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
} from '@onekeyhq/shared/src/routes';
import { EManualBackupRoutes } from '@onekeyhq/shared/src/routes/manualBackup';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { EModalShortcutsRoutes } from '@onekeyhq/shared/src/routes/shortcuts';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { useCloudBackup } from '../../../Onboardingv2/hooks/useCloudBackup';
import { usePrimeAvailable } from '../../../Prime/hooks/usePrimeAvailable';

import {
  AutoLockListItem,
  BTCFreshAddressListItem,
  BiologyAuthListItem,
  CleanDataListItem,
  ClearAppCacheListItem,
  CurrencyListItem,
  DesktopBluetoothListItem,
  HardwareTransportTypeListItem,
  LanguageListItem,
  ListVersionItem,
  ThemeListItem,
} from './CustomElement';
import { DevSettingsSection } from './DevSettingsSection';
import { showExportLogsDialog } from './exportLogs/showExportLogsDialog';
import { OneKeyIdSubSettings } from './OneKeyIdSubSettings';
import { OneKeyIdTabItem } from './OneKeyIdTabItem';
import { SubSearchSettings } from './SubSettings';

import type { RouteProp } from '@react-navigation/native';

export interface ISubSettingConfig {
  icon: string | IKeyOfIcons;
  title: string;
  subtitle?: string;
  badgeProps?: {
    badgeSize: 'sm' | 'md' | 'lg';
    badgeText: string;
  };
  onPress?: (navigation?: ReturnType<typeof useAppNavigation>) => void;
  renderElement?: React.ReactElement<any>;
}

export enum ESettingsTabNames {
  OneKeyID = 'OneKeyID',
  Backup = 'Backup',
  Preferences = 'Preferences',
  Wallet = 'Wallet',
  Security = 'Security',
  Network = 'Network',
  About = 'About',
  Search = 'Search',
  Dev = 'Dev',
}

export type ISettingsConfig = (
  | {
      icon: string;
      title: string;
      subtitle?: string;
      name: ESettingsTabNames;
      isHidden?: boolean;
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
export const useSettingsConfig: () => ISettingsConfig = () => {
  const appUpdateInfo = useAppUpdateInfo();
  const isShowAppUpdateUI = useMemo(() => {
    return isShowAppUpdateUIWhenUpdating({
      updateStrategy: appUpdateInfo.data.updateStrategy,
      updateStatus: appUpdateInfo.data.status,
    });
  }, [appUpdateInfo.data.updateStrategy, appUpdateInfo.data.status]);
  const intl = useIntl();
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
  const { isPrimeAvailable } = usePrimeAvailable();
  const { isLoggedIn } = useOneKeyAuth();
  const [{ perpConfigCommon }] = usePerpsCommonConfigPersistAtom();
  const [settings] = useSettingsPersistAtom();

  const { cloudBackupFeatureInfo, startBackup } = useCloudBackup();

  const isKeylessWalletEnabled = useKeylessWalletFeatureIsEnabled();

  return useMemo(
    () => [
      // OneKey ID tab with custom rendering
      ...(isKeylessWalletEnabled
        ? [
            {
              name: ESettingsTabNames.OneKeyID,
              icon: 'PeopleSolid' as const,
              title: 'OneKey ID',
              renderTabItem: OneKeyIdTabItem,
              Component: OneKeyIdSubSettings,
              configs: [],
            },
          ]
        : []),
      platformEnv.isWebDappMode
        ? undefined
        : {
            name: ESettingsTabNames.Backup,
            icon: 'CloudUploadSolid',
            title: intl.formatMessage({ id: ETranslations.global_backup }),
            configs: [
              [
                cloudBackupFeatureInfo?.supportCloudBackup
                  ? {
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
                isPrimeAvailable
                  ? {
                      // OneKey Cloud
                      icon: 'CloudOutline',
                      title: intl.formatMessage({
                        id: ETranslations.global_onekey_cloud,
                      }),
                      onPress: (navigation) => {
                        defaultLogger.prime.subscription.primeEntryClick({
                          featureName: EPrimeFeatures.OneKeyCloud,
                          entryPoint: 'settingsPage',
                        });

                        navigation?.pushModal(EModalRoutes.PrimeModal, {
                          screen: EPrimePages.PrimeCloudSync,
                        });
                      },
                    }
                  : undefined,
              ],
              [
                !platformEnv.isWebDappMode
                  ? {
                      // OneKey Transfer
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
                platformEnv.isNative
                  ? {
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
                  icon: 'OnekeyKeytagOutline',
                  title: intl.formatMessage({
                    id: ETranslations.global_onekey_keytag,
                  }),
                  onPress: (navigation) => {
                    defaultLogger.setting.page.enterKeyTag();
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
        icon: 'SettingsSolid',
        title: intl.formatMessage({
          id: ETranslations.global_preferences,
        }),
        configs: [
          [
            platformEnv.isExtension
              ? {
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
          [
            {
              icon: 'TranslateOutline',
              title: intl.formatMessage({
                id: ETranslations.global_language,
              }),
              renderElement: <LanguageListItem />,
            },
            {
              icon: 'DollarOutline',
              title: intl.formatMessage({
                id: ETranslations.settings_default_currency,
              }),
              renderElement: <CurrencyListItem />,
            },
            {
              icon: 'PaletteOutline',
              title: intl.formatMessage({
                id: ETranslations.settings_theme,
              }),
              renderElement: <ThemeListItem />,
            },
          ],
          [
            !platformEnv.isWeb
              ? {
                  icon: 'BellOutline',
                  title: intl.formatMessage({
                    id: ETranslations.global_notifications,
                  }),
                  onPress: (
                    navigation?: ReturnType<typeof useAppNavigation>,
                  ) => {
                    navigation?.push(EModalSettingRoutes.SettingNotifications);
                  },
                }
              : undefined,
          ],
          [
            platformEnv.isSupportDesktopBle
              ? {
                  icon: 'BluetoothOutline',
                  title: intl.formatMessage({
                    id: ETranslations.global_bluetooth,
                  }),
                  renderElement: <DesktopBluetoothListItem />,
                }
              : undefined,
          ],
        ],
      },
      {
        name: ESettingsTabNames.Wallet,
        icon: 'WalletSolid',
        title: intl.formatMessage({
          id: ETranslations.global_wallet,
        }),
        configs: [
          [
            platformEnv.isWebDappMode
              ? undefined
              : {
                  icon: 'ContactsOutline',
                  title: intl.formatMessage({
                    id: ETranslations.settings_address_book,
                  }),
                  onPress: (navigation) => {
                    void onPressAddressBook(navigation);
                  },
                },
          ],
          [
            !platformEnv.isWeb
              ? {
                  icon: 'RefreshCcwOutline',
                  title: intl.formatMessage({
                    id: ETranslations.settings_account_sync_modal_title,
                  }),
                  onPress: (navigation) => {
                    navigation?.push(
                      EModalSettingRoutes.SettingAlignPrimaryAccount,
                    );
                  },
                }
              : undefined,
            platformEnv.isWebDappMode
              ? undefined
              : {
                  icon: 'LabOutline',
                  title: intl.formatMessage({
                    id: ETranslations.global_customize_transaction,
                  }),
                  onPress: (navigation) => {
                    defaultLogger.setting.page.enterCustomizeTransaction();
                    navigation?.push(
                      EModalSettingRoutes.SettingCustomTransaction,
                    );
                  },
                },
          ],
          [
            platformEnv.isWebDappMode
              ? undefined
              : {
                  icon: 'BranchesOutline',
                  title: intl.formatMessage({
                    id: ETranslations.settings_account_derivation_path,
                  }),
                  onPress: (navigation) => {
                    navigation?.push(
                      EModalSettingRoutes.SettingAccountDerivationModal,
                    );
                  },
                },
          ],
          [
            !perpConfigCommon.disablePerp && !perpConfigCommon.usePerpWeb
              ? {
                  icon: 'BrowserOutline',
                  title: intl.formatMessage({
                    id: ETranslations.perp_setting_interface,
                  }),
                  onPress: (navigation) => {
                    navigation?.push(EModalSettingRoutes.SettingPerpUserConfig);
                  },
                }
              : null,
          ],
          [
            platformEnv.isWebDappMode
              ? undefined
              : {
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
        ],
      },
      {
        name: ESettingsTabNames.Security,
        icon: 'Shield2CheckSolid',
        title: intl.formatMessage({
          id: ETranslations.global_security,
        }),
        configs: [
          [
            isPasswordSet &&
            (biologyAuthIsSupport || webAuthIsSupport) &&
            !platformEnv.isWebDappMode
              ? {
                  title: biometricAuthInfo.title,
                  icon: biometricAuthInfo.icon,
                  renderElement: <BiologyAuthListItem />,
                }
              : null,
            isPasswordSet && !platformEnv.isWebDappMode
              ? {
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
                  icon: 'KeyOutline',
                  title: intl.formatMessage({
                    id: isPasswordSet
                      ? ETranslations.global_change_passcode
                      : ETranslations.global_set_passcode,
                  }),
                  onPress: async () => {
                    if (isPasswordSet) {
                      const oldEncodedPassword =
                        await backgroundApiProxy.servicePassword.promptPasswordVerify(
                          {
                            reason: EReasonForNeedPassword.Security,
                          },
                        );
                      const dialog = Dialog.show({
                        title: intl.formatMessage({
                          id: ETranslations.global_change_passcode,
                        }),
                        renderContent: (
                          <PasswordUpdateContainer
                            oldEncodedPassword={oldEncodedPassword.password}
                            onUpdateRes={async (data) => {
                              if (data) {
                                await dialog.close();
                              }
                            }}
                          />
                        ),
                        showFooter: false,
                      });
                    } else {
                      void backgroundApiProxy.servicePassword.promptPasswordVerify();
                    }
                  },
                },
          ],
          [
            platformEnv.isWebDappMode
              ? undefined
              : {
                  icon: 'ShieldCheckDoneOutline',
                  title: intl.formatMessage({
                    id: ETranslations.settings_protection,
                  }),
                  onPress: (navigation) => {
                    navigation?.push(EModalSettingRoutes.SettingProtectModal);
                  },
                },
            platformEnv.isWebDappMode
              ? undefined
              : {
                  icon: 'LinkOutline',
                  title: intl.formatMessage({
                    id: ETranslations.settings_connected_sites,
                  }),
                  onPress: (navigation) => {
                    navigation?.pushModal(EModalRoutes.DAppConnectionModal, {
                      screen: EDAppConnectionModal.ConnectionList,
                    });
                  },
                },
            platformEnv.isWebDappMode
              ? undefined
              : {
                  icon: 'NoteOutline',
                  title: intl.formatMessage({
                    id: ETranslations.settings_signature_record,
                  }),
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
                  icon: 'MenuCircleHorOutline',
                  title: intl.formatMessage({
                    id: ETranslations.setting_floating_icon,
                  }),
                  onPress: (navigation) => {
                    navigation?.push(
                      EModalSettingRoutes.SettingFloatingIconModal,
                    );
                  },
                }
              : undefined,
          ],
          [
            isLoggedIn
              ? {
                  icon: 'RemovePeopleOutline',
                  title: intl.formatMessage({
                    id: ETranslations.id_delete_onekey_id,
                  }),
                  onPress: (navigation) => {
                    navigation?.pushModal(EModalRoutes.PrimeModal, {
                      screen: EPrimePages.PrimeDeleteAccount,
                    });
                  },
                }
              : null,
          ],
          [
            {
              icon: 'BroomOutline',
              title: intl.formatMessage({
                id: ETranslations.settings_clear_cache_on_app,
              }),
              renderElement: <ClearAppCacheListItem />,
            },
            {
              icon: 'FolderDeleteOutline',
              title: intl.formatMessage({
                id: ETranslations.settings_clear_data,
              }),
              renderElement: <CleanDataListItem />,
            },
          ],
        ],
      },
      platformEnv.isWebDappMode
        ? undefined
        : {
            name: ESettingsTabNames.Network,
            icon: 'GlobusSolid',
            title: intl.formatMessage({
              id: ETranslations.global_network,
            }),
            configs: [
              [
                {
                  icon: 'GlobusOutline',
                  title: intl.formatMessage({
                    id: ETranslations.custom_network_add_network_action_text,
                  }),
                  onPress: (navigation) => {
                    defaultLogger.setting.page.enterCustomRPC();
                    navigation?.push(EModalSettingRoutes.SettingCustomNetwork);
                  },
                },
                {
                  icon: 'BezierNodesOutline',
                  title: intl.formatMessage({
                    id: ETranslations.custom_rpc_title,
                  }),
                  onPress: (navigation) => {
                    defaultLogger.setting.page.enterCustomRPC();
                    navigation?.push(EModalSettingRoutes.SettingCustomRPC);
                  },
                },
                platformEnv.isDev
                  ? {
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
                      icon: 'ApiConnectionOutline',
                      title: intl.formatMessage({
                        id: ETranslations.settings_hardware_bridge_status,
                      }),
                      onPress: () => {
                        openUrlExternal(BRIDGE_STATUS_URL);
                      },
                    }
                  : undefined,
              ],
              [
                {
                  icon: 'FileDownloadOutline',
                  title: intl.formatMessage({
                    id: ETranslations.settings_export_network_config_label,
                  }),
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
        title: intl.formatMessage({
          id: ETranslations.global_about,
        }),
        showDot: isShowAppUpdateUI && !!appUpdateInfo.isNeedUpdate,
        configs: [
          [
            {
              icon: 'InfoCircleOutline',
              title: intl.formatMessage({
                id: appUpdateInfo.isNeedUpdate
                  ? ETranslations.settings_app_update_available
                  : ETranslations.settings_whats_new,
              }),
              renderElement: <ListVersionItem />,
            },
            {
              icon: 'BookOpenOutline',
              title: intl.formatMessage({
                id: ETranslations.settings_help_center,
              }),
              onPress: () => {
                openUrlExternal(helpCenterUrl);
              },
            },
            {
              icon: 'HelpSupportOutline',
              title: intl.formatMessage({
                id: ETranslations.global_contact_us,
              }),
              onPress: () => {
                void showIntercom();
              },
            },
            platformEnv.isExtension ||
            platformEnv.isNativeAndroidGooglePlay ||
            platformEnv.isNativeIOS
              ? {
                  icon: 'StarOutline',
                  title: intl.formatMessage({
                    id: ETranslations.settings_rate_app,
                  }),
                  onPress: () => {
                    if (platformEnv.isExtension) {
                      let url = EXT_RATE_URL.chrome;
                      if (platformEnv.isExtFirefox) url = EXT_RATE_URL.firefox;
                      window.open(
                        url,
                        intl.formatMessage({
                          id: ETranslations.settings_rate_app,
                        }),
                      );
                    } else if (platformEnv.isNativeAndroidGooglePlay) {
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
              icon: 'PeopleOutline',
              title: intl.formatMessage({
                id: ETranslations.settings_user_agreement,
              }),
              onPress: (navigation) => {
                openUrlExternal(userAgreementUrl);
              },
            },
            {
              icon: 'FileTextOutline',
              title: intl.formatMessage({
                id: ETranslations.settings_privacy_policy,
              }),
              onPress: (navigation) => {
                openUrlExternal(privacyPolicyUrl);
              },
            },
          ],
          [
            platformEnv.isDesktop
              ? {
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
            {
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
            name: ESettingsTabNames.Dev,
            title: intl.formatMessage({
              id: ETranslations.global_dev_mode,
            }),
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
    ],
    [
      intl,
      cloudBackupFeatureInfo?.supportCloudBackup,
      cloudBackupFeatureInfo?.icon,
      cloudBackupFeatureInfo?.title,
      isPrimeAvailable,
      perpConfigCommon.disablePerp,
      perpConfigCommon.usePerpWeb,
      isPasswordSet,
      biologyAuthIsSupport,
      webAuthIsSupport,
      biometricAuthInfo.title,
      biometricAuthInfo.icon,
      isLoggedIn,
      settings.hardwareTransportType,
      isShowAppUpdateUI,
      appUpdateInfo.isNeedUpdate,
      devSettings.enabled,
      isKeylessWalletEnabled,
      startBackup,
      onPressAddressBook,
      helpCenterUrl,
      userAgreementUrl,
      privacyPolicyUrl,
    ],
  );
};
