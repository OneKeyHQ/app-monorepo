import { useEffect } from 'react';

import { Alert, useMedia } from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { getPrimeSubscriptionManagementTarget } from './primeSubscriptionManagementUtils';
import { useOpenPrimeSubscriptionManagement } from './useOpenPrimeSubscriptionManagement';

// Copy draft, pending onekey-i18n keys.
const PRIME_BILLING_ISSUE_COPY = {
  title: 'Prime renewal payment failed',
  description: 'Update your payment method to keep Prime.',
  action: 'Update payment method',
};

// Users whose alert impression was already reported in this session.
const reportedImpressionUserIds = new Set<string>();

export function PrimeBillingIssueAlert() {
  const { user, isPrimeSubscriptionActive } = useOneKeyAuth();
  const media = useMedia();
  const primeSubscription = user?.primeSubscription;
  const onekeyUserId = user?.onekeyUserId;
  const visible = Boolean(
    isPrimeSubscriptionActive && primeSubscription?.hasBillingIssue === true,
  );

  const openManagement = useOpenPrimeSubscriptionManagement({
    managementTarget: visible
      ? getPrimeSubscriptionManagementTarget({
          userInfo: { primeSubscription },
          preferBillingIssue: true,
        })
      : undefined,
    entryPoint: 'billingIssueAlert',
  });

  useEffect(() => {
    if (!visible || !onekeyUserId) {
      return;
    }
    if (reportedImpressionUserIds.has(onekeyUserId)) {
      return;
    }
    reportedImpressionUserIds.add(onekeyUserId);
    defaultLogger.prime.subscription.primeBillingIssueAlertShow();
  }, [onekeyUserId, visible]);

  if (!visible) {
    return null;
  }

  return (
    <Alert
      type="critical"
      icon="CreditCardOutline"
      actionLayout={media.sm ? 'vertical' : undefined}
      title={PRIME_BILLING_ISSUE_COPY.title}
      description={PRIME_BILLING_ISSUE_COPY.description}
      action={{
        primary: PRIME_BILLING_ISSUE_COPY.action,
        onPrimaryPress: () => {
          void openManagement();
        },
      }}
    />
  );
}
