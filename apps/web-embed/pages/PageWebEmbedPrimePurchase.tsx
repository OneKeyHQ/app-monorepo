/* eslint-disable unicorn/prefer-global-this */
import { useCallback, useEffect, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import purchasesSdk from '@onekeyhq/kit/src/views/Prime/purchasesSdk/purchasesSdk';

import webEmbedAppSettings from '../utils/webEmbedAppSettings';

import type { Package } from '@revenuecat/purchases-js';

async function showNativeToast({
  method,
  title,
  message,
}: {
  method: 'success' | 'error' | 'info';
  title: string;
  message?: string | undefined;
}) {
  await globalThis.$onekey.$private.request({
    method: 'wallet_showToast',
    params: {
      method,
      title,
      message,
    },
  });
}

async function closeNativeWebViewModal() {
  await globalThis.$onekey.$private.request({
    method: 'wallet_closeWebViewModal',
  });
}

function WebCssStyles() {
  return (
    <style>
      {`
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `}
    </style>
  );
}

function Spinner() {
  return (
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
  );
}

function SubscriptionPlansLoading() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px',
      }}
    >
      <Spinner />
    </div>
  );
}

function PrimeSubscriptionPlansWeb({
  isLoading,
  packages,
  onPackageSelected,
}: {
  isLoading: boolean;
  packages: Package[];
  onPackageSelected: (packageId: string) => void;
}) {
  const [selectedPackageId, setSelectedPackageId] = useState<
    string | undefined
  >(packages?.[0]?.identifier);

  useEffect(() => {
    if (selectedPackageId) {
      onPackageSelected(selectedPackageId);
    }
  }, [onPackageSelected, selectedPackageId]);

  useEffect(() => {
    if (selectedPackageId === undefined && packages?.length) {
      setSelectedPackageId(packages[0].identifier);
    }
  }, [selectedPackageId, packages]);

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column' as any,
    gap: '10px',
  };

  const itemStyle = (selected: boolean) => ({
    display: 'flex',
    alignItems: 'baseline',
    padding: '20px',
    backgroundColor: '#ffffff',
    border: `2px solid ${selected ? '#000000' : '#e5e7eb'}`,
    borderRadius: '12px',
    cursor: 'pointer',
    position: 'relative' as any,
    userSelect: 'none' as const,
  });

  const titleStyle = {
    fontSize: '24px',
    marginRight: '8px',
  };

  const priceStyle = {
    fontSize: '24px',
    flex: 1,
  };

  const pricePerMonthStyle = {
    fontSize: '14px',
    color: '#6b7280',
    marginLeft: '8px',
  };

  const badgeStyle = {
    position: 'absolute' as any,
    top: '-11px',
    right: '16px',
    backgroundColor: '#000000',
    color: '#ffffff',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
  };

  if (isLoading) {
    return <SubscriptionPlansLoading />;
  }

  return (
    <div style={containerStyle}>
      {packages?.map((p) => {
        const selected = selectedPackageId === p.identifier;
        const price = p.rcBillingProduct.currentPrice.amountMicros / 1_000_000;
        const periodDuration = p.rcBillingProduct?.normalPeriodDuration;
        const pricePerMonth = periodDuration === 'P1Y' ? price / 12 : price;
        const showSaveBadge = periodDuration === 'P1Y';

        return (
          <div
            key={p.identifier}
            style={itemStyle(selected)}
            onClick={() => setSelectedPackageId(p.identifier)}
            onKeyDown={() => {
              // noop
            }}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
          >
            {showSaveBadge ? <div style={badgeStyle}>Save 33%</div> : null}
            <div style={titleStyle}>
              {p.rcBillingProduct.title} ({periodDuration})
            </div>
            <div style={priceStyle}>${price.toFixed(2)}</div>
            <div style={pricePerMonthStyle}>
              ${pricePerMonth.toFixed(2)}/month
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PurchaseButton({
  selectedPackageId,
  primeUserId,
  primeUserEmail,
}: {
  selectedPackageId: string | undefined | null;
  primeUserId: string;
  primeUserEmail: string;
}) {
  const [isLoading, setIsLoading] = useState(false);

  if (!selectedPackageId || !primeUserId || !primeUserEmail) {
    return null;
  }

  return (
    <button
      type="button"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        backgroundColor: '#000000',
        color: '#ffffff',
        border: 'none',
        cursor: 'pointer',
        opacity: isLoading ? 0.5 : 1,
      }}
      onClick={async () => {
        if (isLoading) {
          return;
        }
        try {
          setIsLoading(true);
          if (!selectedPackageId) {
            throw new Error('No package selected');
          }
          const result = await purchasesSdk.purchasePackage({
            userId: primeUserId,
            email: primeUserEmail,
            packageId: selectedPackageId,
          });
          // TODO toast error
          if (result) {
            await showNativeToast({
              method: 'success',
              title: `Purchase success`,
            });
            await closeNativeWebViewModal();
          }
        } finally {
          setIsLoading(false);
        }
      }}
    >
      {isLoading ? <Spinner /> : 'Purchase'}
    </button>
  );
}

export default function PageWebEmbedPrimePurchase() {
  const [isLoading, setIsLoading] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    null,
  );

  const [searchParams] = useSearchParams();
  const primeUserId = searchParams.get('primeUserId') || '';
  const primeUserEmail = searchParams.get('primeUserEmail') || '';

  const fetchPackages = useCallback(async () => {
    try {
      setIsLoading(true);
      await purchasesSdk.login({ userId: primeUserId });
      const packages0 = await purchasesSdk.getPaywallPackages();
      setPackages(packages0);
      // TODO toast error
    } finally {
      setIsLoading(false);
    }
  }, [primeUserId]);

  useEffect(() => {
    void fetchPackages();
  }, [fetchPackages]);

  const settings = webEmbedAppSettings.getSettings();
  return (
    <div
      style={{
        paddingTop: '32px',
        paddingBottom: '48px',
        paddingLeft: '16px',
        paddingRight: '16px',
      }}
    >
      <WebCssStyles />
      <PrimeSubscriptionPlansWeb
        isLoading={isLoading}
        packages={packages}
        onPackageSelected={setSelectedPackageId}
      />

      <PurchaseButton
        selectedPackageId={selectedPackageId}
        primeUserId={primeUserId}
        primeUserEmail={primeUserEmail}
      />

      <div
        style={{
          paddingTop: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <button type="button" onClick={fetchPackages}>
          RefreshPackages
        </button>
        <button
          type="button"
          onClick={async () => {
            await showNativeToast({
              method: 'success',
              title: 'Hello',
              message: `World ${Date.now()}`,
            });
          }}
        >
          ShowToast
        </button>
        <button
          type="button"
          onClick={async () => {
            await closeNativeWebViewModal();
          }}
        >
          CloseWebviewModal
        </button>
        <div style={{ wordBreak: 'break-all' }}>
          {JSON.stringify({
            settings,
            primeUserId,
            primeUserEmail,
          })}
        </div>
        <div>{window.location.href}</div>
      </div>
    </div>
  );
}
