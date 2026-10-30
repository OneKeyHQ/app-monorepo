// cspell:ignore lproj apos
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../../..');
const appDirectory = path.join(root, 'packages/shared/src/locale/json');
const iosDirectory = path.join(root, 'apps/mobile/ios/OneKeyMarketWidget');
const androidDirectory = path.join(root, 'apps/mobile/android/app/src/main');
const read = (file) => fs.readFileSync(file, 'utf8');
const locales = [
  ['bn', 'bn', 'values-bn'],
  ['de', 'de', 'values-de'],
  ['en_US', 'en', 'values'],
  ['es', 'es', 'values-es'],
  ['fr_FR', 'fr-FR', 'values-fr'],
  ['hi_IN', 'hi', 'values-hi'],
  ['id', 'id', 'values-in'],
  ['it_IT', 'it-IT', 'values-it'],
  ['ja_JP', 'ja-JP', 'values-ja'],
  ['ko_KR', 'ko', 'values-ko'],
  ['pt', 'pt', 'values-pt'],
  ['pt_BR', 'pt-BR', 'values-pt-rBR'],
  ['ru', 'ru', 'values-ru'],
  ['th_TH', 'th', 'values-th'],
  ['uk_UA', 'uk-UA', 'values-uk'],
  ['vi', 'vi', 'values-vi'],
  ['zh_CN', 'zh-Hans', 'values-zh-rCN'],
  ['zh_HK', 'zh-HK', 'values-zh-rHK'],
  ['zh_TW', 'zh-Hant', 'values-zh-rTW'],
];
const sharedKeys = [
  ['market_widget_single__title', 'market_widget_single_title', true],
  ['market_widget_list__title', 'market_widget_watchlist_title', true],
  ['market_widget_source__title', 'market_widget_source', true],
  ['market_widget_coin__title', 'market_widget_coin', true],
  ['market_widget_watchlist__title', 'market_widget_source_watchlist', true],
  ['market_widget_hot_coins__title', 'market_widget_source_hot', true],
  ['market_widget_search__title', 'market_widget_search', false],
  ['market_widget_coin_removed__msg', 'market_widget_empty', false],
  ['wallet.price_unavailable', 'market_widget_unavailable', true],
  ['global.unknown_error_retry_message', 'market_widget_save_failed', false],
  ['global.confirm', 'market_widget_done', false],
  ['tray_loading_title', 'market_widget_loading', false],
  ['global.no_results', 'market_widget_no_coins', false],
  ['global.back', 'market_widget_back', false],
];

function iosStrings(folder) {
  const file = path.join(iosDirectory, `${folder}.lproj/Localizable.strings`);
  return Object.fromEntries(
    [
      ...read(file).matchAll(
        /^"((?:\\.|[^"\\])*)"\s*=\s*"((?:\\.|[^"\\])*)";/gm,
      ),
    ].map(([, key, value]) => [
      JSON.parse(`"${key}"`),
      JSON.parse(`"${value}"`),
    ]),
  );
}

