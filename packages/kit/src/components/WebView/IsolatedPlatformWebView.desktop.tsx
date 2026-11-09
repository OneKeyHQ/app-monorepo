import type { FC } from 'react';
import { forwardRef, useCallback, useMemo, useRef, useState } from 'react';

import { Progress, Spinner, Stack } from '@onekeyhq/components';

import { DesktopIsolatedWebView } from './DesktopIsolatedWebView';

import type { IInpageProviderWebViewProps } from './types';

const IsolatedPlatformWebView: FC<IInpageProviderWebViewProps> = forwardRef(
  (
    {
      id,
      src = '',
      onSrcChange,
      receiveHandler,
      allowpopups = false,
      isSpinnerLoading,
      displayProgressBar,
      partition,
      onDidStartLoading,
      onDidStartNavigation,
      onDidFinishLoad,
      onDidStopLoading,
      onDidFailLoad,
      onPageTitleUpdated,
      onPageFaviconUpdated,
      onLoadEnd,
      onDomReady,
      onOpenWindow,
      onShouldStartLoadWithRequest,
    }: IInpageProviderWebViewProps,
    ref: any,
  ) => {
    const [progress, setProgress] = useState(5);
    const [showProgress, setShowProgress] = useState(true);

    const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      if (!displayProgressBar) {
        return null;
      }
      if (showProgress) {
        if (isSpinnerLoading) {
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
    }, [displayProgressBar, isSpinnerLoading, progress, showProgress]);

    const handleNewWindow = useCallback(
      (e: { url?: string }) => {
        if (onOpenWindow && e.url) {
          onOpenWindow({ nativeEvent: { targetUrl: e.url } });
        }
      },
      [onOpenWindow],
    );

    return (
      <Stack flex={1}>
        {progressLoading}
        <DesktopIsolatedWebView
          id={id}
          ref={ref}
          src={src}
          onSrcChange={onSrcChange}
          receiveHandler={receiveHandler}
          partition={partition}
          // @ts-expect-error
          allowpopups={allowpopups.toString()}
          useragent={undefined}
          onDidStartLoading={innerOnDidStartLoading}
          onDidStartNavigation={onDidStartNavigation}
          onDidFinishLoad={onDidFinishLoad}
          onLoadEnd={onLoadEnd}
          onDidStopLoading={innerOnStopLoading}
          onDidFailLoad={onDidFailLoad}
          onPageTitleUpdated={onPageTitleUpdated}
          onPageFaviconUpdated={onPageFaviconUpdated}
          onDomReady={onDomReady}
          onNewWindow={onOpenWindow ? handleNewWindow : undefined}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        />
      </Stack>
    );
  },
);
IsolatedPlatformWebView.displayName = 'IsolatedPlatformWebView';

export default IsolatedPlatformWebView;
