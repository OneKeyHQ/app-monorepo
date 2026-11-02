/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';

import {
  useLanguageSearchKeywords,
  useLocaleOptions,
} from './useLocaleOptions';

const messages: Record<string, string> = {
  'global.auto': 'Auto',
  'global.language_name_ja_jp': '日语',
  'global.language_name_zh_cn': '简体中文',
};

jest.mock('react-intl', () => ({
  useIntl: () => ({
    locale: 'zh-CN',
    formatMessage: ({
      id,
      defaultMessage,
    }: {
      id: string;
      defaultMessage?: string;
    }) => messages[id] ?? defaultMessage ?? id,
  }),
}));

jest.mock('@onekeyhq/shared/src/locale/translationKeys', () => ({
  isKnownTranslationKey: (key: string) =>
    key === 'global.language_name_ja_jp' ||
    key === 'global.language_name_zh_cn',
}));

describe('useLocaleOptions', () => {
  it('keeps Auto first and searches by native name, English name, and code', () => {
    const { result } = renderHook(() => useLocaleOptions());
    const [autoOption, ...locales] = result.current;

    expect(autoOption).toEqual({ label: 'Auto', value: 'system' });
    expect(locales.some((option) => option.value === 'system')).toBe(false);

    const japanese = result.current.find((option) => option.value === 'ja-JP');
    expect(japanese?.label).toBe('日本語');
    expect(japanese?.description).toBe('日语');
    expect(japanese?.searchKeywords).toEqual(
      expect.arrayContaining(['Japanese', 'ja-JP', '日语']),
    );
  });

  it('omits the subtitle for the current app language and for keys that are not generated yet', () => {
    const { result } = renderHook(() => useLocaleOptions());
    const simplifiedChinese = result.current.find(
      (option) => option.value === 'zh-CN',
    );
    const german = result.current.find((option) => option.value === 'de');

    expect(simplifiedChinese?.description).toBeUndefined();
    expect(simplifiedChinese?.searchKeywords).toEqual(
      expect.arrayContaining(['简体中文']),
    );
    expect(german?.description).toBeUndefined();
    expect(german?.searchKeywords).toEqual(
      expect.arrayContaining(['German', 'de']),
    );
  });

  it('indexes language names for Settings search and skips locale codes', () => {
    const { result } = renderHook(() => useLanguageSearchKeywords());

    expect(result.current).toEqual(
      expect.arrayContaining([
        '日本語',
        'Japanese',
        '日语',
        '简体中文',
        'Deutsch',
      ]),
    );
    expect(result.current).not.toContain('ja-JP');
    expect(result.current).not.toContain('en-US');
    expect(result.current).not.toContain('Auto');
  });
});
