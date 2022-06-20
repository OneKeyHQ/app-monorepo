import React, { useEffect, useRef } from 'react';

import WebView from 'react-native-webview';

import { createChartDom, updateChartDom } from './sharedChartUtils';

type ChartViewAdapterProps = {
  data: any[];
  onHover(price?: number): void;
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
    const chartNode = document.getElementById('chart');
    const {chart} = ${createChartDom.toString()}(chartNode, ReactNativeWebView.postMessage);
    ${updateChartDom.toString()}({
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
      style={{ flex: 1 }}
      source={{ uri: 'file:///android_asset/index.html' }}
      allowFileAccessFromFileURLs
      domStorageEnabled
      allowFileAccess
      allowUniversalAccessFromFileURLs
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={() => false}
      injectedJavaScript={jsToInject}
      onMessage={(event) => {
        onHover(event.nativeEvent.data as any as number);
      }}
    />
  );
};
ChartViewAdapter.displayName = 'ChartViewAdapter';
export default ChartViewAdapter;
