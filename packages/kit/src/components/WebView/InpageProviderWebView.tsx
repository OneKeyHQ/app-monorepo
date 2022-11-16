import {
  FC,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  IElectronWebView,
  InpageProviderWebViewProps as InpageWebViewProps,
} from '@onekeyfe/cross-inpage-provider-types';
import {
  IWebViewWrapperRef,
  useWebViewBridge,
} from '@onekeyfe/onekey-cross-webview';
import { Box, Progress } from 'native-base';
import { Freeze } from 'react-freeze';
import { useIntl } from 'react-intl';
import { WebViewSource } from 'react-native-webview/lib/WebViewTypes';

import {
  Button,
  Center,
  Empty,
  Spinner,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// eslint-disable-next-line import/order
import { DesktopWebView } from './DesktopWebView';

// injected hot-reload cache update: 21334400088746
// eslint-disable-next-line import/order
// @ts-ignore
import injectedNativeCode from './injectedNative.text-js';
import { NativeWebView } from './NativeWebView';

const { isDesktop, isWeb, isExtension, isNative } = platformEnv;
const isApp = isNative;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const USER_AGENT_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const USER_AGENT_ANDROID =
  'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36';
// const DESKTOP_USER_AGENT_MOCK = USER_AGENT_ANDROID;
// const DESKTOP_USER_AGENT_MOCK = USER_AGENT_IOS;
const DESKTOP_USER_AGENT_MOCK = undefined;

export type InpageProviderWebViewProps = InpageWebViewProps & {
  id?: string;
  onNavigationStateChange?: (event: any) => void;
  allowpopups?: boolean;
  nativeWebviewSource?: WebViewSource;
  nativeInjectedJavaScriptBeforeContentLoaded?: string;
  isSpinnerLoading?: boolean;
  onContentLoaded?: () => void; // currently works in NativeWebView only
  onOpenWindow?: (event: any) => void;
};

const InpageProviderWebView: FC<InpageProviderWebViewProps> = forwardRef(
  (
    {
      id,
      src = '',
      onSrcChange,
      receiveHandler,
      onNavigationStateChange,
      allowpopups,
      nativeWebviewSource,
      nativeInjectedJavaScriptBeforeContentLoaded,
      isSpinnerLoading,
      onContentLoaded,
      onOpenWindow,
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
    const isVertical = useIsVerticalLayout();
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
      if (platformEnv.isDesktop) {
        setDesktopLoadError(false);
      }
    }, [src]);

    useEffect(() => {
      const webview = webviewRef.current?.innerRef;

      if (!webview || !isDesktop) {
        return;
      }

      try {
        const electronWebView = webview as IElectronWebView;
        const handleMessage = (event: any) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (event.errorCode !== -3) {
            // TODO iframe error also show ErrorView
            //      testing www.163.com
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (event.isMainFrame) {
              setDesktopLoadError(true);
            }
          }
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

    const onRefresh = useCallback(() => {
      try {
        setKey(Math.random().toString());
        setDesktopLoadError(false);
      } catch (error) {
        console.warn(error);
      }
    }, []);

    type ErrorViewProps = {
      error?: string | undefined;
    };
    const ErrorView: FC<ErrorViewProps> = () => (
      <Center w="full" h="full" bg="background-default">
        <Empty
          emoji="🌐"
          title={intl.formatMessage({ id: 'title__no_connection' })}
          subTitle={intl.formatMessage({ id: 'title__no_connection_desc' })}
          mb={3}
        />

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

    const nativeWebviewProps = useMemo(() => {
      const props = {} as any;
      if (nativeWebviewSource) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        props.source = nativeWebviewSource;
      }
      if (onOpenWindow) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        props.onOpenWindow = onOpenWindow;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return props;
    }, [nativeWebviewSource, onOpenWindow]);
    const nativeInjectedJsCode = useMemo(() => {
      let code: string = injectedNativeCode || '';
      if (nativeInjectedJavaScriptBeforeContentLoaded) {
        code += `
        ;(function() {
            ;
            ${nativeInjectedJavaScriptBeforeContentLoaded}
            ;
        })();
        `;
      }
      return code;
    }, [nativeInjectedJavaScriptBeforeContentLoaded]);

    const progressLoading = useMemo(() => {
      if (isApp && progress < 100) {
        if (isSpinnerLoading) {
          // should be absolute position, otherwise android will crashed!
          return (
            <Center
              position="absolute"
              left={0}
              top={0}
              right={0}
              w="full"
              h="full"
              flex={1}
            >
              <Spinner size="lg" />
            </Center>
          );
        }
        return (
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
        );
      }
      return null;
    }, [isSpinnerLoading, progress]);

    return (
      <Box flex={1}>
        {progressLoading}
        <Box flex={1}>
          {isDesktop && (
            <Freeze freeze={desktopLoadError}>
              <DesktopWebView
                id={id}
                key={key}
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
            </Freeze>
          )}
          {desktopLoadError ? <ErrorView /> : null}

          {isApp && (
            <NativeWebView
              key={key}
              ref={setWebViewRef}
              src={src}
              onSrcChange={onSrcChange}
              receiveHandler={receiveHandler}
              renderError={(error) => <ErrorView error={error} />}
              injectedJavaScriptBeforeContentLoaded={nativeInjectedJsCode}
              onLoadProgress={({ nativeEvent }) => {
                const p = Math.ceil(nativeEvent.progress * 100);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                setProgress(p);
                if (p >= 100) {
                  onContentLoaded?.();
                }
              }}
              onNavigationStateChange={onNavigationStateChange}
              textInteractionEnabled={undefined}
              minimumFontSize={undefined}
              // allowFileAccessFromFileURLs
              // allowFileAccess
              // allowUniversalAccessFromFileURLs

              // *** Note that static HTML will require setting originWhitelist to ["*"].
              originWhitelist={['*']}
              {...nativeWebviewProps}
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

export default InpageProviderWebView;
