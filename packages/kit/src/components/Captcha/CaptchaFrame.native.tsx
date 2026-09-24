import { useCallback, useEffect, useRef, useState } from 'react';

import { WebView } from 'react-native-webview';

import { SizableText, Spinner, Stack, XStack } from '@onekeyhq/components';

import { isCaptchaOrigin, parseCaptchaMessage } from './captchaMessage';

import type { ICaptchaFrameProps } from './captchaMessage';

type ICaptchaNavigationRequest = {
  url: string;
  isTopFrame?: boolean;
};

function NativeCaptchaFrame({ url, requestId, onResult }: ICaptchaFrameProps) {
  const origin = new URL(url).origin;
  const [ready, setReady] = useState(false);
  const lifecycle = useRef({ active: false, failed: false, started: false });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const failToLoad = useCallback(() => {
    if (!lifecycle.current.active || lifecycle.current.failed) return;
    lifecycle.current.failed = true;
    clearTimeout(timer.current);
    setReady(false);
    onResult({ type: 'onekey-test-captcha', requestId, status: 'load-error' });
  }, [onResult, requestId]);

  useEffect(() => {
    const currentLifecycle = lifecycle.current;
    currentLifecycle.active = true;
    const deadline =
      !currentLifecycle.started && !currentLifecycle.failed
        ? setTimeout(failToLoad, 30_000)
        : undefined;
    timer.current = deadline;
    return () => {
      currentLifecycle.active = false;
      clearTimeout(deadline);
    };
  }, [failToLoad]);

  return (
    <Stack position="relative" height={65}>
      {!ready ? (
        <XStack
          testID="email-otp-captcha-loading"
          position="absolute"
          inset={0}
          alignItems="center"
          justifyContent="center"
          gap="$2"
          bg="$bgSubdued"
          borderRadius="$2"
        >
          <Spinner size="small" />
          <SizableText size="$bodyMd" color="$textSubdued">
            Loading CAPTCHA…
          </SizableText>
        </XStack>
      ) : null}
      <WebView
        testID="email-otp-captcha-frame"
        source={{ uri: url }}
        containerStyle={{ height: 65, flex: 0, opacity: ready ? 1 : 0 }}
        style={{ height: 65, flex: 0, backgroundColor: 'transparent' }}
        pointerEvents={ready ? 'auto' : 'none'}
        javaScriptEnabled
        domStorageEnabled
        // Turnstile uses srcdoc frames; WebView's default whitelist blocks them.
        originWhitelist={[
          'http://*',
          'https://*',
          'about:blank',
          'about:srcdoc',
        ]}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(request: ICaptchaNavigationRequest) => {
          if (
            request.isTopFrame === false ||
            isCaptchaOrigin(request.url, origin)
          ) {
            return true;
          }
          // Android omits isTopFrame. Allow only Turnstile's required documents
          // when frame metadata is unavailable; keep known top frames restricted.
          return (
            request.isTopFrame === undefined &&
            (request.url === 'about:blank' ||
              request.url === 'about:srcdoc' ||
              isCaptchaOrigin(request.url, 'https://challenges.cloudflare.com'))
          );
        }}
        onMessage={(event) => {
          if (
            !lifecycle.current.active ||
            lifecycle.current.failed ||
            !isCaptchaOrigin(event.nativeEvent.url, origin)
          )
            return;
          const message = parseCaptchaMessage(
            event.nativeEvent.data,
            requestId,
          );
          if (!message) return;
          if (message.status === 'load-error') {
            failToLoad();
            return;
          }
          clearTimeout(timer.current);
          lifecycle.current.started = true;
          if (message.status === 'timeout') {
            lifecycle.current.failed = true;
            setReady(false);
          } else {
            // HTTP load events can describe an error page. Reveal only a page
            // whose origin and request-bound provider bridge have been verified.
            setReady(true);
          }
          onResult(message);
        }}
        onError={failToLoad}
        onHttpError={(event) => {
          // react-native-webview filters HTTP errors to the main document on
          // both Android and iOS before dispatching this callback.
          if (
            event.nativeEvent.statusCode >= 400 &&
            isCaptchaOrigin(event.nativeEvent.url, origin)
          ) {
            failToLoad();
          }
        }}
        onContentProcessDidTerminate={failToLoad}
        onRenderProcessGone={failToLoad}
      />
    </Stack>
  );
}

export default function CaptchaFrame(props: ICaptchaFrameProps) {
  return (
    <NativeCaptchaFrame key={`${props.requestId}:${props.url}`} {...props} />
  );
}
