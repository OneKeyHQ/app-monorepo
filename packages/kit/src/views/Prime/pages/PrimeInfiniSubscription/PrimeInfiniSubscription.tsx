/* cspell:ignore Infini */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import type { IBadgeType } from '@onekeyhq/components';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  Divider,
  Empty,
  Page,
  SizableText,
  Spinner,
  Stack,
  TextAreaInput,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { noopObject } from '@onekeyhq/shared/src/utils/miscUtils';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IPrimeInfiniSubscription,
  IPrimeInfiniSubscriptionPlan,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { showPrimeInfiniWaitingDialog } from '../../components/PrimeInfiniWaitingDialog';
import { PrimePurchaseDialog } from '../../components/PrimePurchaseDialog/PrimePurchaseDialog';

import {
  isInfiniSubscriptionRenewalStopped,
  normalizeInfiniSubscriptionPlan,
} from './infiniSubscriptionUtils';

import type { ISubscriptionPeriod } from '../../hooks/usePrimePaymentTypes';

// Crypto payments are forbidden on iOS / Android Google Play builds (store
// policy, integration plan §2). The management entry is already gated in
// PrimeUserInfoMoreButton; hiding the payment action here is defense in depth
// for any other route into this page (e.g. dev-only entries).
const isCryptoPaySupported =
  !platformEnv.isNativeIOS && !platformEnv.isNativeAndroidGooglePlay;

// Fixed USD prices of the Infini crypto plans (integration plan §5.3(c)),
// used as a fallback when the server does not return the amount
const INFINI_PLAN_USD_PRICE: Record<IPrimeInfiniSubscriptionPlan, string> = {
  monthly: '29.99',
  yearly: '239.00',
};

// Renewal invoices are generated ahead of the period end with these lead days
// (invoice_lead_days passed at subscription creation, integration plan §7.1);
// the user should complete the payment within this window
const INFINI_INVOICE_LEAD_DAYS: Record<IPrimeInfiniSubscriptionPlan, number> = {
  monthly: 3,
  yearly: 7,
};

const INFINI_STATUS_TO_BADGE_TYPE: Record<string, IBadgeType> = {
  active: 'success',
  canceled: 'warning',
  cancelled: 'warning',
  expired: 'default',
};

const INFINI_STATUS_TO_LABEL: Record<string, string> = {
  // TODO: i18n pending translation key
  active: 'Active',
  // TODO: i18n pending translation key
  canceled: 'Canceled',
  // TODO: i18n pending translation key
  cancelled: 'Canceled',
  // TODO: i18n pending translation key
  expired: 'Expired',
};

function formatPeriodDate(timestamp: number) {
  // Show the full time down to the second: the billing period end / next
  // invoice are exact instants, so the user can tell precisely when the
  // subscription lapses rather than guessing the time on the end date.
  return formatDate(new Date(timestamp));
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <XStack justifyContent="space-between" alignItems="center" gap="$4">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$bodyMdMedium" textAlign="right" flexShrink={1}>
        {value}
      </SizableText>
    </XStack>
  );
}

type ICancelRenewalSubmitRef = {
  current: ((close: () => Promise<void>) => void) | undefined;
};

function CancelRenewalDialogContent({
  submitRef,
  onCancelRenewal,
}: {
  submitRef: ICancelRenewalSubmitRef;
  onCancelRenewal: (note: string | undefined) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    // Re-registered whenever the note changes so the handler always sees the
    // latest text; the dialog-level onCancel delegates the actual work here
    submitRef.current = (close) => {
      if (isSubmittingRef.current) {
        return;
      }
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      void (async () => {
        try {
          await onCancelRenewal(note.trim() || undefined);
          await close();
        } catch {
          // The service method is wrapped with @toastIfError, keep the
          // dialog open so the user can retry
        } finally {
          isSubmittingRef.current = false;
          setIsSubmitting(false);
        }
      })();
    };
  }, [note, onCancelRenewal, submitRef]);

  return (
    <YStack gap="$2">
      <SizableText size="$bodyMd" color="$textSubdued">
        {/* TODO: i18n pending translation key */}
        Reason (optional)
      </SizableText>
      <TextAreaInput
        value={note}
        onChangeText={setNote}
        maxLength={200}
        numberOfLines={3}
        editable={!isSubmitting}
        // TODO: i18n pending translation key
        placeholder="Tell us why you’re canceling"
        testID="prime-infini-cancel-note"
      />
      {/* Retention-first layout (integration plan §5.3(c)): the primary
          confirm button keeps the subscription and simply closes the dialog,
          the secondary cancel button performs the actual cancellation */}
      <Dialog.Footer
        showConfirmButton
        showCancelButton
        // TODO: i18n pending translation key
        onConfirmText="Keep subscription"
        // TODO: i18n pending translation key
        onCancelText="Cancel renewal"
        confirmButtonProps={{ disabled: isSubmitting }}
        cancelButtonProps={{ loading: isSubmitting }}
      />
    </YStack>
  );
}

