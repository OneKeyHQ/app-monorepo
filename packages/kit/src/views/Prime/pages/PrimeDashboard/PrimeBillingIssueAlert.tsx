import { useCallback, useEffect, useMemo } from 'react';

import { useIsFocused } from '@react-navigation/core';

import { Alert, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { useHandleAppStateActive } from '@onekeyhq/kit/src/hooks/useHandleAppStateActive';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { getPrimeSubscriptionManagementTarget } from './primeSubscriptionManagementUtils';
import { useOpenPrimeSubscriptionManagement } from './useOpenPrimeSubscriptionManagement';

// Copy draft, pending onekey-i18n keys.
const PRIME_BILLING_ISSUE_COPY = {
  title: 'Prime renewal payment failed',
  action: 'Update payment method',
};

// Users whose alert impression was already reported in this session.
const reportedImpressionUserIds = new Set<string>();

export function PrimeBillingIssueAlert() {
  const { user, isPrimeSubscriptionActive } = useOneKeyAuth();
  const media = useMedia();
  const isFocused = useIsFocused();
  const primeSubscription = user?.primeSubscription;
  const onekeyUserId = user?.onekeyUserId;
  const visible = Boolean(
    isPrimeSubscriptionActive && primeSubscription?.hasBillingIssue === true,
  );

  const openManagement = useOpenPrimeSubscriptionManagement({
    managementTarget: visible
      ? getPrimeSubscriptionManagementTarget({
          userInfo: { primeSubscription },
          billingIssueOnly: true,
        })
      : undefined,
    entryPoint: 'billingIssueAlert',
  });

  // The payment page opens outside the app; refresh when the user comes back
  // so the alert goes away once the payment went through.
  const refreshUserInfo = useCallback(() => {
    void backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo({
      forceRefresh: true,
    });
  }, []);
  const appStateHandlers = useMemo(
    () => ({ onActiveFromBlur: refreshUserInfo }),
    [refreshUserInfo],
  );
  useHandleAppStateActive(
    visible ? refreshUserInfo : undefined,
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
    <Alert
      type="critical"
      icon="CreditCardOutline"
      actionLayout={media.sm ? 'vertical' : undefined}
      title={PRIME_BILLING_ISSUE_COPY.title}
      action={{
        primary: PRIME_BILLING_ISSUE_COPY.action,
        onPrimaryPress: () => {
          void openManagement();
        },
      }}
    />
  );
}
