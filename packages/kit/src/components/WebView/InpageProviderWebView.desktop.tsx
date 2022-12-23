import type { FC } from 'react';
import { forwardRef, useImperativeHandle } from 'react';

import { useWebViewBridge } from '@onekeyfe/onekey-cross-webview';

import { useIsVerticalLayout } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// eslint-disable-next-line import/order
import { DesktopWebView } from './DesktopWebView';

// injected hot-reload cache update: 21334400088746
// eslint-disable-next-line import/order
// @ts-ignore

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
    }: InpageProviderWebViewProps,
    ref: any,
  ) => {
    const { webviewRef, setWebViewRef } = useWebViewBridge();
    const isVertical = useIsVerticalLayout();

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
          // TODO move it to Developer Settings
          // we can resize desktop to vertical only in DEV env currently
          platformEnv.isDev && isVertical
            ? // sim mobile app UA
              DESKTOP_USER_AGENT_MOCK
            : undefined
        }
      />
    );
  },
);
InpageProviderWebView.displayName = 'InpageProviderWebView';

export default InpageProviderWebView;
