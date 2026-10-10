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
    manifest.background && manifest.background.page,
    manifest.browser_action && manifest.browser_action.default_popup,
    manifest.action && manifest.action.default_popup,
    manifest.side_panel && manifest.side_panel.default_path,
    ...Object.values(manifest.chrome_url_overrides || {}),
  ];
  for (const contentScript of manifest.content_scripts || []) {
    references.push(...(contentScript.js || []), ...(contentScript.css || []));
  }
  for (const resourceGroup of manifest.web_accessible_resources || []) {
    references.push(
      ...(typeof resourceGroup === 'string'
        ? [resourceGroup]
        : resourceGroup.resources || []),
    );
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
  const isFirefox = getBrowser() === 'firefox';
  const outputRoot = path.join(buildRoot, `${getBrowser()}_v3`);
  const manifestPath = path.join(outputRoot, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing extension manifest: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const expectedManifestVersion = isFirefox ? 2 : 3;
  if (manifest.manifest_version !== expectedManifestVersion) {
    throw new Error(
      `Unexpected extension manifest version: ${manifest.manifest_version} !== ${expectedManifestVersion}`,
    );
  }
  for (const reference of collectManifestReferences(manifest)) {
    assertFile(outputRoot, reference, 'manifest.json');
  }
  const backgroundBootFiles = [
    'release-meta.js',
    'background-runtime.bundle.js',
    'background-vendor.bundle.js',
    'background.bundle.js',
  ];
  let backgroundScriptFiles = backgroundBootFiles;
  for (const file of backgroundBootFiles) {
    assertFile(outputRoot, file, 'background entrypoint');
  }
  if (isFirefox) {
    if (manifest.background?.page !== 'background.html') {
      throw new Error('Firefox background must use the background page.');
    }
    const backgroundHtml = fs.readFileSync(
      path.join(outputRoot, manifest.background.page),
      'utf8',
    );
    backgroundScriptFiles = [
      ...backgroundHtml.matchAll(/<script[^>]+src=["']([^"']+)["']/g),
    ].map((match) => match[1].replace(/^\//, '').split(/[?#]/)[0]);
    const backgroundFiles = backgroundScriptFiles.filter((file) =>
      backgroundBootFiles.includes(file),
    );
    if (
      JSON.stringify(backgroundFiles) !== JSON.stringify(backgroundBootFiles)
    ) {
      throw new Error(
        'Firefox background load order does not match its chunks.',
      );
    }
  } else {
    if (manifest.background?.service_worker !== 'background.bootstrap.js') {
      throw new Error('Production background must use the split bootstrap.');
    }
    assertFile(outputRoot, 'background.bootstrap.js', 'background bootstrap');
    const bootstrapSource = fs.readFileSync(
      path.join(outputRoot, 'background.bootstrap.js'),
      'utf8',
    );
    const bootstrapFiles = [
      ...bootstrapSource.matchAll(/["']([^"']+\.js)["']/g),
    ].map((match) => match[1]);
    if (
      !bootstrapSource.startsWith('importScripts(') ||
      JSON.stringify(bootstrapFiles) !== JSON.stringify(backgroundBootFiles)
    ) {
      throw new Error(
        'Background bootstrap load order does not match its chunks.',
      );
    }
  }
  const expectedContentFiles = [
    'release-meta.js',
    'content-script-runtime.bundle.js',
    'content-script-vendor.bundle.js',
    'content-script.bundle.js',
  ];
  if (
    JSON.stringify(manifest.content_scripts?.[0]?.js) !==
    JSON.stringify(expectedContentFiles)
  ) {
    throw new Error('Content script load order does not match its chunks.');
  }
  for (const compilerName of ['background', 'content-script']) {
    const runtimePath = path.join(
      outputRoot,
      `${compilerName}-runtime.bundle.js`,
    );
    const entryPath = path.join(outputRoot, `${compilerName}.bundle.js`);
    const chunkQueue = `rspackChunkonekey_ext_${compilerName.replace('-', '_')}`;
    if (
      !fs.readFileSync(runtimePath, 'utf8').includes(chunkQueue) ||
      !fs.readFileSync(entryPath, 'utf8').includes(chunkQueue)
    ) {
      throw new Error(`${compilerName} runtime cannot register split chunks.`);
    }
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
  const backgroundBytes =
    (isFirefox
      ? 0
      : fs.statSync(path.join(outputRoot, 'background.bootstrap.js')).size) +
    [...new Set(backgroundScriptFiles)].reduce(
      (total, file) => total + fs.statSync(path.join(outputRoot, file)).size,
      0,
    );
  const budgets = {
    // The expected hardware onboarding assets raised Linux CI output to
    // 166931278 bytes (run 35951858232). Keep about 3.6% headroom for growth.
    // Trust the CI number when the margin is thin; macOS builds differ.
    totalBytes: readBudget('EXT_BUILD_MAX_TOTAL_BYTES', 173000000),
    // Keep enough headroom for expected route and chunk growth while the total
    // output size budget continues to guard against broader regressions.
    jsFiles: readBudget('EXT_BUILD_MAX_JS_FILES', 1000),
    // Translation growth raised Linux CI output to 40933513 bytes (run
    // 38020508845), above 39 MiB. Restore about 2.5% headroom for
    // incremental growth.
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
      `Background entrypoint exceeds size budget: ${backgroundBytes} > ${budgets.backgroundBytes}`,
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
