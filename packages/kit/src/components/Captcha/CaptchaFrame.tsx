import { useEffect, useRef, useState } from 'react';

import { SizableText, Spinner, Stack, XStack } from '@onekeyhq/components';

import { parseCaptchaMessage } from './captchaMessage';

import type { ICaptchaFrameProps } from './captchaMessage';

export default function CaptchaFrame({
  url,
  requestId,
  onResult,
}: ICaptchaFrameProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [readySource, setReadySource] = useState<string>();
  const source = new URL(url);
  const params = new URLSearchParams(source.hash.slice(1));
  params.set(
    'parentOrigin',
    globalThis.location.protocol === 'file:'
      ? 'null'
      : globalThis.location.origin,
  );
  source.hash = params.toString();
  const frameUrl = source.toString();
  const isReady = readySource === frameUrl;

  useEffect(() => {
    const origin = new URL(url).origin;
    let failed = false;
    // Cross-origin error documents can fire load without firing error. Only
    // the hosted page's authenticated bridge message proves it has started.
    const timer = setTimeout(() => {
      failed = true;
      onResult({
        type: 'onekey-test-captcha',
        requestId,
        status: 'load-error',
      });
    }, 30_000);
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (
        failed ||
        event.origin !== origin ||
        event.source !== ref.current?.contentWindow
      ) {
        return;
      }
      const message = parseCaptchaMessage(event.data, requestId);
      if (message) {
        clearTimeout(timer);
        if (message.status !== 'load-error' && message.status !== 'timeout') {
          setReadySource(frameUrl);
        }
        onResult(message);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('message', handleMessage);
    };
  }, [frameUrl, onResult, requestId, url]);

  return (
    <Stack position="relative" height={65}>
      {!isReady ? (
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
      <iframe
        ref={ref}
        data-testid="email-otp-captcha-frame"
        title="Security verification"
        src={frameUrl}
        sandbox="allow-scripts allow-same-origin"
        style={{
          display: 'block',
          width: '100%',
          height: 65,
          border: 0,
          visibility: isReady ? 'visible' : 'hidden',
        }}
        onErrorCapture={() =>
          onResult({
            type: 'onekey-test-captcha',
            requestId,
            status: 'load-error',
          })
        }
      />
    </Stack>
  );
}
