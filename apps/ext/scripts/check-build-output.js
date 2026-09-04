#!/usr/bin/env node

/* eslint-disable no-restricted-syntax, onekey/no-raw-error, unicorn/numeric-separators-style -- standalone build script */

const fs = require('fs');
const path = require('path');

const buildRoot = path.resolve(__dirname, '..', 'build');
const forbiddenRemoteCode = [
  'https://browser.sentry-cdn.com',
  'https://svelte-stripe-js.vercel.app',
  'https://maps.googleapis.com/maps/api/js',
  '/js/telegram-login.js',
];
const stripeV3BaseUrl = 'https://js.stripe.com/v3/';
const stripeV3SourcePath = path.resolve(
  __dirname,
  '../../../packages/shared/src/modules3rdParty/stripe-v3/index.js',
);
const stripeV3RuntimeStartMarker = 'stripe-js-v3:';
const stripeV3RuntimeMarker = 'webpackChunkStripeJSouter';
const stripeV3FrameBaseMarker = 'DANGEROUS_BREAKS_ORIGIN_CHECKING_baseUrl';
const stripeV3SourcePublicPathPattern =
  /(\.p\s*=\s*)(["'])https:\/\/js\.stripe\.com\/v3\/\2/g;
const stripeV3FrameBaseFallbackPattern =
  /\|\|(["'])https:\/\/js\.stripe\.com\/v3\/\1/g;
const stripeV3FramePathPattern = /elements-inner-payment-[a-f0-9]+\.html/g;

function getBrowser() {
  const browserArg = process.argv.find((arg) => arg.startsWith('--browser='));
  if (browserArg) {
    return browserArg.slice('--browser='.length);
  }
  const browserIndex = process.argv.indexOf('--browser');
  if (browserIndex >= 0 && process.argv[browserIndex + 1]) {
    return process.argv[browserIndex + 1];
  }
  return process.env.EXT_CHANNEL || 'chrome';
}

function walkFiles(rootPath) {
  const files = [];
  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function assertFile(outputRoot, relativePath, label) {
  if (!relativePath || relativePath.includes('*')) {
    return;
  }
  const normalizedPath = relativePath.replace(/^\//, '').split(/[?#]/)[0];
  const filePath = path.resolve(outputRoot, normalizedPath);
  const relativeToOutput = path.relative(outputRoot, filePath);
  if (
    relativeToOutput.startsWith('..') ||
    path.isAbsolute(relativeToOutput) ||
    !fs.existsSync(filePath)
  ) {
    throw new Error(`${label} references missing asset: ${relativePath}`);
  }
}

function collectManifestReferences(manifest) {
  const references = [
    manifest.background && manifest.background.service_worker,
    manifest.action && manifest.action.default_popup,
    manifest.side_panel && manifest.side_panel.default_path,
    ...Object.values(manifest.chrome_url_overrides || {}),
  ];
  for (const contentScript of manifest.content_scripts || []) {
    references.push(...(contentScript.js || []), ...(contentScript.css || []));
  }
  for (const resourceGroup of manifest.web_accessible_resources || []) {
    references.push(...(resourceGroup.resources || []));
  }
  return references.filter(Boolean);
}

function assertHtmlReferences(outputRoot, htmlFiles) {
  const scriptPattern = /<script[^>]+src=["']([^"']+)["']/g;
  for (const htmlFile of htmlFiles) {
    const html = fs.readFileSync(htmlFile, 'utf8');
    for (const match of html.matchAll(scriptPattern)) {
      if (/^(?:https?:)?\/\//.test(match[1])) {
        throw new Error(`Remote script in ${htmlFile}: ${match[1]}`);
      }
      assertFile(outputRoot, match[1], path.relative(outputRoot, htmlFile));
    }
  }
}

function countOccurrences(source, value) {
  return source.split(value).length - 1;
}

function assertStripeV3Runtime(files, jsFiles) {
  const stripeV3RuntimeCandidates = [];
  for (const jsFile of jsFiles) {
    const source = fs.readFileSync(jsFile, 'utf8');
    const isStripeV3Runtime =
      source.includes(stripeV3RuntimeStartMarker) &&
      source.includes(stripeV3RuntimeMarker);
    // This scans emitted JavaScript source for an exact forbidden literal,
    // not an untrusted URL that will be parsed or navigated to.
    // codeql[js/incomplete-url-substring-sanitization]
    if (source.includes(stripeV3BaseUrl) && !isStripeV3Runtime) {
      throw new Error(`Unexpected Stripe v3 remote URL in ${jsFile}`);
    }
    if (isStripeV3Runtime) {
      stripeV3RuntimeCandidates.push({ jsFile, source });
    }
  }

  if (stripeV3RuntimeCandidates.length !== 1) {
    throw new Error(
      `Expected one vendored Stripe v3 runtime, found ${stripeV3RuntimeCandidates.length}.`,
    );
  }

  const [{ jsFile, source }] = stripeV3RuntimeCandidates;
  const runtimeStartIndex = source.indexOf(stripeV3RuntimeStartMarker);
  const runtimeEndIndex = source.indexOf(
    stripeV3RuntimeMarker,
    runtimeStartIndex,
  );
  const runtimeSource = source.slice(runtimeStartIndex, runtimeEndIndex);
  const publicPaths = [
    ...runtimeSource.matchAll(/\.p\s*=\s*(["'])(.*?)\1/g),
  ].map((match) => match[2]);
  if (publicPaths.length !== 1 || publicPaths[0] !== '') {
    throw new Error(`Stripe v3 webpack public path must be empty in ${jsFile}`);
  }

  const frameBaseMarkerIndex = source.indexOf(stripeV3FrameBaseMarker);
  if (frameBaseMarkerIndex < 0) {
    throw new Error(`Missing Stripe v3 frame URL helper in ${jsFile}`);
  }
  const frameBaseSource = source.slice(
    frameBaseMarkerIndex,
    frameBaseMarkerIndex + 1000,
  );
  const frameBaseFallbackMatches =
    frameBaseSource.match(stripeV3FrameBaseFallbackPattern) || [];
  if (frameBaseFallbackMatches.length !== 1) {
    throw new Error(
      `Expected one exact Stripe v3 frame URL fallback in ${jsFile}, found ${frameBaseFallbackMatches.length}`,
    );
  }

  const framePaths = [...new Set(source.match(stripeV3FramePathPattern) || [])];
  if (framePaths.length === 0) {
    throw new Error(`Missing Stripe v3 payment iframe path in ${jsFile}`);
  }
  const emittedFileNames = new Set(files.map((file) => path.basename(file)));
  const locallyEmittedFrame = framePaths.find((framePath) =>
    emittedFileNames.has(framePath),
  );
  if (locallyEmittedFrame) {
    throw new Error(
      `Stripe v3 payment iframe must remain remote: ${locallyEmittedFrame}`,
    );
  }

  const stripeV3Source = fs.readFileSync(stripeV3SourcePath, 'utf8');
  const sourcePublicPathMatches =
    stripeV3Source.match(stripeV3SourcePublicPathPattern) || [];
  if (sourcePublicPathMatches.length !== 1) {
    throw new Error(
      `Expected one Stripe v3 source public path, found ${sourcePublicPathMatches.length}.`,
    );
  }
  const expectedBaseUrlCount =
    countOccurrences(stripeV3Source, stripeV3BaseUrl) -
    sourcePublicPathMatches.length;
  const emittedBaseUrlCount = countOccurrences(source, stripeV3BaseUrl);
  if (emittedBaseUrlCount !== expectedBaseUrlCount) {
    throw new Error(
      `Stripe v3 URL replacement count mismatch in ${jsFile}: ${emittedBaseUrlCount} !== ${expectedBaseUrlCount}`,
    );
  }
}

function readBudget(name, fallback) {
  const value = process.env[name];
  return value ? Number(value) : fallback;
}

function main() {
  const outputRoot = path.join(buildRoot, `${getBrowser()}_v3`);
  const manifestPath = path.join(outputRoot, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing extension manifest: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.manifest_version !== 3) {
    throw new Error('Rspack extension output must use Manifest V3.');
  }
  for (const reference of collectManifestReferences(manifest)) {
    assertFile(outputRoot, reference, 'manifest.json');
  }

  const files = walkFiles(outputRoot);
  const jsFiles = files.filter((file) => file.endsWith('.js'));
  const htmlFiles = files.filter((file) => file.endsWith('.html'));
  assertHtmlReferences(outputRoot, htmlFiles);
  assertStripeV3Runtime(files, jsFiles);

  const backgroundPath = path.join(outputRoot, 'background.bundle.js');
  const contentScriptPath = path.join(outputRoot, 'content-script.bundle.js');
  assertFile(outputRoot, 'background.bundle.js', 'build contract');
  assertFile(outputRoot, 'content-script.bundle.js', 'build contract');

  for (const jsFile of jsFiles) {
    const source = fs.readFileSync(jsFile, 'utf8');
    const violation = forbiddenRemoteCode.find((value) =>
      source.includes(value),
    );
    if (violation) {
      throw new Error(
        `Forbidden remote-code reference in ${jsFile}: ${violation}`,
      );
    }
  }
  if (fs.readFileSync(backgroundPath, 'utf8').includes('import.meta')) {
    throw new Error(
      'background.bundle.js contains unsupported import.meta syntax.',
    );
  }
  if (files.some((file) => file.endsWith('.map'))) {
    throw new Error(
      'Production extension output must not contain source maps.',
    );
  }

  const totalBytes = files.reduce(
    (total, file) => total + fs.statSync(file).size,
    0,
  );
  const jsBytes = jsFiles.reduce(
    (total, file) => total + fs.statSync(file).size,
    0,
  );
  const backgroundBytes = fs.statSync(backgroundPath).size;
  const budgets = {
    // Raised from 160000000: the previous ceiling was set against a
    // ~154.3 MB build and steady growth on x has since consumed almost all of
    // that margin, so the gate started firing on whichever PR happened to land
    // next rather than on the change that caused the growth. This restores the
    // original ~3.7% headroom over the current output. Note the measurement is
    // platform-sensitive — a macOS build reads ~43 KB smaller than CI's Linux
    // build, so trust the CI number when the margin is thin.
    totalBytes: readBudget('EXT_BUILD_MAX_TOTAL_BYTES', 166000000),
    // Keep enough headroom for expected route and chunk growth while the total
    // output size budget continues to guard against broader regressions.
    jsFiles: readBudget('EXT_BUILD_MAX_JS_FILES', 1000),
    // Raised from 38 MiB (39845888) for the same reason as totalBytes above:
    // x had grown to 39.63 MB (c45e14cece, 0.5% headroom) and the WalletKit
    // 1.5.6 upgrade (bundled @walletconnect/pay stack, ~0.47 MB in the
    // single-file MV3 background bundle) tipped the merged output to
    // 40.10 MB. 40 MiB restores ~4.6% headroom over that build.
    backgroundBytes: readBudget(
      'EXT_BUILD_MAX_BACKGROUND_BYTES',
      40 * 1024 * 1024,
    ),
  };

  if (totalBytes > budgets.totalBytes) {
    throw new Error(
      `Extension output exceeds total size budget: ${totalBytes} > ${budgets.totalBytes}`,
    );
  }
  if (jsFiles.length > budgets.jsFiles) {
    throw new Error(
      `Extension output exceeds JavaScript file budget: ${jsFiles.length} > ${budgets.jsFiles}`,
    );
  }
  if (backgroundBytes > budgets.backgroundBytes) {
    throw new Error(
      `Background bundle exceeds size budget: ${backgroundBytes} > ${budgets.backgroundBytes}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        outputRoot,
        files: files.length,
        totalBytes,
        jsFiles: jsFiles.length,
        jsBytes,
        backgroundBytes,
        contentScriptBytes: fs.statSync(contentScriptPath).size,
        budgets,
      },
      null,
      2,
    ),
  );
}

main();
