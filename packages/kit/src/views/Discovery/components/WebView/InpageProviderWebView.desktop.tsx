import type { FC } from 'react';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useWebViewBridge } from '@onekeyfe/onekey-cross-webview';

// eslint-disable-next-line import/order
import { Progress, Spinner, Stack } from '@onekeyhq/components';

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
      isSpinnerLoading,
      onDidStartLoading,
      onDidStartNavigation,
      onDidFinishLoad,
      onDidStopLoading,
      onDidFailLoad,
      onPageTitleUpdated,
      onPageFaviconUpdated,
      // onNewWindow,
      onDomReady,
    }: InpageProviderWebViewProps,
    ref: any,
  ) => {
    const [progress, setProgress] = useState(5);
    const [showProgress, setShowProgress] = useState(true);
    const { webviewRef, setWebViewRef } = useWebViewBridge();

    const isVertical = false;
    // const isVertical = useIsVerticalLayout();

    useImperativeHandle(
      ref,
      (): IWebViewWrapperRef | null => webviewRef.current,
    );

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const innerOnDidStartLoading = useCallback(
      (e: any) => {
        onDidStartLoading?.(e);
        setShowProgress(true);
        setProgress(5);
        intervalRef.current = setInterval(() => {
          setProgress((oldProgress) => {
            if (oldProgress >= 90) {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
              }
              return 90;
            }
            return oldProgress + 1;
          });
        }, 50);
      },
      [onDidStartLoading],
    );

    const innerOnStopLoading = useCallback(() => {
      onDidStopLoading?.();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      setProgress(100);
      setTimeout(() => {
        setShowProgress(false);
      }, 100);
    }, [onDidStopLoading]);

    const progressLoading = useMemo(() => {
      if (showProgress) {
        if (isSpinnerLoading) {
          // should be absolute position, otherwise android will crashed!
          return (
            <Stack
              position="absolute"
              left={0}
              top={0}
              right={0}
              w="100%"
              h="100%"
              flex={1}
              alignItems="center"
              justifyContent="center"
            >
              <Spinner size="large" />
            </Stack>
          );
        }
        return (
          <Progress
            value={progress}
            width="100%"
            position="absolute"
            left={0}
            top={0}
            right={0}
            zIndex={10}
            borderRadius={0}
          />
        );
      }
      return null;
    }, [isSpinnerLoading, progress, showProgress]);

    return (
      <Stack flex={1}>
        {progressLoading}
        <DesktopWebView
          id={id}
          ref={setWebViewRef}
          src={src}
          onSrcChange={onSrcChange}
          receiveHandler={receiveHandler}
          // Warning: any string work, any bool not work
          // @ts-expect-error
          allowpopups={allowpopups.toString()}
          useragent={
            // we can resize desktop to vertical only in DEV env currently
            platformEnv.isDev && isVertical
              ? // sim mobile app UA
                DESKTOP_USER_AGENT_MOCK
              : undefined
          }
          onDidStartLoading={() => innerOnDidStartLoading}
          onDidStartNavigation={onDidStartNavigation}
          onDidFinishLoad={onDidFinishLoad}
          onDidStopLoading={innerOnStopLoading}
          onDidFailLoad={onDidFailLoad}
          onPageTitleUpdated={onPageTitleUpdated}
          onPageFaviconUpdated={onPageFaviconUpdated}
          // onNewWindow={onNewWindow}
          onDomReady={onDomReady}
        />
      </Stack>
    );
  },
);
InpageProviderWebView.displayName = 'InpageProviderWebView';

export default InpageProviderWebView;
