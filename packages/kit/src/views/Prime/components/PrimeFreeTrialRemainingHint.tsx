import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, useDialogInstance } from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  usePrimeFreeTrialAtom,
  usePrimePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import { getPrimeFreeTrialHeldReservationEnd } from '@onekeyhq/shared/src/utils/primeFreeTrialUtils';
import type { IPrimeFreeTrialFeatureId } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import { isPrimeFreeTrialTravelMode } from '../hooks/usePrimeFeatureAccess';
import { usePrimeFreeTrialUpgrade } from '../hooks/usePrimeFreeTrialUpgrade';
import {
  getPrimeFreeTrialQuotaOfUser,
  resolvePrimeFreeTrialAccess,
} from '../utils/primeFreeTrialAccess';
import { getPrimeFreeTrialNoticeCopy } from '../utils/primeFreeTrialCopy';

import type { IPrimeFreeTrialNotice } from '../utils/primeFreeTrialCopy';
import type { GestureResponderEvent } from 'react-native';

// A snapshot younger than this is reused instead of refreshing on mount; the
// entry gate usually refreshed it a moment ago.
const SNAPSHOT_FRESH_MS = 30 * 1000;
// A reservation lasts at most 30 minutes; the refresh at its end waits a
// moment so the server has released it.
const RESERVATION_MAX_MS = 30 * 60 * 1000;
const RESERVATION_END_GRACE_MS = 2000;

