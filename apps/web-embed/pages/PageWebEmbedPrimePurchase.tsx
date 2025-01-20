/* eslint-disable unicorn/prefer-global-this */
import { useEffect, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import purchasesSdk from '@onekeyhq/kit/src/views/Prime/purchasesSdk/purchasesSdk';

import webEmbedAppSettings from '../utils/webEmbedAppSettings';

import type { Package } from '@revenuecat/purchases-js';

function PrimeSubscriptionPlansWeb({
  packages,
  onPackageSelected,
}: {
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
    border: `2px solid ${selected ? '#0066ff' : '#e5e7eb'}`,
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setSelectedPackageId(p.identifier);
              }
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

export default function PageWebEmbedPrimePurchase() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    null,
  );

  const [searchParams] = useSearchParams();
  const primeUserId = searchParams.get('primeUserId') || '';
  const primeUserEmail = searchParams.get('primeUserEmail') || '';

  const settings = webEmbedAppSettings.getSettings();
  return (
    <div style={{ padding: '16px' }}>
      <PrimeSubscriptionPlansWeb
        packages={packages}
        onPackageSelected={setSelectedPackageId}
      />
      <button
        type="button"
        onClick={async () => {
          await purchasesSdk.login({ userId: primeUserId });
          const packages0 = await purchasesSdk.getPaywallPackages();
          setPackages(packages0);
        }}
      >
        ShowPackages441
      </button>
      <button
        type="button"
        onClick={async () => {
          if (!selectedPackageId) {
            throw new Error('No package selected');
          }
          const result = await purchasesSdk.purchasePackage({
            userId: primeUserId,
            email: primeUserEmail,
            packageId: selectedPackageId,
          });
          if (result) {
            alert('Purchase success');
          }
        }}
      >
        PurchasePackage221
      </button>
      <button
        type="button"
        onClick={async () => {
          // TODO call app Toast by $onekey.$private
          alert(
            JSON.stringify({
              title: 'success',
              message: 'success',
            }),
          );
        }}
      >
        ShowToast998
      </button>

      <div>
        {JSON.stringify({
          settings,
          primeUserId,
          primeUserEmail,
          revenuecatApiKeySandbox: process.env.REVENUECAT_API_KEY_WEB_SANDBOX,
          revenuecatApiKey: process.env.REVENUECAT_API_KEY_WEB,
        })}
      </div>
      <div>{window.location.href}</div>
    </div>
  );
}
