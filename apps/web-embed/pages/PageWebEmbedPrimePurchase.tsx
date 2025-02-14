/* eslint-disable unicorn/prefer-global-this */
import { useCallback, useEffect, useRef, useState } from 'react';

import { type PurchaseParams, Purchases } from '@revenuecat/purchases-js';
import { useSearchParams } from 'react-router-dom';

const testData = {
  'settings': {
    'themeVariant': 'light',
    'localeVariant': 'en',
    'revenuecatApiKey': 'rcb_OQDYrGcbnrzaKUaIDRhXQxEqBNTB',
  },
  'primeUserId': 'did:privy:cm6cunn8e00a710mbujncg4t8',
  'primeUserEmail': 'yao.hou@onekey.so',
};

async function closeNativeWebViewModal() {
  await globalThis.$onekey.$private.request({
    method: 'wallet_closeWebViewModal',
  });
}

function Spinner() {
  return (
    <div>
      <style>
        {`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}
      </style>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        style={{
          animation: 'spin 1s linear infinite',
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
  const primeUserId =
    searchParams.get('primeUserId') || 'did:privy:cm6cunn8e00a710mbujncg4t8';
  const primeUserEmail =
    searchParams.get('primeUserEmail') || 'yao.hou@onekey.so';
  const packageId = searchParams.get('packageId') || 'P1Y';
  const [debugText, setDebugText] = useState('');

  const run = useCallback(async () => {
    if (isRunning.current) {
      return;
    }

    isRunning.current = true;

    Purchases.configure(testData.settings.revenuecatApiKey, primeUserId);

    const offerings = await Purchases.getSharedInstance().getOfferings({
      currency: 'USD',
    });

    const paywallPackage = offerings?.current?.availablePackages.find(
      (p) => p.rcBillingProduct.normalPeriodDuration === packageId,
    );

    if (!paywallPackage) {
      throw new Error('No paywall package found');
    }

    const purchaseParams: PurchaseParams = {
      rcPackage: paywallPackage,
      customerEmail: primeUserEmail,
      selectedLocale: 'en',
    };

    try {
      const purchaseResult = await Purchases.getSharedInstance().purchase(
        purchaseParams,
      );

      setDebugText(JSON.stringify(purchaseResult));
    } catch (error) {
      setDebugText(JSON.stringify(error));
    }

    isRunning.current = false;
    await closeNativeWebViewModal();
  }, [primeUserId, primeUserEmail, packageId]);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <div>
      <Spinner />
      <div>
        {debugText}
        {JSON.stringify(
          {
            packageId,
            primeUserId,
            primeUserEmail,
          },
          null,
          2,
        )}
      </div>
    </div>
  );
}
