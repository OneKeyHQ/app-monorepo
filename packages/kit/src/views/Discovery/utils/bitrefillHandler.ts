import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import type BackgroundApiProxy from '@onekeyhq/kit-bg/src/apis/BackgroundApiProxy';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import type { IConnectedAccountInfo } from '@onekeyhq/shared/types/dappConnection';

// eslint-disable-next-line spellcheck/spell-checker
type IBackgroundApi = InstanceType<typeof BackgroundApiProxy>;

// ============================================================================
// Types
// ============================================================================

export type IBitrefillPaymentMethod =
  | 'bitcoin'
  | 'dash'
  | 'dogecoin'
  | 'ethereum'
  | 'eth_base'
  | 'lightning'
  | 'litecoin'
  | 'usdc_erc20'
  | 'usdc_polygon'
  | 'usdc_arbitrum'
  | 'usdc_base'
  | 'usdc_solana'
  | 'usdt_erc20'
  | 'usdt_polygon'
  | 'usdt_arbitrum'
  | 'usdt_bsc'
  | 'usdt_trc20';

export type IBitrefillPaymentCurrency =
  | 'BTC'
  | 'DASH'
  | 'DOGE'
  | 'ETH'
  | 'LTC'
  | 'USDC'
  | 'USDT';

export interface IBitrefillPaymentIntent {
  event: 'payment_intent';
  invoiceId: string;
  paymentUri: string;
  paymentMethod: IBitrefillPaymentMethod;
  paymentAmount: number;
  paymentCurrency: IBitrefillPaymentCurrency;
  paymentAddress: string;
}

export interface IBitrefillInvoiceCreated {
  event: 'invoice_created';
  invoiceId: string;
  paymentUri: string;
  paymentMethod: IBitrefillPaymentMethod;
  paymentAmount: number;
  paymentCurrency: IBitrefillPaymentCurrency;
  paymentAddress: string;
}

export interface IBitrefillInvoiceUpdate {
  event: 'invoice_update';
  invoiceId: string;
  status: 'payment_detected' | 'payment_confirmed' | 'expired' | 'refunded';
}

export interface IBitrefillInvoiceComplete {
  event: 'invoice_complete';
  invoiceId: string;
  deliveryStatus:
    | 'not_delivered'
    | 'all_delivered'
    | 'all_error'
    | 'partial_delivery';
  refundNeeded: boolean;
}

export type IBitrefillMessage =
  | IBitrefillPaymentIntent
  | IBitrefillInvoiceCreated
  | IBitrefillInvoiceUpdate
  | IBitrefillInvoiceComplete;

// ============================================================================
// Constants
// ============================================================================

const BITREFILL_ORIGINS = [
  'https://embed.bitrefill.com',
  'https://www.bitrefill.com',
  'https://bitrefill.com',
];

/**
 * Map Bitrefill payment methods to OneKey networkIds
 */
const PAYMENT_METHOD_NETWORK_MAP: Record<string, string> = {
  // Native ETH
  ethereum: 'evm--1',
  eth_base: 'evm--8453',

  // USDC
  usdc_erc20: 'evm--1',
  usdc_polygon: 'evm--137',
  usdc_arbitrum: 'evm--42161',
  usdc_base: 'evm--8453',
  // usdc_solana: 'sol--101', // TODO: Add Solana support

  // USDT
  usdt_erc20: 'evm--1',
  usdt_polygon: 'evm--137',
  usdt_arbitrum: 'evm--42161',
  usdt_bsc: 'evm--56',
  // usdt_trc20: 'tron--0x2b6653dc', // TODO: Add Tron support
};

/**
 * Map payment methods to token contract addresses
 * Native tokens (ETH) don't have contract addresses
 */
const PAYMENT_METHOD_TOKEN_MAP: Record<
  string,
  { contractAddress?: string; decimals: number }
