import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
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
import PassCodeProtectionSwitch from '@onekeyhq/kit/src/components/Password/container/PassCodeProtectionSwitch';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

const SettingProtectionModal = () => {
  const intl = useIntl();
  const [
    {
      tokenRiskReminder,
      protectCreateTransaction,
      protectCreateOrRemoveWallet,
    },
    setSettings,
  ] = useSettingsPersistAtom();
  const isEnableTransferAllowList = useIsEnableTransferAllowList();
  const [enableProtection, setEnableProtection] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
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
      } catch (e) {
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
              <Button onPress={() => checkEnableProtection()}>
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
          >
            <Switch
              size={ESwitchSize.small}
              value={tokenRiskReminder}
              onChange={async (value) => {
                handleTransition(async () => {
                  setSettings((v) => ({ ...v, tokenRiskReminder: !!value }));
                });
              }}
            />
          </ListItem>
          <SizableText px="$5" size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.settings_token_risk_reminder_desc,
            })}
          </SizableText>
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.settings_protection_allowlist_title,
            })}
          >
            <Switch
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
          <SizableText px="$5" size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.settings_protection_allowlist_content,
            })}
          </SizableText>
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
          <SizableText px="$5" size="$bodySm" color="$textSubdued">
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
          >
            <PassCodeProtectionSwitch
              size={ESwitchSize.small}
              onTransition={handleTransition}
            />
          </ListItem>
          <SizableText px="$5" size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.settings_reset_app_description,
            })}
          </SizableText>
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
    handleTransition,
    intl,
    isEnableTransferAllowList,
    isLocked,
    protectCreateOrRemoveWallet,
    protectCreateTransaction,
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
