import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect, useIsFocused } from '@react-navigation/core';
import { Dimensions } from 'react-native';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/shared/src/utils/appVisibility';

const NATIVE_POLL_MS = 300;

export type IPrimeGiftCampaignBannerMeasureInWindow = (
  x: number,
  y: number,
  width: number,
  height: number,
) => void;

export type IPrimeGiftCampaignBannerImpressionHost =
  | {
      measureInWindow?: (
        callback: IPrimeGiftCampaignBannerMeasureInWindow,
      ) => void;
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

export function usePrimeGiftCampaignBannerImpression({
  enabled,
  slot,
  linkId,
}: {
  enabled: boolean;
  slot: string;
  linkId: string | undefined;
}) {
  const isFocused = useIsFocused();
  const [host, setHost] =
    useState<IPrimeGiftCampaignBannerImpressionHost>(null);
  const shownThisVisitRef = useRef(new Set<string>());
  const impressionKey = linkId ? `${slot}:${linkId}` : undefined;

  useFocusEffect(
    useCallback(
      () => () => {
        shownThisVisitRef.current = new Set();
      },
      [],
    ),
  );

  useEffect(() => {
    if (!enabled || !impressionKey || !linkId || !isFocused || !host) {
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
      if (!active || shownThisVisitRef.current.has(impressionKey)) {
        return;
      }
      shownThisVisitRef.current.add(impressionKey);
      defaultLogger.prime.subscription.primeGiftClaimSuccessBannerShown({
        slot,
        linkId,
      });
      stopPoll();
    };

    const tryLog = () => {
      if (!active || !getCurrentVisibilityState()) {
        stopPoll();
        return;
      }
      if (shownThisVisitRef.current.has(impressionKey)) {
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
          if (shownThisVisitRef.current.has(impressionKey)) {
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
        shownThisVisitRef.current.has(impressionKey)
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
  }, [enabled, host, impressionKey, isFocused, linkId, slot]);

  return setHost;
}
