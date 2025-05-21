import { useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IIconProps } from '@onekeyhq/components';
import {
  Badge,
  Button,
  Dialog,
  Divider,
  ESwitchSize,
  Page,
  ScrollView,
  SizableText,
  Stack,
  Switch,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Section } from '@onekeyhq/kit/src/components/Section';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { usePrimeCloudSyncPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { ELockDuration } from '@onekeyhq/shared/src/consts/appAutoLockConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { formatDistanceToNow } from '@onekeyhq/shared/src/utils/dateUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { AppAutoLockSettingsView } from '../../../Setting/pages/AppAutoLock';
import { usePrimeRequirements } from '../../hooks/usePrimeRequirements';

function isAutoLockValueNotAllowed(value: number) {
  return (
    value === Number(ELockDuration.Never) ||
    value === Number(ELockDuration.Hour4)
  );
}

function AutoLockUpdateDialogContent({
  onContinue,
  onError,
}: {
  onContinue: () => void;
  onError: (error: Error) => void;
}) {
  const intl = useIntl();
  const [selectedValue, setSelectedValue] = useState<string>('');
  return (
    <Stack>
      <ScrollView h={250} nestedScrollEnabled>
        <SizableText px="$5">
          {intl.formatMessage({
            id: ETranslations.prime_auto_lock_description,
          })}
        </SizableText>
        <AppAutoLockSettingsView
          disableCloudSyncDisallowedOptions
          useLocalState
          onValueChange={(v) => {
            setSelectedValue(v);
          }}
        />
      </ScrollView>
      <Dialog.Footer
        showCancelButton={false}
        confirmButtonProps={{
          disabled: isAutoLockValueNotAllowed(Number(selectedValue)),
        }}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_continue,
        })}
        onConfirm={async () => {
          try {
            await backgroundApiProxy.servicePassword.setAppLockDuration(
              Number(selectedValue),
            );
            onContinue();
          } catch (error) {
            onError(error as Error);
            throw error;
          }
        }}
      />
    </Stack>
  );
}

function EnableOneKeyCloudSwitchListItem() {
  const [config] = usePrimeCloudSyncPersistAtom();

  const isSubmittingRef = useRef(false);

  const intl = useIntl();

  const lastUpdateTime = useMemo<string>(() => {
    if (config.lastSyncTime) {
      return formatDistanceToNow(new Date(config.lastSyncTime));
    }
    return ' - ';
  }, [config.lastSyncTime]);
  const { ensurePrimeSubscriptionActive } = usePrimeRequirements();

  const [passwordSettings] = usePasswordPersistAtom();
  const shouldChangePasswordAutoLock = useMemo(() => {
    return (
      passwordSettings.isPasswordSet &&
      isAutoLockValueNotAllowed(passwordSettings.appLockDuration)
    );
  }, [passwordSettings.appLockDuration, passwordSettings.isPasswordSet]);

  return (
    <ListItem
      title="OneKey Cloud"
      icon="CloudOutline"
      subtitle={`${intl.formatMessage({
        id: ETranslations.prime_last_update,
      })} : ${lastUpdateTime}`}
    >
      <Switch
        disabled={false}
        size={ESwitchSize.small}
        onChange={async (value) => {
          await ensurePrimeSubscriptionActive();

          if (isSubmittingRef.current) {
            return;
          }
          try {
            isSubmittingRef.current = true;
            if (value) {
              const runEnableCloudSync = async () => {
                const {
                  success,
                  isServerMasterPasswordSet,
                  serverDiffItems,
                  encryptedSecurityPasswordR1ForServer,
                } =
                  await backgroundApiProxy.servicePrimeCloudSync.enableCloudSync();
                await backgroundApiProxy.servicePrimeCloudSync.setCloudSyncEnabled(
                  success,
                );
                if (serverDiffItems?.length) {
                  console.log('serverDiffItems>>>', serverDiffItems);
                  return;
                }
                if (success) {
                  await timerUtils.wait(0);
                  await backgroundApiProxy.serviceApp.showDialogLoading({
                    title: intl.formatMessage({
                      id: ETranslations.global_syncing,
                    }),
                  });
                  try {
                    await backgroundApiProxy.servicePrimeCloudSync.startServerSyncFlow(
                      {
                        isFlush: !isServerMasterPasswordSet, // flush if server master password is not set
                        setUndefinedTimeToNow: true,
                        callerName: 'Enable Cloud Sync',
                        encryptedSecurityPasswordR1ForServer,
                      },
                    );
                  } finally {
                    await timerUtils.wait(1000);
                    await backgroundApiProxy.serviceApp.hideDialogLoading();
                  }
                }
              };

              if (shouldChangePasswordAutoLock) {
                await new Promise<void>((resolve, reject) => {
                  Dialog.show({
                    title: intl.formatMessage({
                      id: ETranslations.settings_auto_lock,
                    }),
                    contentContainerProps: {
                      px: 0,
                    },
                    onClose: () => {
                      reject(new Error('User cancelled'));
                    },
                    onCancel: () => {
                      reject(new Error('User cancelled'));
                    },
                    renderContent: (
                      <AutoLockUpdateDialogContent
                        onContinue={() => {
                          resolve();
                        }}
                        onError={(error) => {
                          reject(error);
                        }}
                      />
                    ),
                  });
                });
              }
              await runEnableCloudSync();
            } else {
              // disable cloud sync
              await backgroundApiProxy.servicePrimeCloudSync.setCloudSyncEnabled(
                false,
              );
            }
          } catch (error) {
            // disable cloud sync
            await backgroundApiProxy.servicePrimeCloudSync.setCloudSyncEnabled(
              false,
            );
            throw error;
          } finally {
            isSubmittingRef.current = false;
          }
        }}
        value={config.isCloudSyncEnabled}
      />
    </ListItem>
  );
}

