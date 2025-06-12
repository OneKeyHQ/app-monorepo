/* eslint-disable unicorn/prefer-global-this */
import { useCallback, useEffect, useRef, useState } from 'react';

import { type PurchaseParams, Purchases } from '@revenuecat/purchases-js';
import { useSearchParams } from 'react-router-dom';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

async function closeNativeWebViewModal() {
  await globalThis.$onekey.$private.request({
    method: 'wallet_closeWebViewModal',
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
  const [searchParams] = useSearchParams();
  const isRunning = useRef(false);
  const apiKey = searchParams.get('apiKey') || '';
  const primeUserId = searchParams.get('primeUserId') || '';
  const primeUserEmail = searchParams.get('primeUserEmail') || '';
  const subscriptionPeriod = searchParams.get('subscriptionPeriod') || '';
  const locale = searchParams.get('locale') || 'en';
  const [debugText, setDebugText] = useState('');
  const mode = (searchParams.get('mode') || 'prod') as 'dev' | 'prod';

  const run = useCallback(async () => {
    if (!primeUserId || !primeUserEmail || !subscriptionPeriod) {
      await closeNativeWebViewModal();
      return;
    }

    if (isRunning.current) {
      return;
    }

    try {
      isRunning.current = true;

      Purchases.configure(apiKey, primeUserId);

      const offerings = await Purchases.getSharedInstance().getOfferings({
        currency: 'USD',
      });

      const paywallPackage = offerings?.current?.availablePackages.find(
        (p) => p.rcBillingProduct.normalPeriodDuration === subscriptionPeriod,
      );

      if (!paywallPackage) {
        throw new OneKeyLocalError('No paywall package found');
      }

      const purchaseParams: PurchaseParams = {
        rcPackage: paywallPackage,
        customerEmail: primeUserEmail,
        selectedLocale: locale,
      };

      const purchaseResult = await Purchases.getSharedInstance().purchase(
        purchaseParams,
      );

      setDebugText(JSON.stringify(purchaseResult));
    } catch (error) {
      const trace = (error instanceof Error ? error.stack : '') || '';
      setDebugText(
        error instanceof Error
          ? `${error.message}\n${trace}`
          : `Unknown error: ${trace}`,
      );

      if (mode !== 'dev') {
        await closeNativeWebViewModal();
      }
    }

    isRunning.current = false;
  }, [primeUserId, primeUserEmail, subscriptionPeriod, apiKey, locale, mode]);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <div>
      <Spinner />

      {mode === 'dev' ? (
        <div>
          {debugText ? (
            <pre
              style={{
                color: 'red',
              }}
            >
              {debugText}
            </pre>
          ) : null}
          {JSON.stringify(
            {
              subscriptionPeriod,
              primeUserId,
              primeUserEmail,
            },
            null,
            2,
          )}
        </div>
      ) : null}
    </div>
  );
}
