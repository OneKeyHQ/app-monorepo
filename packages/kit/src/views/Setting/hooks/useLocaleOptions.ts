import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { LOCALES_OPTION } from '@onekeyhq/shared/src/locale/localeOptions';
import {
  LOCALE_DISPLAY_NAME_MESSAGE_IDS,
  buildLocaleSelectOption,
  getLocaleEnglishName,
  normalizeSelectableLocale,
} from '@onekeyhq/shared/src/locale/localeSearch';
import { isKnownTranslationKey } from '@onekeyhq/shared/src/locale/translationKeys';

const SKIPPED_LANGUAGE_SEARCH_VALUES = new Set(['system', 'en-US']);

function getTranslatedLocaleName(
  translate: (descriptor: {
    id: ETranslations;
    defaultMessage: string;
  }) => string,
  localeValue: string,
) {
  const messageId =
    LOCALE_DISPLAY_NAME_MESSAGE_IDS[
      localeValue as keyof typeof LOCALE_DISPLAY_NAME_MESSAGE_IDS
    ];
  if (!messageId || !isKnownTranslationKey(messageId)) {
    return undefined;
  }
  return translate({
    id: messageId,
    defaultMessage: getLocaleEnglishName(localeValue),
  });
}

export function useLocaleOptions() {
  const intl = useIntl();
  const localeOptions = useMemo(() => {
    const currentLocale = normalizeSelectableLocale(intl.locale);
    const translate = (descriptor: {
      id: ETranslations;
      defaultMessage: string;
    }) => intl.formatMessage(descriptor);
    return [
      {
        label: intl.formatMessage({
          id: ETranslations.global_auto,
        }),
        value: 'system',
      },
      ...LOCALES_OPTION.map((option) =>
        buildLocaleSelectOption({
          value: option.value,
          label: option.label,
          currentLocale,
          translatedName: getTranslatedLocaleName(translate, option.value),
        }),
      ),
    ];
  }, [intl]);
  return localeOptions;
}

export function useLanguageSearchKeywords() {
  const localeOptions = useLocaleOptions();
  return useMemo(() => {
    const keywords = new Set<string>();
    for (const option of localeOptions) {
      if (!SKIPPED_LANGUAGE_SEARCH_VALUES.has(option.value)) {
        keywords.add(option.label);
        for (const keyword of option.searchKeywords ?? []) {
          // Locale codes (`id`, `pt`) belong to the picker, not Settings
          // search, where a two-letter query should not surface Language.
          if (keyword !== option.value) {
            keywords.add(keyword);
          }
        }
      }
    }
    return [...keywords];
  }, [localeOptions]);
}