function androidStrings(folder) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  const escapes = { '\\': '\\', "'": "'", '"': '"', n: '\n', t: '\t' };
  return Object.fromEntries(
    [
      ...read(
        path.join(androidDirectory, 'res', folder, 'market_widget.xml'),
      ).matchAll(/<string name="([^"]+)"[^>]*>(.*?)<\/string>/gs),
    ].map(([, key, value]) => [
      key,
      value
        .replace(/&(amp|lt|gt|quot|apos);/g, (_, entity) => entities[entity])
        .replace(/\\([\\'"nt])/g, (_, escaped) => escapes[escaped]),
    ]),
  );
}

const fileContents = (directory, filter) =>
  fs
    .readdirSync(directory)
    .filter(filter)
    .map((file) => read(path.join(directory, file)))
    .join('\n');
const iosSource = fileContents(iosDirectory, (file) => file.endsWith('.swift'));
const androidSource = [
  fileContents(
    path.join(androidDirectory, 'java/so/onekey/app/wallet/marketwidget'),
    (file) => file.endsWith('.java'),
  ),
  ...['layout', 'xml'].map((folder) =>
    fileContents(
      path.join(androidDirectory, 'res', folder),
      (file) => file.startsWith('market_widget') && file.endsWith('.xml'),
    ),
  ),
  read(path.join(androidDirectory, 'AndroidManifest.xml')),
].join('\n');
const activeIOS = [
  ...new Set(
    [
      ...iosSource.matchAll(
        /"(market_widget_[a-z0-9_]+|wallet\.price_unavailable)"/g,
      ),
    ].map((match) => match[1]),
  ),
];
const activeAndroid = [
  ...new Set(
    [
      ...androidSource.matchAll(
        /(?:R\.string\.|@string\/)(market_widget_[a-z0-9_]+)/g,
      ),
    ].map((match) => match[1]),
  ),
];
const formatTokens = (value) => (value.match(/%\d+\$[@s]/g) || []).sort();

describe('Market widget translations bundled with the app', () => {
  it('covers every App locale on both native platforms', () => {
    expect(locales.map(([locale]) => locale).toSorted()).toEqual(
      fs
        .readdirSync(appDirectory)
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.slice(0, -5))
        .toSorted(),
    );
    expect(activeIOS.length).toBeGreaterThan(30);
    expect(activeAndroid.length).toBeGreaterThan(25);
  });

  it.each(locales)(
    '%s has native strings for every active reference',
    (_, ios, android) => {
      for (const [values, baseline, active] of [
        [iosStrings(ios), iosStrings('en'), activeIOS],
        [androidStrings(android), androidStrings('values'), activeAndroid],
      ]) {
        for (const key of active) {
          expect({ key, value: values[key] }).toEqual({
            key,
            value: expect.stringMatching(/\S/),
          });
          expect(formatTokens(values[key])).toEqual(
            formatTokens(baseline[key]),
          );
          expect(values[key]).not.toMatch(/\{[a-z]+\}/);
          expect(values[key].replace(/%\d+\$[@s]|%%/g, '')).not.toContain('%');
        }
      }
    },
  );

  it.each(locales)(
    '%s keeps shared and reused copy identical to the App',
    (locale, ios, android) => {
      const app = JSON.parse(read(path.join(appDirectory, `${locale}.json`)));
      const iosCopy = iosStrings(ios);
      const androidCopy = androidStrings(android);
      for (const [key, androidKey, usedInIOS] of sharedKeys) {
        expect(app[key]).toEqual(expect.stringMatching(/\S/));
        expect(androidCopy[androidKey]).toBe(app[key]);
        if (usedInIOS) expect(iosCopy[key]).toBe(app[key]);
      }
    },
  );

  it('keeps complete Android quote templates and timestamp arguments', () => {
    for (const [, , android] of locales) {
      const values = androidStrings(android);
      for (const key of [
        'market_widget_quote_updated_at',
        'market_widget_quote_cached_at',
      ]) {
        expect(formatTokens(values[key])).toEqual([
          '%1$s',
          '%2$s',
          '%3$s',
          '%4$s',
        ]);
      }
      expect(formatTokens(values.market_widget_cached_at)).toEqual(['%1$s']);
    }
  });

  it('separates Watchlist meanings and bundles independent Traditional Chinese copy', () => {
    const simplified = iosStrings('zh-Hans');
    expect(simplified.market_widget_watchlist__title).toBe('自选');
    expect(simplified.market_widget_lock_watchlist__title).toBe('关注列表');
    for (const [, ios, android] of locales.filter(([locale]) =>
      ['zh_HK', 'zh_TW'].includes(locale),
    )) {
      expect(iosStrings(ios).market_widget_watchlist__title).toBe('自選');
      expect(androidStrings(android).market_widget_source_watchlist).toBe(
        '自選',
      );
      expect(iosStrings(ios).market_widget_lock_setup__desc).not.toBe(
        simplified.market_widget_lock_setup__desc,
      );
    }
  });
});