function WhatDataIncludedListItem() {
  const intl = useIntl();
  return (
    <ListItem
      title={intl.formatMessage({
        id: ETranslations.prime_what_data_included,
      })}
      icon="QuestionmarkOutline"
      subtitle={intl.formatMessage({
        id: ETranslations.prime_what_data_included_description,
      })}
      drillIn
      onPress={() => {
        const sectionProps = {
          titleProps: {
            paddingHorizontal: 0,
          },
        };
        const listItemProps: {
          px: number;
          mx: number;
          icon: IIconProps['name'];
          iconProps?: IIconProps;
        } = {
          px: 0,
          mx: 0,
          icon: 'CheckRadioSolid',
          iconProps: {
            color: '$iconSuccess',
          },
        };
        Dialog.show({
          title: intl.formatMessage({
            id: ETranslations.prime_what_data_included,
          }),
          showCancelButton: false,
          showConfirmButton: false,
          renderContent: (
            <Stack>
              <SizableText>
                {intl.formatMessage({
                  id: ETranslations.prime_what_data_included_description_long,
                })}
              </SizableText>
              <Stack mt="$2">
                <Section
                  title={intl.formatMessage({
                    id: ETranslations.global_wallet,
                  })}
                  {...sectionProps}
                >
                  <ListItem
                    {...listItemProps}
                    title={intl.formatMessage({
                      id: ETranslations.prime_wallet_list,
                    })}
                    subtitle={intl.formatMessage({
                      id: ETranslations.prime_wallet_list_description,
                    })}
                  />
                  <ListItem
                    {...listItemProps}
                    title={intl.formatMessage({
                      id: ETranslations.prime_custom_token_n_network,
                    })}
                  />
                </Section>

                <Section
                  title={intl.formatMessage({
                    id: ETranslations.global_browser,
                  })}
                  {...sectionProps}
                >
                  <ListItem
                    {...listItemProps}
                    title={intl.formatMessage({
                      id: ETranslations.explore_bookmarks,
                    })}
                  />
                </Section>

                <Section
                  title={intl.formatMessage({
                    id: ETranslations.global_market,
                  })}
                  {...sectionProps}
                >
                  <ListItem
                    {...listItemProps}
                    title={intl.formatMessage({
                      id: ETranslations.global_watchlist,
                    })}
                  />
                </Section>

                <Section
                  title={intl.formatMessage({
                    id: ETranslations.global_settings,
                  })}
                  {...sectionProps}
                >
                  <ListItem
                    {...listItemProps}
                    title={intl.formatMessage({
                      id: ETranslations.settings_address_book,
                    })}
                  />
                  <ListItem
                    {...listItemProps}
                    title={intl.formatMessage({
                      id: ETranslations.custom_rpc_title,
                    })}
                  />
                </Section>
              </Stack>
            </Stack>
          ),
        });
      }}
    />
  );
}

function AppDataSection() {
  const navigation = useAppNavigation();

  const [config] = usePrimeCloudSyncPersistAtom();

  const isSubmittingRef = useRef(false);

  const intl = useIntl();

  const lastUpdateTime = useMemo<string>(() => {
    if (config.lastSyncTime) {
      return formatDistanceToNow(new Date(config.lastSyncTime));
    }
    return ' - ';
  }, [config.lastSyncTime]);

  return (
    <Section title={intl.formatMessage({ id: ETranslations.prime_app_data })}>
      <EnableOneKeyCloudSwitchListItem />

      {config?.isCloudSyncEnabled ? (
        <ListItem
          title={intl.formatMessage({
            id: ETranslations.prime_change_backup_password,
          })}
          icon="Key2Outline"
          drillIn
          onPress={async () => {
            await backgroundApiProxy.serviceMasterPassword.startChangePassword();
          }}
        />
      ) : null}

      <WhatDataIncludedListItem />
    </Section>
  );
}

function WalletSection() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  return (
    <Section title={intl.formatMessage({ id: ETranslations.prime_wallet })}>
      <ListItem
        title={intl.formatMessage({
          id: ETranslations.transfer_transfer,
        })}
        icon="MultipleDevicesOutline"
        subtitle={intl.formatMessage({
          id: ETranslations.prime_transfer_description,
        })}
        // drillIn
        // onPress={() => {
        //   navigation.navigate(EPrimePages.PrimeCloudSyncDebug);
        // }}
      >
        <Badge badgeSize="sm">
          <Badge.Text>
            {intl.formatMessage({
              id: ETranslations.id_prime_soon,
            })}
          </Badge.Text>
        </Badge>
      </ListItem>
    </Section>
  );
}

export default function PagePrimeCloudSync() {
  const navigation = useAppNavigation();
  useEffect(() => {
    void backgroundApiProxy.servicePrimeCloudSync.showAlertDialogIfLocalPasswordNotSet();
  }, []);

  return (
    <Page scrollEnabled>
      <Page.Header title="OneKey Cloud" />
      <Page.Body>
        <AppDataSection />
        <Divider mt="$5" mb="$2" />
        <WalletSection />
        <Button
          mt="$5"
          onPress={() => {
            navigation.navigate(EPrimePages.PrimeCloudSyncDebug);
          }}
        >
          数据调试页面
        </Button>
      </Page.Body>
    </Page>
  );
}
