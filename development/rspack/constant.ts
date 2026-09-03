const {
  WEB_PORT,
  PUBLIC_URL,
  NODE_ENV,
  EXT_MANIFEST_V3,
  ENABLE_ANALYZER,
  ENABLE_ANALYZER_HTML_REPORT,
  ANALYSE_MODULE,
  EXT_CHANNEL,
  ONEKEY_PROXY,
} = process.env;

export const webPort = WEB_PORT || '3000';
export const nodeEnv = NODE_ENV || 'development';
export const onekeyProxy = ONEKEY_PROXY;
export const isDev = nodeEnv !== 'production';
export const publicUrl = PUBLIC_URL;

export const isManifestV3 = !!EXT_MANIFEST_V3;
export const isManifestV2 = !isManifestV3;

export const enableAnalyzer = ENABLE_ANALYZER || false;
export const enableAnalyzerHtmlReport = ENABLE_ANALYZER_HTML_REPORT || false;
export const analyseModule = !!ANALYSE_MODULE;

export const extChannel = EXT_CHANNEL;

function getBuildTargetBrowser(): string {
  const argv = process.argv[process.argv.length - 1];
  if (argv === '--firefox') {
    return 'firefox';
  }
  if (argv === '--chrome') {
    return 'chrome';
  }
  if (argv === '--edge') {
    return 'edge';
  }
  return extChannel || 'chrome';
}

export const targetBrowser = getBuildTargetBrowser();
