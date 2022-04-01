import React, {
  FC,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import {
  IElectronWebView,
  InpageProviderWebViewProps,
} from '@onekeyfe/cross-inpage-provider-types';
import {
  DesktopWebView,
  IWebViewWrapperRef,
  NativeWebView,
  useWebViewBridge,
} from '@onekeyfe/onekey-cross-webview';
import { Box, Progress } from 'native-base';
import { useIntl } from 'react-intl';

import { Button, Center, Icon, Typography } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// @ts-ignore
import injectedNativeCode from './injectedNative.text-js';
// random 11122333333

// console.log('=============', injectedNativeCode);

const { isDesktop, isWeb, isExtension, isNative } = platformEnv;
const isApp = isNative;

const InpageProviderWebView: FC<InpageProviderWebViewProps> = forwardRef(
  (
    { src: url = '', onSrcChange, receiveHandler }: InpageProviderWebViewProps,
    ref: any,
  ) => {
    const intl = useIntl();
    const [src, setSrc] = useState(url);
    const [desktopLoadError, setDesktopLoadError] = useState(false);
    const [progress, setProgress] = useState(5);
    const { webviewRef, setWebViewRef } = useWebViewBridge();
    const isRenderAsIframe = isWeb || isExtension;
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const iframeWebviewRef = useRef<IWebViewWrapperRef>({
      reload: () => {
        if (iframeRef.current) {
          iframeRef.current.src = 'about:blank';
          setTimeout(() => {
            if (iframeRef.current) {
              iframeRef.current.src = src;
            }
          }, 150);
        }
      },
      loadURL: () => {
        // noop
      },
    });

    useEffect(() => {
      setSrc(url);
    }, [url]);

    useImperativeHandle(ref, (): IWebViewWrapperRef | null =>
      isRenderAsIframe ? iframeWebviewRef.current : webviewRef.current,
    );

    useEffect(() => {
      const webview = webviewRef.current?.innerRef;

      if (!webview || !isDesktop) {
        return;
      }

      try {
        const electronWebView = webview as IElectronWebView;
        const handleMessage = () => {
          setDesktopLoadError(true);
        };

        electronWebView.addEventListener('did-fail-load', handleMessage);
        return () => {
          electronWebView.removeEventListener('did-fail-load', handleMessage);
        };
      } catch (error) {
        console.error(error);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [webviewRef.current, webviewRef.current?.innerRef]);

    const onRefresh = () => {
      try {
        const polyfillUrl = new URL(url);
        polyfillUrl.searchParams.set(
          'onekey-browser-refresh',
          Math.random().toString(),
        );

        setSrc(polyfillUrl.toString());
        setDesktopLoadError(false);
      } catch (error) {
        console.warn(error);
      }
    };

    type ErrorViewProps = {
      error?: string | undefined;
    };
    const ErrorView: FC<ErrorViewProps> = () => (
      <Center w="full" h="full" bg="background-default">
        <Icon name="StatusOfflineOutline" size={48} />
        <Typography.DisplayMedium mt={3}>
          {intl.formatMessage({ id: 'title__no_connection' })}
        </Typography.DisplayMedium>
        <Typography.Body1 mt={2} color="text-subdued">
          {intl.formatMessage({ id: 'title__no_connection_desc' })}
        </Typography.Body1>

        <Button
          mt={6}
          size="lg"
          type="primary"
          leftIconName="RefreshOutline"
          onPress={onRefresh}
        >
          {intl.formatMessage({ id: 'action__refresh' })}
        </Button>
      </Center>
    );

    return (
      <Box flex={1}>
        {isApp && progress < 100 && (
          <Progress
            value={progress}
            position="absolute"
            left={0}
            top={0}
            right={0}
            zIndex={10}
            rounded={0}
            size="xs"
            bg="surface-neutral-default"
            _filledTrack={{
              bg: 'interactive-default',
            }}
          />
        )}
        <Box flex={1}>
          {isDesktop &&
            (desktopLoadError ? (
              <ErrorView />
            ) : (
              <DesktopWebView
                ref={setWebViewRef}
                src={src}
                onSrcChange={onSrcChange}
                receiveHandler={receiveHandler}
              />
            ))}
          {isApp && (
            <NativeWebView
              ref={setWebViewRef}
              src={src}
              onSrcChange={onSrcChange}
              receiveHandler={receiveHandler}
              renderError={(error) => <ErrorView error={error} />}
              injectedJavaScriptBeforeContentLoaded={injectedNativeCode}
              onLoadProgress={({ nativeEvent }) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                setProgress(Math.ceil(nativeEvent.progress * 100));
              }}
              textInteractionEnabled={undefined}
              minimumFontSize={undefined}
            />
          )}
          {isRenderAsIframe && (
            // TODO define new IframeSimWebview class
            <iframe
              ref={iframeRef}
              title="iframe-web"
              src={src}
              key={src}
              frameBorder="0"
              style={{ height: '100%', width: '100%' }}
            />
          )}
        </Box>
      </Box>
    );
  },
);
InpageProviderWebView.displayName = 'InpageProviderWebView';

export default InpageProviderWebView;
