// @ts-expect-error text-js module imported as string by babel-plugin-inline-import / esbuild
import lightweightChartsStandaloneScript from './lightweightChartsStandalone.text-js';

const LIGHTWEIGHT_CHARTS_STANDALONE_SCRIPT = String(
  lightweightChartsStandaloneScript,
);

const SAFE_LIGHTWEIGHT_CHARTS_STANDALONE_SCRIPT =
  LIGHTWEIGHT_CHARTS_STANDALONE_SCRIPT.replace(/<\/script/gi, '<\\/script');

export function getLightweightChartsRuntimeScriptTag(): string {
  return `<script>${SAFE_LIGHTWEIGHT_CHARTS_STANDALONE_SCRIPT}</script>`;
}
