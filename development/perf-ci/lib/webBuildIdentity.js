const path = require('path');

function scriptAssetNamesFromHtml(html) {
  const assetNames = [];
  const scriptSourcePattern =
    /<script\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;

  for (const match of String(html).matchAll(scriptSourcePattern)) {
    const source = match[1] || match[2] || match[3];
    if (source) {
      const pathname = source.split(/[?#]/, 1)[0];
      const assetName = path.posix.basename(pathname.replace(/\\/g, '/'));
      if (assetName) assetNames.push(assetName);
    }
  }

  return [...new Set(assetNames)];
}

function assertBuildScriptsLoaded({ expected, loaded }) {
  const loadedSet = new Set(loaded);
  const missing = expected.filter((assetName) => !loadedSet.has(assetName));

  if (missing.length) {
    throw new Error(
      [
        'The browser loaded scripts that do not match the current Web build.',
        `Missing current assets: ${missing.join(', ')}`,
        `Loaded assets: ${loaded.join(', ') || '(none)'}`,
        'A stale Service Worker or browser cache may be serving an older build.',
      ].join(' '),
    );
  }
}

module.exports = {
  assertBuildScriptsLoaded,
  scriptAssetNamesFromHtml,
};
