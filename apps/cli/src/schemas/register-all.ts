// apps/cli/src/schemas/register-all.ts
import {
  authLoginInputSchema,
  authLoginOutputSchema,
  authLogoutInputSchema,
  authLogoutOutputSchema,
  authStatusInputSchema,
  authStatusOutputSchema,
} from './auth-schema';
import { balanceAllOutputSchema, balanceInputSchema } from './balance-schema';
import {
  getAddressInputSchema,
  getAddressOutputSchema,
} from './get-address-schema';
import { logoutInputSchema, logoutOutputSchema } from './logout-schema';
import {
  marketKlineInputSchema,
  marketKlineOutputSchema,
  marketPriceInputSchema,
  marketPriceOutputSchema,
  marketPricesInputSchema,
  marketPricesOutputSchema,
} from './market-schemas';
import { defineCommand } from './registry';
import {
  securityAuditInputSchema,
  securityAuditOutputSchema,
  securitySimulateInputSchema,
  securitySimulateOutputSchema,
} from './security-schemas';
import { signInputSchema, signOutputSchema } from './sign-schema';
import { statusInputSchema, statusOutputSchema } from './status-schema';
import {
  swapBuildInputSchema,
  swapBuildOutputSchema,
  swapExecuteInputSchema,
  swapExecuteOutputSchema,
  swapHistoryInputSchema,
  swapHistoryOutputSchema,
  swapNetworksInputSchema,
  swapNetworksOutputSchema,
  swapQuoteInputSchema,
  swapQuoteOutputSchema,
  swapStatusInputSchema,
  swapStatusOutputSchema,
} from './swap-schemas';
import {
  tokenInfoInputSchema,
  tokenInfoOutputSchema,
  tokenLiquidityInputSchema,
  tokenLiquidityOutputSchema,
  tokenPriceInputSchema,
  tokenPriceOutputSchema,
  tokenSearchInputSchema,
  tokenSearchOutputSchema,
  tokenTradesInputSchema,
  tokenTradesOutputSchema,
  tokenTrendingInputSchema,
  tokenTrendingOutputSchema,
} from './token-schemas';
import { transferInputSchema, transferOutputSchema } from './transfer-schema';
import { versionInputSchema, versionOutputSchema } from './version-schema';
import {
  walletHistoryInputSchema,
  walletHistoryOutputSchema,
} from './wallet-history-schema';

// --- Standalone commands ---

defineCommand({
  name: 'version',
  description: 'Print CLI version and environment',
  input: versionInputSchema,
  output: versionOutputSchema,
  examples: ['onekey version'],
});

defineCommand({
  name: 'status',
  description: 'Check API connectivity and latency',
  input: statusInputSchema,
  output: statusOutputSchema,
  examples: ['onekey status'],
});

defineCommand({
  name: 'logout',
  description: 'Remove wallet from system keychain',
  input: logoutInputSchema,
  output: logoutOutputSchema,
  examples: ['onekey logout'],
});

defineCommand({
  name: 'balance',
  description: 'Query token balance — all assets or specific token',
  input: balanceInputSchema,
  output: balanceAllOutputSchema,
  examples: [
    'onekey balance',
    'onekey balance --chain eth',
    'onekey balance --chain eth --token USDC',
  ],
});

defineCommand({
  name: 'transfer',
  description: 'Send native or ERC-20 tokens',
  input: transferInputSchema,
  output: transferOutputSchema,
  examples: [
    'onekey transfer --to 0x... --amount 1.5',
    'onekey transfer --to 0x... --amount 100 --token 0x... --chain bsc',
    'onekey transfer --to 0x... --amount 0.01 --dry-run',
  ],
});

defineCommand({
  name: 'sign',
  description: 'Sign an encoded transaction locally',
  input: signInputSchema,
  output: signOutputSchema,
  examples: [
    'onekey sign --chain eth --tx \'{"to":"0x..."}\' --address 0x... --path "m/44\'/60\'/0\'/0/0" --pub 02...',
  ],
});

defineCommand({
  name: 'get-address',
  description: 'Show the active Bot Wallet address',
  input: getAddressInputSchema,
  output: getAddressOutputSchema,
  examples: ['onekey get-address', 'onekey get-address --format=text'],
});

defineCommand({
  name: 'auth-login',
  description: 'Authenticate with a OneKey App Bot Wallet or hardware wallet',
  input: authLoginInputSchema,
  output: authLoginOutputSchema,
  examples: [
    'onekey auth login --app-transfer',
    'onekey auth login --hardware',
    'onekey auth login --hardware --device-id <uuid>',
    'onekey auth login --hardware --passphrase-mode on-device',
  ],
});

defineCommand({
  name: 'auth-status',
  description: 'Show the current auth session',
  input: authStatusInputSchema,
  output: authStatusOutputSchema,
  examples: ['onekey auth status'],
});

