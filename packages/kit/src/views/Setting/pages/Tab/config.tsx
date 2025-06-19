import type { ComponentType } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type {
  IIconProps,
  IKeyOfIcons,
  ISizableTextProps,
  IStackStyle,
} from '@onekeyhq/components';
import { Dialog, SizableText, Stack, useClipboard } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import PasswordUpdateContainer from '@onekeyhq/kit/src/components/Password/container/PasswordUpdateContainer';
import { useAppUpdateInfo } from '@onekeyhq/kit/src/components/UpdateReminder/hooks';
import type useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBiometricAuthInfo } from '@onekeyhq/kit/src/hooks/useBiometricAuthInfo';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { useShowAddressBook } from '@onekeyhq/kit/src/hooks/useShowAddressBook';
import {
  useDevSettingsPersistAtom,
  usePasswordBiologyAuthInfoAtom,
  usePasswordPersistAtom,
  usePasswordWebAuthInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  APP_STORE_LINK,
  BRIDGE_STATUS_URL,
  EXT_RATE_URL,
  PLAY_STORE_LINK,
} from '@onekeyhq/shared/src/config/appConfig';
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
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { usePrimeAuthV2 } from '../../../Prime/hooks/usePrimeAuthV2';
import { DevSettingsSection } from '../List/DevSettingsSection';
import { exportLogs } from '../List/ResourceSection/StateLogsItem/logs';

import {
  AutoLockListItem,
  BiologyAuthListItem,
  CleanDataListItem,
  CurrencyListItem,
  HardwareTransportTypeListItem,
  LanguageListItem,
  ListVersionItem,
  ThemeListItem,
} from './CustomElement';
import { SubSearchSettings } from './SubSettings';

export interface ISubSettingConfig {
  icon: string | IKeyOfIcons;
  title: string;
  badgeProps?: {
    badgeSize: 'sm' | 'md' | 'lg';
    badgeText: string;
  };
  onPress?: (navigation?: ReturnType<typeof useAppNavigation>) => void;
  renderElement?: React.ReactElement;
}

