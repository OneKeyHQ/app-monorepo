/* cspell:ignore Infini */
import {
  buildPrimeInfiniPaymentCacheKey,
  getPrimeInfiniPaymentAssetKey,
  isPrimeInfiniPaymentTransferClaimForSession,
} from './primeInfiniPaymentCacheUtils';

import type {
  IPrimeInfiniPaymentAsset,
  IPrimeInfiniPendingPaymentSession,
} from '../../types/prime/primeTypes';

function buildSession({
  asset,
  payerAddress,
  recipientAddress,
}: {
  asset: Omit<IPrimeInfiniPaymentAsset, 'key'>;
  payerAddress: string;
  recipientAddress: string;
}): IPrimeInfiniPendingPaymentSession {
  const paymentAsset = {
    ...asset,
    key: getPrimeInfiniPaymentAssetKey(asset),
  };
  const payment = {
    paymentId: 'payment-1',
    address: recipientAddress,
    chain: asset.chain,
    token: asset.token,
    amountDue: '9.99',
    expiresAt: Date.now() + 60_000,
  };
  const payerAccountId = 'hd-1--0';
  const onekeyUserId = 'user-1';
  const plan = 'monthly' as const;
  return {
    schemaVersion: 2,
    asset: paymentAsset,
    baseline: {
      onekeyUserId,
      wasPrimeActive: false,
    },
    plan,
    selectedSubscriptionPeriod: 'P1M',
    payerAccountId,
    payerAddress,
    paymentCacheKey: buildPrimeInfiniPaymentCacheKey({
      bindingId: 'binding-1',
      payment,
      asset: paymentAsset,
      onekeyUserId,
      plan,
      payerAccountId,
      payerAddress,
    }),
    payment,
    sendStarted: false,
    updatedAt: Date.now(),
  };
}

function buildTransferClaim(session: IPrimeInfiniPendingPaymentSession) {
  return {
    networkId: session.asset.networkId,
    accountId: session.payerAccountId,
    accountAddress: session.payerAddress,
    fromAddress: session.payerAddress,
    toAddress: session.payment.address,
    contractAddress: session.asset.contractAddress,
    amount: session.payment.amountDue,
  };
}

describe('isPrimeInfiniPaymentTransferClaimForSession', () => {
  test('accepts EVM address casing and equivalent decimal formatting', () => {
    const session = buildSession({
      asset: {
        chain: 'ETHEREUM',
        token: 'USDT',
        networkId: 'evm--1',
        contractAddress: '0xAbCd',
      },
      payerAddress: '0x1234aBcD',
      recipientAddress: '0x9876dEfA',
    });

    expect(
      isPrimeInfiniPaymentTransferClaimForSession({
        session,
        transferClaim: {
          ...buildTransferClaim(session),
          accountAddress: session.payerAddress.toUpperCase(),
          fromAddress: session.payerAddress.toUpperCase(),
          toAddress: session.payment.address.toUpperCase(),
          contractAddress: session.asset.contractAddress.toUpperCase(),
          amount: '9.9900',
        },
      }),
    ).toBe(true);
  });

  test('keeps Solana payer, recipient, and token addresses case-sensitive', () => {
    const session = buildSession({
      asset: {
        chain: 'SOLANA',
        token: 'USDC',
        networkId: 'sol--101',
        contractAddress: 'TokenMintAbC',
      },
      payerAddress: 'PayerAbC',
      recipientAddress: 'RecipientXyZ',
    });

    expect(
      isPrimeInfiniPaymentTransferClaimForSession({
        session,
        transferClaim: {
          ...buildTransferClaim(session),
          fromAddress: 'payerabc',
        },
      }),
    ).toBe(false);
    expect(
      isPrimeInfiniPaymentTransferClaimForSession({
        session,
        transferClaim: {
          ...buildTransferClaim(session),
          contractAddress: 'tokenmintabc',
        },
      }),
    ).toBe(false);
  });

  test.each(['0', '-1', 'NaN', 'Infinity', ''])(
    'rejects an invalid decoded amount %p',
    (amount) => {
      const session = buildSession({
        asset: {
          chain: 'ETHEREUM',
          token: 'USDT',
          networkId: 'evm--1',
          contractAddress: '0xabcd',
        },
        payerAddress: '0x1234',
        recipientAddress: '0x9876',
      });

      expect(
        isPrimeInfiniPaymentTransferClaimForSession({
          session,
          transferClaim: {
            ...buildTransferClaim(session),
            amount,
          },
        }),
      ).toBe(false);
    },
  );
});
