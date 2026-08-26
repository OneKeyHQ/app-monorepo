const path = require('path');

const { resolveCommitSha } = require('../utils/resolveCommitSha');

const PLUGIN_NAME = 'WebAppVersionManifestPlugin';
const DEFAULT_MANIFEST_FILE = 'sw-version-manifest.json';

function normalizePublicUrl(publicUrl) {
  if (!publicUrl) {
    return '/';
  }
  return publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`;
}

function getSourceText(asset) {
  if (!asset) {
    return '';
  }
  const source =
    typeof asset.source === 'function' ? asset.source() : asset.source;
  if (Buffer.isBuffer(source)) {
    return source.toString('utf8');
  }
  return String(source || '');
}

function getAssetSize(asset) {
  if (!asset) {
    return undefined;
  }
  if (typeof asset.size === 'function') {
    return asset.size();
  }
  const source =
    typeof asset.source === 'function' ? asset.source() : asset.source;
  if (Buffer.isBuffer(source)) {
    return source.length;
  }
  if (typeof source === 'string') {
    return Buffer.byteLength(source);
  }
  return undefined;
}

function getAttribute(attributes, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = attributes.match(
    new RegExp(
      `(?:^|\\s)${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
      'i',
    ),
  );
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function normalizeAssetUrl(rawUrl, publicUrl) {
  if (!rawUrl) {
    return '';
  }
  if (/^https?:\/\//i.test(rawUrl) || rawUrl.startsWith('//')) {
    return rawUrl;
  }
  if (rawUrl.startsWith('/')) {
    return rawUrl;
  }
  if (/^https?:\/\//i.test(publicUrl)) {
    return new URL(rawUrl, publicUrl).toString();
  }
  return `${publicUrl}${rawUrl}`.replace(/\/{2,}/g, '/');
}

function getAssetNameFromUrl(rawUrl, publicUrl) {
  const cleanRawUrl = rawUrl.split('?')[0].split('#')[0];
  const normalizedPublicUrl = normalizePublicUrl(publicUrl);

  try {
    const url = new URL(cleanRawUrl, 'https://onekey.local');
    if (/^https?:\/\//i.test(normalizedPublicUrl)) {
      const publicUrlObj = new URL(normalizedPublicUrl);
      if (
        url.origin === publicUrlObj.origin &&
        url.pathname.startsWith(publicUrlObj.pathname)
      ) {
        return decodeURIComponent(
          url.pathname.slice(publicUrlObj.pathname.length),
        );
      }
    }
    return decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  } catch {
    return cleanRawUrl.replace(/^\/+/, '');
  }
}

function getCompilationAsset(compilation, assetName) {
  if (!assetName) {
    return undefined;
  }
  const asset = compilation.getAsset?.(assetName);
  if (asset?.source) {
    return asset.source;
  }
  const fallbackAsset = compilation.getAssets?.().find((item) => {
    const normalizedName = item.name.replace(/\\/g, '/');
    return (
      normalizedName === assetName ||
      normalizedName.endsWith(`/${assetName}`) ||
      path.basename(normalizedName) === assetName
    );
  });
  if (fallbackAsset?.source) {
    return fallbackAsset.source;
  }
  return compilation.assets?.[assetName];
}

function extractCriticalAssets({ compilation, html, publicUrl }) {
  const criticalAssets = [];
  const seen = new Set();
  const tagRegex = /<(script|link)\b([^>]*)>/gi;

  let match;
  while ((match = tagRegex.exec(html))) {
    const tagName = match[1].toLowerCase();
    const attributes = match[2] || '';
    const rel = getAttribute(attributes, 'rel') || '';
    const src = getAttribute(attributes, 'src');
    const href = getAttribute(attributes, 'href');

    let rawUrl = '';
    let assetType = '';
    if (tagName === 'script' && src) {
      rawUrl = src;
      assetType = 'script';
    } else if (
      tagName === 'link' &&
      href &&
      rel
        .split(/\s+/)
        .map((item) => item.toLowerCase())
        .includes('stylesheet')
    ) {
      rawUrl = href;
      assetType = 'style';
    }

    if (rawUrl && !seen.has(rawUrl)) {
      seen.add(rawUrl);

      const assetName = getAssetNameFromUrl(rawUrl, publicUrl);
      const asset = getCompilationAsset(compilation, assetName);
      const normalizedUrl = normalizeAssetUrl(rawUrl, publicUrl);

      criticalAssets.push({
        url: normalizedUrl,
        as: assetType,
        integrity: getAttribute(attributes, 'integrity') || undefined,
        crossOrigin: getAttribute(attributes, 'crossorigin') || undefined,
        size: getAssetSize(asset),
      });
    }
  }

  return criticalAssets;
}

function buildVersion() {
  const commit = resolveCommitSha();
  const buildNumber = process.env.BUILD_NUMBER || '0';
  return `${commit || 'local'}-${buildNumber}`;
}

class WebAppVersionManifestPlugin {
  constructor(options = {}) {
    this.options = {
      fileName: DEFAULT_MANIFEST_FILE,
      htmlAssetName: 'index.html',
      publicUrl: process.env.PUBLIC_URL,
      RawSource: options.RawSource,
      processAssetsStage: options.processAssetsStage,
      ...options,
    };
  }

  apply(compiler) {
    const { fileName, htmlAssetName, processAssetsStage, RawSource } =
      this.options;

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: processAssetsStage,
        },
        () => {
          const htmlAsset = getCompilationAsset(compilation, htmlAssetName);
          const html = getSourceText(htmlAsset);
          if (!html) {
            compilation.errors.push(
              new Error(
                `[${PLUGIN_NAME}] missing HTML asset for ${htmlAssetName}`,
              ),
            );
            return;
          }
          const publicUrl = normalizePublicUrl(this.options.publicUrl);
          const critical = extractCriticalAssets({
            compilation,
            html,
            publicUrl,
          });
          if (critical.length === 0) {
            compilation.errors.push(
              new Error(`[${PLUGIN_NAME}] generated empty critical asset list`),
            );
            return;
          }
          const commit = resolveCommitSha();
          const buildTime = Number(process.env.BUILD_TIME) || Date.now();

          const manifest = {
            schema: 1,
            version: buildVersion(),
            appVersion: process.env.VERSION || '',
            bundleVersion: process.env.BUNDLE_VERSION || '',
            buildNumber: process.env.BUILD_NUMBER || '',
            commit,
            buildTime,
            publicUrl,
            htmlUrl: '/index.html',
            generatedAt: new Date(buildTime).toISOString(),
            critical,
          };

          const source = new RawSource(
            `${JSON.stringify(manifest, null, 2)}\n`,
          );
          compilation.emitAsset(fileName, source);
        },
      );
    });
  }
}

module.exports = {
  WebAppVersionManifestPlugin,
  extractCriticalAssets,
  normalizePublicUrl,
};