export enum ESettingsTabNames {
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
      name: ESettingsTabNames;
      isHidden?: boolean;
      tabBarItemStyle?: IStackStyle;
      tabBarIconStyle?: IIconProps;
      tabBarLabelStyle?: ISizableTextProps;
      Component?: ComponentType<{
        name: string;
        settingsConfig: ISettingsConfig;
      }>;
      configs: (ISubSettingConfig | undefined | null)[][];
    }
  | undefined
)[];
export const useSettingsConfig: () => ISettingsConfig = () => {
  const appUpdateInfo = useAppUpdateInfo();
  const intl = useIntl();
  const { isPrimeSubscriptionActive } = usePrimeAuthV2();
  const onPressAddressBook = useShowAddressBook({
    useNewModal: false,
  });
  const [{ isPasswordSet }] = usePasswordPersistAtom();
  const [{ isSupport: biologyAuthIsSupport }] =
    usePasswordBiologyAuthInfoAtom();
  const [{ isSupport: webAuthIsSupport }] = usePasswordWebAuthInfoAtom();
  const { copyText } = useClipboard();
  const biometricAuthInfo = useBiometricAuthInfo();
  const userAgreementUrl = useHelpLink({ path: 'articles/360002014776' });
  const privacyPolicyUrl = useHelpLink({ path: 'articles/360002003315' });
  const requestUrl = useHelpLink({ path: 'requests/new' });
  const helpCenterUrl = useHelpLink({ path: '' });
  const [devSettings] = useDevSettingsPersistAtom();
  return useMemo(
    () => [
      {
        name: ESettingsTabNames.Backup,
        icon: 'CloudUploadSolid',
        title: intl.formatMessage({ id: ETranslations.global_backup }),
        configs: [
          [
            platformEnv.isNative
              ? {
                  icon: 'RepeatOutline',
                  title: intl.formatMessage({
                    id: platformEnv.isNativeAndroid
                      ? ETranslations.settings_google_drive_backup
                      : ETranslations.settings_icloud_backup,
                  }),
                  onPress: (navigation) => {
                    navigation?.pushModal(EModalRoutes.CloudBackupModal, {
                      screen: ECloudBackupRoutes.CloudBackupHome,
                    });
                  },
                }
              : null,
            {
              icon: 'CloudOutline',
              title: intl.formatMessage({
                id: ETranslations.global_onekey_cloud,
              }),
              badgeProps: {
                badgeSize: 'sm',
                badgeText: 'Prime',
              },
              onPress: (navigation) => {
                if (isPrimeSubscriptionActive) {
                  navigation?.pushModal(EModalRoutes.PrimeModal, {
                    screen: EPrimePages.PrimeCloudSync,
                  });
                } else {
                  navigation?.pushModal(EModalRoutes.PrimeModal, {
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
            {
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
            {
              icon: 'LabOutline',
              title: intl.formatMessage({
                id: ETranslations.global_customize_transaction,
              }),
              onPress: (navigation) => {
                defaultLogger.setting.page.enterCustomizeTransaction();
                navigation?.push(EModalSettingRoutes.SettingCustomTransaction);
              },
            },
          ],
          [
            {
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
            isPasswordSet && (biologyAuthIsSupport || webAuthIsSupport)
              ? {
                  title: biometricAuthInfo.title,
                  icon: biometricAuthInfo.icon,
                  renderElement: <BiologyAuthListItem />,
                }
              : null,
            isPasswordSet
              ? {
                  icon: 'ClockTimeHistoryOutline',
                  title: intl.formatMessage({
                    id: ETranslations.settings_auto_lock,
                  }),
                  renderElement: <AutoLockListItem />,
                }
              : null,
            {
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
            {
              icon: 'ShieldCheckDoneOutline',
              title: intl.formatMessage({
                id: ETranslations.settings_protection,
              }),
              onPress: (navigation) => {
                navigation?.push(EModalSettingRoutes.SettingProtectModal);
              },
            },
            {
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
            {
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
      {
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
            platformEnv.isSupportWebUSB
              ? {
                  icon: 'UsbOutline',
                  title: intl.formatMessage({
                    id: ETranslations.device_hardware_communication,
                  }),
                  renderElement: <HardwareTransportTypeListItem />,
                }
              : undefined,
            platformEnv.isExtension || platformEnv.isWeb
              ? {
                  icon: 'ApiConnectionOutline',
                  title: intl.formatMessage({
                    id: ETranslations.settings_hardware_bridge_status,
                  }),
                  onPress: (navigation) => {
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
              icon: 'HelpSupportOutline',
              title: intl.formatMessage({
                id: ETranslations.settings_help_center,
              }),
              onPress: (navigation) => {
                openUrlExternal(helpCenterUrl);
              },
            },
            {
              icon: 'EditOutline',
              title: intl.formatMessage({
                id: ETranslations.global_contact_us,
              }),
              onPress: (navigation) => {
                openUrlExternal(requestUrl);
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
                  onPress: (navigation) => {
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
              onPress: (navigation) => {
                Dialog.show({
                  icon: 'FileDownloadOutline',
                  title: intl.formatMessage({
                    id: ETranslations.settings_export_state_logs,
                  }),
                  renderContent: (
                    <Stack>
                      <SizableText size="$bodyLg">
                        {intl.formatMessage({
                          id: ETranslations.settings_logs_do_not_include_sensitive_data,
                        })}
                      </SizableText>
                      <Stack h="$5" />
                      <SizableText size="$bodyLg">
                        {intl.formatMessage(
                          {
                            id: ETranslations.settings_export_state_logs_desc,
                          },
                          {
                            email: (
                              <SizableText
                                size="$bodyLg"
                                textDecorationLine="underline"
                                onPress={() => copyText('hi@onekey.so')}
                              >
                                hi@onekey.so
                              </SizableText>
                            ),
                          },
                        )}
                      </SizableText>
                    </Stack>
                  ),
                  confirmButtonProps: {
                    variant: 'primary',
                  },
                  onConfirmText: intl.formatMessage({
                    id: ETranslations.global_export,
                  }),
                  onConfirm: () => {
                    const str = new Date().toISOString().replace(/[-:.]/g, '');
                    void exportLogs(`OneKeyLogs-${str}`);
                  },
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
      isPasswordSet,
      biologyAuthIsSupport,
      webAuthIsSupport,
      biometricAuthInfo.title,
      biometricAuthInfo.icon,
      appUpdateInfo.isNeedUpdate,
      devSettings.enabled,
      isPrimeSubscriptionActive,
      onPressAddressBook,
      helpCenterUrl,
      requestUrl,
      userAgreementUrl,
      privacyPolicyUrl,
      copyText,
    ],
  );
};
