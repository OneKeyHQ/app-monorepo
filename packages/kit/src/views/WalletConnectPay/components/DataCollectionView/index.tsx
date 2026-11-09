import { useEffect, useMemo, useRef, useState } from 'react';

import { Spinner, Stack } from '@onekeyhq/components';
import {
  WALLET_CONNECT_PAY_TRUSTED_HOST,
  isWcPayTrustedHost,
} from '@onekeyhq/shared/src/walletConnect/payConstant';

import type { IDataCollectionViewProps } from './types';

const INNER_FRAME_ID = 'wc-pay-form-frame';
// ~6s at 30ms per attempt; mirrors the native variant's injector cap so a
// persistent cross-frame DOM access failure surfaces instead of spinning
const MAX_ATTACH_ATTEMPTS = 200;

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * The hosted form is embedded through a same-origin srcdoc wrapper document
 * whose CSP `frame-src` is limited to the trusted WalletConnect Pay host.
 * The browser enforces frame-src on EVERY navigation of the nested browsing
 * context — initial load, redirects, and navigations initiated by the page
 * itself — which gives web/desktop the same "main document must stay on the
 * trusted host" semantics as the native onShouldStartLoadWithRequest guard.
 * Like the native guard it constrains only the form's main document; frames
 * nested inside the form are governed by the form page's own CSP.
 *
 * The wrapper carries no script: the shell reaches into the same-origin
 * document from outside to observe load state, messages, and CSP violation
 * events, so blocking never depends on shell code running.
 */
function buildWrapperSrcDoc(url: string): string {
  const frameSrc = `https://${WALLET_CONNECT_PAY_TRUSTED_HOST} https://*.${WALLET_CONNECT_PAY_TRUSTED_HOST}`;
  return [
    '<!doctype html><html><head>',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${frameSrc}; style-src 'unsafe-inline'">`,
    '<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden}iframe{display:block;border:0;width:100%;height:100%}</style>',
    '</head><body>',
    `<iframe id="${INNER_FRAME_ID}" title="WalletConnect Pay" sandbox="allow-scripts allow-forms allow-same-origin" src="${escapeHtmlAttribute(
      url,
    )}"></iframe>`,
    '</body></html>',
  ].join('');
}

/**
 * Web/desktop variant: the hosted compliance form runs in an iframe and
 * reports completion via window postMessage (IC_COMPLETE / IC_ERROR).
 */
