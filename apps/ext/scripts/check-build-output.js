#!/usr/bin/env node

/* eslint-disable no-restricted-syntax, onekey/no-raw-error, unicorn/numeric-separators-style -- standalone build script */

const fs = require('fs');
const path = require('path');

const buildRoot = path.resolve(__dirname, '..', 'build');
const forbiddenRemoteCode = [
  'https://browser.sentry-cdn.com',
  'https://svelte-stripe-js.vercel.app',
  'https://maps.googleapis.com/maps/api/js',
  'https://js.stripe.com/v3/',
  '/js/telegram-login.js',
];

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
    totalBytes: readBudget('EXT_BUILD_MAX_TOTAL_BYTES', 160000000),
    jsFiles: readBudget('EXT_BUILD_MAX_JS_FILES', 700),
    backgroundBytes: readBudget(
      'EXT_BUILD_MAX_BACKGROUND_BYTES',
      38 * 1024 * 1024,
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
