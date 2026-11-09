import { useCallback, useEffect, useRef } from 'react';

import { usePrimePaymentMethods } from '@onekeyhq/kit/src/views/Prime/hooks/usePrimePaymentMethods.web-embed';
import { EWebEmbedPrivateRequestMethod } from '@onekeyhq/shared/src/consts/webEmbedConsts';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

async function closeWebViewModal() {
  await globalThis.$onekey.$private.request({
    method: EWebEmbedPrivateRequestMethod.closeWebViewModal,
  });
}

async function closeWebViewModalAfterPrimePurchaseSuccess(
  onekeyUserId: string,
) {
  await globalThis.$onekey.$private.request({
    method:
      EWebEmbedPrivateRequestMethod.closeWebViewModalAfterPrimePurchaseSuccess,
    params: { onekeyUserId },
  });
}

async function showToast({
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

function Spinner() {
  return (
    <>
      <style>
        {`
          @keyframes onekey-prime-purchase-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
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
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          style={{ animation: 'onekey-prime-purchase-spin 2s linear infinite' }}
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
    </>
  );
}

// Isolated desktop Prime checkout page, served from the same app shell with
// `?render=prime-purchase` inside a sandboxed <webview>: it has no
// desktopApi / desktopApiBridge / $mmkvSync, so official Stripe.js and its
// dynamically updated sub-scripts can load freely without exposing the wallet.
// Query params are read from the URL hash by usePrimePaymentMethods.
export default function PrimePurchaseWebEmbedApp() {
  const isRunning = useRef(false);
  const { webEmbedQueryParams, purchasePackageWeb } = usePrimePaymentMethods();

  const apiKey = webEmbedQueryParams?.apiKey;
  const primeUserId = webEmbedQueryParams?.primeUserId;
  const primeUserEmail = webEmbedQueryParams?.primeUserEmail;
  const subscriptionPeriod = webEmbedQueryParams?.subscriptionPeriod;
  const locale = webEmbedQueryParams?.locale;
  const currency = webEmbedQueryParams?.currency;
  const featureName = webEmbedQueryParams?.featureName;

  const run = useCallback(async () => {
    if (!primeUserId || !primeUserEmail || !subscriptionPeriod || !apiKey) {
      await closeWebViewModal();
      return;
    }
    if (isRunning.current) {
      return;
    }

    isRunning.current = true;
    try {
      const validFeatureName =
        featureName &&
        Object.values(EPrimeFeatures).includes(featureName as EPrimeFeatures)
          ? (featureName as EPrimeFeatures)
          : undefined;

      const purchaseResult = await purchasePackageWeb?.({
        subscriptionPeriod,
        email: primeUserEmail,
        locale,
        currency,
        featureName: validFeatureName,
      });

      if (purchaseResult?.customerInfo.entitlements.active.Prime?.isActive) {
        await closeWebViewModalAfterPrimePurchaseSuccess(primeUserId);
      } else {
        await closeWebViewModal();
      }
    } catch (error) {
      await showToast({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      await closeWebViewModal();
    } finally {
      isRunning.current = false;
    }
  }, [
    apiKey,
    currency,
    featureName,
    locale,
    primeUserEmail,
    primeUserId,
    purchasePackageWeb,
    subscriptionPeriod,
  ]);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <div>
      <Spinner />
    </div>
  );
}