export default function PrimeInfiniSubscription() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [primeUserInfo] = usePrimePersistAtom();

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      void backgroundApiProxy.servicePrime.isLoggedIn().then((isLogin) => {
        if (isActive && !isLogin) {
          navigation.pop();
        }
      });
      return () => {
        isActive = false;
      };
    }, [navigation]),
  );

  const primeExpiresAt = primeUserInfo.primeSubscription?.expiresAt;

  const { result, run } = usePromiseResult(
    async () => {
      // primeExpiresAt is a real dependency: a successful (renewal) payment
      // bumps the merged Prime expiry in primePersistAtom (via the waiting
      // dialog's poll, the card flow's apiFetchPrimeUserInfo, or a websocket
      // push), and the Infini details shown on this page must refetch to
      // reflect the new billing period instead of staying stale
      noopObject(primeExpiresAt);
      try {
        const subscription =
          await backgroundApiProxy.servicePrime.apiGetInfiniSubscription();
        return { subscription, hasError: false };
      } catch {
        // Fold the error into the result: usePromiseResult clears the result
        // on throw, and the page needs an explicit retry state
        return { subscription: undefined, hasError: true };
      }
    },
    [primeExpiresAt],
    // Debounced so the renew flow's overlapping triggers (waiting-dialog
    // onClose refresh, the atom expiry bump, and the focus refetch) collapse
    // into a single apiGetInfiniSubscription call instead of firing several
    // back to back. watchLoading is intentionally omitted: refreshes keep the
    // current content in place (see renderContent) rather than flipping the
    // page into a full spinner.
    { debounced: 300 },
  );
  const subscription = result?.subscription;

  const refreshSubscription = useCallback(() => {
    void run();
  }, [run]);

  // Leading-edge debounce: a rapid double tap on "Renew now" would otherwise
  // open the invoice URL in two browser tabs (or stack two purchase dialogs).
  // useDebouncedCallback always invokes the latest render's closure, so no
  // dependency array is needed.
  const handleRenewNow = useDebouncedCallback(
    async (currentSubscription: IPrimeInfiniSubscription) => {
      // Normalized defensively: the raw server enum is unconfirmed
      // (integration plan §11-3) and must not misclassify the plan
      const plan = normalizeInfiniSubscriptionPlan(currentSubscription.plan);
      const subscriptionPeriod: ISubscriptionPeriod =
        plan === 'yearly' ? 'P1Y' : 'P1M';
      const { latestInvoiceUrl } = currentSubscription;
      if (latestInvoiceUrl) {
        // Priority 1 (integration plan §7.2): pay the renewal invoice passed
        // through by the server. Intent is logged here because this path
        // skips the purchase dialog where the channel branches normally log it.
        defaultLogger.prime.subscription.primeSubscribeIntent({
          subscriptionPeriod,
          currency: 'USD',
          paymentMethod: 'crypto',
        });
        // System browser required for wallet-app / Binance Pay deep links
        // (integration plan §8). Opened before the baseline fetch below so
        // the web popup blocker still sees a direct user gesture; the
        // waiting dialog offers a manual reopen affordance either way.
        openUrlUtils.openUrlExternal(latestInvoiceUrl, {
          useSystemBrowser: true,
        });
        // Same staleness rule as purchaseByCrypto: the merged-expiry baseline
        // must come from fresh server truth, not the render-time atom
        // snapshot — another channel renewed elsewhere (webhook landed while
        // the app was backgrounded) would leave the snapshot low and make the
        // dialog's first poll report success before any payment. On fetch
        // failure fall back to the snapshot, never worse than trusting it.
        const baselinePrimeSubscription = await backgroundApiProxy.servicePrime
          .apiFetchPrimeUserInfo()
          .then((userInfo) => userInfo.primeSubscription)
          .catch(() => primeUserInfo.primeSubscription);
        showPrimeInfiniWaitingDialog({
          plan,
          checkoutUrl: latestInvoiceUrl,
          // The waiting dialog compares the account-level merged expiry
          // (primeSubscription.expiresAt) against this baseline, so the
          // baseline must be account-level too: for dual-channel users the
          // RevenueCat expiry may already exceed the Infini period end, and
          // a baseline of only currentPeriodEnd would report success on the
          // very first poll without any payment
          renewalBaselineExpiresAt:
            Math.max(
              currentSubscription.currentPeriodEnd ?? 0,
              baselinePrimeSubscription?.expiresAt ?? 0,
            ) || undefined,
          // For those same dual-channel users the merged expiry may also
          // never move after the invoice is paid (only the shorter Infini
          // channel extends), so the dialog additionally polls the Infini
          // record against its own pre-renewal period end
          renewalBaselineInfiniPeriodEnd: currentSubscription.currentPeriodEnd,
          onClose: refreshSubscription,
        });
        return;
      }
      // Priority 2: no invoice url available — start a fresh purchase. The plan
      // picker defaults to yearly (PrimePurchaseDialog's own 'P1Y' default)
      // regardless of the user's current plan, to nudge the annual option on
      // renewal.
      const purchaseDialog = Dialog.show({
        renderContent: (
          <PrimePurchaseDialog
            onPurchase={() => {
              void purchaseDialog.close();
            }}
          />
        ),
        onClose: refreshSubscription,
      });
    },
    300,
    { leading: true, trailing: false },
  );

  const handleCancelRenewal = useCallback(
    (currentSubscription: IPrimeInfiniSubscription) => {
      const periodEndText = currentSubscription.currentPeriodEnd
        ? formatPeriodDate(currentSubscription.currentPeriodEnd)
        : undefined;
      const submitRef: ICancelRenewalSubmitRef = { current: undefined };
      Dialog.show({
        icon: 'InfoCircleOutline',
        // TODO: i18n pending translation key
        title: 'Cancel renewal?',
        // TODO: i18n pending translation key
        description: periodEndText
          ? `You will no longer receive renewal invoices. Your Prime benefits remain available until ${periodEndText}.`
          : 'You will no longer receive renewal invoices. Your Prime benefits remain available until the end of the current billing period.',
        renderContent: (
          <CancelRenewalDialogContent
            submitRef={submitRef}
            onCancelRenewal={async (note) => {
              await backgroundApiProxy.servicePrime.apiCancelInfiniSubscription(
                { note },
              );
              Toast.success({
                // TODO: i18n pending translation key
                title: 'Renewal canceled',
                message: periodEndText
                  ? // TODO: i18n pending translation key
                    `Your Prime benefits remain available until ${periodEndText}.`
                  : undefined,
              });
              refreshSubscription();
            }}
          />
        ),
        // The declared `close` parameter matters: it opts out of the Dialog's
        // auto-close so the async cancellation controls when to dismiss
        onCancel: (close) => {
          submitRef.current?.(close);
        },
      });
    },
    [refreshSubscription],
  );

  const renderSubscriptionDetail = useCallback(
    (currentSubscription: IPrimeInfiniSubscription) => {
      const normalizedStatus = currentSubscription.status.toLowerCase();
      const badgeType =
        INFINI_STATUS_TO_BADGE_TYPE[normalizedStatus] ?? 'default';
      const statusLabel =
        INFINI_STATUS_TO_LABEL[normalizedStatus] ?? currentSubscription.status;
      const isRenewalStopped =
        isInfiniSubscriptionRenewalStopped(currentSubscription);
      // Normalized defensively: indexing the fixed price / lead-days maps
      // with a raw unknown enum value (integration plan §11-3) would render
      // literal "$undefined" / "within undefined days" texts
      const plan = normalizeInfiniSubscriptionPlan(currentSubscription.plan);
      const planLabel =
        currentSubscription.planName ||
        intl.formatMessage({
          id:
            plan === 'yearly'
              ? ETranslations.prime_yearly
              : ETranslations.prime_monthly,
        });
      const priceAmount =
        currentSubscription.amount || INFINI_PLAN_USD_PRICE[plan];
      const priceText = intl.formatMessage(
        {
          id:
            plan === 'yearly'
              ? ETranslations.prime_prime_price_per_year
              : ETranslations.prime_prime_price_per_month,
        },
        { price: `$${priceAmount}` },
      );
      const periodEndText = currentSubscription.currentPeriodEnd
        ? formatPeriodDate(currentSubscription.currentPeriodEnd)
        : undefined;
      const nextInvoiceText = currentSubscription.nextInvoiceAt
        ? formatPeriodDate(currentSubscription.nextInvoiceAt)
        : undefined;
      const leadDays = INFINI_INVOICE_LEAD_DAYS[plan];
      // displayEmail is the server-provided masked email of the OneKey ID;
      // the renewal invoice is delivered to this address (payer_email)
      const emailText = primeUserInfo.displayEmail || 'your email';

      return (
        <YStack px="$5" py="$4" gap="$4">
          <YStack
            p="$4"
            bg="$bg"
            borderRadius="$3"
            borderWidth={1}
            borderColor="$borderSubdued"
            gap="$3"
          >
            <XStack alignItems="center" gap="$2">
              <SizableText size="$headingLg" flexShrink={1}>
                {planLabel}
              </SizableText>
              <Badge badgeType={badgeType} badgeSize="sm">
                {statusLabel}
              </Badge>
            </XStack>
            <SizableText size="$headingXl">{priceText}</SizableText>
            <Divider />
            <YStack gap="$2.5">
              {periodEndText ? (
                <InfoRow
                  // TODO: i18n pending translation key
                  label="Current period ends"
                  value={periodEndText}
                />
              ) : null}
              {!isRenewalStopped && nextInvoiceText ? (
                <InfoRow
                  // TODO: i18n pending translation key
                  label="Next invoice"
                  value={nextInvoiceText}
                />
              ) : null}
            </YStack>
          </YStack>

          {isRenewalStopped ? (
            <Alert
              type="warning"
              icon="InfoCircleOutline"
              // TODO: i18n pending translation key
              title="Renewal canceled"
              description={
                periodEndText
                  ? // TODO: i18n pending translation key
                    `You will not receive further renewal invoices. Your Prime benefits remain available until ${periodEndText}.`
                  : // TODO: i18n pending translation key
                    'You will not receive further renewal invoices. Your Prime benefits remain available until the end of the current billing period.'
              }
            />
          ) : null}
          {!isRenewalStopped && nextInvoiceText ? (
            <Alert
              type="info"
              icon="EmailOutline"
              // TODO: i18n pending translation key
              title="Renewal reminder"
              // TODO: i18n pending translation key
              description={`Your next invoice will be sent to ${emailText} on ${nextInvoiceText}. Please check your inbox and complete the payment within ${leadDays} days to keep your subscription active.`}
            />
          ) : null}
        </YStack>
      );
    },
    [intl, primeUserInfo.displayEmail],
  );

  const renderContent = () => {
    // Only the first load (no data yet) blocks the whole page with a spinner.
    // Later refreshes (renew onClose, expiry bumps) keep the current content
    // visible and update in place, so the page never flashes back to a
    // full-page spinner while re-fetching.
    if (result === undefined) {
      return (
        <Stack flex={1} alignItems="center" justifyContent="center">
          <Spinner size="large" />
        </Stack>
      );
    }

    if (result?.hasError) {
      return (
        <Stack flex={1} alignItems="center" justifyContent="center" p="$5">
          <Empty
            icon="ErrorOutline"
            // TODO: i18n pending translation key
            title="Unable to load subscription"
            // TODO: i18n pending translation key
            description="Please check your network connection and try again."
            buttonProps={{
              onPress: refreshSubscription,
              children: intl.formatMessage({ id: ETranslations.global_retry }),
            }}
          />
        </Stack>
      );
    }

    if (!subscription) {
      return (
        <Stack flex={1} alignItems="center" justifyContent="center" p="$5">
          <Empty
            icon="CreditCardOutline"
            // TODO: i18n pending translation key
            title="No crypto subscription"
            // TODO: i18n pending translation key
            description="You don’t have a crypto-paid Prime subscription yet."
          />
        </Stack>
      );
    }

    return renderSubscriptionDetail(subscription);
  };

  return (
    // flexGrow keeps the loading / empty / error states vertically centered
    // inside the page scroll container
    <Page
      scrollEnabled
      scrollProps={{ contentContainerStyle: { flexGrow: 1 } }}
    >
      <Page.Header
        headerTitle={intl.formatMessage({
          id: ETranslations.prime_manage_subscription,
        })}
      />
      <Page.Body>{renderContent()}</Page.Body>
      {subscription ? (
        <Page.Footer>
          <YStack px="$5" pt="$2" pb="$5" gap="$2.5">
            {/* Always visible on crypto-pay platforms (integration plan
                §7.2): pays the latest renewal invoice when available,
                otherwise re-purchases. Hidden on iOS / Android Google Play,
                where both the crypto invoice and the re-purchase fallback
                (which would silently start a parallel native IAP) are
                forbidden purchase channels (integration plan §2) */}
            {isCryptoPaySupported ? (
              <Button
                variant="primary"
                size="large"
                testID="prime-infini-renew-now"
                onPress={() => handleRenewNow(subscription)}
              >
                {/* TODO: i18n pending translation key */}
                Renew now
              </Button>
            ) : null}
            {!isInfiniSubscriptionRenewalStopped(subscription) ? (
              // De-emphasized on purpose (integration plan §5.3(c)):
              // tertiary text-style button, no destructive filled style
              <Button
                variant="tertiary"
                size="large"
                testID="prime-infini-cancel-renewal"
                onPress={() => handleCancelRenewal(subscription)}
              >
                {/* TODO: i18n pending translation key */}
                Cancel renewal
              </Button>
            ) : null}
          </YStack>
        </Page.Footer>
      ) : null}
    </Page>
  );
}
