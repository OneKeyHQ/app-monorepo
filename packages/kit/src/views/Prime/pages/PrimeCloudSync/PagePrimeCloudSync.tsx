import { useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

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
  startViewTransition,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import { Section } from '@onekeyhq/kit/src/components/Section';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { usePrimeCloudSyncPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { ELockDuration } from '@onekeyhq/shared/src/consts/appAutoLockConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { IPrimeParamList } from '@onekeyhq/shared/src/routes/prime';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { formatDistanceToNow } from '@onekeyhq/shared/src/utils/dateUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { AppAutoLockSettingsView } from '../../../Setting/pages/AppAutoLock';
import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';
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
            startViewTransition(async () => {
              await backgroundApiProxy.servicePassword.setAppLockDuration(
                Number(selectedValue),
              );
            });
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
  const { isPrimeSubscriptionActive } = usePrimeAuthV2();
  const navigation = useAppNavigation();
  const route = useAppRoute<IPrimeParamList, EPrimePages.PrimeCloudSync>();
  const serverUserInfo = route.params?.serverUserInfo;

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

  const { user } = usePrimeAuthV2();
  const isPrimeUser = user?.primeSubscription?.isActive && user?.privyUserId;

  return (
    <ListItem
      title={intl.formatMessage({
        id: ETranslations.global_onekey_cloud,
      })}
      icon="CloudOutline"
      subtitle={`${intl.formatMessage({
        id: ETranslations.prime_last_update,
      })} : ${lastUpdateTime}`}
    >
      {!isPrimeUser ? (
        <Badge badgeSize="sm" badgeType="default">
          <Badge.Text>
            {intl.formatMessage({
              id: ETranslations.prime_status_prime,
            })}
          </Badge.Text>
        </Badge>
      ) : null}
      <Switch
        disabled={false}
        size={ESwitchSize.small}
        onChange={async (value) => {
          if (value && !isPrimeSubscriptionActive) {
            navigation?.pushModal(EModalRoutes.PrimeModal, {
              screen: EPrimePages.PrimeFeatures,
              params: {
                showAllFeatures: false,
                selectedFeature: EPrimeFeatures.OneKeyCloud,
                selectedSubscriptionPeriod: 'P1Y',
                serverUserInfo,
              },
            });
            return;
          }
          if (value) {
            await ensurePrimeSubscriptionActive();
          }

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
                    isAsync: true,
                    disableDrag: true,
                    dismissOnOverlayPress: true,
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
  const navigation = useAppNavigation();

  return (
    <ListItem
      title={intl.formatMessage({
        id: ETranslations.prime_about_cloud_sync,
      })}
      icon="QuestionmarkOutline"
      subtitle={intl.formatMessage({
        id: ETranslations.prime_about_cloud_sync_description,
      })}
      drillIn
      onPress={() => {
        navigation.navigate(EPrimePages.PrimeCloudSyncInfo);
      }}
    />
  );
}

function AppDataSection() {
  const navigation = useAppNavigation();
  const route = useAppRoute<IPrimeParamList, EPrimePages.PrimeCloudSync>();
  const forceReloadServerUserInfo = useRef(false);
  const serverUserInfo = route.params?.serverUserInfo;

  const [config] = usePrimeCloudSyncPersistAtom();

  const isSubmittingRef = useRef(false);

  const { result: isServerMasterPasswordSet, run: reloadServerUserInfo } =
    usePromiseResult(() => {
      return backgroundApiProxy.serviceMasterPassword.IsServerMasterPasswordSet(
        {
          serverUserInfo: forceReloadServerUserInfo.current
            ? undefined
            : serverUserInfo,
        },
      );
    }, [serverUserInfo]);

  const intl = useIntl();

  const lastUpdateTime = useMemo<string>(() => {
    if (config.lastSyncTime) {
      return formatDistanceToNow(new Date(config.lastSyncTime));
    }
    return ' - ';
  }, [config.lastSyncTime]);

  return (
    <>
      <EnableOneKeyCloudSwitchListItem />

      {config?.isCloudSyncEnabled || isServerMasterPasswordSet ? (
        <ListItem
          title={intl.formatMessage({
            id: ETranslations.prime_change_backup_password,
          })}
          icon="Key2Outline"
          drillIn
          onPress={async () => {
            try {
              await backgroundApiProxy.serviceMasterPassword.startChangePassword();
            } finally {
              forceReloadServerUserInfo.current = true;
              await reloadServerUserInfo();
            }
          }}
        />
      ) : null}

      <WhatDataIncludedListItem />
    </>
  );
}

function WalletSection() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [transferEnabled, setTransferEnabled] = useState(false);
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
        drillIn={transferEnabled}
        onPress={
          transferEnabled
            ? () => {
                navigation.navigate(EPrimePages.PrimeTransfer);
              }
            : undefined
        }
      >
        {transferEnabled ? null : (
          <Badge badgeSize="sm">
            <Badge.Text>
              {intl.formatMessage({
                id: ETranslations.id_prime_soon,
              })}
            </Badge.Text>
          </Badge>
        )}
      </ListItem>
      <MultipleClickStack
        showDevBgColor
        onPress={() => {
          setTransferEnabled(true);
        }}
      >
        <Stack h="$20" />
      </MultipleClickStack>
    </Section>
  );
}

export default function PagePrimeCloudSync() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  useEffect(() => {
    void backgroundApiProxy.servicePrimeCloudSync.showAlertDialogIfLocalPasswordNotSet();
  }, []);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_onekey_cloud,
        })}
      />
      <Page.Body>
        <AppDataSection />
        <MultipleClickStack
          onPress={() => {
            navigation.navigate(EPrimePages.PrimeCloudSyncDebug);
          }}
        >
          <Stack h="$32" />
        </MultipleClickStack>
      </Page.Body>
    </Page>
  );
}
