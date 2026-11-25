import { useState } from 'react';

import { useReducedMotion } from 'react-native-reanimated';

import { Image } from '@onekeyhq/components';
import orbFallbackImage from '@onekeyhq/kit/assets/onboarding/orb-fallback.png';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ErrorBoundarySimple } from '../../../components/ErrorBoundary';

import SkiaOrbShader from './SkiaOrbShader';

import type { IOrbShaderProps } from './SkiaOrbShader';

export type { IOrbShaderProps };

export function OrbShader(props: IOrbShaderProps) {
  const { paused, size = 240 } = props;
  const reduceMotion = useReducedMotion();
  const [gifFailed, setGifFailed] = useState(false);
  const playGif = !paused && !reduceMotion && !gifFailed;
  const fallback = (
    <Image
      accessible={false}
      // The native image decoder keeps motion independent of Skia and video playback.
      source={
        playGif
          ? require('@onekeyhq/kit/assets/onboarding/orb-fallback-animated.gif')
          : orbFallbackImage
      }
      autoplay={playGif}
      testID="onboarding-orb-fallback"
      width={size}
      height={size}
      resizeMode="contain"
      onError={() => setGifFailed(true)}
    />
  );

  if (reduceMotion || platformEnv.isNativeIOSMacCatalyst) {
    return fallback;
  }

  return (
    <ErrorBoundarySimple fallback={fallback}>
      <SkiaOrbShader {...props} />
    </ErrorBoundarySimple>
  );
}

export default OrbShader;
