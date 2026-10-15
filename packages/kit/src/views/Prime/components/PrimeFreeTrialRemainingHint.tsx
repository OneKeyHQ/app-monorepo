import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import { SizableText } from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  usePrimeFreeTrialAtom,
  usePrimePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getPrimeFreeTrialHeldReservationEnd } from '@onekeyhq/shared/src/utils/primeFreeTrialUtils';
import type { IPrimeFreeTrialFeatureId } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import { isPrimeFreeTrialTravelMode } from '../hooks/usePrimeFeatureAccess';
import {
  getPrimeFreeTrialQuotaOfUser,
  isPrimeFreeTrialStayOnPageFeature,
  resolvePrimeFreeTrialAccess,
} from '../utils/primeFreeTrialAccess';
import { getPrimeFreeTrialNoticeCopy } from '../utils/primeFreeTrialCopy';

import type { IPrimeFreeTrialNotice } from '../utils/primeFreeTrialCopy';

// A snapshot younger than this is reused instead of refreshing on mount; the
// entry gate usually refreshed it a moment ago.
const SNAPSHOT_FRESH_MS = 30 * 1000;
// A reservation lasts at most 30 minutes; the refresh at its end waits a
// moment so the server has released it.
const RESERVATION_MAX_MS = 30 * 60 * 1000;
const RESERVATION_END_GRACE_MS = 2000;

// Remaining free uses of a feature. Rendered only for logged-in free users
// with a known quota of a feature open for a free trial, never for
// translate. Used up or held by live reservations, it shows the same notice
// as the toast a submit would get. No "Get Prime" here: pressing the main
// button shows that toast, which has it.
// Reads the Prime atom directly (not useOneKeyAuth) so it also works inside
// dialogs rendered outside the auth providers.
export function PrimeFreeTrialRemainingHint({
  featureId,
  ...rest
}: {
  featureId: IPrimeFreeTrialFeatureId;
} & ISizableTextProps) {
  const [user] = usePrimePersistAtom();
  const isLoggedIn = Boolean(user?.isLoggedIn && user?.isLoggedInOnServer);
  const isPrimeSubscriptionActive = Boolean(
    isLoggedIn && user?.primeSubscription?.isActive,
  );
  const [{ quota, config }] = usePrimeFreeTrialAtom();
  const onekeyUserId = user?.onekeyUserId;
  const isFreeUser = isLoggedIn && !isPrimeSubscriptionActive;
  const intl = useIntl();

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

  // Only features open for a free trial get a hint.
  if (
    !isFreeUser ||
    !featureQuota ||
    isPrimeFreeTrialTravelMode() ||
    isPrimeFreeTrialStayOnPageFeature(featureId)
  ) {
    return null;
  }
  // Rejection states read the same notice copy as the toasts.
  const noticeHint = (notice: IPrimeFreeTrialNotice) =>
    getPrimeFreeTrialNoticeCopy({ intl, featureId, notice }).hint;
  let text: string;
  if (heldUntil) {
    text = noticeHint({ kind: 'reservationHeld', heldUntil });
  } else if (featureQuota.remaining <= 0) {
    text = noticeHint({
      kind: 'exhausted',
      resetAt: access.status === 'exhausted' ? access.resetAt : undefined,
    });
  } else {
    text = intl.formatMessage(
      { id: ETranslations.prime_free_trial_remaining_uses__desc },
      { count: featureQuota.remaining },
    );
  }
  return (
    <SizableText size="$bodyMd" color="$textSubdued" {...rest}>
      {text}
    </SizableText>
  );
}
