/* eslint-disable unicorn/prefer-global-this */
import { useCallback, useEffect, useRef, useState } from 'react';

import safeStringify from 'fast-safe-stringify';

import { usePrimePaymentMethods } from '@onekeyhq/kit/src/views/Prime/hooks/usePrimePaymentMethods';
import { EWebEmbedPrivateRequestMethod } from '@onekeyhq/shared/src/consts/webEmbedConsts';

async function closeNativeWebViewModal() {
  await globalThis.$onekey.$private.request({
    method: EWebEmbedPrivateRequestMethod.closeWebViewModal,
  });
}

async function showNativeToast({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  await globalThis.$onekey.$private.request({
    method: EWebEmbedPrivateRequestMethod.showToast,
    params: { title, message },
  });
}

async function showNativeDebugMessageDialog(debugMessage: any) {
  await globalThis.$onekey.$private.request({
    method: EWebEmbedPrivateRequestMethod.showDebugMessageDialog,
    params: debugMessage,
  });
}

function Spinner() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        position: 'absolute',
        zIndex: 1,
      }}
    >
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        style={{
          animation: 'spin 2s linear infinite',
        }}
      >
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 3v3m0 12v3M5.636 5.636l2.122 2.121m8.485 8.486 2.121 2.121M3 12.001h3m12 0h3M5.636 18.364l2.122-2.121m8.485-8.486 2.121-2.121"
          fill="none"
        />
      </svg>
    </div>
  );
}

export default function PageWebEmbedPrimePurchase() {
  const isRunning = useRef(false);
  const [debugText, setDebugText] = useState<string>('');

  const { webEmbedQueryParams, purchasePackageWeb } = usePrimePaymentMethods();

  console.log('webEmbedQueryParams', webEmbedQueryParams);

  const {
    apiKey,
    primeUserId,
    primeUserEmail,
    subscriptionPeriod,
    locale,
    mode,
  } = webEmbedQueryParams || {};

  const run = useCallback(async () => {
    if (!primeUserId || !primeUserEmail || !subscriptionPeriod || !apiKey) {
      await closeNativeWebViewModal();
      return;
    }

    if (isRunning.current) {
      return;
    }

    try {
      isRunning.current = true;

      console.log('call purchasePackageWeb');

      const purchaseResult = await purchasePackageWeb?.({
        subscriptionPeriod,
        email: primeUserEmail,
        locale,
      });

      const debugMessage = safeStringify.stableStringify(
        purchaseResult,
        undefined,
        2,
      );
      setDebugText(debugMessage);
      await showNativeDebugMessageDialog(debugMessage);

      await closeNativeWebViewModal();
    } catch (error) {
      const trace = (error instanceof Error ? error.stack : '') || '';
      const debugMessage =
        error instanceof Error
          ? `${error.message}\n${trace}`
          : `Unknown error: ${trace}`;
      setDebugText(debugMessage);
      await showNativeDebugMessageDialog(debugMessage);

      await showNativeToast({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });

      await closeNativeWebViewModal();
    }

    isRunning.current = false;
  }, [
    primeUserId,
    primeUserEmail,
    subscriptionPeriod,
    apiKey,
    purchasePackageWeb,
    locale,
  ]);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <div>
      <Spinner />

      {mode === 'dev' ? (
        <div>
          <button
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 11_111,
            }}
            type="button"
            onClick={() => {
              void closeNativeWebViewModal();
            }}
          >
            CloseModal
          </button>

          <button
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 11_111,
            }}
            type="button"
            onClick={() => {
              void run();
            }}
          >
            Run
          </button>

          {debugText ? (
            <pre
              style={{
                color: 'red',
              }}
            >
              {debugText}
            </pre>
          ) : null}
          {safeStringify.stableStringify(
            {
              subscriptionPeriod,
              primeUserId,
              primeUserEmail,
              apiKey,
              locale,
              mode,
            },
            undefined,
            2,
          )}
        </div>
      ) : null}
    </div>
  );
}
