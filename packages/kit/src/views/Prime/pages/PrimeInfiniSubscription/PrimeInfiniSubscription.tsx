/* cspell:ignore Infini */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/core';
import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

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
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { noopObject } from '@onekeyhq/shared/src/utils/miscUtils';
import type {
  IPrimeInfiniSubscription,
  IPrimeInfiniSubscriptionPlan,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { PrimeInfiniSubscriptionResetButton } from '../../components/PrimeDevUtils';

import {
  isInfiniSubscriptionRenewalStopped,
  normalizeInfiniSubscriptionPlan,
} from './infiniSubscriptionUtils';

import type { IntlShape } from 'react-intl';

// Fixed USD prices of the Infini crypto plans (integration plan §5.3(c)),
// used as a fallback when the server does not return the amount
const INFINI_PLAN_USD_PRICE: Record<IPrimeInfiniSubscriptionPlan, string> = {
  monthly: '29.99',
  yearly: '239.00',
};

const INFINI_STATUS_TO_BADGE_TYPE: Record<string, IBadgeType> = {
  active: 'success',
  canceled: 'warning',
  cancelled: 'warning',
  expired: 'default',
};

const INFINI_STATUS_TO_TRANSLATION: Record<string, ETranslations> = {
  active: ETranslations.earn_active,
  canceled: ETranslations.prime_fulfillment_status_cancelled,
  cancelled: ETranslations.prime_fulfillment_status_cancelled,
  expired: ETranslations.export_history_expired__title,
};

function formatPeriodDate(timestamp: number) {
  // Show the full time down to the second: the billing period end / next
  // invoice are exact instants, so the user can tell precisely when the
  // subscription lapses rather than guessing the time on the end date.
  return formatDate(new Date(timestamp));
}

function getRenewalStoppedDescription({
  intl,
  periodEndText,
}: {
  intl: IntlShape;
  periodEndText?: string;
}) {
  return periodEndText
    ? intl.formatMessage(
        {
          id: ETranslations.prime_cancel_renewal_until__desc,
        },
        { date: periodEndText },
      )
    : intl.formatMessage({
        id: ETranslations.prime_cancel_renewal_period_end__desc,
      });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <XStack
      justifyContent="space-between"
      alignItems="center"
      gap="$4"
      $md={{
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '$1',
      }}
    >
      <SizableText size="$bodyMd" color="$textSubdued" flexShrink={1}>
        {label}
      </SizableText>
      <SizableText
        size="$bodyMdMedium"
        textAlign="right"
        flexShrink={1}
        $md={{ textAlign: 'left' }}
      >
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
  const intl = useIntl();
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
        {intl.formatMessage({
          id: ETranslations.prime_cancel_reason_optional__label,
        })}
      </SizableText>
      <TextAreaInput
        value={note}
        onChangeText={setNote}
        maxLength={200}
        numberOfLines={3}
        editable={!isSubmitting}
        placeholder={intl.formatMessage({
          id: ETranslations.prime_cancel_reason__placeholder,
        })}
        testID="prime-infini-cancel-note"
      />
      {/* Retention-first layout (integration plan §5.3(c)): the primary
          confirm button keeps the subscription and simply closes the dialog,
          the secondary cancel button performs the actual cancellation */}
      <Dialog.Footer
        showConfirmButton
        showCancelButton
        onConfirmText={intl.formatMessage({
          id: ETranslations.prime_keep_subscription__action,
        })}
        onCancelText={intl.formatMessage({
          id: ETranslations.prime_cancel_renewal__action,
        })}
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
  const currentOneKeyUserId = primeUserInfo.onekeyUserId;

  const { result, run } = usePromiseResult(
    async () => {
      // primeExpiresAt is a real dependency: a successful (renewal) payment
      // bumps the merged Prime expiry in primePersistAtom (via the waiting
      // dialog's poll, the card flow's apiFetchPrimeUserInfo, or a websocket
      // push), and the Infini details shown on this page must refetch to
      // reflect the new billing period instead of staying stale
      noopObject(primeExpiresAt);
      noopObject(currentOneKeyUserId);
      if (!currentOneKeyUserId) {
        return {
          onekeyUserId: currentOneKeyUserId,
          subscription: undefined,
          hasError: true,
        };
      }
      try {
        const subscription =
          await backgroundApiProxy.servicePrime.apiGetInfiniSubscription({
            expectedOneKeyUserId: currentOneKeyUserId,
          });
        return {
          onekeyUserId: currentOneKeyUserId,
          subscription,
          hasError: false,
        };
      } catch {
        // Fold the error into the result: usePromiseResult clears the result
        // on throw, and the page needs an explicit retry state
        return {
          onekeyUserId: currentOneKeyUserId,
          subscription: undefined,
          hasError: true,
        };
      }
    },
    [currentOneKeyUserId, primeExpiresAt],
    // Debounce lives on the refresh callback below, not here: a hook-level
    // debounce also wraps the run() that the reset flow has to await, and a
    // debounced call resolves with lodash's previous return value rather than
    // the pending request. watchLoading is intentionally omitted: refreshes
    // keep the current content in place (see renderContent) rather than
    // flipping the page into a full spinner.
    {},
  );
  const isResultForCurrentUser = Boolean(
    currentOneKeyUserId && result?.onekeyUserId === currentOneKeyUserId,
  );
  const subscription = isResultForCurrentUser
    ? result?.subscription
    : undefined;

  const runRef = useRef(run);
  runRef.current = run;

  // Debounced so the renew flow's overlapping triggers collapse into a single
  // apiGetInfiniSubscription call instead of firing several back to back.
  // Reads run() through a ref so the debounced instance stays stable and its
  // pending call cannot be dropped by a re-render.
  const refreshSubscription = useMemo(
    () =>
      debounce(() => {
        void runRef.current();
      }, 300),
    [],
  );

  useEffect(() => () => refreshSubscription.cancel(), [refreshSubscription]);

  // Awaited by the reset button: the subscription shown here comes from this
  // page's own apiGetInfiniSubscription call, which only re-runs when the
  // OneKey ID or primeExpiresAt changes, so a reset would otherwise leave the
  // deleted subscription (and its cancel-renewal entry) on screen. Goes through
  // run() rather than writing state directly, so this refresh mints a fresh
  // nonce inside the hook: an apiGetInfiniSubscription still in flight from an
  // earlier trigger is invalidated instead of landing afterwards and restoring
  // the pre-reset subscription.
  const handleSubscriptionReset = useCallback(async () => {
    refreshSubscription.cancel();
    await run();
  }, [refreshSubscription, run]);

  const handleCancelRenewal = useCallback(
    (currentSubscription: IPrimeInfiniSubscription) => {
      const purchaseUserId = currentOneKeyUserId;
      if (!purchaseUserId || result?.onekeyUserId !== purchaseUserId) {
        return;
      }
      const periodEndText = currentSubscription.currentPeriodEnd
        ? formatPeriodDate(currentSubscription.currentPeriodEnd)
        : undefined;
      const submitRef: ICancelRenewalSubmitRef = { current: undefined };
      Dialog.show({
        icon: 'InfoCircleOutline',
        title: intl.formatMessage({
          id: ETranslations.prime_cancel_renewal__title,
        }),
        description: getRenewalStoppedDescription({
          intl,
          periodEndText,
        }),
        renderContent: (
          <CancelRenewalDialogContent
            submitRef={submitRef}
            onCancelRenewal={async (note) => {
              const currentUser =
                await backgroundApiProxy.servicePrime.getLocalUserInfo();
              if (
                !currentUser.isLoggedIn ||
                currentUser.onekeyUserId !== purchaseUserId
              ) {
                throw new OneKeyLocalError({
                  message: 'Prime subscription user changed',
                  autoToast: false,
                });
              }
              await backgroundApiProxy.servicePrime.apiCancelInfiniSubscription(
                { note, expectedOneKeyUserId: purchaseUserId },
              );
              const currentUserAfterCancel =
                await backgroundApiProxy.servicePrime.getLocalUserInfo();
              if (
                !currentUserAfterCancel.isLoggedIn ||
                currentUserAfterCancel.onekeyUserId !== purchaseUserId
              ) {
                throw new OneKeyLocalError({
                  message: 'Prime subscription user changed',
                  autoToast: false,
                });
              }
              Toast.success({
                title: intl.formatMessage({
                  id: ETranslations.prime_renewal_canceled__title,
                }),
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
    [currentOneKeyUserId, intl, refreshSubscription, result?.onekeyUserId],
  );

  const renderSubscriptionDetail = useCallback(
    (currentSubscription: IPrimeInfiniSubscription) => {
      const normalizedStatus = currentSubscription.status?.toLowerCase() ?? '';
      const badgeType =
        INFINI_STATUS_TO_BADGE_TYPE[normalizedStatus] ?? 'default';
      const statusLabel = intl.formatMessage({
        id:
          INFINI_STATUS_TO_TRANSLATION[normalizedStatus] ??
          ETranslations.global_unknown,
      });
      const isRenewalStopped =
        isInfiniSubscriptionRenewalStopped(currentSubscription);
      // Normalized defensively: indexing the fixed price / lead-days maps
      // with a raw unknown enum value (integration plan §11-3) would render
      // literal "$undefined" / "within undefined days" texts
      const plan = normalizeInfiniSubscriptionPlan(currentSubscription.plan);
      const planLabel = intl.formatMessage({
        id:
          plan === 'yearly'
            ? ETranslations.prime_crypto_yearly_plan__title
            : ETranslations.prime_crypto_monthly_plan__title,
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
            {/* Hidden reset entry: revealed by repeated clicks on the title,
                and only when developer mode is enabled. devSettingsOnly keeps
                the gate in place even if an onPress is added here later.
                (Enabling developer mode itself requires the devOnly password
                plus the app password.) */}
            <MultipleClickStack
              alignSelf="flex-start"
              testID="prime-infini-subscription-title"
              devSettingsOnly
              debugComponent={
                <PrimeInfiniSubscriptionResetButton
                  testID="prime-infini-subscription-reset"
                  onReset={handleSubscriptionReset}
                />
              }
            >
              <XStack alignItems="center" gap="$2">
                <SizableText size="$headingLg" flexShrink={1}>
                  {planLabel}
                </SizableText>
                <Badge badgeType={badgeType} badgeSize="sm">
                  {statusLabel}
                </Badge>
              </XStack>
            </MultipleClickStack>
            <SizableText size="$headingXl">{priceText}</SizableText>
            <Divider />
            <YStack gap="$2.5">
              {periodEndText ? (
                <InfoRow
                  label={intl.formatMessage({
                    id: ETranslations.prime_current_period_ends__label,
                  })}
                  value={periodEndText}
                />
              ) : null}
              {!isRenewalStopped && nextInvoiceText ? (
                <InfoRow
                  label={intl.formatMessage({
                    id: ETranslations.prime_next_invoice__label,
                  })}
                  value={nextInvoiceText}
                />
              ) : null}
            </YStack>
          </YStack>

          {isRenewalStopped ? (
            <Alert
              type="warning"
              icon="InfoCircleOutline"
              title={intl.formatMessage({
                id: ETranslations.prime_renewal_canceled__title,
              })}
              description={getRenewalStoppedDescription({
                intl,
                periodEndText,
              })}
            />
          ) : null}
          {!isRenewalStopped && nextInvoiceText ? (
            <Alert
              type="info"
              icon="EmailOutline"
              title={intl.formatMessage({
                id: ETranslations.prime_renewal_reminder__title,
              })}
              description={intl.formatMessage({
                id: ETranslations.prime_renewal_reminder__desc,
              })}
            />
          ) : null}
        </YStack>
      );
    },
    [handleSubscriptionReset, intl],
  );

  const renderContent = () => {
    // Only the first load (no data yet) blocks the whole page with a spinner.
    // Later refreshes (renew onClose, expiry bumps) keep the current content
    // visible and update in place, so the page never flashes back to a
    // full-page spinner while re-fetching.
    if (result === undefined || !isResultForCurrentUser) {
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
            title={intl.formatMessage({
              id: ETranslations.global_network_error,
            })}
            description={intl.formatMessage({
              id: ETranslations.auth_server_error_text,
            })}
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
            illustration="SearchDocument"
            title={intl.formatMessage({
              id: ETranslations.prime_no_crypto_subscription__title,
            })}
            description={intl.formatMessage({
              id: ETranslations.prime_no_crypto_subscription__desc,
            })}
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
      {subscription && !isInfiniSubscriptionRenewalStopped(subscription) ? (
        <Page.Footer>
          <YStack px="$5" pt="$2" pb="$5" gap="$2.5">
            {/* Renewal purchases are intentionally unavailable because the
                server does not support extending an active subscription. */}
            <Button
              variant="tertiary"
              size="large"
              testID="prime-infini-cancel-renewal"
              onPress={() => handleCancelRenewal(subscription)}
            >
              {intl.formatMessage({
                id: ETranslations.prime_cancel_renewal__action,
              })}
            </Button>
          </YStack>
        </Page.Footer>
      ) : null}
    </Page>
  );
}
