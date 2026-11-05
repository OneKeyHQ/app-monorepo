const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  countResourceEntries,
  isStaticResourceResponse,
  normalizeStaticResourceUrl,
} = require('./webColdResources');

const localOrigin = 'http://127.0.0.1:3000';
let buildDir;

beforeEach(() => {
  buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-cold-resources-'));
});
afterEach(() => {
  fs.rmSync(buildDir, { recursive: true, force: true });
});

function classify(overrides) {
  return isStaticResourceResponse({
    url: `${localOrigin}/api/data`,
    method: 'GET',
    resourceType: 'fetch',
    contentType: 'application/json',
    localOrigin,
    buildDir,
    ...overrides,
  });
}

test.each([
  ['stylesheet', 'text/css'],
  ['script', 'application/javascript'],
  ['image', 'image/svg+xml'],
  ['font', 'font/woff2'],
  ['media', 'video/mp4'],
  ['texttrack', 'text/vtt'],
  ['manifest', 'application/manifest+json'],
  ['fetch', 'application/wasm'],
  ['fetch', 'image/png'],
])('recognizes static %s responses (%s)', (resourceType, contentType) => {
  expect(classify({ resourceType, contentType })).toBe(true);
});

test.each(['locale.json', 'module.wasm', 'config'])(
  'recognizes fetched build files without treating JSON APIs as static (%s)',
  (file) => {
    fs.writeFileSync(path.join(buildDir, file), 'fixture');
    expect(classify({ url: `${localOrigin}/${file}?v=1` })).toBe(true);
    expect(classify({ url: `${localOrigin}/api/data.json` })).toBe(false);
    expect(classify({ url: 'https://api.example.com/data.json' })).toBe(false);
  },
);

test('keeps POST API responses and paths outside the build directory dynamic', () => {
  expect(classify({ method: 'POST', contentType: 'image/svg+xml' })).toBe(
    false,
  );
  expect(classify({ url: `${localOrigin}/..%2f../package.json` })).toBe(false);
});

test('deduplicates every static resource URL while counting identical API calls separately', () => {
  const responses = [
    { url: `${localOrigin}/icon.svg`, resourceType: 'image' },
    { url: `${localOrigin}/chunk.js`, resourceType: 'script' },
    { url: `${localOrigin}/style.css`, resourceType: 'stylesheet' },
    { url: `${localOrigin}/font.woff2`, resourceType: 'font' },
    { url: `${localOrigin}/photo.png`, resourceType: 'image' },
    { url: `${localOrigin}/clip.mp4`, resourceType: 'media' },
    { url: `${localOrigin}/module.wasm`, contentType: 'application/wasm' },
    { url: 'https://api.example.com/info', method: 'POST' },
    { url: 'https://api.example.com/list' },
  ];
  const staticUrls = new Set(
    responses
      .filter(classify)
      .map(({ url }) => normalizeStaticResourceUrl(url)),
  );
  const entries = responses.flatMap(({ url, resourceType }) =>
    Array.from({ length: 3 }, () => ({
      name: url,
      initiatorType: resourceType === 'script' ? 'script' : 'fetch',
    })),
  );

  expect(countResourceEntries(entries, staticUrls)).toEqual({
    resourceCount: 7 + 6,
    scriptCount: 1,
  });
  expect(entries).toHaveLength(27);
});

test('preserves version query parameters and origins, and collapses only URL fragments', () => {
  const urls = [
    `${localOrigin}/icon.svg?v=1#first`,
    `${localOrigin}/icon.svg?v=1#second`,
    `${localOrigin}/icon.svg?v=2`,
    'https://cdn.example.com/icon.svg?v=1',
  ];
  const staticUrls = new Set(urls.map(normalizeStaticResourceUrl));

  expect(
    countResourceEntries(
      urls.map((name) => ({ name, initiatorType: 'img' })),
      staticUrls,
    ),
  ).toEqual({ resourceCount: 3, scriptCount: 0 });
});

test('counts an extensionless script once when preload and script entries share a URL', () => {
  const name = `${localOrigin}/script`;
  expect(
    countResourceEntries(
      [
        { name, initiatorType: 'link' },
        { name, initiatorType: 'script' },
      ],
      new Set([name]),
    ),
  ).toEqual({ resourceCount: 1, scriptCount: 1 });
});
