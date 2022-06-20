import React from 'react';

import WebView from 'react-native-webview';

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
    const {chart} = (${createChartDom.toString()})(
      createChart,
      container, 
      window.ReactNativeWebView.postMessage
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
      }}
      source={{ uri: 'file:///android_asset/tradingview.html' }}
      allowFileAccessFromFileURLs
      allowFileAccess
      allowUniversalAccessFromFileURLs
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={() => false}
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
