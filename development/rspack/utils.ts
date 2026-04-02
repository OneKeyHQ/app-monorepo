import uniq from 'lodash/uniq';

import { extChannel, isManifestV3, targetBrowser } from './constant';

export function createResolveExtensions({
  platform,
  configName,
}: {
  platform: string;
  configName?: string;
}): string[] {
  const result = uniq([
    // .chrome-ext.ts, .firefox-ext.ts
    ...(extChannel && targetBrowser
      ? ['.ts', '.tsx', '.js', '.jsx'].map(
          (ext) => `.${targetBrowser}-${platform}${ext}`,
        )
      : []),
    // .ext-bg-v3.ts
    ...(configName && platform === 'ext' && isManifestV3
      ? ['.ts', '.tsx', '.js', '.jsx'].map(
          (ext) => `.${platform}-${configName}-v3${ext}`,
        )
      : []),
    // .ext-ui.ts, .ext-bg.ts
    ...(configName
      ? ['.ts', '.tsx', '.js', '.jsx'].map(
          (ext) => `.${platform}-${configName}${ext}`,
        )
      : []),
    // .ext.ts, .web.ts, .desktop.ts, .android.ts, .ios.ts, .native.ts
    ...['.ts', '.tsx', '.js', '.jsx'].map((ext) => `.${platform}${ext}`),
    '.web.ts',
    '.web.tsx',
    '.web.mjs',
    '.web.js',
    '.web.jsx',
    '.ts',
    '.tsx',
    '.mjs',
    '.cjs',
    '.js',
    '.jsx',
    '.json',
    '.wasm',
    '.d.ts',
  ]);
  console.log('createResolveExtensions>>>>>>', platform, configName, result);
  return result;
}

export function getOutputFolder(): string {
  const buildTargetBrowser = targetBrowser;
  return `${buildTargetBrowser}_v3`;
}
