import React from 'react';

import WebView from 'react-native-webview';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { createChartDom, updateChartDom } from './sharedChartUtils';

type ChartViewAdapterProps = {
  data: any[];
  onHover(price?: string): void;
  lineColor: string;
  topColor: string;
  bottomColor: string;
};

const ChartViewAdapter: React.FC<ChartViewAdapterProps> = ({
  data,
  onHover,
  lineColor,
  topColor,
  bottomColor,
}) => {
  const jsToInject = `
    const createChart = window.LightweightCharts.createChart;
    const container = document.getElementById('chart');
    const postMessage = (price) => window.ReactNativeWebView.postMessage(price);
    const { chart } = (${createChartDom.toString()})(
      createChart,
      container, 
      postMessage,
    );
    (${updateChartDom.toString()})({
      chart,
      bottomColor: ${JSON.stringify(bottomColor)},
      topColor: ${JSON.stringify(topColor)},
      lineColor: ${JSON.stringify(lineColor)},
      data: ${JSON.stringify(data)},
    });
  `;

  // TODO refresh data

  return (
    <WebView
      style={{
        flex: 1,
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
      injectedJavaScript={jsToInject}
      scrollEnabled={false}
      onMessage={(event) => {
        onHover(event.nativeEvent.data);
      }}
    />
  );
};
ChartViewAdapter.displayName = 'ChartViewAdapter';
export default ChartViewAdapter;
