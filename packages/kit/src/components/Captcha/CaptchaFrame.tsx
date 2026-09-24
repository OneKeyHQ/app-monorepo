import { useLayoutEffect, useRef, useState } from 'react';

import { SizableText, Spinner, Stack, XStack } from '@onekeyhq/components';

import { parseCaptchaMessage } from './captchaMessage';

import type { ICaptchaFrameProps } from './captchaMessage';

function WebCaptchaFrame({ url, requestId, onResult }: ICaptchaFrameProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const resultCallback = useRef(onResult);
  resultCallback.current = onResult;
  const failRef = useRef<() => void>(() => {});
  const didLoad = useRef(false);
  const [isReady, setReady] = useState(false);
  const [isFailed, setFailed] = useState(false);
  const source = new URL(url);
  const params = new URLSearchParams(source.hash.slice(1));
  params.set(
    'parentOrigin',
    globalThis.location.protocol === 'file:'
      ? 'null'
      : globalThis.location.origin,
  );
  params.set('bridge', 'message-channel-v1');
  source.hash = params.toString();
  const frameUrl = source.toString();

  // Invalidate the old port during the commit, before removing its document
  // can deliver pagehide and fail a new attempt through a stale callback.
  useLayoutEffect(() => {
    const origin = new URL(url).origin;
    let active = true;
    let failed = false;
    let port: MessagePort | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stopTimer = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const closePort = () => {
      if (!port) return;
      port.onmessage = null;
      port.onmessageerror = null;
      port.close();
    };
    const fail = () => {
      if (!active || failed) return;
      failed = true;
      stopTimer();
      closePort();
      setReady(false);
      setFailed(true);
      resultCallback.current({
        type: 'onekey-test-captcha',
        requestId,
        status: 'load-error',
      });
    };
    failRef.current = fail;
    // Cross-origin error documents can fire load without firing error. Only
    // a result from the document's port can complete startup, not the handshake.
    timer = setTimeout(fail, 30_000);
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (
        !active ||
        failed ||
        port ||
        event.origin !== origin ||
        event.source !== ref.current?.contentWindow ||
        event.ports.length !== 1
      ) {
        return;
      }
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      const handshake = data as {
        type?: unknown;
        version?: unknown;
        requestId?: unknown;
      };
      if (
        handshake.type !== 'onekey-captcha-bridge' ||
        handshake.version !== 1 ||
        handshake.requestId !== requestId
      ) {
        return;
      }
      // WindowProxy survives navigation; a MessagePort belongs to the document
      // that created it. Never accept window result messages or replace a port.
      [port] = event.ports;
      port.onmessage = (result: MessageEvent<unknown>) => {
        if (!active || failed) return;
        const message = parseCaptchaMessage(result.data, requestId);
        if (!message) return;
        if (message.status === 'load-error') {
          fail();
          return;
        }
        stopTimer();
        setReady(message.status !== 'timeout');
        resultCallback.current(message);
      };
      port.onmessageerror = fail;
    };
    window.addEventListener('message', handleMessage);
    return () => {
      active = false;
      stopTimer();
      closePort();
      window.removeEventListener('message', handleMessage);
    };
  }, [requestId, url]);

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
      {!isFailed ? (
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
          onLoad={() => {
            // A fresh document requires a fresh attempt and port. The hosted
            // page also reports pagehide, covering navigation before load fires.
            if (didLoad.current) failRef.current();
            didLoad.current = true;
          }}
          onErrorCapture={() => failRef.current()}
        />
      ) : null}
    </Stack>
  );
}

export default function CaptchaFrame(props: ICaptchaFrameProps) {
  return <WebCaptchaFrame key={`${props.requestId}:${props.url}`} {...props} />;
}
