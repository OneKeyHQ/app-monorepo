import { useMemo } from 'react';

import { useCalendars } from 'expo-localization';

import type { ILocaleJSONSymbol } from '@onekeyhq/shared/src/locale';

import { useLocaleVariant } from '../../hooks/useLocaleVariant';
import { useThemeVariant } from '../../hooks/useThemeVariant';

// https://www.tradingview.com/charting-library-docs/latest/core_concepts/Localization/
const localeMap: Record<ILocaleJSONSymbol, string> = {
  bn: 'en',
  de: 'de',
  en: 'en',
  'en-US': 'en',
  es: 'es',
  'fr-FR': 'fr',
  'hi-IN': 'en',
  id: 'id',
  'it-IT': 'it',
  'ja-JP': 'ja',
  'ko-KR': 'ko',
  pt: 'pt',
  'pt-BR': 'pt',
  ru: 'ru',
  'th-TH': 'th',
  'uk-UA': 'ru',
  vi: 'vi',
  'zh-CN': 'zh_CN',
  'zh-HK': 'zh_HK',
  'zh-TW': 'zh_TW',
};

export const useTradingViewUri = (
  symbol: string,
  { hideSideToolbar = false }: { hideSideToolbar?: boolean },
) => {
  const theme = useThemeVariant();
  const systemLocale = useLocaleVariant();
  const locale = useMemo(
    () => localeMap[systemLocale as ILocaleJSONSymbol] || 'en',
    [systemLocale],
  );
  const calendars = useCalendars();

  const timezone = useMemo(
    () => calendars[0].timeZone || 'Etc/UTC',
    [calendars],
  );

  const uri = useMemo(() => {
    const params = {
      'show_popup_button': 'false',
      'autosize': 'true',
      'symbol': `KRAKEN:${symbol.toUpperCase()}USD`,
      'interval': 'D',
      'timezone': timezone,
      'theme': theme,
      'style': '1',
      'locale': locale,
      'hide_legend': 'true',
      'allow_symbol_change': 'false',
      'save_image': 'false',
      'withdateranges': 'true',
      'calendar': 'false',
      'hide_side_toolbar': hideSideToolbar ? '1' : '0',
      'support_host': 'https://www.tradingview.com',
      'isTransparent': 'true',
    };
    return `https://www.tradingview-widget.com/embed-widget/advanced-chart/?t=${Date.now()}&locale=${locale}#${JSON.stringify(
      params,
    )}`;
  }, [hideSideToolbar, locale, symbol, theme, timezone]);
  return uri;
};