// Remaining free uses of a feature. Rendered only for logged-in free users
// with a known quota, and never for token quotas (translate shows no hint). Used up, held by
// live reservations, or without a free trial (the entry lets the user in, so
// nobody fills in the page first), it shows the same notice as the toast a
// submit would get, with the same "Get Prime".
// Reads the Prime atom directly (not useOneKeyAuth) so it also works inside
// dialogs rendered outside the auth providers.
export function PrimeFreeTrialRemainingHint({
  featureId,
  networkId,
  beforeGetPrime,
  ...rest
}: {
  featureId: IPrimeFreeTrialFeatureId;
  networkId?: string;
  // Closes a popover holding the hint before the dashboard opens.
  beforeGetPrime?: () => Promise<void>;
} & IXStackProps) {
  const [user] = usePrimePersistAtom();
  const isLoggedIn = Boolean(user?.isLoggedIn && user?.isLoggedInOnServer);
  const isPrimeSubscriptionActive = Boolean(
    isLoggedIn && user?.primeSubscription?.isActive,
  );
  const [{ quota, config }] = usePrimeFreeTrialAtom();
  const onekeyUserId = user?.onekeyUserId;
  const isFreeUser = isLoggedIn && !isPrimeSubscriptionActive;
  const { getPrime } = usePrimeFreeTrialUpgrade();
  const intl = useIntl();
  // Empty outside a dialog, where close does nothing.
  const dialog = useDialogInstance();

  const isSnapshotFresh =
    quota.onekeyUserId === onekeyUserId &&
    quota.status === 'success' &&
    Date.now() - (quota.updatedAt ?? 0) < SNAPSHOT_FRESH_MS;
  useEffect(() => {
    if (!isFreeUser || isSnapshotFresh || isPrimeFreeTrialTravelMode()) {
      return;
    }
    void backgroundApiProxy.servicePrimeFreeTrial.refreshQuota({
      dedupe: true,
    });
    // Only on mount / user change: the snapshot updates itself afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFreeUser, onekeyUserId]);

  // A failed or missing load hides the hint; it is never read as exhausted
  // or not open (start decides), and the next entry refreshes again. The
  // same resolution as the entry gate: a feature missing from the quota is
  // not open, and a null quota defers to the public config.
  const access = resolvePrimeFreeTrialAccess({
    featureId,
    isPrimeSubscriptionActive: false,
    isLoggedIn: true,
    config: config.data,
    quota: getPrimeFreeTrialQuotaOfUser({ quota, onekeyUserId }),
  });
  const featureQuota =
    access.status === 'exhausted' || access.status === 'available'
      ? access.featureQuota
      : undefined;
  // Used up only by live reservations (an earlier use still running or
  // interrupted, on any device): those uses come back when they end.
  const heldUntil =
    featureQuota && featureQuota.remaining <= 0
      ? getPrimeFreeTrialHeldReservationEnd(featureQuota)
      : undefined;
  // Refresh once the reservation ends, so the hint does not stay on "held".
  // Keyed on the snapshot's end, not on heldUntil: heldUntil turns undefined
  // as soon as the end passes, so a render in the grace period would cancel
  // the refresh and leave the hint on "used up". A snapshot whose end has
  // already passed refreshes after the grace.
  const reservationEnd =
    featureQuota &&
    featureQuota.remaining <= 0 &&
    Number(featureQuota.reserved) > 0
      ? featureQuota.reservationExpiresAt
      : undefined;
  useEffect(() => {
    if (!isFreeUser || !reservationEnd) {
      return;
    }
    const timer = setTimeout(
      () => {
        void backgroundApiProxy.servicePrimeFreeTrial.refreshQuota({
          dedupe: true,
        });
      },
      Math.min(Math.max(reservationEnd - Date.now(), 0), RESERVATION_MAX_MS) +
        RESERVATION_END_GRACE_MS,
    );
    return () => clearTimeout(timer);
  }, [reservationEnd, isFreeUser]);

  if (
    !isFreeUser ||
    isPrimeFreeTrialTravelMode() ||
    featureId === EPrimeFeatures.DAppTranslate
  ) {
    return null;
  }
  if (access.status !== 'notOpen' && !featureQuota) {
    return null;
  }
  const renderGetPrime = (freeTrialReason: 'exhausted' | 'notOpen') => {
    const openDashboard = () => {
      getPrime({ featureId, networkId, freeTrialReason });
    };
    return (
      <SizableText
        testID="prime-free-trial-hint-get-prime-btn"
        size="$bodyMdMedium"
        color="$textSuccess"
        cursor="pointer"
        hoverStyle={{ opacity: 0.8 }}
        pressStyle={{ opacity: 0.6 }}
        role="button"
        onPress={(event: GestureResponderEvent) => {
          // The hint can sit inside a pressable card (bulk revoke method).
          event.stopPropagation();
          // A dialog would stay above the dashboard.
          void dialog.close();
          if (beforeGetPrime) {
            void beforeGetPrime().then(openDashboard);
            return;
          }
          openDashboard();
        }}
      >
        {intl.formatMessage({ id: ETranslations.prime_get_prime })}
      </SizableText>
    );
  };
  // Rejection states read the same notice copy as the toasts.
  let notice: IPrimeFreeTrialNotice | undefined;
  if (!featureQuota) {
    notice = { kind: 'notOpen' };
  } else if (heldUntil) {
    notice = { kind: 'reservationHeld', heldUntil };
  } else if (featureQuota.remaining <= 0) {
    notice = {
      kind: 'exhausted',
      resetAt: access.status === 'exhausted' ? access.resetAt : undefined,
    };
  }
  let content: ReactNode;
  if (notice) {
    content = (
      <>
        <SizableText size="$bodyMd" color="$textSubdued">
          {getPrimeFreeTrialNoticeCopy({ intl, featureId, notice }).hint}
        </SizableText>
        {renderGetPrime(notice.kind === 'notOpen' ? 'notOpen' : 'exhausted')}
      </>
    );
  } else if (featureQuota) {
    content = (
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage(
          { id: ETranslations.prime_free_trial_remaining_uses__desc },
          { count: featureQuota.remaining },
        )}
      </SizableText>
    );
  }
  return (
    <XStack gap="$1.5" alignItems="center" flexWrap="wrap" {...rest}>
      {content}
    </XStack>
  );
}
