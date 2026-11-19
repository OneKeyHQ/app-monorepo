const TRADING_VIEW_EMBED_PROTOCOL_VERSION = 1;

interface IBuildTradingViewEmbedServiceWorkerPathOptions {
  buildNumber?: string;
  commitHash?: string;
}

export function buildTradingViewEmbedServiceWorkerPath({
  buildNumber = process.env.BUILD_NUMBER || '0',
  commitHash = process.env.WORKFLOW_GITHUB_SHA ||
    process.env.GITHUB_SHA ||
    'local',
}: IBuildTradingViewEmbedServiceWorkerPathOptions = {}): string {
  const appBuild = `${commitHash || 'local'}-${buildNumber || '0'}`;
  return `/service-worker.js?tradingviewEmbedProtocol=${TRADING_VIEW_EMBED_PROTOCOL_VERSION}&appBuild=${encodeURIComponent(
    appBuild,
  )}`;
}

export const TRADING_VIEW_EMBED_SERVICE_WORKER_PATH =
  buildTradingViewEmbedServiceWorkerPath();
