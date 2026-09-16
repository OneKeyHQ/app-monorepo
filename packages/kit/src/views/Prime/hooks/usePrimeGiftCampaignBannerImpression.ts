import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect, useIsFocused } from '@react-navigation/core';
import { Dimensions } from 'react-native';

import { useScrollView } from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/shared/src/utils/appVisibility';
import { PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT } from '@onekeyhq/shared/types/linkConfig';

const NATIVE_POLL_MS = 300;

export type IPrimeGiftCampaignBannerMeasureInWindow = (
  x: number,
  y: number,
  width: number,
  height: number,
) => void;

export type IPrimeGiftCampaignBannerMeasureHost = {
  measureInWindow?: (callback: IPrimeGiftCampaignBannerMeasureInWindow) => void;
};

export type IPrimeGiftCampaignBannerImpressionHost =
  | IPrimeGiftCampaignBannerMeasureHost
  | Element
  | null;

type IMeasureHost = {
  measureInWindow: (callback: IPrimeGiftCampaignBannerMeasureInWindow) => void;
};

type IWindowRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function intersectRects(
  a: IWindowRect,
  b: IWindowRect,
): IWindowRect | undefined {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const width = Math.min(a.x + a.width, b.x + b.width) - x;
  const height = Math.min(a.y + a.height, b.y + b.height) - y;
  if (width <= 0 || height <= 0) {
    return undefined;
  }
  return { x, y, width, height };
}

function isRectVisibleInScrollViewport(
  banner: IWindowRect,
  viewport: IWindowRect,
) {
  const windowRect = {
    x: 0,
    y: 0,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  };
  const clipped = intersectRects(banner, viewport);
  if (!clipped) {
    return false;
  }
  return Boolean(intersectRects(clipped, windowRect));
}

function isMeasureHost(value: unknown): value is IMeasureHost {
  return (
    typeof value === 'object' &&
    value !== null &&
    'measureInWindow' in value &&
    typeof (value as { measureInWindow?: unknown }).measureInWindow ===
      'function'
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
  const [host, setHost] =
    useState<IPrimeGiftCampaignBannerImpressionHost>(null);
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
        if (!isMeasureHost(host) || !isMeasureHost(scrollViewRef?.current)) {
          return;
        }
        host.measureInWindow((x, y, width, height) => {
          if (!active || !getCurrentVisibilityState()) {
            return;
          }
          if (shownThisVisitRef.current.has(linkId)) {
            return;
          }
          const viewport = scrollViewRef?.current;
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
            if (
              !isRectVisibleInScrollViewport(
                { x, y, width, height },
                { x: vx, y: vy, width: vw, height: vh },
              )
            ) {
              return;
            }
            markShown();
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
