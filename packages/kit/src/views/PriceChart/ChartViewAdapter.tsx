import React, { useEffect, useMemo, useRef } from 'react';

import WebView from 'react-native-webview';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  ChartViewAdapterProps,
  createChartDom,
  updateChartDom,
} from './chartService';

const ChartViewAdapter: React.FC<ChartViewAdapterProps> = ({
  data,
  onHover,
  lineColor,
  topColor,
  bottomColor,
  height,
}) => {
  const webviewRef = useRef<WebView>(null);
  const initJs = useMemo(
    () => `
  const createChart = window.LightweightCharts.createChart;
  const container = document.getElementById('chart');
  const postMessage = (hoverData) => 
    window.ReactNativeWebView.postMessage(JSON.stringify(hoverData));
  const { chart } = (${createChartDom.toString()})(
    createChart,
    container, 
    postMessage,
    ${JSON.stringify(height)},
  );
  (${updateChartDom.toString()})({
    bottomColor: ${JSON.stringify(bottomColor)},
    topColor: ${JSON.stringify(topColor)},
    lineColor: ${JSON.stringify(lineColor)},
    data: ${JSON.stringify(data)},
  });
`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    webviewRef.current?.injectJavaScript(
      `(${updateChartDom.toString()})({
          bottomColor: ${JSON.stringify(bottomColor)},
          topColor: ${JSON.stringify(topColor)},
          lineColor: ${JSON.stringify(lineColor)},
          data: ${JSON.stringify(data)},
        });`,
    );
  }, [bottomColor, data, lineColor, topColor]);

  return (
    <WebView
      ref={webviewRef}
      style={{
        backgroundColor: 'transparent',
      }}
      source={{
        uri: platformEnv.isNativeIOS
          ? 'tradingview.html'
          : 'file:///android_asset/tradingview.html',
      }}
      allowFileAccessFromFileURLs
      allowFileAccess
      allowUniversalAccessFromFileURLs
      originWhitelist={['*']}
      injectedJavaScript={initJs}
      scrollEnabled={false}
      onMessage={(event) => {
        onHover(JSON.parse(event.nativeEvent.data));
      }}
    />
  );
};
ChartViewAdapter.displayName = 'ChartViewAdapter';
export default ChartViewAdapter;
