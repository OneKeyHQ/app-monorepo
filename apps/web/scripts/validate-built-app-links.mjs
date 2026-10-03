#!/usr/bin/env node
// cspell:words AASA DAL aasa applinks appclips

import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const buildDirectory = resolve(
  process.argv[2] || fileURLToPath(new URL('../web-build', import.meta.url)),
);
const publicAssociationFiles = new Set([
  '.well-known/apple-app-site-association',
  '.well-known/assetlinks.json',
]);

// Hidden files are excluded by upload-artifact unless explicitly enabled.
// Fail before that upload if the build contains anything except public AASA/DAL.
async function validateHiddenFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = join(directory, entry.name);
    const outputPath = relative(buildDirectory, filePath).replaceAll('\\', '/');
    if (
      (entry.name.startsWith('.') || outputPath.startsWith('.well-known/')) &&
      outputPath !== '.well-known' &&
      !publicAssociationFiles.has(outputPath)
    ) {
      assert.fail(`Unexpected hidden artifact path: ${outputPath}`);
    }
    assert(
      !entry.isSymbolicLink(),
      `Artifact must not contain symlinks: ${outputPath}`,
    );
    if (entry.isDirectory()) await validateHiddenFiles(filePath);
  }
}

await validateHiddenFiles(buildDirectory);
const aasa = JSON.parse(
  await readFile(
    join(buildDirectory, '.well-known/apple-app-site-association'),
    'utf8',
  ),
);
assert(Array.isArray(aasa.appclips?.apps));
assert(aasa.appclips.apps.includes('BVJ3FU5H2K.so.onekey.wallet.Clip'));
const parentApp = aasa.applinks?.details?.find((detail) =>
  detail.appIDs?.includes('BVJ3FU5H2K.so.onekey.wallet'),
);
const paths = new Set(
  parentApp?.components?.map((component) => component['/']),
);
for (const path of [
  '/account/*',
  '/wc/*',
  '/swap',
  '/swap/',
  '/perps',
  '/perps/',
  '/market',
  '/market/',
  '/clip/*',
  '/r/*',
]) {
  assert(paths.has(path), `Missing Universal Link path: ${path}`);
}
assert(
  Array.isArray(
    JSON.parse(
      await readFile(
        join(buildDirectory, '.well-known/assetlinks.json'),
        'utf8',
      ),
    ),
  ),
);

for (const fileName of ['index.html', '404.html']) {
  const html = await readFile(join(buildDirectory, fileName), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((script) =>
      script.includes('app-clip-bundle-id=so.onekey.wallet.Clip'),
    );
  assert.equal(
    scripts.length,
    1,
    `${fileName}: missing or duplicate App Clip head script`,
  );
  for (const [path, expected] of [
    ['/r/CODEX_TEST_ONLY', true],
    ['/r/CODEX_TEST_ONLY/app', true],
    [
      '/r/CODEX_TEST_ONLY/app/perps?utm_source=local_test&ref_code=CODEX_TEST_ONLY',
      true,
    ],
    ['/r/CODEX_TEST_ONLY/app/swap', true],
    ['/r/CODEX_TEST_ONLY/app/defi/', true],
    ['/r/invite?code=CODEX_TEST_ONLY', false],
    ['/r/CODEX_TEST_ONLY/app/perps/extra', false],
    ['/market', false],
  ]) {
    const location = new URL(path, 'https://app.onekey.so');
    const originalUrl = location.href;
    const metas = [];
    runInNewContext(
      scripts[0],
      {
        location,
        document: {
          createElement: () => ({}),
          head: { appendChild: (meta) => metas.push(meta) },
        },
      },
      { timeout: 1000 },
    );
    assert.equal(
      metas.length,
      expected ? 1 : 0,
      `${fileName}: incorrect banner for ${path}`,
    );
    assert.equal(
      location.href,
      originalUrl,
      `${fileName}: invite URL or query changed`,
    );
    if (expected) {
      assert.equal(metas[0].name, 'apple-itunes-app');
      assert(metas[0].content.includes('app-id=1609559473'));
      assert(metas[0].content.includes('app-clip-display=card'));
    }
  }
}

console.log(
  '[app-links] AASA, referral banner/query preservation and hidden artifact paths passed.',
);
