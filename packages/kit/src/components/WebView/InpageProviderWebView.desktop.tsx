import type { FC } from 'react';
import { forwardRef, useImperativeHandle } from 'react';

import { useWebViewBridge } from '@onekeyfe/onekey-cross-webview';

// TODO: REPLACE_HOOKS
// import { useIsVerticalLayout } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { DesktopWebView } from './DesktopWebView';

import type { InpageProviderWebViewProps } from './types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

const DESKTOP_USER_AGENT_MOCK = undefined;

const InpageProviderWebView: FC<InpageProviderWebViewProps> = forwardRef(
  (
    {
      id,
      src = '',
      onSrcChange,
      receiveHandler,
      allowpopups,
      onDidStartLoading,
      onDidStartNavigation,
      onDidFinishLoad,
      onDidStopLoading,
      onDidFailLoad,
      onPageTitleUpdated,
      onPageFaviconUpdated,
      onNewWindow,
      onDomReady,
    }: InpageProviderWebViewProps,
    ref: any,
  ) => {
    const { webviewRef, setWebViewRef } = useWebViewBridge();

    const isVertical = false;
    // const isVertical = useIsVerticalLayout();

    useImperativeHandle(
      ref,
      (): IWebViewWrapperRef | null => webviewRef.current,
    );

    return (
      <DesktopWebView
        id={id}
        ref={setWebViewRef}
        src={src}
        onSrcChange={onSrcChange}
        receiveHandler={receiveHandler}
        // Warning: any string work, any bool not work
        // @ts-expect-error
        allowpopups={allowpopups ? 'true' : false}
        useragent={
          // we can resize desktop to vertical only in DEV env currently
          platformEnv.isDev && isVertical
            ? // sim mobile app UA
              DESKTOP_USER_AGENT_MOCK
            : undefined
        }
        onDidStartLoading={onDidStartLoading}
        onDidStartNavigation={onDidStartNavigation}
        onDidFinishLoad={onDidFinishLoad}
        onDidStopLoading={onDidStopLoading}
        onDidFailLoad={onDidFailLoad}
        onPageTitleUpdated={onPageTitleUpdated}
        onPageFaviconUpdated={onPageFaviconUpdated}
        onNewWindow={onNewWindow}
        onDomReady={onDomReady}
      />
    );
  },
);
InpageProviderWebView.displayName = 'InpageProviderWebView';

export default InpageProviderWebView;
