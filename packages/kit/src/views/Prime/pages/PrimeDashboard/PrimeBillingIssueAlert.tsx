import { useCallback, useEffect, useMemo } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { useHandleAppStateActive } from '@onekeyhq/kit/src/hooks/useHandleAppStateActive';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { useOpenPrimeSubscriptionManagement } from './useOpenPrimeSubscriptionManagement';

import type { IPrimeSubscriptionManagementTarget } from './primeSubscriptionManagementUtils';

// Users whose alert impression was already reported in this session.
const reportedImpressionUserIds = new Set<string>();

// Bottom row of the user info card while a renewal charge is failing.
export function PrimeBillingIssueAlert() {
  const intl = useIntl();
  const { user, isPrimeSubscriptionActive } = useOneKeyAuth();
  const isFocused = useIsFocused();
  const primeSubscription = user?.primeSubscription;
  const onekeyUserId = user?.onekeyUserId;
  const visible = Boolean(
    isPrimeSubscriptionActive && primeSubscription?.hasBillingIssue === true,
  );

  const billingIssueManagementUrl =
    primeSubscription?.billingIssueManagementUrl;
  const managementTarget = useMemo<
    IPrimeSubscriptionManagementTarget | undefined
  >(() => {
    if (!visible) {
      return undefined;
    }
    return billingIssueManagementUrl
      ? { type: 'external', url: billingIssueManagementUrl }
      : { type: 'unavailable' };
  }, [billingIssueManagementUrl, visible]);
  const openManagement = useOpenPrimeSubscriptionManagement({
    managementTarget,
    entryPoint: 'billingIssueAlert',
  });

  // The payment page opens outside the app; refresh when the user comes back
  // so the row goes away once the payment went through.
  const refreshUserInfo = useCallback(() => {
    // Waits for a request already running instead of superseding it.
    backgroundApiProxy.servicePrime
      .refreshPrimeUserInfoAfterChange()
      .catch(() => {
        // Keep the last known state; the next return refreshes again.
      });
  }, []);
  const appStateHandlers = useMemo(
    () => ({ onActiveFromBlur: refreshUserInfo }),
    [refreshUserInfo],
  );
  useHandleAppStateActive(
    visible && isFocused ? refreshUserInfo : undefined,
    appStateHandlers,
  );

  useEffect(() => {
    if (!visible || !isFocused || !onekeyUserId) {
      return;
    }
    if (reportedImpressionUserIds.has(onekeyUserId)) {
      return;
    }
    reportedImpressionUserIds.add(onekeyUserId);
    defaultLogger.prime.subscription.primeBillingIssueAlertShow();
  }, [isFocused, onekeyUserId, visible]);

  if (!visible) {
    return null;
  }

  return (
    <XStack
      testID="prime-billing-issue-row"
      alignItems="center"
      gap="$2"
      px="$3.5"
      py="$3"
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderSubdued"
      cursor="default"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={() => {
        void openManagement();
      }}
    >
      <Icon name="CreditCardOutline" color="$iconCritical" size="$5" />
      <YStack flex={1} minWidth={0}>
        <SizableText size="$bodyMdMedium" color="$textCritical">
          {intl.formatMessage({
            id: ETranslations.prime_renewal_payment_failed__title,
          })}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.prime_update_payment_method_to_keep_prime__desc,
          })}
        </SizableText>
      </YStack>
      <Icon name="ChevronRightSmallOutline" color="$iconSubdued" size="$5" />
    </XStack>
  );
}