defineCommand({
  name: 'auth-logout',
  description: 'Log out of the current auth session',
  input: authLogoutInputSchema,
  output: authLogoutOutputSchema,
  examples: ['onekey auth logout', 'onekey --yes auth logout'],
});

defineCommand({
  name: 'history',
  description: 'On-chain transaction history',
  input: walletHistoryInputSchema,
  output: walletHistoryOutputSchema,
  examples: ['onekey history', 'onekey history --chain eth --detail'],
});

// --- Token group ---

defineCommand({
  name: 'token-search',
  description: 'Search tokens by keyword, symbol, or address',
  input: tokenSearchInputSchema,
  output: tokenSearchOutputSchema,
  examples: ['onekey token search --query PEPE --chain eth'],
});

defineCommand({
  name: 'token-info',
  description: 'Detailed token metadata and market data',
  input: tokenInfoInputSchema,
  output: tokenInfoOutputSchema,
  examples: ['onekey token info --chain eth --token USDC'],
});

defineCommand({
  name: 'token-price',
  description: 'Token price with multi-timeframe changes',
  input: tokenPriceInputSchema,
  output: tokenPriceOutputSchema,
  examples: ['onekey token price --chain eth --token 0x...'],
});

defineCommand({
  name: 'token-trending',
  description: 'Top trending tokens across chains',
  input: tokenTrendingInputSchema,
  output: tokenTrendingOutputSchema,
  examples: ['onekey token trending', 'onekey token trending --chain sol'],
});

defineCommand({
  name: 'token-trades',
  description: 'Buy/sell activity and volume stats by timeframe',
  input: tokenTradesInputSchema,
  output: tokenTradesOutputSchema,
  examples: ['onekey token trades --chain eth --token 0x...'],
});

defineCommand({
  name: 'token-liquidity',
  description: 'Top token holders and their balances',
  input: tokenLiquidityInputSchema,
  output: tokenLiquidityOutputSchema,
  examples: ['onekey token liquidity --chain eth --token 0x...'],
});

// --- Market group ---

defineCommand({
  name: 'market-price',
  description: 'Get single token price from market data',
  input: marketPriceInputSchema,
  output: marketPriceOutputSchema,
  examples: ['onekey market price --chain eth --token USDC'],
});

defineCommand({
  name: 'market-prices',
  description: 'Batch pricing for multiple tokens',
  input: marketPricesInputSchema,
  output: marketPricesOutputSchema,
  examples: ['onekey market prices --tokens "eth:0x...,bsc:0x..."'],
});

defineCommand({
  name: 'market-kline',
  description: 'Candlestick OHLCV data',
  input: marketKlineInputSchema,
  output: marketKlineOutputSchema,
  examples: ['onekey market kline --chain eth --token 0x... --interval 1H'],
});

// --- Swap group ---

defineCommand({
  name: 'swap-quote',
  description: 'Get real-time swap quotes (read-only, not commitment)',
  input: swapQuoteInputSchema,
  output: swapQuoteOutputSchema,
  examples: ['onekey swap quote --chain eth --from USDC --to ETH --amount 100'],
});

defineCommand({
  name: 'swap-build',
  description: 'Build unsigned swap transaction and get orderId',
  input: swapBuildInputSchema,
  output: swapBuildOutputSchema,
  examples: ['onekey swap build --chain eth --from USDC --to ETH --amount 100'],
});

defineCommand({
  name: 'swap-execute',
  description: 'Sign and broadcast a built swap transaction',
  input: swapExecuteInputSchema,
  output: swapExecuteOutputSchema,
  examples: ['onekey swap execute --order <orderId>'],
});

defineCommand({
  name: 'swap-status',
  description: 'Query swap order or transaction status',
  input: swapStatusInputSchema,
  output: swapStatusOutputSchema,
  examples: [
    'onekey swap status --order <orderId>',
    'onekey swap status --tx 0x... --watch',
  ],
});

defineCommand({
  name: 'swap-networks',
  description: 'List supported swap networks',
  input: swapNetworksInputSchema,
  output: swapNetworksOutputSchema,
  examples: ['onekey swap networks', 'onekey swap networks --bridge'],
});

defineCommand({
  name: 'swap-history',
  description: 'Local swap order history',
  input: swapHistoryInputSchema,
  output: swapHistoryOutputSchema,
  examples: ['onekey swap history'],
});

// --- Security group ---

defineCommand({
  name: 'security-audit',
  description:
    'Token risk assessment — returns overall risk level with item breakdown',
  input: securityAuditInputSchema,
  output: securityAuditOutputSchema,
  examples: ['onekey security audit --chain eth --token 0x...'],
});

defineCommand({
  name: 'security-simulate',
  description: 'Preview transaction effects before signing',
  input: securitySimulateInputSchema,
  output: securitySimulateOutputSchema,
  examples: ['onekey security simulate --chain eth --to 0x... --data 0x...'],
});
