import { useMemo } from 'react';

import { useCalendars } from 'expo-localization';

import { useMedia, useThemeValue } from '@onekeyhq/components';
import type { ILocaleJSONSymbol } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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

export const useTradingViewProps = ({
  identifier,
  baseToken,
  targetToken,
}: {
  identifier: string;
  baseToken: string;
  targetToken: string;
}) => {
  const { md } = useMedia();
  const theme = useThemeVariant();
  const [
    bgAppColor,
    bgSubduedColor,
    textColor,
    textDisabled,
    iconColor,
    bgBackdropColor,
    bgHoverColor,
  ] = useThemeValue(
    [
      '$bgApp',
      '$bgSubdued',
      '$text',
      '$textDisabled',
      '$icon',
      '$bgBackdrop',
      '$bgHover',
    ],
    undefined,
    true,
  );
  const systemLocale = useLocaleVariant();
  const calendars = useCalendars();
  return useMemo(() => {
    const locale = localeMap[systemLocale as ILocaleJSONSymbol] || 'en';
    const timezone = calendars[0].timeZone || 'Etc/UTC';
    const params: Record<string, string> = {
      'show_popup_button': 'false',
      'autosize': 'true',
      'symbol': `${identifier.toUpperCase()}:${baseToken.toUpperCase()}${targetToken.toUpperCase()}`,
      'timezone': timezone,
      'theme': theme,
      'style': '1',
      'gridColor': 'rgba(255, 255, 255, 0)',
      'locale': locale,
      'interval': '15',
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
      'backgroundColor': bgAppColor,
    };

    const hash = `#${JSON.stringify(params)}`;
    const query = `?t=${Date.now()}&locale=${locale}`;
    const uri = `https://www.tradingview-widget.com/embed-widget/advanced-chart/${query}${hash}`;
    if (platformEnv.isWeb || platformEnv.isExtension) {
      return {
        uri,
      };
    }
    const style = `
            :root {
              --tv-color-toolbar-button-text-active: ${textColor} !important;
              --tv-color-toolbar-button-text-active-hover: ${textColor} !important;
              --tv-color-pane-background: ${bgAppColor} !important;
              --tv-color-platform-background: ${bgAppColor} !important;
              --tv-color-toolbar-button-text: ${textDisabled} !important;
              --tv-spinner-color: ${iconColor} !important;
              --tv-color-popup-background: ${bgSubduedColor} !important;
              --tv-color-popup-element-background-hover: ${bgHoverColor} !important;
            }
            html .chart-page .chart-container-border {
              background-color: ${bgAppColor} !important;
            }  
            body {
              border-width: 0px !important;
            }  
              ${
                md
                  ? `
              .layout__area--top>div {
                padding: 0 10px;
              }`
                  : ''
              }

            div:has(>#header-toolbar-compare) {
              display: none;
            } 
            div:has(>#header-toolbar-chart-styles) + div {
              display: none;
            }
            html.theme-dark .chart-page {
              background: ${bgAppColor} !important;
            }
            html [data-name="indicators-dialog"] {
              background: ${bgAppColor} !important;
            }
            html [id*="indicators_dialog_item"]:hover {
              background-color: ${bgHoverColor} !important;
            }
            html [id*="indicators_dialog_item"]:focus {
              background-color: ${bgHoverColor} !important;
            }
            #overlap-manager-root [class*="backdrop-"] {
              background-color: ${bgBackdropColor} !important;
            }
    `;
    return {
      uri,
      injectedJavaScript: ` const styleNode = document.createElement('style'); 
      styleNode.type = 'text/css'; 
      styleNode.textContent = \`${style}\`;
      document.documentElement.appendChild(styleNode);`,
    };
  }, [
    systemLocale,
    calendars,
    identifier,
    baseToken,
    targetToken,
    theme,
    bgAppColor,
    textColor,
    textDisabled,
    iconColor,
    bgSubduedColor,
    bgHoverColor,
    md,
    bgBackdropColor,
  ]);
};
