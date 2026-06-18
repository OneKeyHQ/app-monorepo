// @ts-expect-error text-js module imported as string by babel-plugin-inline-import / esbuild
import lightweightChartsStandaloneScript from './lightweightChartsStandalone.text-js';

export function getLightweightChartsStandaloneScript(): string {
  return String(lightweightChartsStandaloneScript);
}
