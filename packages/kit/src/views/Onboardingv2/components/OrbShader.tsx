// cspell:ignore canvaskit emscripten
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
// Rspack (rspack.base.config.ts) emits this wasm as an asset/resource so we
// get a runtime URL; without locateFile, emscripten tries to fetch the wasm
// next to the JS bundle and 404s.
// @ts-expect-error — asset import resolves to a string URL at runtime.
import canvaskitWasmUrl from 'canvaskit-wasm/bin/full/canvaskit.wasm';

import { YStack } from '@onekeyhq/components';

import type { IOrbShaderProps } from './OrbShader.native';

export type { IOrbShaderProps };

const loadSkiaOpts = {
  locateFile: () => canvaskitWasmUrl as unknown as string,
};

// canvaskit-wasm (~2.5MB) is fetched lazily inside WithSkiaWeb. The fallback
// below is shown during that load window on every entry, so keep it invisible
// to avoid a "green success" flash before the orb appears. Actual Skia-failure
// degradation lives in OrbShader.native (static brand circle when the shader
// fails to compile); there's no load phase on native so no flash there.
export function OrbShader(props: IOrbShaderProps) {
  const size = props.size ?? 240;
  return (
    <WithSkiaWeb
      getComponent={() => import('./OrbShader.native')}
      componentProps={props}
      opts={loadSkiaOpts}
      fallback={<YStack w={size} h={size} />}
    />
  );
}

export default OrbShader;
