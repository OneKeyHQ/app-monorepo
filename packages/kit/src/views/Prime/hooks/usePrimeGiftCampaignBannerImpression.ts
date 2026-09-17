import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect, useIsFocused } from '@react-navigation/core';
import { Dimensions, type View } from 'react-native';

import { useScrollView } from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/shared/src/utils/appVisibility';
import { PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT } from '@onekeyhq/shared/types/linkConfig';

const NATIVE_POLL_MS = 300;

type INativeMeasureHost = Pick<View, 'measureInWindow'>;
type IImpressionHost = INativeMeasureHost | Element | null;

function isMeasureHost(value: unknown): value is INativeMeasureHost {
  return (
    typeof value === 'object' &&
    value !== null &&
    'measureInWindow' in value &&
    typeof value.measureInWindow === 'function'
  );
}

export function usePrimeGiftCampaignBannerImpression({
  enabled,
  linkId,
}: {
  enabled: boolean;
  linkId: string | undefined;
}) {
  const isFocused = useIsFocused();
  const { scrollViewRef } = useScrollView();
  const [host, setHost] = useState<IImpressionHost>(null);
  const shownThisVisitRef = useRef(new Set<string>());

  useFocusEffect(
    useCallback(
      () => () => {
        shownThisVisitRef.current = new Set();
      },
      [],
    ),
  );

  useEffect(() => {
    if (!enabled || !linkId || !isFocused || !host) {
      return;
    }
    let active = true;
    let intersecting = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let observer: IntersectionObserver | undefined;

    const stopPoll = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = undefined;
      }
    };

    const stopWatching = () => {
      stopPoll();
      observer?.disconnect();
      observer = undefined;
    };

    const markShown = () => {
      if (!active || shownThisVisitRef.current.has(linkId)) {
        return;
      }
      shownThisVisitRef.current.add(linkId);
      defaultLogger.prime.subscription.primeGiftClaimSuccessBannerShown({
        slot: PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT,
        linkId,
      });
      stopWatching();
    };

    const tryLog = () => {
      if (!active || !getCurrentVisibilityState()) {
        stopPoll();
        return;
      }
      if (shownThisVisitRef.current.has(linkId)) {
        stopWatching();
        return;
      }
      if (platformEnv.isNative) {
        if (!isMeasureHost(host) || !isMeasureHost(scrollViewRef.current)) {
          return;
        }
        host.measureInWindow((x, y, width, height) => {
          if (!active || !getCurrentVisibilityState()) {
            return;
          }
          if (shownThisVisitRef.current.has(linkId)) {
            return;
          }
          const viewport = scrollViewRef.current;
          if (!isMeasureHost(viewport)) {
            return;
          }
          viewport.measureInWindow((vx, vy, vw, vh) => {
            if (!active || !getCurrentVisibilityState()) {
              return;
            }
            if (shownThisVisitRef.current.has(linkId)) {
              return;
            }
            const { width: windowWidth, height: windowHeight } =
              Dimensions.get('window');
            const left = Math.max(x, vx, 0);
            const top = Math.max(y, vy, 0);
            const right = Math.min(x + width, vx + vw, windowWidth);
            const bottom = Math.min(y + height, vy + vh, windowHeight);
            if (right > left && bottom > top) {
              markShown();
            }
          });
        });
        return;
      }
      if (!intersecting) {
        return;
      }
      markShown();
    };

    const startPoll = () => {
      if (!platformEnv.isNative || pollTimer || !active) {
        return;
      }
      if (
        !getCurrentVisibilityState() ||
        shownThisVisitRef.current.has(linkId)
      ) {
        return;
      }
      pollTimer = setInterval(tryLog, NATIVE_POLL_MS);
    };

    const unsubVisibility = onVisibilityStateChange((visible) => {
      if (!visible) {
        stopPoll();
        return;
      }
      tryLog();
      startPoll();
    });

    if (
      !platformEnv.isNative &&
      typeof IntersectionObserver !== 'undefined' &&
      typeof Element !== 'undefined' &&
      host instanceof Element
    ) {
      observer = new IntersectionObserver((entries) => {
        intersecting = entries.some((entry) => entry.isIntersecting);
        tryLog();
      });
      observer.observe(host);
    } else {
      tryLog();
      startPoll();
    }

    return () => {
      active = false;
      stopWatching();
      unsubVisibility();
    };
  }, [enabled, host, isFocused, linkId, scrollViewRef]);

  return setHost;
}
