import { LIGHTWEIGHT_CHARTS_STANDALONE_SCRIPT } from './lightweightChartsStandaloneScript';

const SAFE_LIGHTWEIGHT_CHARTS_STANDALONE_SCRIPT =
  LIGHTWEIGHT_CHARTS_STANDALONE_SCRIPT.replace(/<\/script/gi, '<\\/script');

export function getLightweightChartsRuntimeScriptTag(): string {
  return `<script>${SAFE_LIGHTWEIGHT_CHARTS_STANDALONE_SCRIPT}</script>`;
}
