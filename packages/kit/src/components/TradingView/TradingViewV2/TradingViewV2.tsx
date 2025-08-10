import { useCallback, useMemo, useRef } from 'react';

import { useCalendars } from 'expo-localization';

import { Stack, useOrientation } from '@onekeyhq/components';
import type { IStackStyle } from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { TRADING_VIEW_URL } from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useLocaleVariant } from '../../../hooks/useLocaleVariant';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import WebView from '../../WebView';
import { getTradingViewTimezone } from '../utils/tradingViewTimezone';

import {
  fetchTradingViewV2DataWithSlicing,
  useAutoKLineUpdate,
  useAutoTokenDetailUpdate,
} from './hooks';

import type { ICustomReceiveHandlerData } from './types';
import type { IWebViewRef } from '../../WebView/types';
import type { WebViewProps } from 'react-native-webview';

interface IBaseTradingViewV2Props {
  mode: 'overview' | 'realtime';
  identifier: string;
  symbol: string;
  targetToken: string;
  onLoadEnd: () => void;
  tradingViewUrl?: string;
  tokenAddress?: string;
  networkId?: string;
  interval?: string;
  timeFrom?: number;
  timeTo?: number;
  decimal: number;
}

export type ITradingViewV2Props = IBaseTradingViewV2Props & IStackStyle;

export function TradingViewV2(props: ITradingViewV2Props & WebViewProps) {
  const isLandscape = useOrientation();
  const isIPadPortrait = platformEnv.isNativeIOSPad && !isLandscape;
  const webRef = useRef<IWebViewRef | null>(null);
  const calendars = useCalendars();
  const systemLocale = useLocaleVariant();
  const theme = useThemeVariant();
  const [devSettings] = useDevSettingsPersistAtom();

  const {
    mode,
    onLoadEnd,
    tradingViewUrl,
    tokenAddress = '',
    networkId = '',
    symbol,
    decimal,
  } = props;

  // Determine the URL to use based on dev settings
  const finalTradingViewUrl = useMemo(() => {
    if (tradingViewUrl) {
      return tradingViewUrl;
    }

    return devSettings.enabled && devSettings.settings?.useLocalTradingViewUrl
      ? 'http://localhost:5173/'
      : TRADING_VIEW_URL;
  }, [
    tradingViewUrl,
    devSettings.enabled,
    devSettings.settings?.useLocalTradingViewUrl,
  ]);

  const tradingViewUrlWithParams = useMemo(() => {
    const timezone = getTradingViewTimezone(calendars);
    const locale = systemLocale;

    const url = new URL(finalTradingViewUrl);
    url.searchParams.set('timezone', timezone);
    url.searchParams.set('locale', locale);
    url.searchParams.set('platform', platformEnv.appPlatform ?? 'web');
    url.searchParams.set('theme', theme);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('decimal', decimal?.toString());
    return url.toString();
  }, [finalTradingViewUrl, calendars, systemLocale, theme, symbol, decimal]);

  const customReceiveHandler = useCallback(
    async ({ data }: ICustomReceiveHandlerData) => {
      // Debug: Log all incoming messages
      console.log('🔍 TradingView message received:', {
        scope: data.scope,
        method: data.method,
        origin: data.origin,
        dataKeys: data.data ? Object.keys(data.data) : 'no data',
      });

      // {
      //     "scope": "$private",
      //     "method": "tradingview_getKLineData",
      //     "origin": "tradingview.onekey.so",
      //     "data": {
      //         "method": "tradingview_getHistoryData",
      //         "resolution": "1D",
      //         "from": 1724803200,
      //         "to": 1750809600,
      //         "firstDataRequest": true
      //     }
      // }

      // Handle TradingView private API requests
      if (
        data.scope === '$private' &&
        data.method === 'tradingview_getKLineData'
      ) {
        // Safely extract history data with proper type checking
        const messageData = data.data;
        if (
          messageData &&
          typeof messageData === 'object' &&
          'method' in messageData &&
          'resolution' in messageData &&
          'from' in messageData &&
          'to' in messageData
        ) {
          // Extract properties safely with explicit checks
          const safeData = messageData as unknown as Record<string, unknown>;
          const method = safeData.method as string;
          const resolution = safeData.resolution as string;
          const from = safeData.from as number;
          const to = safeData.to as number;
          const firstDataRequest = safeData.firstDataRequest as boolean;

          console.log('TradingView request received:', {
            method,
            resolution,
            from,
            to,
            firstDataRequest,
            origin: data.origin,
          });

          // Use combined function to get sliced data
          try {
            const kLineData = await fetchTradingViewV2DataWithSlicing({
              tokenAddress,
              networkId,
              interval: resolution,
              timeFrom: from,
              timeTo: to,
            });

            if (webRef.current && kLineData) {
              webRef.current.sendMessageViaInjectedScript({
                type: 'kLineData',
                payload: {
                  type: 'history',
                  kLineData,
                  requestData: messageData,
                },
              });
            }
          } catch (error) {
            console.error('Failed to fetch and send kline data:', error);
          }
        }
      }

      // Handle TradingView layout update messages
      if (
        data.scope === '$private' &&
        data.method === 'tradingview_layoutUpdate'
      ) {
        console.log('✅ Layout update method matched!');
        // Safely extract layout data with proper type checking
        const messageData = data.data;
        if (
          messageData &&
          typeof messageData === 'object' &&
          'layout' in messageData
        ) {
          // Extract layout property safely
          const safeData = messageData as unknown as Record<string, unknown>;
          const layoutString = safeData.layout as string;

          console.log('📡 TradingView layout update received:', data);

          try {
            const parsedLayoutData = JSON.parse(layoutString);
            console.log('🎨 Layout data parsed successfully:', {
              keys: Object.keys(parsedLayoutData),
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error('❌ Failed to parse layout data:', error);
          }
        }
      }
    },
    [tokenAddress, networkId],
  );

  useAutoKLineUpdate({
    tokenAddress,
    networkId,
    webRef,
    enabled: mode === 'realtime',
  });

  useAutoTokenDetailUpdate({
    tokenAddress,
    networkId,
    webRef,
    enabled: mode === 'realtime',
  });

  return (
    <Stack position="relative" flex={1}>
      <WebView
        customReceiveHandler={async (data) => {
          await customReceiveHandler(data as ICustomReceiveHandlerData);
        }}
        onLoadEnd={onLoadEnd}
        onWebViewRef={(ref) => {
          webRef.current = ref;
        }}
        displayProgressBar={false}
        pullToRefreshEnabled={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        decelerationRate="normal"
        src={tradingViewUrlWithParams}
      />

      {platformEnv.isNativeIOS || isIPadPortrait ? (
        <Stack
          position="absolute"
          left={0}
          top={0}
          bottom={0}
          width={12}
          zIndex={1}
          pointerEvents="auto"
        />
      ) : null}
    </Stack>
  );
}
