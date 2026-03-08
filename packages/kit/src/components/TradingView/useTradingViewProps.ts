import { useMemo } from 'react';

import { useCalendars } from 'expo-localization';

import { useMedia, useTheme } from '@onekeyhq/components';
import type { ILocaleJSONSymbol } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useLocaleVariant } from '../../hooks/useLocaleVariant';
import { useThemeVariant } from '../../hooks/useThemeVariant';

import { tradingViewLocaleMap } from './utils/tradingViewLocaleMap';
import { getTradingViewTimezone } from './utils/tradingViewTimezone';

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
  const themeColors = useTheme();
  const bgAppColor = themeColors.bgApp.val;
  const bgSubduedColor = themeColors.bgSubdued.val;
  const textColor = themeColors.text.val;
  const textDisabled = themeColors.textDisabled.val;
  const iconColor = themeColors.icon.val;
  const bgBackdropColor = themeColors.bgBackdrop.val;
  const bgHoverColor = themeColors.bgHover.val;
  const systemLocale = useLocaleVariant();
  const calendars = useCalendars();
  return useMemo(() => {
    const locale =
      tradingViewLocaleMap[systemLocale as ILocaleJSONSymbol] || 'en-US';
    // https://onekey-bb.sentry.io/issues/45978027
    // Cannot read property 'timeZone' of undefined
    const timezone = getTradingViewTimezone(calendars);
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
      injectedJavaScript: `const styleNode = document.createElement('style'); 
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
