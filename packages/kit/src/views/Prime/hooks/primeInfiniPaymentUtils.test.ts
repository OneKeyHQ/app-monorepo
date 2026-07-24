/* cspell:ignore Infini infini */
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { getPrimeInfiniPaymentAssetKey } from '@onekeyhq/shared/src/utils/primeInfiniPaymentCacheUtils';

import {
  canChangePrimeInfiniPaymentSelection,
  getCanonicalPrimeInfiniPaymentAsset,
  getPrimeInfiniPaymentAssets,
  getPrimeInfiniPaymentCountdown,
  getPrimeInfiniPaymentErrorRecoveryPhase,
  getPrimeInfiniPaymentOutcome,
  hasPrimeInfiniPaymentConfirmingAmount,
  hasPrimeInfiniPaymentProgress,
  isPrimeInfiniBalanceSufficient,
  isPrimeInfiniPaymentExplicitlyExpired,
  isPrimeInfiniPaymentForAsset,
  isPrimeInfiniPaymentReplaceable,
  isPrimeInfiniPaymentWithinSendSafetyWindow,
  isPrimeInfiniPurchaseCompleted,
  shouldBlockPrimeInfiniPaymentRefresh,
  shouldRenderPrimeInfiniPaymentSelection,
} from './primeInfiniPaymentUtils';

const networkIdsMap = getNetworkIdsMap();
const ethereumUsdcContract = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const baseUsdtContract = '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2';

const payment = {
  paymentId: 'payment-id',
  address: '0x1234',
  chain: 'ETHEREUM',
  token: 'USDC',
  amountDue: '29.99',
  expiresAt: 2000,
  status: 'pending',
  infiniStatus: 'created',
  amountConfirmed: '0',
};

const buildInfiniSubscription = (currentPeriodEnd: number) => ({
  subscriptionId: 'subscription-id',
  status: 'active',
  plan: 'monthly' as const,
  currentPeriodEnd,
});

