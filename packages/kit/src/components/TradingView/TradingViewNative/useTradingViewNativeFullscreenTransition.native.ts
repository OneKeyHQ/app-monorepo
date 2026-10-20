import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';

import { AppState } from 'react-native';
import { captureScreen, releaseCapture } from 'react-native-view-shot';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { setTradingViewNativeTransitionCover } from './TradingViewNativePresentation.native';

type IChartSize = { width: number; height: number };
type ITransition = {
  fullscreen: boolean;
  started: boolean;
  committed: boolean;
  uri?: string;
  timeout?: ReturnType<typeof setTimeout>;
  frame?: number;
};

export function useTradingViewNativeFullscreenTransition({
  isFullscreen,
  onFullscreenChange,
}: {
  isFullscreen: boolean;
  onFullscreenChange?: (fullscreen: boolean) => void;
}) {
  const id = useId();
  const mounted = useRef(true);
  const transition = useRef<ITransition | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const callback = useRef(onFullscreenChange);
  useLayoutEffect(() => {
    callback.current = onFullscreenChange;
  }, [onFullscreenChange]);

  const finish = useCallback(() => {
    const current = transition.current;
    transition.current = null;
    if (mounted.current) setIsTransitioning(false);
    if (current?.timeout) clearTimeout(current.timeout);
    if (current?.frame !== undefined) cancelAnimationFrame(current.frame);
    setTradingViewNativeTransitionCover(id, null);
    if (current?.uri) releaseCapture(current.uri);
  }, [id]);

  useLayoutEffect(() => {
    mounted.current = true;
    if (!platformEnv.isNativeIOS) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') finish();
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      finish();
    };
  }, [finish]);

  useLayoutEffect(() => {
    const current = transition.current;
    if (!current?.started) return;
    if (isFullscreen === current.fullscreen) {
      current.committed = true;
    } else if (current.committed) {
      finish();
    }
  }, [finish, isFullscreen]);

  const changeFullscreen = useCallback(
    (fullscreen: boolean) => {
      if (!platformEnv.isNativeIOS || !callback.current) {
        callback.current?.(fullscreen);
        return;
      }
      if (transition.current || fullscreen === isFullscreen) return;
      const current: ITransition = {
        fullscreen,
        started: false,
        committed: false,
      };
      transition.current = current;
      setIsTransitioning(true);
      const start = () => {
        if (transition.current !== current || current.started) return;
        current.started = true;
        callback.current?.(fullscreen);
      };
      // A failed capture or an interrupted layout must never trap the user.
      current.timeout = setTimeout(() => {
        start();
        finish();
      }, 5000);
      void captureScreen({ format: 'png', result: 'tmpfile' })
        .then((uri) => {
          if (!mounted.current || transition.current !== current) {
            releaseCapture(uri);
            return;
          }
          current.uri = uri;
          setTradingViewNativeTransitionCover(id, {
            uri,
            onLoad: () => {
              if (transition.current !== current || current.started) return;
              current.frame = requestAnimationFrame(() => {
                current.frame = requestAnimationFrame(start);
              });
            },
            onError: () => {
              if (transition.current !== current) return;
              start();
              finish();
            },
          });
        })
        .catch(() => {
          if (transition.current === current) {
            start();
            finish();
          }
        });
    },
    [finish, id, isFullscreen],
  );

  const onPresentationReady = useCallback(
    (size: IChartSize) => {
      const current = transition.current;
      if (!current?.committed || current.fullscreen !== isFullscreen) return;
      if (
        isFullscreen &&
        !platformEnv.isNativeIOSPad &&
        size.width <= size.height
      ) {
        return;
      }
      if (current.frame !== undefined) cancelAnimationFrame(current.frame);
      current.frame = requestAnimationFrame(() => {
        current.frame = requestAnimationFrame(() => {
          if (transition.current === current) finish();
        });
      });
    },
    [finish, isFullscreen],
  );

  return {
    changeFullscreen,
    onPresentationReady: isTransitioning ? onPresentationReady : undefined,
  };
}