> = {
  // Native ETH - no contract address
  ethereum: { decimals: 18 },
  eth_base: { decimals: 18 },

  // USDC (6 decimals)
  usdc_erc20: {
    contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
  },
  usdc_polygon: {
    contractAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    decimals: 6,
  },
  usdc_arbitrum: {
    contractAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    decimals: 6,
  },
  usdc_base: {
    contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
  },

  // USDT (6 decimals)
  usdt_erc20: {
    contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
  },
  usdt_polygon: {
    contractAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    decimals: 6,
  },
  usdt_arbitrum: {
    contractAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    decimals: 6,
  },
  usdt_bsc: {
    contractAddress: '0x55d398326f99059fF775485246999027B3197955',
    decimals: 18, // BSC USDT has 18 decimals
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if the origin is a Bitrefill domain
 */
export function isBitrefillOrigin(url: string): boolean {
  try {
    const origin = new URL(url).origin;
    return BITREFILL_ORIGINS.some(
      (bitrefillOrigin) =>
        origin === bitrefillOrigin || origin.endsWith('.bitrefill.com'),
    );
  } catch {
    return false;
  }
}

/**
 * Parse a WebView message and check if it's a Bitrefill message
 */
export function parseBitrefillMessage(data: string): IBitrefillMessage | null {
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    if (
      parsed.event === 'payment_intent' ||
      parsed.event === 'invoice_created' ||
      parsed.event === 'invoice_update' ||
      parsed.event === 'invoice_complete'
    ) {
      return parsed as IBitrefillMessage;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get OneKey networkId from Bitrefill payment method
 */
export function getNetworkIdByPaymentMethod(
  paymentMethod: IBitrefillPaymentMethod,
): string | null {
  return PAYMENT_METHOD_NETWORK_MAP[paymentMethod] ?? null;
}

/**
 * Check if payment method is supported (EVM only for now)
 */
export function isPaymentMethodSupported(
  paymentMethod: IBitrefillPaymentMethod,
): boolean {
  return paymentMethod in PAYMENT_METHOD_NETWORK_MAP;
}

/**
 * Get token info for a payment method
 */
export function getTokenInfoByPaymentMethod(
  paymentMethod: IBitrefillPaymentMethod,
): {
  contractAddress?: string;
  decimals: number;
} | null {
  return PAYMENT_METHOD_TOKEN_MAP[paymentMethod] ?? null;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Ensure user has connected account and is on the correct network
 * Returns the connected account info or throws an error
 */
export async function ensureConnectedAccount(params: {
  origin: string;
  targetNetworkId: string;
  backgroundApi: IBackgroundApi;
}): Promise<IConnectedAccountInfo> {
  const { origin, targetNetworkId, backgroundApi } = params;

  // Build mock request object for serviceDApp methods
  const mockRequest = {
    origin,
    scope: 'ethereum' as const,
  };

  // Step 1: Check if already connected
  let accountsInfo =
    await backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(mockRequest);

  if (!accountsInfo || accountsInfo.length === 0) {
    // Not connected → open connection modal
    await backgroundApi.serviceDApp.openConnectionModal(mockRequest);

    // Re-fetch account info
    accountsInfo = await backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
      mockRequest,
    );

    if (!accountsInfo || accountsInfo.length === 0) {
      throw new OneKeyError('User rejected connection');
    }
  }

  const currentAccountInfo = accountsInfo[0];
  const currentNetworkId = currentAccountInfo.accountInfo?.networkId;

  // Step 2: Check if network switch is needed
  if (currentNetworkId !== targetNetworkId) {
    await backgroundApi.serviceDApp.switchConnectedNetwork({
      origin,
      scope: mockRequest.scope,
      oldNetworkId: currentNetworkId,
      newNetworkId: targetNetworkId,
    });

    // Re-fetch account info after switch
    accountsInfo = await backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
      mockRequest,
    );

    if (!accountsInfo || accountsInfo.length === 0) {
      throw new OneKeyError('Failed to get account after network switch');
    }
  }

  return accountsInfo[0];
}

/**
 * Build EVM encoded transaction from Bitrefill payment intent
 */
function buildEvmEncodedTx(params: {
  paymentAddress: string;
  paymentAmount: number;
  paymentMethod: IBitrefillPaymentMethod;
  fromAddress: string;
}): IEncodedTxEvm {
  const { paymentAddress, paymentAmount, paymentMethod, fromAddress } = params;
  const tokenInfo = getTokenInfoByPaymentMethod(paymentMethod);

  if (!tokenInfo) {
    throw new OneKeyError(`Unsupported payment method: ${paymentMethod}`);
  }

  const { contractAddress, decimals } = tokenInfo;

  // Convert amount to wei/smallest unit
  const amountInSmallestUnit = BigInt(
    Math.round(paymentAmount * 10 ** decimals),
  ).toString(16);

  if (contractAddress) {
    // ERC20 transfer
    // transfer(address,uint256) function selector: 0xa9059cbb
    const paddedAddress = paymentAddress.slice(2).padStart(64, '0');
    const paddedAmount = amountInSmallestUnit.padStart(64, '0');
    // eslint-disable-next-line spellcheck/spell-checker
    const data = `0xa9059cbb${paddedAddress}${paddedAmount}`;

    return {
      from: fromAddress,
      to: contractAddress,
      value: '0x0',
      data,
    };
  }
  // Native ETH transfer
  return {
    from: fromAddress,
    to: paymentAddress,
    value: `0x${amountInSmallestUnit}`,
    data: '0x',
  };
}

/**
 * Handle Bitrefill payment intent
 * This is the main entry point for processing payment requests
 */
export async function handleBitrefillPayment(params: {
  origin: string;
  event: IBitrefillPaymentIntent;
  backgroundApi: IBackgroundApi;
}): Promise<void> {
  const { origin, event, backgroundApi } = params;
  const { paymentMethod, paymentAddress, paymentAmount } = event;

  // Step 1: Check if payment method is supported
  if (!isPaymentMethodSupported(paymentMethod)) {
    throw new OneKeyError(`Unsupported payment method: ${paymentMethod}`);
  }

  // Step 2: Get target network
  const targetNetworkId = getNetworkIdByPaymentMethod(paymentMethod);
  if (!targetNetworkId) {
    throw new OneKeyError(
      `Cannot determine network for payment method: ${paymentMethod}`,
    );
  }

  // Step 3: Ensure account is connected and on correct network
  const accountInfo = await ensureConnectedAccount({
    origin,
    targetNetworkId,
    backgroundApi,
  });

  const accountId = accountInfo.accountInfo?.accountId;
  const networkId = accountInfo.accountInfo?.networkId;
  const fromAddress = accountInfo.account?.addressDetail?.normalizedAddress;

  if (!accountId || !networkId || !fromAddress) {
    throw new OneKeyError('Invalid account info');
  }

  // Step 4: Build encoded transaction
  const encodedTx = buildEvmEncodedTx({
    paymentAddress,
    paymentAmount,
    paymentMethod,
    fromAddress,
  });

  // Step 5: Open sign and send transaction modal
  const mockRequest = {
    origin,
    scope: 'ethereum' as const,
  };

  await backgroundApi.serviceDApp.openSignAndSendTransactionModal({
    request: mockRequest,
    encodedTx,
    accountId,
    networkId,
  });
}

/**
 * Handle WebView message from Bitrefill
 * This should be called from WebContent's onMessage handler
 */
export async function handleBitrefillWebViewMessage(params: {
  url: string;
  messageData: string;
  backgroundApi: IBackgroundApi;
}): Promise<boolean> {
  const { url, messageData, backgroundApi } = params;

  // Check if this is from Bitrefill
  if (!isBitrefillOrigin(url)) {
    return false;
  }

  // Parse the message
  const message = parseBitrefillMessage(messageData);
  if (!message) {
    return false;
  }

  // Handle different event types
  switch (message.event) {
    case 'payment_intent':
      await handleBitrefillPayment({
        origin: new URL(url).origin,
        event: message,
        backgroundApi,
      });
      return true;

    case 'invoice_created':
      // Could show a notification or update UI
      console.log('[Bitrefill] Invoice created:', message.invoiceId);
      return true;

    case 'invoice_update':
      // Could show status update
      console.log('[Bitrefill] Invoice update:', message.status);
      return true;

    case 'invoice_complete':
      // Could show completion notification
      console.log('[Bitrefill] Invoice complete:', message.deliveryStatus);
      return true;

    default:
      return false;
  }
}
