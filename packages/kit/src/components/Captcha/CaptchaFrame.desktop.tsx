/* eslint-disable react/no-unknown-property -- Electron webview attributes. */
import { useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Spinner, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  DESKTOP_CAPTCHA_MESSAGE_CHANNEL,
  isCaptchaOrigin,
  isDesktopCaptchaPage,
  parseCaptchaMessage,
} from '@onekeyhq/shared/src/utils/captchaMessage';

import type { ICaptchaFrameProps } from './captchaMessage';
import type {
  DidFailLoadEvent,
  DidFrameNavigateEvent,
  DidStartNavigationEvent,
  IpcMessageEvent,
  WebviewTag,
} from 'electron';

function DesktopCaptchaFrame({ url, requestId, onResult }: ICaptchaFrameProps) {
  const intl = useIntl();
  const ref = useRef<WebviewTag | null>(null);
  const resultCallback = useRef(onResult);
  resultCallback.current = onResult;
  const [preload, setPreload] = useState<string>();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const lifecycle = useRef({ active: false, failed: false });
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const failRef = useRef<() => void>(() => {});

  useEffect(() => {
    const current = lifecycle.current;
    current.active = true;
    const fail = () => {
      if (!current.active || current.failed) return;
      current.failed = true;
      clearTimeout(deadline.current);
      setReady(false);
      setFailed(true);
      resultCallback.current({
        type: 'onekey-test-captcha',
        requestId,
        status: 'load-error',
      });
    };
    failRef.current = fail;
    // Include preload acquisition and silent HTTP error documents in the
    // deadline. Only a validated page message can complete startup.
    deadline.current = setTimeout(fail, 30_000);
    if (!isDesktopCaptchaPage(url)) {
      fail();
    } else {
      void globalThis.desktopApiProxy.webview
        .getPreloadJsContent()
        .then((path) => {
          if (current.active && !current.failed) setPreload(path);
        })
        .catch(fail);
    }
    return () => {
      current.active = false;
      clearTimeout(deadline.current);
    };
  }, [requestId, url]);

  useEffect(() => {
    const webview = ref.current;
    if (!webview || !preload || failed) return undefined;
    const current = lifecycle.current;
    const origin = new URL(url).origin;
    const matchesAttempt = (pageUrl: string) => {
      if (!isDesktopCaptchaPage(pageUrl) || !isCaptchaOrigin(pageUrl, origin)) {
        return false;
      }
      return (
        new URLSearchParams(new URL(pageUrl).hash.slice(1)).get('requestId') ===
        requestId
      );
    };
    const fail = () => failRef.current();
    const onMessage = (event: IpcMessageEvent) => {
      if (
        !current.active ||
        current.failed ||
        event.channel !== DESKTOP_CAPTCHA_MESSAGE_CHANNEL ||
        event.target !== webview
      ) {
        return;
      }
      const payload: unknown = event.args[0];
      if (!payload || typeof payload !== 'object') return;
      const envelope = payload as { url?: unknown; message?: unknown };
      if (typeof envelope.url !== 'string' || !matchesAttempt(envelope.url)) {
        return;
      }
      // The preload stamps its real document URL. Also check the guest's
      // current URL, so a late reply cannot survive navigation or a retry.
      if (webview.getURL() !== envelope.url) return;
      const message = parseCaptchaMessage(envelope.message, requestId);
      if (!message) return;
      if (message.status === 'load-error') {
        fail();
        return;
      }
      clearTimeout(deadline.current);
      setReady(message.status !== 'timeout');
      resultCallback.current(message);
    };
    const onFailLoad = (event: DidFailLoadEvent) => {
      // Chromium uses ERR_ABORTED for replaced navigations. Child resource
      // failures after ready belong to the hosted widget's retry handling.
      if (event.isMainFrame && event.errorCode !== -3) fail();
    };
    const onNavigate = (event: DidFrameNavigateEvent) => {
      if (
        event.isMainFrame &&
        (event.httpResponseCode >= 400 || !matchesAttempt(event.url))
      )
        fail();
    };
    const onStartNavigation = (event: DidStartNavigationEvent) => {
      if (event.isMainFrame && !matchesAttempt(event.url)) {
        webview.stop();
        fail();
      }
    };
    webview.addEventListener('ipc-message', onMessage);
    webview.addEventListener('did-fail-load', onFailLoad);
    webview.addEventListener('did-frame-navigate', onNavigate);
    webview.addEventListener('did-start-navigation', onStartNavigation);
    webview.addEventListener('render-process-gone', fail);
    webview.addEventListener('destroyed', fail);
    // Attach listeners before starting navigation: ready may arrive before
    // dom-ready, and must not be lost on a fast cached page.
    webview.src = url;
    return () => {
      webview.removeEventListener('ipc-message', onMessage);
      webview.removeEventListener('did-fail-load', onFailLoad);
      webview.removeEventListener('did-frame-navigate', onNavigate);
      webview.removeEventListener('did-start-navigation', onStartNavigation);
      webview.removeEventListener('render-process-gone', fail);
      webview.removeEventListener('destroyed', fail);
    };
  }, [failed, preload, requestId, url]);

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
            {intl.formatMessage({
              id: ETranslations.auth_captcha_loading__msg,
            })}
          </SizableText>
        </XStack>
      ) : null}
      {preload && !failed ? (
        <webview
          ref={ref}
          data-testid="email-otp-captcha-frame"
          title={intl.formatMessage({
            id: ETranslations.auth_captcha_security_verification__title,
          })}
          preload={preload}
          // Reuse the shell-managed WebView session so OTA renderers inherit
          // its existing permission handlers without requiring a shell update.
          partition="persist:onekey"
          disableblinkfeatures="Notifications"
          webpreferences="contextIsolation=1,sandbox=1,nodeIntegration=0"
          style={{
            display: 'flex',
            width: '100%',
            height: 65,
            visibility: ready ? 'visible' : 'hidden',
          }}
        />
      ) : null}
    </Stack>
  );
}

export default function CaptchaFrame(props: ICaptchaFrameProps) {
  return (
    <DesktopCaptchaFrame key={`${props.requestId}:${props.url}`} {...props} />
  );
}
