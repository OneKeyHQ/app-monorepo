import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, Stack } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IWebViewRef } from '../../../components/WebView/types';
import type { WebViewNavigation } from 'react-native-webview';

const HYPERLIQUID_URL = 'https://app.hyperliquid.xyz/';

// 请求拦截器
const requestInterceptor = (request: unknown) => {
  // 这里可以添加请求拦截逻辑
  // 例如：修改请求头、添加认证信息等
  console.log('Intercepted request:', request);
  return request;
};

// 响应拦截器
const responseInterceptor = (response: unknown) => {
  // 这里可以添加响应拦截逻辑
  // 例如：修改响应数据、添加缓存等
  console.log('Intercepted response:', response);
  return response;
};

// 注入的 JS 代码
const injectedJavaScript = `
(function() {
  // 改变背景颜色为白色
  document.body.style.backgroundColor = 'white';
  
  // 请求拦截
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    console.log('Fetch request intercepted:', args);
    return originalFetch.apply(this, args);
  };
  
  // XMLHttpRequest 拦截
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    console.log('XHR request intercepted:', method, url);
    return originalXHROpen.apply(this, [method, url, ...args]);
  };
  
  XMLHttpRequest.prototype.send = function(...args) {
    console.log('XHR send intercepted:', args);
    return originalXHRSend.apply(this, args);
  };
  
  console.log('Perps tab JS injected successfully');
})();
`;

const TabPerps = () => {
  const intl = useIntl();
  const webviewRef = useRef<IWebViewRef | null>(null);
  const [currentUrl, setCurrentUrl] = useState(HYPERLIQUID_URL);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const onNavigationStateChange = useCallback(
    (navigationState: WebViewNavigation) => {
      setCurrentUrl(navigationState.url);
      setCanGoBack(navigationState.canGoBack);
      setCanGoForward(navigationState.canGoForward);
    },
    [],
  );

  const onShouldStartLoadWithRequest = useCallback(
    (request: WebViewNavigation) => {
      // 这里可以添加请求拦截逻辑
      console.log('Should start load with request:', request);
      return true;
    },
    [],
  );

  const webviewProps = useMemo(
    () => ({
      src: HYPERLIQUID_URL,
      onWebViewRef: (ref: IWebViewRef | null) => {
        if (ref) {
          webviewRef.current = ref;
        }
      },
      onNavigationStateChange,
      onShouldStartLoadWithRequest,
      nativeInjectedJavaScriptBeforeContentLoaded: injectedJavaScript,
      displayProgressBar: true,
      pullToRefreshEnabled: true,
      allowpopups: true,
    }),
    [onNavigationStateChange, onShouldStartLoadWithRequest],
  );

  return (
    <Page>
      <Page.Body>
        <Stack flex={1}>
          <WebView {...webviewProps} />
        </Stack>
      </Page.Body>
    </Page>
  );
};

export default TabPerps;