export function DataCollectionView({
  url,
  onComplete,
  onError,
}: IDataCollectionViewProps) {
  const completedRef = useRef(false);
  const wrapperRef = useRef<HTMLIFrameElement | null>(null);
  // the hosted form can take seconds to load; keep a spinner over the empty
  // iframe so the page never looks blank/frozen
  const [isFormLoaded, setIsFormLoaded] = useState(false);

  const srcDoc = useMemo(() => buildWrapperSrcDoc(url), [url]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    let disposed = false;
    const cleanups: Array<() => void> = [];

    const finishWithError = (message: string) => {
      if (!completedRef.current) {
        completedRef.current = true;
        onError(message);
      }
    };

    const handleMessage = (event: MessageEvent) => {
      try {
        // a completion message must come from the form frame nested directly
        // inside this view's wrapper — another WC Pay window/frame that merely
        // shares a trusted hostname must not be able to finish this form.
        // `parent` is a cross-origin-accessible property, so this identity
        // check works without reaching into the wrapper document and keeps
        // message reception independent of attach() succeeding.
        // The origin is bound to the trusted host set (same as the native
        // variant and the wrapper CSP's frame-src) rather than the initial
        // url's exact origin: the hosted form may legitimately navigate
        // between trusted subdomains, and pinning the initial origin would
        // silently drop its completion message after such a hop
        if (
          !event.source ||
          (event.source as Window).parent !== wrapper?.contentWindow ||
          !event.origin.startsWith('https://') ||
          !isWcPayTrustedHost(new URL(event.origin).hostname)
        ) {
          return;
        }
        const data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'IC_COMPLETE' && !completedRef.current) {
          completedRef.current = true;
          onComplete();
        } else if (data?.type === 'IC_ERROR' && !completedRef.current) {
          completedRef.current = true;
          onError(String(data?.error ?? 'Data collection failed'));
        }
      } catch {
        // ignore non-JSON messages
      }
    };
    // the form may post to its direct parent (the wrapper) or to the top
    // window. The top-window listener is registered unconditionally so
    // completion is never lost even if cross-frame DOM access below fails
    window.addEventListener('message', handleMessage);
    cleanups.push(() => window.removeEventListener('message', handleMessage));

    const attach = (): boolean => {
      const doc = wrapper?.contentDocument ?? null;
      // present only in the parsed srcdoc document, never in the initial
      // about:blank one — its existence marks the wrapper as ready
      const frame = doc?.getElementById(
        INNER_FRAME_ID,
      ) as HTMLIFrameElement | null;
      const wrapperWindow = wrapper?.contentWindow;
      if (!doc || !frame || !wrapperWindow) {
        return false;
      }

      wrapperWindow.addEventListener('message', handleMessage);
      cleanups.push(() => {
        try {
          wrapperWindow.removeEventListener('message', handleMessage);
        } catch {
          // wrapper window may already be torn down
        }
      });

      const handleViolation = (event: SecurityPolicyViolationEvent) => {
        if (
          event.effectiveDirective !== 'frame-src' &&
          event.violatedDirective !== 'frame-src'
        ) {
          return;
        }
        // the browser already blocked the navigation; also tear the frame
        // down and abort the flow instead of leaving a dead form on screen
        frame.remove();
        finishWithError(
          'Data collection left the trusted WalletConnect Pay domain',
        );
      };
      doc.addEventListener('securitypolicyviolation', handleViolation);
      cleanups.push(() => {
        try {
          doc.removeEventListener('securitypolicyviolation', handleViolation);
        } catch {
          // wrapper document may already be torn down
        }
      });

      const handleFrameLoad = () => setIsFormLoaded(true);
      frame.addEventListener('load', handleFrameLoad);
      cleanups.push(() => {
        try {
          frame.removeEventListener('load', handleFrameLoad);
        } catch {
          // frame may already be removed
        }
      });
      return true;
    };

    // the srcdoc document parses asynchronously; poll briefly until its
    // elements exist. CSP blocking and top-window completion messages never
    // depend on attach() — it only adds wrapper-side listeners — but a
    // persistent failure must abort the flow instead of spinning forever
    if (!attach()) {
      let attempts = 0;
      const timer = setInterval(() => {
        if (disposed || attach()) {
          clearInterval(timer);
          return;
        }
        attempts += 1;
        if (attempts > MAX_ATTACH_ATTEMPTS) {
          clearInterval(timer);
          finishWithError('Data collection form failed to initialize');
        }
      }, 30);
      cleanups.push(() => clearInterval(timer));
    }

    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
    };
  }, [srcDoc, onComplete, onError]);

  return (
    <Stack flex={1}>
      <iframe
        // remount on url change so listeners never attach to a stale
        // wrapper document that is about to be replaced
        key={srcDoc}
        ref={wrapperRef}
        srcDoc={srcDoc}
        // the wrapper's load event waits for its nested form frame, so this
        // clears the spinner even when attach() cannot reach the wrapper
        // document to observe the inner frame's load directly
        onLoad={() => setIsFormLoaded(true)}
        title="WalletConnect Pay"
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        sandbox="allow-scripts allow-forms allow-same-origin"
      />
      {!isFormLoaded ? (
        <Stack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          alignItems="center"
          justifyContent="center"
          bg="$bgApp"
          pointerEvents="none"
        >
          <Spinner size="large" />
        </Stack>
      ) : null}
    </Stack>
  );
}
