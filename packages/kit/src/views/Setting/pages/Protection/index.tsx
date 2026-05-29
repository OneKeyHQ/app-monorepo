import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Divider,
  ESwitchSize,
  Empty,
  Page,
  ScrollView,
  SectionList,
  SizableText,
  Spinner,
  Stack,
  Switch,
  YStack,
  startViewTransition,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIsEnableTransferAllowList } from '@onekeyhq/kit/src/components/AddressInput/hooks';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useOneKeyAuthMethods } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import PassCodeProtectionSwitch from '@onekeyhq/kit/src/components/Password/container/PassCodeProtectionSwitch';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

const SettingProtectionModal = () => {
  const intl = useIntl();
  const [
    {
      tokenRiskReminder,
      protectCreateTransaction,
      protectCreateOrRemoveWallet,
      receiveRiskMonitoringMap,
    },
    setSettings,
  ] = useSettingsPersistAtom();
  const { isPrimeSubscriptionActive } = useOneKeyAuthMethods();
  const [{ onekeyUserId }] = usePrimePersistAtom();
  const isEnableTransferAllowList = useIsEnableTransferAllowList();
  const [enableProtection, setEnableProtection] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isUpdatingReceiveRiskMonitoring, setIsUpdatingReceiveRiskMonitoring] =
    useState(false);
  const navigation = useAppNavigation();

  const useIsFocused = useRouteIsFocused();

  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLockTimer = useCallback(() => {
    if (lockTimer.current) {
      clearTimeout(lockTimer.current);
    }
  }, []);

  const updateLockTimer = useCallback(() => {
    clearLockTimer();
    lockTimer.current = setTimeout(() => {
      setIsLocked(true);
    }, 60 * 1000);
  }, [clearLockTimer]);

  // https://github.com/facebook/react/issues/31819
  // Page flicker caused by Suspense throttling behavior.
  const handleTransition = useCallback(
    (fn: () => Promise<void>) => {
      startViewTransition(fn);
      updateLockTimer();
    },
    [updateLockTimer],
  );

  const handleToggleReceiveRiskMonitoring = useCallback(
    async (value: boolean) => {
      setIsUpdatingReceiveRiskMonitoring(true);
      try {
        // The background method persists the per-user enabled state only on success,
        // so the switch flips only after the server confirms the change.
        await backgroundApiProxy.serviceSetting.apiSetKytEnabled({
          enabled: value,
        });
      } catch {
        // Error toast is handled by @toastIfError in the background method;
        // local state stays unchanged so the switch keeps its previous position.
      } finally {
        setIsUpdatingReceiveRiskMonitoring(false);
        updateLockTimer();
      }
    },
    [updateLockTimer],
  );

  useEffect(() => {
    if (useIsFocused) {
      updateLockTimer();
    } else {
      clearLockTimer();
      setIsLocked(true);
    }
    return () => {
      clearLockTimer();
    };
  }, [clearLockTimer, updateLockTimer, useIsFocused]);

  const checkEnableProtection = useCallback(
    async (autoPopNavigation = false) => {
      try {
        const passwordRes =
          await backgroundApiProxy.servicePassword.promptPasswordVerify({
            reason: EReasonForNeedPassword.Security,
          });
        if (passwordRes) {
          setEnableProtection(true);
          setIsLocked(false);
        } else {
          if (autoPopNavigation) {
            navigation.pop();
          }
          setIsLocked(true);
        }
      } catch (_e) {
        if (autoPopNavigation) {
          navigation.pop();
        }
        setIsLocked(true);
      }
    },
    [navigation],
  );

  useEffect(() => {
    if (!enableProtection) {
      void checkEnableProtection(true);
    }
  }, [checkEnableProtection, enableProtection, navigation]);

  const renderEnableProtection = useCallback(() => {
    if (isLocked) {
      return (
        <Stack h="100%" flex={1} alignItems="center" justifyContent="center">
          <Empty
            icon="UnlockedOutline"
            button={
              <Button
                onPress={() => checkEnableProtection()}
                testID="setting-render-enable-protection-btn"
              >
                {intl.formatMessage({
                  id: ETranslations.global_unlock,
                })}
              </Button>
            }
          />
        </Stack>
      );
    }
    return enableProtection ? (
      <ScrollView>
        <YStack pb="$10">
          <SectionList.SectionHeader
            title={intl.formatMessage({
              id: ETranslations.settings_token_risk_protection,
            })}
          />
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.settings_token_risk_reminder,
            })}
            subtitle={intl.formatMessage({
              id: ETranslations.settings_token_risk_reminder_desc,
            })}
          >
            <Switch
              testID="setting-switch"
              size={ESwitchSize.small}
              value={tokenRiskReminder}
              onChange={async (value) => {
                handleTransition(async () => {
                  setSettings((v) => ({ ...v, tokenRiskReminder: !!value }));
                });
              }}
            />
          </ListItem>
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.settings_protection_allowlist_title,
            })}
            subtitle={intl.formatMessage({
              id: ETranslations.settings_protection_allowlist_content,
            })}
          >
            <Switch
              testID="setting-switch"
              size={ESwitchSize.small}
              value={isEnableTransferAllowList}
              onChange={async (value) => {
                handleTransition(async () => {
                  await backgroundApiProxy.serviceSetting.setIsEnableTransferAllowList(
                    value,
                  );
                });
              }}
            />
          </ListItem>
          <Divider my="$5" mx="$5" />
          <SectionList.SectionHeader title="Receive risk monitoring" />
          <ListItem
            title="Monitor incoming transfers"
            subtitle="Check supported incoming token transfers for fund-source risk."
            {...(!isPrimeSubscriptionActive && {
              onPress: () => {
                navigation.pushModal(EModalRoutes.PrimeModal, {
                  screen: EPrimePages.PrimeDashboard,
                  params: {
                    fromFeature: EPrimeFeatures.ReceiveRiskMonitoring,
                  },
                });
              },
            })}
          >
            {isPrimeSubscriptionActive ? null : (
              <Badge badgeSize="sm" badgeType="default">
                <Badge.Text size="$bodySmMedium">
                  {intl.formatMessage({
                    id: ETranslations.prime_status_prime,
                  })}
                </Badge.Text>
              </Badge>
            )}
            {isUpdatingReceiveRiskMonitoring ? (
              <Stack w={38} h="$6" alignItems="center" justifyContent="center">
                <Spinner size="small" />
              </Stack>
            ) : (
              <Switch
                testID="setting-receive-risk-monitoring-switch"
                size={ESwitchSize.small}
                value={
                  isPrimeSubscriptionActive
                    ? (receiveRiskMonitoringMap?.[onekeyUserId ?? ''] ?? false)
                    : false
                }
                disabled={!isPrimeSubscriptionActive}
                onChange={(value) => {
                  void handleToggleReceiveRiskMonitoring(!!value);
                }}
              />
            )}
          </ListItem>
          <ListItem
            testID="setting-receive-risk-supported-assets"
            title="Supported assets"
            subtitle="View networks and tokens"
            drillIn
            onPress={() => {
              navigation.push(
                EModalSettingRoutes.SettingReceiveRiskSupportedAssets,
              );
            }}
          />
          <Divider my="$5" mx="$5" />
          <SectionList.SectionHeader
            title={intl.formatMessage({
              id: ETranslations.settings_passcode_bypass,
            })}
          />
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.settings_create_transactions,
            })}
          >
            <Switch
              testID="setting-switch"
              size={ESwitchSize.small}
              value={!protectCreateTransaction}
              onChange={async (value) => {
                handleTransition(async () => {
                  await backgroundApiProxy.serviceSetting.setProtectCreateTransaction(
                    !value,
                  );
                });
              }}
            />
          </ListItem>
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.settings_create_remove_wallets,
            })}
          >
            <Switch
              testID="setting-switch"
              size={ESwitchSize.small}
              value={!protectCreateOrRemoveWallet}
              onChange={async (value) => {
                handleTransition(async () => {
                  await backgroundApiProxy.serviceSetting.setProtectCreateOrRemoveWallet(
                    !value,
                  );
                });
              }}
            />
          </ListItem>
          <SizableText px="$5" size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.settings_passcode_bypass_desc,
            })}
          </SizableText>
          <Divider my="$5" mx="$5" />
          <SectionList.SectionHeader
            title={intl.formatMessage({
              id: ETranslations.settings_protection_passcode_section_title,
            })}
          />
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.settings_reset_app,
            })}
            subtitle={intl.formatMessage({
              id: ETranslations.settings_reset_app_description,
            })}
          >
            <PassCodeProtectionSwitch
              size={ESwitchSize.small}
              onTransition={handleTransition}
            />
          </ListItem>
        </YStack>
      </ScrollView>
    ) : (
      <Stack h="100%" flex={1} alignItems="center" justifyContent="center">
        <Spinner size="large" />
      </Stack>
    );
  }, [
    checkEnableProtection,
    enableProtection,
    handleToggleReceiveRiskMonitoring,
    handleTransition,
    intl,
    isEnableTransferAllowList,
    isLocked,
    isPrimeSubscriptionActive,
    isUpdatingReceiveRiskMonitoring,
    navigation,
    onekeyUserId,
    protectCreateOrRemoveWallet,
    protectCreateTransaction,
    receiveRiskMonitoringMap,
    setSettings,
    tokenRiskReminder,
  ]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.settings_protection })}
      />
      <Page.Body>{renderEnableProtection()}</Page.Body>
    </Page>
  );
};

export default SettingProtectionModal;
