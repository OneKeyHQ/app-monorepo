// cspell:ignore canvaskit emscripten
import { useCallback, useState, useSyncExternalStore } from 'react';

import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
// Rspack (rspack.base.config.ts) emits this wasm as an asset/resource so we
// get a runtime URL; without locateFile, emscripten tries to fetch the wasm
// next to the JS bundle and 404s.
// @ts-expect-error — asset import resolves to a string URL at runtime.
import canvaskitWasmUrl from 'canvaskit-wasm/bin/full/canvaskit.wasm';

import { ErrorBoundarySimple } from '../../../components/ErrorBoundary';

import type { IOrbShaderProps } from './SkiaOrbShader';

export type { IOrbShaderProps };

const loadSkiaOpts = {
  locateFile: () => canvaskitWasmUrl as unknown as string,
};

const fallbackImageUrl =
  require('@onekeyhq/kit/assets/onboarding/orb-fallback.png') as string;

const fallbackGifUrl =
  require('@onekeyhq/kit/assets/onboarding/orb-fallback-animated.gif') as string;

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

function subscribeToReducedMotion(onChange: () => void) {
  const media = globalThis.matchMedia?.(reducedMotionQuery);
  media?.addEventListener?.('change', onChange);
  return () => media?.removeEventListener?.('change', onChange);
}

function getReducedMotion() {
  return globalThis.matchMedia?.(reducedMotionQuery).matches ?? false;
}

// The images are the baseline. Keeping the optional stylesheet with the
// fallback means the image does not depend on loading a CSS chunk.
const fallbackStyles = `
  @media (prefers-reduced-motion: no-preference) {
    .onekey-onboarding-orb-image {
      --orb-spin: none;
      --orb-hue: none;
      animation:
        onekey-onboarding-orb-breathe 1.6s ease-in-out infinite alternate,
        var(--orb-spin),
        var(--orb-hue);
    }

    .onekey-onboarding-orb-image[data-rotate] {
      --orb-spin: onekey-onboarding-orb-spin 31.4s linear infinite;
    }

    .onekey-onboarding-orb-image[data-hue-shift] {
      --orb-hue: onekey-onboarding-orb-hue 5.2s ease-in-out infinite alternate;
    }
  }

  @keyframes onekey-onboarding-orb-breathe {
    from { opacity: 0.6; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1.04); }
  }

  @keyframes onekey-onboarding-orb-spin {
    to { rotate: -1turn; }
  }

  @keyframes onekey-onboarding-orb-hue {
    from { filter: hue-rotate(-55deg); }
    to { filter: hue-rotate(120deg); }
  }
`;

const loadSkiaOrb = () => import('./SkiaOrbShader');

function OrbStillImage({ size }: { size: number }) {
  return (
    <img
      alt=""
      src={fallbackImageUrl}
      width={size}
      height={size}
      data-testid="onboarding-orb-fallback"
      style={{ display: 'block' }}
    />
  );
}

function OrbFallback({
  autoRotate = true,
  hueByIntensity = true,
  paused,
  size = 240,
}: IOrbShaderProps) {
  const [cssUnavailable, setCssUnavailable] = useState(false);
  const [gifFailed, setGifFailed] = useState(false);
  const checkCssAnimation = useCallback(
    (element: HTMLImageElement | null) => {
      if (!element || paused) return;
      if (
        !getComputedStyle(element).animationName.includes(
          'onekey-onboarding-orb-breathe',
        )
      ) {
        setCssUnavailable(true);
      }
    },
    [paused],
  );

  if (cssUnavailable) {
    return (
      <picture>
        {/* The media source honors reduced motion even if the stylesheet was blocked. */}
        <source media={reducedMotionQuery} srcSet={fallbackImageUrl} />
        <img
          alt=""
          src={paused || gifFailed ? fallbackImageUrl : fallbackGifUrl}
          width={size}
          height={size}
          data-testid="onboarding-orb-fallback"
          style={{ display: 'block' }}
          onError={() => setGifFailed(true)}
        />
      </picture>
    );
  }

  return (
    <>
      <style>{fallbackStyles}</style>
      <img
        ref={checkCssAnimation}
        alt=""
        src={fallbackImageUrl}
        width={size}
        height={size}
        className="onekey-onboarding-orb-image"
        data-testid="onboarding-orb-fallback"
        data-rotate={autoRotate || undefined}
        data-hue-shift={hueByIntensity || undefined}
        style={{
          display: 'block',
          animationPlayState: paused ? 'paused' : undefined,
        }}
      />
    </>
  );
}

export function OrbShader(props: IOrbShaderProps) {
  const { size = 240 } = props;
  const [contextLost, setContextLost] = useState(false);
  const reduceMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotion,
    () => true,
  );

  const attachContextLossListener = useCallback(
    (container: HTMLDivElement | null) => {
      if (!container) return undefined;

      // Context-loss events from the canvas do not bubble.
      const onContextLost = () => setContextLost(true);
      container.addEventListener('webglcontextlost', onContextLost, true);
      return () =>
        container.removeEventListener('webglcontextlost', onContextLost, true);
    },
    [],
  );

  const fallback = <OrbFallback {...props} />;
  const stillImage = <OrbStillImage size={size} />;

  let content = stillImage;
  if (!reduceMotion) {
    content = contextLost ? (
      fallback
    ) : (
      <ErrorBoundarySimple fallback={fallback}>
        <WithSkiaWeb
          getComponent={loadSkiaOrb}
          componentProps={props}
          fallback={stillImage}
          opts={loadSkiaOpts}
        />
      </ErrorBoundarySimple>
    );
  }

  return (
    <div
      aria-hidden="true"
      ref={attachContextLossListener}
      style={{ width: size, height: size }}
    >
      {content}
    </div>
  );
}

export default OrbShader;
