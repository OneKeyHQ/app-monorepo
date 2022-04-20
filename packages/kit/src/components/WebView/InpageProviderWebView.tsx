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
  InpageProviderWebViewProps as InpageWebViewProps,
} from '@onekeyfe/cross-inpage-provider-types';
import {
  DesktopWebView,
  IWebViewWrapperRef,
  NativeWebView,
  useWebViewBridge,
} from '@onekeyfe/onekey-cross-webview';
import { Box, Progress } from 'native-base';
import { useIntl } from 'react-intl';

import { Button, Center, Image, Typography } from '@onekeyhq/components';
import IconNoConnect from '@onekeyhq/kit/assets/ic_3d_no_connect.png';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// @ts-ignore
import injectedNativeCode from './injectedNative.text-js';
// random 11122333333

// console.log('=============', injectedNativeCode);

const { isDesktop, isWeb, isExtension, isNative } = platformEnv;
const isApp = isNative;

export type InpageProviderWebViewProps = InpageWebViewProps & {
  onNavigationStateChange?: (event: any) => void;
  showProgress?: boolean;
  allowpopups?: boolean;
};

const InpageProviderWebView: FC<InpageProviderWebViewProps> = forwardRef(
  (
    {
      src = '',
      onSrcChange,
      receiveHandler,
      onNavigationStateChange,
      showProgress,
      allowpopups,
    }: InpageProviderWebViewProps,
    ref: any,
  ) => {
    const intl = useIntl();
    const [key, setKey] = useState('');
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

    useEffect(() => {
      const webview = webviewRef.current?.innerRef;

      if (!webview || !isDesktop) {
        return;
      }

      try {
        const electronWebView = webview as IElectronWebView;

        const handleStartMessage = () => {
          setProgress(20);
        };
        const handleCommitMessage = () => {
          setProgress(40);
        };
        const handleReadyMessage = () => {
          setProgress(80);
        };
        const handleFinishMessage = () => {
          setProgress(100);
        };

        electronWebView.addEventListener(
          'did-start-loading',
          handleStartMessage,
        );
        electronWebView.addEventListener('load-commit', handleCommitMessage);
        electronWebView.addEventListener('dom-ready', handleReadyMessage);
        electronWebView.addEventListener(
          'did-finish-load',
          handleFinishMessage,
        );
        electronWebView.addEventListener(
          'did-stop-loading',
          handleFinishMessage,
        );
        electronWebView.addEventListener('did-fail-load', handleFinishMessage);
        return () => {
          electronWebView.removeEventListener(
            'did-start-loading',
            handleStartMessage,
          );
          electronWebView.removeEventListener(
            'load-commit',
            handleCommitMessage,
          );
          electronWebView.removeEventListener('dom-ready', handleReadyMessage);
          electronWebView.removeEventListener(
            'did-finish-load',
            handleFinishMessage,
          );
          electronWebView.removeEventListener(
            'did-stop-loading',
            handleFinishMessage,
          );
          electronWebView.removeEventListener(
            'did-fail-load',
            handleFinishMessage,
          );
        };
      } catch (error) {
        console.error(error);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [webviewRef.current, webviewRef.current?.innerRef]);

    const onRefresh = () => {
      try {
        setKey(Math.random().toString());
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
        <Box mb={3}>
          <Image size="100px" source={IconNoConnect} />
        </Box>
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
        {!!showProgress && progress < 100 && (
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
                key={key}
                ref={setWebViewRef}
                src={src}
                onSrcChange={onSrcChange}
                receiveHandler={receiveHandler}
                allowpopups={allowpopups}
              />
            ))}
          {isApp && (
            <NativeWebView
              key={key}
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
              onNavigationStateChange={onNavigationStateChange}
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
              key={key}
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

InpageProviderWebView.defaultProps = {
  showProgress: true,
};

export default InpageProviderWebView;
