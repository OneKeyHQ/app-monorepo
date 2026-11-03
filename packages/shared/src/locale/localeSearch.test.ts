import { LOCALE_KEYS } from './localeLoaders';
import {
  LOCALE_DISPLAY_NAME_MESSAGE_IDS,
  buildLocaleSelectOption,
  getLocaleEnglishName,
  matchesSearchQuery,
  normalizeSearchText,
  resolveLocaleDescription,
} from './localeSearch';
import { isKnownTranslationKey } from './translationKeys';

describe('normalizeSearchText', () => {
  it('folds case, accents, and surrounding whitespace', () => {
    expect(normalizeSearchText('  Português ')).toBe('portugues');
    expect(normalizeSearchText('JA')).toBe('ja');
    expect(normalizeSearchText(' ZH_cn ')).toBe('zh-cn');
  });

  it('treats a blank query as empty', () => {
    expect(normalizeSearchText('   ')).toBe('');
  });
});

describe('matchesSearchQuery', () => {
  const fields = ['日本語', 'Japanese', 'ja-JP'];

  it('matches the native name, the English name, and the locale code', () => {
    expect(matchesSearchQuery(fields, '日本')).toBe(true);
    expect(matchesSearchQuery(fields, 'japan')).toBe(true);
    expect(matchesSearchQuery(fields, 'JA-jp')).toBe(true);
  });

  it('matches a translated name and ignores accents in the query', () => {
    expect(
      matchesSearchQuery(
        ['Português(Brasil)', 'Portuguese (Brazil)'],
        'portugues',
      ),
    ).toBe(true);
    expect(matchesSearchQuery(['日本語', '日语'], '日语')).toBe(true);
  });

  it('returns false when nothing matches', () => {
    expect(matchesSearchQuery(fields, 'zzz')).toBe(false);
    expect(matchesSearchQuery([undefined, ''], 'ja')).toBe(false);
  });

  it('matches everything when the query is empty', () => {
    expect(matchesSearchQuery(fields, '  ')).toBe(true);
  });
});

describe('getLocaleEnglishName', () => {
  it('uses English names, including region-specific labels', () => {
    expect(getLocaleEnglishName('en')).toBe('English');
    expect(getLocaleEnglishName('ja-JP')).toBe('Japanese');
    expect(getLocaleEnglishName('zh-CN')).toBe('Chinese (Simplified)');
    expect(getLocaleEnglishName('zh-HK')).toBe(
      'Chinese (Traditional, Hong Kong)',
    );
    expect(getLocaleEnglishName('zh-TW')).toBe('Chinese (Traditional, Taiwan)');
    expect(getLocaleEnglishName('pt-BR')).toBe('Portuguese (Brazil)');
  });

  it('falls back to the symbol when the code is unknown', () => {
    expect(getLocaleEnglishName('zz-ZZ')).toBe('zz-ZZ');
  });
});

describe('resolveLocaleDescription', () => {
  it('returns the translated name under the native name', () => {
    expect(
      resolveLocaleDescription({
        localeValue: 'ja-JP',
        currentLocale: 'zh-CN',
        nativeName: '日本語',
        translatedName: '日语',
      }),
    ).toBe('日语');
  });

  it('omits the subtitle for the current app language and for a repeated name', () => {
    expect(
      resolveLocaleDescription({
        localeValue: 'zh-CN',
        currentLocale: 'zh-CN',
        nativeName: '简体中文（新加坡）',
        translatedName: '简体中文',
      }),
    ).toBeUndefined();
    expect(
      resolveLocaleDescription({
        localeValue: 'en',
        currentLocale: 'ja-JP',
        nativeName: 'English',
        translatedName: 'English',
      }),
    ).toBeUndefined();
    expect(
      resolveLocaleDescription({
        localeValue: 'de',
        currentLocale: 'en',
        nativeName: 'Deutsch',
      }),
    ).toBeUndefined();
  });
});

describe('buildLocaleSelectOption', () => {
  it('adds the English name, locale code, and translated name as search keywords', () => {
    expect(
      buildLocaleSelectOption({
        value: 'ja-JP',
        label: '日本語',
        currentLocale: 'zh-CN',
        translatedName: '日语',
      }),
    ).toEqual({
      label: '日本語',
      value: 'ja-JP',
      description: '日语',
      searchKeywords: ['Japanese', 'ja-JP', '日语'],
    });
  });

  it('keeps a hidden subtitle in the search keywords', () => {
    const option = buildLocaleSelectOption({
      value: 'en',
      label: 'English',
      currentLocale: 'en',
      translatedName: '英语',
    });
    expect(option.description).toBeUndefined();
    expect(option.searchKeywords).toEqual(['English', 'en', 'en-US', '英语']);
  });
});

describe('LOCALE_DISPLAY_NAME_MESSAGE_IDS', () => {
  it('has a generated message id for every shipped locale', () => {
    for (const locale of LOCALE_KEYS) {
      expect(
        isKnownTranslationKey(LOCALE_DISPLAY_NAME_MESSAGE_IDS[locale]),
      ).toBe(true);
    }
  });
});
