import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect, useIsFocused } from '@react-navigation/core';
import { Dimensions } from 'react-native';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IPrimeGiftAnalyticsSource } from '@onekeyhq/shared/src/logger/scopes/prime/scenes/subscription';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/shared/src/utils/appVisibility';

const NATIVE_POLL_MS = 300;

export type IPrimeGiftOfferMeasureInWindow = (
  x: number,
  y: number,
  width: number,
  height: number,
) => void;

export type IPrimeGiftOfferImpressionHost =
  | {
      measureInWindow?: (callback: IPrimeGiftOfferMeasureInWindow) => void;
    }
  | Element
  | null;

function isRectInViewport(x: number, y: number, width: number, height: number) {
  const viewport = Dimensions.get('window');
  return (
    width > 0 &&
    height > 0 &&
    x < viewport.width &&
    y < viewport.height &&
    x + width > 0 &&
    y + height > 0
  );
}

export function usePrimeGiftOfferImpression({
  enabled,
  serialNo,
  source,
}: {
  enabled: boolean;
  serialNo: string | undefined;
  source: IPrimeGiftAnalyticsSource;
}) {
  const isFocused = useIsFocused();
  const [host, setHost] = useState<IPrimeGiftOfferImpressionHost>(null);
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
    if (!enabled || !serialNo || !isFocused || !host) {
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

    const markShown = () => {
      if (!active || shownThisVisitRef.current.has(serialNo)) {
        return;
      }
      shownThisVisitRef.current.add(serialNo);
      defaultLogger.prime.subscription.primeGiftOfferShown({ source });
      stopPoll();
    };

    const tryLog = () => {
      if (!active || !getCurrentVisibilityState()) {
        stopPoll();
        return;
      }
      if (shownThisVisitRef.current.has(serialNo)) {
        stopPoll();
        return;
      }
      if (platformEnv.isNative) {
        if (!host || typeof host !== 'object' || !('measureInWindow' in host)) {
          return;
        }
        host.measureInWindow?.((x, y, width, height) => {
          if (!active || !getCurrentVisibilityState()) {
            return;
          }
          if (shownThisVisitRef.current.has(serialNo)) {
            return;
          }
          if (!isRectInViewport(x, y, width, height)) {
            return;
          }
          markShown();
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
        shownThisVisitRef.current.has(serialNo)
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
      stopPoll();
      observer?.disconnect();
      unsubVisibility();
    };
  }, [enabled, host, isFocused, serialNo, source]);

  return setHost;
}
