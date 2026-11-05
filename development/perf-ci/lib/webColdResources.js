const fs = require('fs');
const path = require('path');

const STATIC_RESOURCE_TYPES = new Set([
  'stylesheet',
  'script',
  'image',
  'media',
  'font',
  'texttrack',
  'manifest',
]);
const STATIC_CONTENT_TYPE =
  /^(?:(?:image|font|audio|video)\/|text\/css(?:;|$)|(?:application|text)\/(?:javascript|ecmascript|x-javascript|wasm|font-woff|vnd\.ms-fontobject)(?:;|$))/i;

function normalizeStaticResourceUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.href;
  } catch {
    return String(url || '').split('#')[0];
  }
}

function isStaticResourceResponse({
  url,
  method,
  resourceType,
  contentType,
  localOrigin,
  buildDir,
}) {
  if (method !== 'GET' && method !== 'HEAD') return false;
  // Data requests may return asset MIME types; only confirmed build files may
  // deduplicate fetch/XHR entries. Browser asset requests keep their type checks.
  const isDataRequest = resourceType === 'fetch' || resourceType === 'xhr';
  if (
    !isDataRequest &&
    (STATIC_RESOURCE_TYPES.has(resourceType) ||
      STATIC_CONTENT_TYPE.test(contentType || ''))
  ) {
    return true;
  }
  // Fetch can also load build assets such as locale JSON or files without an extension.
  // Only existing files on our static server qualify; API routes stay per-request.
  try {
    const parsed = new URL(url);
    if (parsed.origin !== localOrigin) return false;
    const filePath = path.resolve(
      buildDir,
      `.${decodeURIComponent(parsed.pathname)}`,
    );
    const relativePath = path.relative(buildDir, filePath);
    if (
      relativePath === '..' ||
      relativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativePath)
    ) {
      return false;
    }
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function countResourceEntries(entries, staticResourceUrls) {
  const staticResources = new Set();
  const staticScripts = new Set();
  let dynamicResourceCount = 0;
  let dynamicScriptCount = 0;
  for (const entry of entries) {
    const key = normalizeStaticResourceUrl(entry.name);
    const isScript =
      entry.initiatorType === 'script' || /\.m?js($|\?)/.test(entry.name);
    if (staticResourceUrls.has(key)) {
      staticResources.add(key);
      if (isScript) staticScripts.add(key);
    } else {
      dynamicResourceCount += 1;
      if (isScript) dynamicScriptCount += 1;
    }
  }
  return {
    resourceCount: staticResources.size + dynamicResourceCount,
    scriptCount: staticScripts.size + dynamicScriptCount,
  };
}

module.exports = {
  countResourceEntries,
  isStaticResourceResponse,
  normalizeStaticResourceUrl,
};
