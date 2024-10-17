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

export const useHtmlCode = (symbol: string) => {
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
  return useMemo(
    () => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body {
        height: 100vh;
        width: 100vw;
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <div class="tradingview-widget-container" style="height:100%;width:100%">
      <div class="tradingview-widget-container__widget" style="height:calc(100% - 32px);width:100%"></div>
      <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" async>
      {
      "fullscreen": true,
      "autosize": true,
      "symbol": "KRAKEN:${symbol.toUpperCase()}USD",
      "interval": "D",
      "timezone": "${timezone}",
      "theme": "${theme}",
      "style": "1",
      "locale": "${locale}",
      "hide_legend": true,
      "allow_symbol_change": false,
      "hideSymbolSearch": false,
      "save_image": false,
      "withdateranges": true,
      "widgetbar": {
          "details": false,
          "watchlist": false,
          "news": false,
          "datawindow": false,
          "watchlist_settings": {
              "default_symbols": []
          }
      },
      "calendar": false,
      "hide_side_toolbar": 0,
      "support_host": "https://www.tradingview.com",
      "isTransparent": true
    }
      </script>
    </div>
  </body>
</html>
`,
    [locale, symbol, theme, timezone],
  );
};