describe('primeInfiniPaymentUtils', () => {
  it.each([
    [61_000, '01:00', 61, false],
    [3_661_000, '01:01:00', 3661, false],
    [1000, '00:00', 1, false],
    [-1, '00:00', 0, true],
  ])(
    'formats a payment expiry countdown one second behind the server value',
    (remainingMs, formatted, remainingSeconds, isExpired) => {
      expect(
        getPrimeInfiniPaymentCountdown({
          expiresAt: 10_000 + remainingMs,
          now: 10_000,
        }),
      ).toEqual({
        formatted,
        isExpired,
        remainingSeconds,
      });
    },
  );

  it('detects the pre-send safety window without expiring the invoice', () => {
    expect(
      isPrimeInfiniPaymentWithinSendSafetyWindow({
        payment,
        minValidityBeforeSendMs: 30_000,
        now: payment.expiresAt - 20_000,
      }),
    ).toBe(true);
    expect(
      isPrimeInfiniPaymentWithinSendSafetyWindow({
        payment,
        minValidityBeforeSendMs: 30_000,
        now: payment.expiresAt - 40_000,
      }),
    ).toBe(false);
  });

  it('builds assets from server metadata on locally supported networks', () => {
    const assets = getPrimeInfiniPaymentAssets([
      {
        chain: 'ethereum',
        networkId: networkIdsMap.eth,
        tokens: [
          { symbol: 'usdc', contract: ethereumUsdcContract },
          { symbol: 'usdc', contract: ethereumUsdcContract },
          { symbol: 'USDT', contract: '' },
        ],
      },
      {
        chain: 'BASE',
        networkId: networkIdsMap.base,
        tokens: [{ symbol: 'USDT', contract: baseUsdtContract }],
      },
      {
        chain: 'UNKNOWN',
        networkId: 'unsupported--1',
        tokens: [{ symbol: 'USDC', contract: '0xunsupported' }],
      },
      {
        chain: 'BITCOIN',
        networkId: networkIdsMap.btc,
        tokens: [{ symbol: 'USDC', contract: 'bitcoin-token' }],
      },
      {
        chain: 'TRON',
        networkId: networkIdsMap.trx,
        tokens: [{ symbol: 'USDT', contract: 'tron-token' }],
      },
    ]);

    expect(assets.map((asset) => asset.key)).toEqual([
      getPrimeInfiniPaymentAssetKey({
        chain: 'ETHEREUM',
        token: 'USDC',
        networkId: networkIdsMap.eth,
        contractAddress: ethereumUsdcContract,
      }),
      getPrimeInfiniPaymentAssetKey({
        chain: 'BASE',
        token: 'USDT',
        networkId: networkIdsMap.base,
        contractAddress: baseUsdtContract,
      }),
      getPrimeInfiniPaymentAssetKey({
        chain: 'BITCOIN',
        token: 'USDC',
        networkId: networkIdsMap.btc,
        contractAddress: 'bitcoin-token',
      }),
      getPrimeInfiniPaymentAssetKey({
        chain: 'TRON',
        token: 'USDT',
        networkId: networkIdsMap.trx,
        contractAddress: 'tron-token',
      }),
    ]);
    expect(assets[0]?.networkId).toBe(networkIdsMap.eth);
    expect(assets[0]?.contractAddress).toBe(ethereumUsdcContract);
    expect(assets[1]).toEqual({
      key: getPrimeInfiniPaymentAssetKey({
        chain: 'BASE',
        token: 'USDT',
        networkId: networkIdsMap.base,
        contractAddress: baseUsdtContract,
      }),
      chain: 'BASE',
      token: 'USDT',
      networkId: networkIdsMap.base,
      contractAddress: baseUsdtContract,
    });
  });

  it('drops an ambiguous pair returned with conflicting asset metadata', () => {
    expect(
      getPrimeInfiniPaymentAssets([
        {
          chain: 'BSC',
          networkId: networkIdsMap.bsc,
          tokens: [
            {
              symbol: 'USDT',
              contract: '0x1111111111111111111111111111111111111111',
            },
            {
              symbol: 'USDT',
              contract: '0x2222222222222222222222222222222222222222',
            },
          ],
        },
      ]),
    ).toEqual([]);
  });

  it('keeps server assets on locally listed networks', () => {
    const assets = getPrimeInfiniPaymentAssets([
      {
        chain: 'SOLANA',
        networkId: networkIdsMap.sol,
        tokens: [
          {
            symbol: 'USDC',
            contract: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          },
        ],
      },
      {
        chain: 'BITCOIN',
        networkId: networkIdsMap.btc,
        tokens: [{ symbol: 'USDC', contract: 'bitcoin-token' }],
      },
      {
        chain: 'TRON',
        networkId: networkIdsMap.trx,
        tokens: [{ symbol: 'USDT', contract: 'tron-token' }],
      },
    ]);

    expect(assets).toHaveLength(3);
    expect(assets.map((asset) => asset.networkId)).toEqual([
      networkIdsMap.sol,
      networkIdsMap.btc,
      networkIdsMap.trx,
    ]);
  });

  it('requires the created payment to match the selected server asset', () => {
    const [asset] = getPrimeInfiniPaymentAssets([
      {
        chain: 'ETHEREUM',
        networkId: networkIdsMap.eth,
        tokens: [{ symbol: 'USDC', contract: ethereumUsdcContract }],
      },
    ]);

    expect(asset).toBeDefined();
    expect(isPrimeInfiniPaymentForAsset({ payment, asset: asset! })).toBe(true);
    expect(
      isPrimeInfiniPaymentForAsset({
        payment: { ...payment, token: 'USDT' },
        asset: asset!,
      }),
    ).toBe(false);
    expect(
      isPrimeInfiniPaymentForAsset({
        payment: { ...payment, amountDue: '0' },
        asset: asset!,
      }),
    ).toBe(false);
  });

  it.each([
    ['amount', { amountDue: '39.99' }],
    ['recipient', { address: '0x5678' }],
    ['expiry', { expiresAt: payment.expiresAt + 1 }],
  ])(
    'blocks Continue when a refresh changes the frozen payment %s',
    (_label, refreshedPaymentOverride) => {
      const [asset] = getPrimeInfiniPaymentAssets([
        {
          chain: 'ETHEREUM',
          networkId: networkIdsMap.eth,
          tokens: [{ symbol: 'USDC', contract: ethereumUsdcContract }],
        },
      ]);

      expect(asset).toBeDefined();
      expect(
        shouldBlockPrimeInfiniPaymentRefresh({
          currentPayment: payment,
          refreshedPayment: {
            ...payment,
            ...refreshedPaymentOverride,
          },
          asset: asset!,
        }),
      ).toBe(true);
      expect(
        shouldBlockPrimeInfiniPaymentRefresh({
          currentPayment: payment,
          refreshedPayment: { ...payment },
          asset: asset!,
        }),
      ).toBe(false);
    },
  );

  it('restores only a structurally valid server asset snapshot', () => {
    const [asset] = getPrimeInfiniPaymentAssets([
      {
        chain: 'ETHEREUM',
        networkId: networkIdsMap.eth,
        tokens: [{ symbol: 'USDC', contract: ethereumUsdcContract }],
      },
    ]);

    expect(getCanonicalPrimeInfiniPaymentAsset(asset!)).toEqual(asset);
    expect(
      getCanonicalPrimeInfiniPaymentAsset({
        ...asset!,
        key: `${asset!.key}-changed`,
      }),
    ).toBeUndefined();
    expect(
      getCanonicalPrimeInfiniPaymentAsset({
        ...asset!,
        networkId: 'unsupported--1',
      }),
    ).toBeUndefined();
    expect(
      getCanonicalPrimeInfiniPaymentAsset({
        ...asset!,
        networkId: networkIdsMap.btc,
      }),
    ).toBeUndefined();
  });

  it('compares token balances without floating-point conversion', () => {
    expect(
      isPrimeInfiniBalanceSufficient({
        balance: '29.990000000000000001',
        amountDue: '29.99',
      }),
    ).toBe(true);
    expect(
      isPrimeInfiniBalanceSufficient({
        balance: '29.989999999999999999',
        amountDue: '29.99',
      }),
    ).toBe(false);
  });

  it('derives conservative payment outcomes', () => {
    expect(getPrimeInfiniPaymentOutcome({ payment, now: 1000 })).toBe(
      'pending',
    );
    expect(
      getPrimeInfiniPaymentOutcome({
        payment: { ...payment, amountConfirmed: '29.99' },
        now: 1000,
      }),
    ).toBe('confirmed');
    expect(getPrimeInfiniPaymentOutcome({ payment, now: 2000 })).toBe(
      'expired',
    );
    expect(
      getPrimeInfiniPaymentOutcome({
        payment: { ...payment, infiniStatus: 'expired' },
        now: 1000,
      }),
    ).toBe('expired');
    expect(
      getPrimeInfiniPaymentOutcome({
        payment: { ...payment, status: 'failed' },
        now: 1000,
      }),
    ).toBe('failed');
    expect(
      getPrimeInfiniPaymentOutcome({
        payment: { ...payment, status: 'unknown-terminal-looking-value' },
        now: 1000,
      }),
    ).toBe('pending');
  });

  it('classifies an explicit server expiry before confirming or confirmed amount fields', () => {
    const explicitlyExpiredPayment = {
      ...payment,
      status: 'expired',
      amountConfirming: '0.01',
      amountConfirmed: payment.amountDue,
    };

    expect(
      isPrimeInfiniPaymentExplicitlyExpired(explicitlyExpiredPayment),
    ).toBe(true);
    expect(
      getPrimeInfiniPaymentOutcome({
        payment: explicitlyExpiredPayment,
        now: 1000,
      }),
    ).toBe('expired');
  });

  it('treats an explicit server failure as terminal before confirmed amount totals', () => {
    expect(
      getPrimeInfiniPaymentOutcome({
        payment: {
          ...payment,
          status: 'failed',
          amountConfirmed: payment.amountDue,
        },
        now: 1000,
      }),
    ).toBe('failed');
  });

  it('distinguishes an in-flight confirming amount from a partially confirmed amount', () => {
    expect(
      hasPrimeInfiniPaymentConfirmingAmount({
        ...payment,
        amountConfirming: '0.01',
      }),
    ).toBe(true);
    expect(
      hasPrimeInfiniPaymentConfirmingAmount({
        ...payment,
        amountConfirmed: '0.01',
        amountConfirming: '0',
      }),
    ).toBe(false);
  });

  it('treats any confirmed or confirming amount as in-flight payment progress', () => {
    expect(hasPrimeInfiniPaymentProgress(payment)).toBe(false);
    expect(
      hasPrimeInfiniPaymentProgress({
        ...payment,
        amountConfirming: '0.01',
      }),
    ).toBe(true);
    expect(
      hasPrimeInfiniPaymentProgress({
        ...payment,
        amountConfirmed: '0.01',
      }),
    ).toBe(true);
  });

  it('allows replacing only an unsent payment without payment progress', () => {
    expect(
      isPrimeInfiniPaymentReplaceable({
        payment,
        sendStarted: false,
      }),
    ).toBe(true);
    expect(
      isPrimeInfiniPaymentReplaceable({
        payment,
        sendStarted: true,
      }),
    ).toBe(false);
    expect(
      isPrimeInfiniPaymentReplaceable({
        payment: {
          ...payment,
          amountConfirming: '0.01',
        },
        sendStarted: false,
      }),
    ).toBe(false);
    expect(
      isPrimeInfiniPaymentReplaceable({
        payment: {
          ...payment,
          amountConfirmed: '0.01',
        },
        sendStarted: false,
      }),
    ).toBe(false);
  });

  it('keeps payment selectors available only while a payment can be replaced', () => {
    expect(
      canChangePrimeInfiniPaymentSelection({
        phase: 'selecting',
        payment,
        sendStarted: false,
      }),
    ).toBe(true);
    expect(
      canChangePrimeInfiniPaymentSelection({
        phase: 'switching',
        payment,
        sendStarted: false,
      }),
    ).toBe(false);
    expect(
      canChangePrimeInfiniPaymentSelection({
        phase: 'creating',
        payment,
        sendStarted: false,
      }),
    ).toBe(false);
    expect(
      canChangePrimeInfiniPaymentSelection({
        phase: 'finalizing',
        payment,
        sendStarted: false,
      }),
    ).toBe(false);
    expect(
      canChangePrimeInfiniPaymentSelection({
        phase: 'replacementFailed',
        payment,
        sendStarted: false,
      }),
    ).toBe(true);
    expect(
      canChangePrimeInfiniPaymentSelection({
        phase: 'retryableFailed',
        payment,
        sendStarted: false,
      }),
    ).toBe(true);
    expect(
      canChangePrimeInfiniPaymentSelection({
        phase: 'expired',
        payment,
        sendStarted: false,
      }),
    ).toBe(true);
    expect(
      canChangePrimeInfiniPaymentSelection({
        phase: 'failed',
        payment,
        sendStarted: false,
      }),
    ).toBe(true);
    expect(
      canChangePrimeInfiniPaymentSelection({
        phase: 'selecting',
        payment,
        sendStarted: true,
      }),
    ).toBe(false);
    expect(
      canChangePrimeInfiniPaymentSelection({
        phase: 'selecting',
        payment: {
          ...payment,
          amountConfirming: '0.01',
        },
        sendStarted: false,
      }),
    ).toBe(false);
  });

  it.each([
    'selecting',
    'switching',
    'replacementFailed',
    'retryableFailed',
    'creating',
    'confirming',
    'polling',
    'expired',
    'failed',
  ] as const)('keeps selectors mounted during the %s phase', (phase) => {
    expect(shouldRenderPrimeInfiniPaymentSelection({ phase })).toBe(true);
  });

  it('hides selectors only while purchase completion is finalizing', () => {
    expect(
      shouldRenderPrimeInfiniPaymentSelection({ phase: 'finalizing' }),
    ).toBe(false);
  });

  it('keeps retryable failures recoverable without risking a duplicate send', () => {
    expect(
      getPrimeInfiniPaymentErrorRecoveryPhase({ sendStarted: false }),
    ).toBe('retryableFailed');
    expect(getPrimeInfiniPaymentErrorRecoveryPhase({ sendStarted: true })).toBe(
      'polling',
    );
  });

  it('confirms initial purchases only from fresh Prime state', () => {
    expect(
      isPrimeInfiniPurchaseCompleted({
        baseline: { wasPrimeActive: false },
        primeSubscription: { isActive: true, expiresAt: 3000 },
        infiniSubscription: undefined,
      }),
    ).toBe(true);
    expect(
      isPrimeInfiniPurchaseCompleted({
        baseline: { wasPrimeActive: false },
        primeSubscription: undefined,
        infiniSubscription: buildInfiniSubscription(3000),
      }),
    ).toBe(false);
  });

  it('confirms renewals from either the merged or Infini expiry baseline', () => {
    const baseline = {
      wasPrimeActive: true,
      primeExpiresAt: 5000,
      infiniPeriodEnd: 3000,
    };

    expect(
      isPrimeInfiniPurchaseCompleted({
        baseline,
        primeSubscription: { isActive: true, expiresAt: 5001 },
        infiniSubscription: undefined,
      }),
    ).toBe(true);
    expect(
      isPrimeInfiniPurchaseCompleted({
        baseline,
        primeSubscription: { isActive: true, expiresAt: 5000 },
        infiniSubscription: buildInfiniSubscription(3001),
      }),
    ).toBe(true);
    expect(
      isPrimeInfiniPurchaseCompleted({
        baseline,
        primeSubscription: { isActive: true, expiresAt: 5000 },
        infiniSubscription: buildInfiniSubscription(3000),
      }),
    ).toBe(false);
  });
});
