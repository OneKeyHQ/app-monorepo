import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, Stack } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IWebViewRef } from '../../components/WebView/types';
import type { WebViewNavigation } from 'react-native-webview';

const HYPERLIQUID_URL = 'https://app.hyperliquid.xyz/';

// 注入的 JS 代码
const injectedJavaScript = `
  // 立即执行的CSS注入函数 - 在脚本执行的最开始就运行
  (function() {
    const style = document.createElement('style');
    style.id = 'perp-webview-hide-menu-immediate';
    style.textContent = \`
      /* 隐藏顶部菜单栏容器 */
      .sc-iBYQkv.bCwfQS {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        width: 0 !important;
        position: absolute !important;
        top: -9999px !important;
        left: -9999px !important;
        z-index: -9999 !important;
        pointer-events: none !important;
        margin: 0 !important;
        padding: 0 !important;
        min-height: 0 !important;
        max-height: 0 !important;
      }
      
      /* 隐藏包含菜单的 min-height 容器 */
      div[style*="min-height: 56px"] {
        display: none !important;
        height: 0 !important;
        min-height: 0 !important;
        max-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      
      /* 修改 Grid 布局，移除第一个 auto 行，让内容顶上去 */
      .sc-fEXmlR.ejmSgi {
        grid-template-rows: auto 1fr auto !important;
        height: 100% !important;
      }
      
      /* 确保页面内容从顶部开始 */
      body {
        padding-top: 0 !important;
        margin-top: 0 !important;
      }
      
      /* 确保根容器没有顶部间距 */
      #root, #app, .app, .root {
        margin-top: 0 !important;
        padding-top: 0 !important;
      }
      
      /* 隐藏任何可能的顶部间距 */
      div[style*="min-height: 56px"] + * {
        margin-top: 0 !important;
        padding-top: 0 !important;
      }
    \`;
    
    // 立即插入到head的最前面，确保优先级最高
    if (document.head) {
      document.head.insertBefore(style, document.head.firstChild);
      console.log('Perp WebView: CSS injected immediately');
    } else {
      // 如果head还不存在，等待DOM创建
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && document.head) {
            document.head.insertBefore(style, document.head.firstChild);
            observer.disconnect();
            console.log('Perp WebView: CSS injected after head creation');
          }
        });
      });
      
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  })();
  
  // 等待 DOM 加载完成后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('Perp WebView: DOM loaded, CSS injection completed');
    });
  } else {
    console.log('Perp WebView: DOM already loaded, CSS injection completed');
  }
`;

export const PerpWebView = () => {
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

export default PerpWebView;
