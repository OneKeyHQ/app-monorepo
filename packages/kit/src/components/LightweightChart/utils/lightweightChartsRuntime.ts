type ILightweightChartsRuntimeSource =
  typeof import('./lightweightChartsRuntimeSource');

function loadLightweightChartsStandaloneScript(): string {
  // Delay the large raw string until a native WebView HTML payload is built.
  const { getLightweightChartsStandaloneScript } =
    require('./lightweightChartsRuntimeSource') as ILightweightChartsRuntimeSource;
  return getLightweightChartsStandaloneScript();
}

export function getLightweightChartsRuntimeScriptTag(): string {
  const safeScript = loadLightweightChartsStandaloneScript().replace(
    /<\/script/gi,
    '<\\/script',
  );
  return `<script>${safeScript}</script>`;
}
