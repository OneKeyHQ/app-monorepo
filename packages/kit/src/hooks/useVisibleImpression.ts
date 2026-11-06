import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';

import { Dimensions } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/shared/src/utils/appVisibility';

import type { ViewInstance } from 'react-native';

type IMeasureHost = Pick<ViewInstance, 'measureInWindow'>;
export type IImpressionHost = IMeasureHost | Element | null;

type IImpressionOptions = {
  seen: Set<string>;
  onShown: () => void;
  viewportRef?: RefObject<IMeasureHost | null>;
};

function observeImpression(
  host: NonNullable<IImpressionHost>,
  impressionKey: string,
  { seen, onShown, viewportRef }: IImpressionOptions,
) {
  let active = true;
  let intersecting = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let observer: IntersectionObserver | undefined;
  const stopPolling = () => {
    clearInterval(timer);
    timer = undefined;
  };
  const markShown = () => {
    if (!active || !getCurrentVisibilityState()) return;
    active = false;
    stopPolling();
    observer?.disconnect();
    if (seen.has(impressionKey)) return;
    seen.add(impressionKey);
    onShown();
  };
  const measure = () => {
    if (!('measureInWindow' in host)) return;
    host.measureInWindow((x, y, width, height) => {
      if (!active || !getCurrentVisibilityState()) return;
      const windowSize = Dimensions.get('window');
      const check = (vx: number, vy: number, vw: number, vh: number) => {
        if (
          Math.min(x + width, vx + vw, windowSize.width) > Math.max(x, vx, 0) &&
          Math.min(y + height, vy + vh, windowSize.height) > Math.max(y, vy, 0)
        ) {
          markShown();
        }
      };
      if (viewportRef) {
        viewportRef.current?.measureInWindow(check);
      } else {
        check(0, 0, windowSize.width, windowSize.height);
      }
    });
  };
  const update = (visible: boolean) => {
    if (!active || !visible || seen.has(impressionKey)) {
      stopPolling();
    } else if (platformEnv.isNative && !observer) {
      timer ??= setInterval(measure, 300);
      measure();
    } else if (intersecting) {
      markShown();
    }
  };
  if (
    typeof IntersectionObserver !== 'undefined' &&
    typeof Element !== 'undefined' &&
    host instanceof Element
  ) {
    observer = new IntersectionObserver(
      ([entry]) => {
        intersecting = Boolean(
          entry?.isIntersecting && entry.intersectionRatio > 0,
        );
        update(getCurrentVisibilityState());
      },
      { threshold: [0, Number.EPSILON] },
    );
    observer.observe(host);
  }
  update(getCurrentVisibilityState());
  const unsubscribe = onVisibilityStateChange(update);
  return () => {
    active = false;
    unsubscribe();
    stopPolling();
    observer?.disconnect();
  };
}

export function useVisibleImpression({
  impressionKey,
  seen,
  onShown,
  viewportRef,
}: IImpressionOptions & { impressionKey?: string }) {
  const callback = useRef(onShown);
  const stop = useRef<(() => void) | undefined>(undefined);
  useLayoutEffect(() => {
    callback.current = onShown;
  }, [onShown]);
  useEffect(() => () => stop.current?.(), []);

  // Observe from the ref so that attaching portal content never rerenders its trigger.
  return useCallback(
    (host: IImpressionHost) => {
      stop.current?.();
      stop.current = undefined;
      if (host && impressionKey && !seen.has(impressionKey)) {
        stop.current = observeImpression(host, impressionKey, {
          seen,
          viewportRef,
          onShown: () => callback.current(),
        });
      }
    },
    [impressionKey, seen, viewportRef],
  );
}
