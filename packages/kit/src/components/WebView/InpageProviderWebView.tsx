import {
  FC,
  forwardRef,
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
  DesktopWebView,
  IWebViewWrapperRef,
  NativeWebView,
  useWebViewBridge,
} from '@onekeyfe/onekey-cross-webview';
import { Box, Progress } from 'native-base';
import { useIntl } from 'react-intl';
import { WebViewSource } from 'react-native-webview/lib/WebViewTypes';

import {
  Button,
  Center,
  Image,
  Spinner,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import IconNoConnect from '@onekeyhq/kit/assets/ic_3d_no_connect.png';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// @ts-ignore
import injectedNativeCode from './injectedNative.text-js';

const { isDesktop, isWeb, isExtension, isNative } = platformEnv;
const isApp = isNative;

export type InpageProviderWebViewProps = InpageWebViewProps & {
  onNavigationStateChange?: (event: any) => void;
  allowpopups?: boolean;
  nativeWebviewSource?: WebViewSource;
  nativeInjectedJavaScriptBeforeContentLoaded?: string;
  isSpinnerLoading?: boolean;
  onContentLoaded?: () => void; // currently works in NativeWebView only
};

const InpageProviderWebView: FC<InpageProviderWebViewProps> = forwardRef(
  (
    {
      src = '',
      onSrcChange,
      receiveHandler,
      onNavigationStateChange,
      allowpopups,
      nativeWebviewSource,
      nativeInjectedJavaScriptBeforeContentLoaded,
      isSpinnerLoading,
      onContentLoaded,
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
      const webview = webviewRef.current?.innerRef;

      if (!webview || !isDesktop) {
        return;
      }

      try {
        const electronWebView = webview as IElectronWebView;
        const handleMessage = (event: any) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (event.errorCode !== -3) {
            setDesktopLoadError(true);
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

    const nativeWebviewProps = useMemo(() => {
      const props = {} as any;
      if (nativeWebviewSource) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        props.source = nativeWebviewSource;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return props;
    }, [nativeWebviewSource]);
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
                // Warning: any string work, any bool not work
                // @ts-expect-error
                allowpopups={allowpopups ? 'true' : false}
                useragent={
                  // TODO move it to Developer Settings
                  // we can resize desktop to vertical only in DEV env currently
                  platformEnv.isDev && isVertical
                    ? // sim mobile app UA
                      'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
                    : undefined
                }
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
