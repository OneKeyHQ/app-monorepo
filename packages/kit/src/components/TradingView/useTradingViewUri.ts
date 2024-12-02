import { useMemo } from 'react';

import { useCalendars } from 'expo-localization';

import { useThemeValue } from '@onekeyhq/components';
import type { ILocaleJSONSymbol } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useLocaleVariant } from '../../hooks/useLocaleVariant';
import { usePromiseResult } from '../../hooks/usePromiseResult';
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

export const useTradingViewUri = ({
  identifier,
  baseToken,
  targetToken,
}: {
  identifier: string;
  baseToken: string;
  targetToken: string;
}) => {
  const theme = useThemeVariant();
  const bgAppColor = useThemeValue('$bgApp', undefined, true);
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

  const { result } = usePromiseResult(
    async () => {
      const params: Record<string, string> = {
        'show_popup_button': 'false',
        'autosize': 'true',
        'symbol': `${identifier.toUpperCase()}:${baseToken.toUpperCase()}${targetToken.toUpperCase()}`,
        'interval': '60',
        'timezone': timezone,
        'theme': theme,
        'style': '1',
        'gridColor': 'rgba(255, 255, 255, 0)',
        'locale': locale,
        'hide_legend': 'true',
        'allow_symbol_change': 'false',
        'save_image': 'false',
        'withdateranges': 'false',
        'calendar': 'false',
        'hide_volume': 'true',
        'hide_side_toolbar': '1',
        'support_host': 'https://www.tradingview.com',
        'adaptive_logo': 'false',
        'isTransparent': 'true',
      };

      if (theme === 'dark') {
        params.backgroundColor = 'rgba(27, 27, 27, 1)';
      }
      const hash = `#${JSON.stringify(params)}`;
      const query = `?t=${Date.now()}&locale=${locale}`;
      const uri = `https://www.tradingview-widget.com/embed-widget/advanced-chart/${query}${hash}`;
      const res = await fetch(uri);
      const text = await res.text();
      const htmlCode = text.replace(
        '</title>',
        `</title>
          <style>
              :root {
                --tv-color-pane-background: ${bgAppColor} !important;
              }
          </style>`,
      );
      return {
        uri: platformEnv.isNative
          ? ''
          : `${URL.createObjectURL(
              new Blob([htmlCode], { type: 'text/html' }),
            )}${hash}`,
        hash,
        query,
        htmlCode: platformEnv.isNative ? htmlCode : '',
      };
    },
    [baseToken, bgAppColor, identifier, locale, targetToken, theme, timezone],
    {
      initResult: {
        uri: '',
        hash: '',
        query: '',
        htmlCode: '',
      },
    },
  );

  return result;
};
