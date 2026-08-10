import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

interface ITradingViewEmbedBuildManifest {
  integrity: string;
  outputFileName: string;
  publicUrl: string;
  sourcePath: string;
}

export function readTradingViewEmbedBuildManifest(
  basePath: string,
  assetPublicUrl: string | undefined,
): ITradingViewEmbedBuildManifest | undefined {
  const sourcePath = path.join(
    basePath,
    '.generated/tradingview-embed-manifest.json',
  );
  if (!fs.existsSync(sourcePath)) {
    return undefined;
  }
  const bytes = fs.readFileSync(sourcePath);
  const manifest = JSON.parse(bytes.toString('utf8')) as { version?: unknown };
  if (
    typeof manifest.version !== 'string' ||
    !/^[a-zA-Z0-9._-]+$/.test(manifest.version)
  ) {
    throw new Error('TradingView embed manifest version is invalid');
  }
  const outputFileName = `tradingview-embed-manifest.${manifest.version}.json`;
  let normalizedPublicUrl =
    !assetPublicUrl || assetPublicUrl === '.' || assetPublicUrl === './'
      ? '/'
      : assetPublicUrl;
  if (!normalizedPublicUrl.endsWith('/')) {
    normalizedPublicUrl = `${normalizedPublicUrl}/`;
  }
  return {
    integrity: `sha384-${createHash('sha384').update(bytes).digest('base64')}`,
    outputFileName,
    publicUrl: `${normalizedPublicUrl}${outputFileName}`,
    sourcePath,
  };
}
