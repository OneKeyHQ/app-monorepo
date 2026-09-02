#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  collectEventTimingSummary,
  evaluateEventCountBudgets,
  evaluateFanoutBudgets,
} = require('./account-selector-perf-metrics');
const {
  AccountManagerTestIDs,
  AccountSelectorTestIDs,
  AddressInputTestIDs,
  DAppConnectionTestIDs,
  MarketTestIDs,
  SendTestIDs,
} = require('./account-selector-test-ids');
const {
  getDevOnlyPassword,
  launchBrowser,
  startWebRenderer,
  stopProcess,
} = require('./local-secret-envelope.e2e');

const repoRoot = path.resolve(__dirname, '../../..');
const artifactDir =
  process.env.ACCOUNT_SELECTOR_E2E_ARTIFACT_DIR ||
  path.join(repoRoot, '.tmp', 'account-selector-e2e');
const pageTimeoutMs =
  Number(process.env.ACCOUNT_SELECTOR_E2E_TIMEOUT_MS) || 120_000;
// Budget for an element that should already be rendering. Long enough to absorb
// a cold first paint on a loaded machine, short enough that a genuine miss is
// reported without waiting out the full page timeout.
const uiSettleTimeoutMs =
  Number(process.env.ACCOUNT_SELECTOR_E2E_UI_SETTLE_TIMEOUT_MS) || 15_000;

function visibleTestIDSelector(testID) {
  return `[data-testid=${JSON.stringify(testID)}]:visible`;
}

async function getUniqueVisibleByTestIDs(
  owner,
  testIDs,
  { timeout = pageTimeoutMs } = {},
) {
  const locator = owner.locator(
    testIDs.map((testID) => visibleTestIDSelector(testID)).join(', '),
  );
  await locator.first().waitFor({ state: 'visible', timeout });
  assert.equal(
    await locator.count(),
    1,
    `Expected one visible element for testID ${testIDs.join(' or ')}`,
  );
  return locator;
}

function getUniqueVisibleByTestID(owner, testID, options) {
  return getUniqueVisibleByTestIDs(owner, [testID], options);
}

async function waitForNoVisibleTestID(page, testID) {
  const locator = page.locator(visibleTestIDSelector(testID));
  const deadline = Date.now() + pageTimeoutMs;
  while (Date.now() < deadline) {
    if ((await locator.count()) === 0) {
      return;
    }
    await page.waitForTimeout(50);
  }
  assert.fail(`testID ${testID} remained visible`);
}

const iterations = Number(process.env.ACCOUNT_SELECTOR_E2E_ITERATIONS) || 8;
const configuredCycles = Number(process.env.ACCOUNT_SELECTOR_E2E_CYCLES ?? 1);
const walletModeStorageKey = '$onekey_web_dapp_mode';
const defaultAccountCreationNetworkIds = [
  'btc--0',
  'evm--1',
  'tron--0x2b6653dc',
  'sol--101',
];
const expectedNetworks = [
  'evm--1',
  'evm--137',
  'btc--0',
  'tron--0x2b6653dc',
  'sol--101',
];
// Ground truth for the All Networks selection shape:
// - network id: packages/shared/src/config/presetNetworks.ts (`onekeyall--0`).
// - the persisted record strips deriveType for all-networks on save AND read
//   (SimpleDbEntityAccountSelector.cloneAndFixSelectedAccount), while the
//   jotai selection resolves the global derive type of `onekeyall--0`, which
//   nothing ever writes, so getGlobalDeriveTypeOfNetwork falls back to
//   'default'.
// - the active account for an HD indexed account is the mocked all-network
//   account (ServiceAccount.getMockedAllNetworkAccount) whose address is
//   ALL_NETWORK_ACCOUNT_MOCK_ADDRESS (packages/shared/src/consts/addresses.ts).
const allNetworksNetworkId = 'onekeyall--0';
const allNetworksMockAddress = 'AllNetworkMockAddress';
const allNetworksSelectedDeriveType = 'default';
const accountSelectorE2EWalletFixtures = [
  { accountNames: ['A-1', 'A-2'], fixtureId: 'alpha', name: 'E2E A' },
  { accountNames: ['B-1', 'B-2'], fixtureId: 'beta', name: 'E2E B' },
];
const expectedAccountAddressFixtures = {
  alpha: {
    0: {
      'evm--1': {
        default: '0x29EA87Ea486d2F86d12d9cb89a714a838b80b2c0',
        ledgerLive: '0x29EA87Ea486d2F86d12d9cb89a714a838b80b2c0',
        ledgerLegacy: '0x2910d0b1a398cE6bDCE4636fD77820abc4Ae2D44',
      },
      'evm--137': {
        default: '0x29EA87Ea486d2F86d12d9cb89a714a838b80b2c0',
        ledgerLive: '0x29EA87Ea486d2F86d12d9cb89a714a838b80b2c0',
        ledgerLegacy: '0x2910d0b1a398cE6bDCE4636fD77820abc4Ae2D44',
      },
      'btc--0': {
        BIP86: 'bc1p3exqxzq4a8dt2w93glckd2g0f5hdffx6myne0w5el3e5hr0thwdskd9dd9',
        default: '35Cfo9RaVcs7vuzzHpAZfM93mMwhcBMqX3',
        BIP84: 'bc1q0vet6wytnqxs64xturxgrcqmxhuqryvjpge6fe',
        BIP44: '1EGRU4SwuKfJabfeaYjpAuYv9C9o9wSXkg',
      },
      'tron--0x2b6653dc': {
        default: 'TGVnZ7FhmZ7fk1Q2fq1q1tkPbNoyAKvZ6f',
      },
      'sol--101': {
        default: '3u4eLrbCiaMp18qniooJnZx9WxV7YACv58UB56Pd2Cmz',
        ledgerLive: '9JVmTaUa4oHo9mrj5rcgP8ZLgXCAgntJj9YVdfg2Aqnv',
      },
    },
    1: {
      'evm--1': {
        default: '0x9EeD09420354804349318a77998f3B7E2Ad0c03f',
        ledgerLive: '0xb38C1Add6CAaaf19d5f8ece94ED89b3aF0f6dEE5',
        ledgerLegacy: '0x7312AaB6D67880d56ecd573029c2ae2a5D063e47',
      },
      'evm--137': {
        default: '0x9EeD09420354804349318a77998f3B7E2Ad0c03f',
        ledgerLive: '0xb38C1Add6CAaaf19d5f8ece94ED89b3aF0f6dEE5',
        ledgerLegacy: '0x7312AaB6D67880d56ecd573029c2ae2a5D063e47',
      },
      'btc--0': {
        BIP86: 'bc1pujhgylg0lffp53cr45fy3jqlmqmnljwyywgvmggrk7yy445ukq9svqsxwn',
        default: '3MFBLbC1VhrA91ny8DbKkT8quuTYG771Q4',
        BIP84: 'bc1q82rzukc8drepdflquvwnqmz8myuj9t5m2f87sa',
        BIP44: '16hrKc9j94qGqCDuu3XwKLqXFjjk2Y7RpT',
      },
      'tron--0x2b6653dc': {
        default: 'TXwS4FNboHAXCHXUnYv2b6HLe5YEpuk9LE',
      },
      'sol--101': {
        default: 'Bb9QG1hnt8isRc2ckyVwKdnk2ffwmKJJVkVBkjQMDW9B',
        ledgerLive: 'DeYxLhuSKHNt8gZkG7tVEU4guAbY4pQhWF3NJfFa5X7x',
      },
    },
  },
  beta: {
    0: {
      'evm--1': {
        default: '0xc19f5C3b2471D36c7C164088297A674Afec0fD25',
        ledgerLive: '0xc19f5C3b2471D36c7C164088297A674Afec0fD25',
        ledgerLegacy: '0xd7Fe163fCD9d67Ab68E6CE5652A1957EeC2630d6',
      },
      'evm--137': {
        default: '0xc19f5C3b2471D36c7C164088297A674Afec0fD25',
        ledgerLive: '0xc19f5C3b2471D36c7C164088297A674Afec0fD25',
        ledgerLegacy: '0xd7Fe163fCD9d67Ab68E6CE5652A1957EeC2630d6',
      },
      'btc--0': {
        BIP86: 'bc1pshjgd309dgxxs0a4asdspqqev9pyphre7y880hncn8029r49fzssl27npq',
        default: '3DDTNjF71KjMokRUK9CPVGEVjo7hStra3y',
        BIP84: 'bc1qcu98avx9jd7t09g3qc5m82zee9jd3g6trrtwvd',
        BIP44: '1JzGUm3Gwe7ALQMuzAqKbBWtL8pZ6Q9xeM',
      },
      'tron--0x2b6653dc': {
        default: 'TDNFzUNwJby4p4CXeA2dqCTAbmbm4Yx5jv',
      },
      'sol--101': {
        default: 'CW26DQMgAhvUekW7fkYVtw1rBHgHXH57QeUMNVabJ9o8',
        ledgerLive: 'CYSc58nc6YTouUuAsRGMxxUfek4PxQ6H8MffTWfPVskT',
      },
    },
    1: {
      'evm--1': {
        default: '0xA3335B2314eA7019a54C3679fab8Ac3743B0901B',
        ledgerLive: '0xa272798AFd54aC38FdAFd0bAe3E46CCe6090fF56',
        ledgerLegacy: '0xA39efFD5c0d0B9Bf0f3fFB5EC18C87C12430c671',
      },
      'evm--137': {
        default: '0xA3335B2314eA7019a54C3679fab8Ac3743B0901B',
        ledgerLive: '0xa272798AFd54aC38FdAFd0bAe3E46CCe6090fF56',
        ledgerLegacy: '0xA39efFD5c0d0B9Bf0f3fFB5EC18C87C12430c671',
      },
      'btc--0': {
        BIP86: 'bc1p67xxx734ty8x5zfanxqvt7338trhlepaxwzrax8x5k3l53vgppxskrwrf4',
        default: '36ZAoHY8sq6kETwp1aaEUdhjau69QYX2ty',
        BIP84: 'bc1q848998rvdgcqnt75l2ln3j9cpx682y3v05smf0',
        BIP44: '18BbCRyPdD8VEkf5pGbbyqucFD342b8aq3',
      },
      'tron--0x2b6653dc': {
        default: 'TMRLK1QeHPvNqQSdPDt3ELQjq8KGPCrR23',
      },
      'sol--101': {
        default: '2WRg3Us65uRSibSX2AiAY9nesWtUama8iisAvMkBk4Q3',
        ledgerLive: 'BQ7WwoKXRApzkt6jGX87tCoph9H1dgqu4f1f7JEkzmA2',
      },
    },
  },
};
const simulatedDAppOrigin = 'https://account-selector-e2e.test';
const simulatedDAppSecondaryOrigin =
  'https://account-selector-secondary-e2e.test';
// Only ever opened and rejected, never approved: a dedicated origin proves the
// zero-persistence assertion cannot be satisfied by leftovers from an earlier
// approval of the same origin.
const simulatedDAppRejectOrigin = 'https://account-selector-reject-e2e.test';
// Observed steady state is 15-17 commits per modal open across the dapp,
// dappOps and stress opens (two back-to-back green runs, 2026-08-20), so the
// default is observed max + 2.
const dappConnectionProviderCommitLimit = readPositiveNumberEnv(
  'ACCOUNT_SELECTOR_E2E_DAPP_CONNECTION_PROVIDER_COMMIT_MAX',
  19,
);

// This suite asserts account-selector synchronization, never balances or fiat
// values, yet every account, network and derive switch loads them again over
// the real wallet API - where a 30s timeout surfaces as an uncaught page error
// and fails the cycle. Serving them locally removes that variable.
// Answer with latency, though: a reply in the same tick as the request lands
// state updates inside windows the real backend never lands them in, which
// pushed the DApp initialization commit budget from 5 to 7. See the knob below.
// Set ACCOUNT_SELECTOR_E2E_STUB_WALLET_TOKENS=0 to use the live endpoint.
const stubWalletTokenApi = readBooleanEnv(
  'ACCOUNT_SELECTOR_E2E_STUB_WALLET_TOKENS',
  true,
);
const seenWalletTokenRequests = new Set();
const walletTokenStubLatencyMs = readPositiveNumberEnv(
  'ACCOUNT_SELECTOR_E2E_STUB_WALLET_TOKENS_LATENCY_MS',
  150,
);

// The Perps scenario drives real Hyperliquid endpoints, which rate-limit (429)
// after repeated local runs and then fail the cycle on the uncaught-error check.
// This scenario asserts account-selector synchronization, not market data, so the
// responses are stubbed by default. Set to 0 to exercise the live API.
const stubHyperliquidApi = readBooleanEnv(
  'ACCOUNT_SELECTOR_E2E_STUB_HYPERLIQUID',
  true,
);

const seenHyperliquidActions = new Set();

function buildHyperliquidStubResponse(action) {
  switch (action) {
    case 'meta':
      return { universe: [] };
    case 'spotMeta':
      return { tokens: [], universe: [] };
    case 'metaAndAssetCtxs':
      return [{ universe: [] }, []];
    case 'spotMetaAndAssetCtxs':
      return [{ tokens: [], universe: [] }, []];
    case 'clearinghouseState':
      return {
        assetPositions: [],
        crossMaintenanceMarginUsed: '0',
        crossMarginSummary: {
          accountValue: '0',
          totalMarginUsed: '0',
          totalNtlPos: '0',
          totalRawUsd: '0',
        },
        marginSummary: {
          accountValue: '0',
          totalMarginUsed: '0',
          totalNtlPos: '0',
          totalRawUsd: '0',
        },
        time: 0,
        withdrawable: '0',
      };
    case 'spotClearinghouseState':
      return { balances: [] };
    case 'allMids':
      return {};
    case 'userFees':
      return {
        activeReferralDiscount: '0',
        activeStakingDiscount: { bpsOfMaxSupply: '0', discount: '0' },
        dailyUserVlm: [],
        feeSchedule: {
          add: '0',
          cross: '0',
          referralDiscount: '0',
          spotAdd: '0',
          spotCross: '0',
          tiers: { mm: [], vip: [] },
        },
        userAddRate: '0',
        userCrossRate: '0',
        userSpotAddRate: '0',
        userSpotCrossRate: '0',
      };
    default:
      // Every remaining info action this app calls returns a list.
      return [];
  }
}

async function routeHyperliquidStub(context) {
  await context.route(/https:\/\/[^/]*hyperliquid\.xyz\//, async (route) => {
    let action;
    try {
      action = JSON.parse(route.request().postData() || '{}').type;
    } catch {
      action = undefined;
    }
    seenHyperliquidActions.add(action || route.request().url());
    await route.fulfill({
      body: JSON.stringify(buildHyperliquidStubResponse(action)),
      contentType: 'application/json',
      status: 200,
    });
  });
}

const EMPTY_TOKEN_LIST = { data: [], keys: '', map: {} };

// The account selector e2e never asserts balances or fiat values, but every
// account, network and derive switch loads them again over the real wallet API.
// Serving them locally keeps a timing-sensitive perf run from inheriting the
// network's latency and failures. Set ACCOUNT_SELECTOR_E2E_STUB_WALLET_TOKENS=0
// to exercise the real endpoint.
async function routeWalletTokenStub(context) {
  await context.route(/\/wallet\/v1\/account\/token\/list/, async (route) => {
    seenWalletTokenRequests.add(new URL(route.request().url()).pathname);
    // Answer on the same order of latency as the real endpoint. Returning
    // instantly is not a faithful stand-in here: this suite budgets render
    // scheduling, and a reply that lands in the same tick as the request moves
    // state updates into windows the real backend never lands them in. Fixed,
    // so the determinism the stub exists for is preserved.
    await new Promise((resolve) => {
      setTimeout(resolve, walletTokenStubLatencyMs);
    });
    await route.fulfill({
      body: JSON.stringify({
        code: 0,
        data: {
          allTokens: EMPTY_TOKEN_LIST,
          riskTokens: EMPTY_TOKEN_LIST,
          smallBalanceTokens: EMPTY_TOKEN_LIST,
          tokens: EMPTY_TOKEN_LIST,
        },
        message: '',
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
}

// The Swap inline derive-type scenario needs the swap network list to contain
// btc--0 before useSwapInit accepts an imported BTC from-token, and the list
// normally comes from the live `/swap/v1/networks` endpoint. Serving it locally
// keeps the scenario deterministic on machines without network access and
// removes the live endpoint's latency from every swap-page mount. Token detail
// lookups fire once a token is selected and only decorate balances, so they are
// stubbed to an empty list. Set ACCOUNT_SELECTOR_E2E_STUB_SWAP_API=0 to use the
// live endpoints.
const stubSwapApi = readBooleanEnv('ACCOUNT_SELECTOR_E2E_STUB_SWAP_API', true);
const seenSwapApiRequests = new Set();
// Aligned with expectedNetworks: every network the suite selects on Home has a
// swap-side entry, so swap default-token syncs behave the same on every cycle.
const stubSwapNetworkIds = [
  'btc--0',
  'evm--1',
  'evm--137',
  'sol--101',
  'tron--0x2b6653dc',
];

async function routeSwapApiStub(context) {
  await context.route(/\/swap\/v1\/networks/, async (route) => {
    seenSwapApiRequests.add(new URL(route.request().url()).pathname);
    await route.fulfill({
      body: JSON.stringify({
        code: 0,
        data: stubSwapNetworkIds.map((networkId) => ({
          networkId,
          supportCrossChainSwap: true,
          supportLimit: false,
          supportPrivateSend: false,
          supportSingleSwap: true,
          supportStock: false,
        })),
        message: '',
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
  await context.route(/\/swap\/v1\/token\/detail/, async (route) => {
    seenSwapApiRequests.add(new URL(route.request().url()).pathname);
    await route.fulfill({
      body: JSON.stringify({ code: 0, data: [], message: '' }),
      contentType: 'application/json',
      status: 200,
    });
  });
  // The Market detail swap panel initializes from `/swap/v1/speed-config`
  // (useSpeedSwapInit): the response decides whether speed swap is enabled and
  // which payment tokens the panel offers, so answering locally pins both.
  // The panel network gets two payment tokens because the payment-token
  // selector trigger only renders with more than one candidate left after
  // SwapPanelWrap filters out the current market token; every other network
  // gets the same disabled default the endpoint's error fallback produces.
  await context.route(/\/swap\/v1\/speed-config/, async (route) => {
    const url = new URL(route.request().url());
    seenSwapApiRequests.add(url.pathname);
    const networkId = url.searchParams.get('networkId');
    const isPanelNetwork = networkId === marketSwapPanelToken.networkId;
    await route.fulfill({
      body: JSON.stringify({
        code: 0,
        data: {
          onlySupportCrossChain: false,
          onlySupportSingleChain: false,
          provider: 'e2e-stub',
          speedConfig: {
            defaultLimitTokens: [],
            defaultTokens: isPanelNetwork
              ? [
                  {
                    contractAddress: '',
                    decimals: 18,
                    isNative: true,
                    logoURI: '',
                    name: 'Ethereum',
                    networkId,
                    speedSwapDefaultAmount: [0.1, 0.5, 1],
                    symbol: 'ETH',
                  },
                  {
                    contractAddress:
                      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                    decimals: 6,
                    isNative: false,
                    logoURI: '',
                    name: 'USD Coin',
                    networkId,
                    speedSwapDefaultAmount: [100, 500, 1000],
                    symbol: 'USDC',
                  },
                ]
              : [],
            slippage: 0.5,
            spenderAddress: '',
            swapMevNetConfig: [],
          },
          supportSpeedSwap: isPanelNetwork,
        },
        message: '',
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
  // Fired by the panel whenever the selected payment token is native (max
  // button gas reserve). Zero keeps the reserve math inert.
  await context.route(/\/swap\/v1\/native-token-config/, async (route) => {
    const url = new URL(route.request().url());
    seenSwapApiRequests.add(url.pathname);
    await route.fulfill({
      body: JSON.stringify({
        code: 0,
        data: { networkId: url.searchParams.get('networkId'), reserveGas: 0 },
        message: '',
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
}

// The Market swap-panel scenario mounts MarketDetailV2, whose page body fans
// out to live market endpoints (token detail poll, k-line, information tabs,
// portfolio). None of them feeds an account-selector assertion, but a live
// backend adds latency and failure modes to a timing-sensitive run, so they
// are served locally: the detail endpoint returns a fixed token and every
// other market path returns an empty-but-well-shaped payload. Set
// ACCOUNT_SELECTOR_E2E_STUB_MARKET_API=0 to exercise the live endpoints.
const stubMarketApi = readBooleanEnv(
  'ACCOUNT_SELECTOR_E2E_STUB_MARKET_API',
  true,
);
const seenMarketApiRequests = new Set();
// UNI on evm--1: a real token, so the scenario still renders against the live
// API when the stub is disabled. Deliberately NOT one of the stubbed speed
// swap payment tokens (ETH/USDC): SwapPanelWrap filters the current market
// token out of the payment-token candidates, and the popover trigger needs
// two of them to survive that filter.
const marketSwapPanelToken = {
  contractAddress: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
  decimals: 18,
  name: 'Uniswap',
  networkId: 'evm--1',
  symbol: 'UNI',
};

async function routeMarketApiStub(context) {
  // Registered first on purpose: Playwright matches routes in reverse
  // registration order, so the specific token-detail route below wins.
  await context.route(/\/utility\/v\d+\/market\//, async (route) => {
    seenMarketApiRequests.add(new URL(route.request().url()).pathname);
    await route.fulfill({
      body: JSON.stringify({
        code: 0,
        // Covers the list-shaped market payloads (`data.list`, `data.items`,
        // k-line `data.points`) with empty-but-valid values.
        data: { data: [], items: [], list: [], points: [], total: 0 },
        message: '',
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
  await context.route(
    /\/utility\/v\d+\/market\/token\/detail/,
    async (route) => {
      seenMarketApiRequests.add(new URL(route.request().url()).pathname);
      await route.fulfill({
        body: JSON.stringify({
          code: 0,
          data: {
            // No websocket config on purpose: the detail page then keeps its
            // market data on the (stubbed) polling path and never opens a
            // socket.
            token: {
              address: marketSwapPanelToken.contractAddress,
              decimals: marketSwapPanelToken.decimals,
              holders: 1000,
              isNative: false,
              liquidity: '250000000',
              logoUrl: '',
              marketCap: '5000000000',
              name: marketSwapPanelToken.name,
              networkId: marketSwapPanelToken.networkId,
              price: '10',
              priceChange24hPercent: '1.5',
              supportSwap: { enable: true },
              symbol: marketSwapPanelToken.symbol,
              volume24h: '120000000',
            },
          },
          message: '',
        }),
        contentType: 'application/json',
        status: 200,
      });
    },
  );
}

function readBooleanEnv(name, fallbackValue) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallbackValue;
  }
  return ['1', 'true', 'yes'].includes(raw.toLowerCase());
}

function readPositiveNumberEnv(name, fallbackValue) {
  const rawValue = process.env[name];
  if (rawValue === undefined) return fallbackValue;
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return value;
}

function readJsonObjectEnv(name) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === '') return undefined;
  let parsed;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error(`${name} must be valid JSON`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${name} must be a JSON object`);
  }
  return parsed;
}

// Wall-time budget defaults are calibrated on a dev arm64 Mac at roughly 3-5x
// the maximum observed over 16 green cycles plus two fresh runs (2026-08-20);
// the per-budget env vars exist to raise them for slower CI machines.
const performanceBudgetDefinitions = [
  {
    // Observed p95: 6-17ms.
    defaultLimit: 100,
    envName: 'ACCOUNT_SELECTOR_E2E_ACTIVE_RELOAD_MUTEX_P95_MS',
    event: 'activeReloadResult',
    field: 'mutexWaitMs',
    statistic: 'p95',
  },
  {
    // Observed max: 162-318ms.
    defaultLimit: 1250,
    envName: 'ACCOUNT_SELECTOR_E2E_ACTIVE_RELOAD_MUTEX_MAX_MS',
    event: 'activeReloadResult',
    field: 'mutexWaitMs',
    statistic: 'max',
  },
  {
    defaultLimit: 500,
    envName: 'ACCOUNT_SELECTOR_E2E_ACTIVE_BUILD_P95_MS',
    event: 'activeBuildResult',
    field: 'bgTotalMs',
    statistic: 'p95',
  },
  {
    defaultLimit: 1200,
    envName: 'ACCOUNT_SELECTOR_E2E_SELECTION_STATE_TO_PAINT_P95_MS',
    event: 'providerSubtreePaint',
    field: 'selectionStateToPaintMs',
    statistic: 'p95',
  },
  {
    defaultLimit: 700,
    envName: 'ACCOUNT_SELECTOR_E2E_ACTIVE_STATE_TO_PAINT_P95_MS',
    event: 'providerSubtreePaint',
    field: 'activeStateToPaintMs',
    statistic: 'p95',
  },
  {
    defaultLimit: 250,
    envName: 'ACCOUNT_SELECTOR_E2E_PROVIDER_COMMIT_TO_PAINT_P95_MS',
    event: 'providerSubtreePaint',
    field: 'commitToPaintMs',
    statistic: 'p95',
  },
  {
    defaultLimit: 1500,
    envName: 'ACCOUNT_SELECTOR_E2E_ACTIVE_BUILD_MAX_MS',
    event: 'activeBuildResult',
    field: 'bgTotalMs',
    statistic: 'max',
  },
  {
    defaultLimit: 250,
    envName: 'ACCOUNT_SELECTOR_E2E_ACTIVE_BUILD_RPC_OVERHEAD_P95_MS',
    event: 'activeBuildResult',
    field: 'approximateRpcOverheadMs',
    statistic: 'p95',
  },
  {
    defaultLimit: 1000,
    envName: 'ACCOUNT_SELECTOR_E2E_ACTIVE_BUILD_RPC_OVERHEAD_MAX_MS',
    event: 'activeBuildResult',
    field: 'approximateRpcOverheadMs',
    statistic: 'max',
  },
  {
    // Observed p95: 58-140ms.
    defaultLimit: 500,
    envName: 'ACCOUNT_SELECTOR_E2E_ACTIVE_RELOAD_TOTAL_P95_MS',
    event: 'activeReloadResult',
    field: 'totalMs',
    statistic: 'p95',
  },
  {
    // Observed max: 350-413ms.
    defaultLimit: 1500,
    envName: 'ACCOUNT_SELECTOR_E2E_ACTIVE_RELOAD_TOTAL_MAX_MS',
    event: 'activeReloadResult',
    field: 'totalMs',
    statistic: 'max',
  },
  {
    defaultLimit: 1000,
    envName: 'ACCOUNT_SELECTOR_E2E_SELECTION_STATE_TO_COMMIT_P95_MS',
    event: 'providerSubtreeCommit',
    field: 'selectionStateToProviderCommitMs',
    statistic: 'p95',
  },
  {
    defaultLimit: 500,
    envName: 'ACCOUNT_SELECTOR_E2E_ACTIVE_STATE_TO_COMMIT_P95_MS',
    event: 'providerSubtreeCommit',
    field: 'activeStateToProviderCommitMs',
    statistic: 'p95',
  },
  {
    defaultLimit: 500,
    envName: 'ACCOUNT_SELECTOR_E2E_AVAILABLE_NETWORKS_P95_MS',
    event: 'availableNetworksResult',
    field: 'totalMs',
    statistic: 'p95',
  },
  {
    defaultLimit: 1500,
    envName: 'ACCOUNT_SELECTOR_E2E_AVAILABLE_NETWORKS_MAX_MS',
    event: 'availableNetworksResult',
    field: 'totalMs',
    statistic: 'max',
  },
  {
    defaultLimit: 500,
    envName: 'ACCOUNT_SELECTOR_E2E_AUTO_DERIVE_P95_MS',
    event: 'autoDeriveResult',
    field: 'totalMs',
    statistic: 'p95',
  },
  {
    defaultLimit: 1500,
    envName: 'ACCOUNT_SELECTOR_E2E_AUTO_DERIVE_MAX_MS',
    event: 'autoDeriveResult',
    field: 'totalMs',
    statistic: 'max',
  },
  {
    defaultLimit: 500,
    envName: 'ACCOUNT_SELECTOR_E2E_AUTO_DERIVE_SYNC_GLOBAL_P95_MS',
    event: 'autoDeriveResult',
    field: 'stageMs.syncGlobal',
    statistic: 'p95',
  },
  {
    defaultLimit: 1500,
    envName: 'ACCOUNT_SELECTOR_E2E_AUTO_DERIVE_SYNC_GLOBAL_MAX_MS',
    event: 'autoDeriveResult',
    field: 'stageMs.syncGlobal',
    statistic: 'max',
  },
  {
    // Observed p95: 41.6-51.3ms.
    defaultLimit: 250,
    envName: 'ACCOUNT_SELECTOR_E2E_PROVIDER_COMMIT_P95_MS',
    event: 'providerSubtreeCommit',
    field: 'actualDuration',
    statistic: 'p95',
  },
  {
    // Observed max: 70.9-86.8ms.
    defaultLimit: 400,
    envName: 'ACCOUNT_SELECTOR_E2E_PROVIDER_COMMIT_MAX_MS',
    event: 'providerSubtreeCommit',
    field: 'actualDuration',
    statistic: 'max',
  },
  {
    // Observed p95: 1ms in every recorded run; 150 still catches a stall.
    defaultLimit: 150,
    envName: 'ACCOUNT_SELECTOR_E2E_SELECTION_UPDATE_P95_MS',
    event: 'selectionUpdateResult',
    field: 'totalMs',
    statistic: 'p95',
  },
  {
    // Observed max: 647-738ms.
    defaultLimit: 3000,
    envName: 'ACCOUNT_SELECTOR_E2E_STORAGE_INIT_MAX_MS',
    event: 'storageInitResult',
    field: 'totalMs',
    statistic: 'max',
  },
].map((budget) => ({
  ...budget,
  limit: readPositiveNumberEnv(budget.envName, budget.defaultLimit),
}));

const fanoutBudgetDefinitions = [
  {
    defaultLimit: 6,
    envName: 'ACCOUNT_SELECTOR_E2E_ACTIVE_RELOAD_MAX_CONSUMERS',
    fanout: 'activeReloads',
    field: 'maxConsumersPerOperation',
  },
  {
    defaultLimit: 6,
    envName: 'ACCOUNT_SELECTOR_E2E_SELECTION_MAX_CONSUMERS',
    fanout: 'selectionTransitions',
    field: 'maxConsumersPerOperation',
  },
].map((budget) => ({
  ...budget,
  limit: readPositiveNumberEnv(budget.envName, budget.defaultLimit),
}));

const eventCountBudgetDefinitions = [
  {
    defaultLimit: 180,
    envName: 'ACCOUNT_SELECTOR_E2E_AVAILABLE_NETWORKS_REQUEST_MAX_COUNT',
    event: 'availableNetworksRequested',
  },
  {
    defaultLimit: 140,
    envName: 'ACCOUNT_SELECTOR_E2E_AUTO_DERIVE_REQUEST_MAX_COUNT',
    event: 'autoDeriveRequested',
  },
  {
    defaultLimit: 260,
    envName: 'ACCOUNT_SELECTOR_E2E_ACTIVE_RELOAD_MAX_COUNT',
    event: 'activeReloadStart',
  },
  {
    defaultLimit: 570,
    envName: 'ACCOUNT_SELECTOR_E2E_SELECTION_UPDATE_MAX_COUNT',
    event: 'selectionUpdateRequested',
  },
].map((budget) => ({
  ...budget,
  limit: readPositiveNumberEnv(budget.envName, budget.defaultLimit),
}));

// Per-phase Provider render-count budgets: the direct expression of the
// account-selector render optimization. Each entry caps how many times a
// perf-labeled Provider subtree commits inside one phase; runTotals cap the
// whole post-reload window. A budgeted (phase, debugName) pair that is
// MISSING from a run also fails — silently losing an instrumented Provider
// must not pass, mirroring the wall-time budgets where a never-observed event
// fails its budget.
//
// Calibration: two back-to-back green runs on a dev arm64 Mac (2026-08-20).
// Commit counts are scheduling-dependent but not load-sensitive — they jitter
// roughly 5-15% run to run — so each limit is the observed max plus ~25%
// headroom (+2 absolute for counts of 5 or less), widened further only for
// pairs whose 16-cycle history showed larger jitter. slowCommitCount
// (commits >16ms actualDuration) IS load-sensitive: a busy machine turns fast
// commits into slow ones without changing their number. Slow limits therefore
// carry at least 3x headroom (minimum slack +5) and are budgeted per phase
// total, not per debug name.
//
// Override or extend via ACCOUNT_SELECTOR_E2E_PHASE_COMMIT_BUDGETS: a JSON
// object of this same shape whose entries merge over these defaults.
const phaseRenderBudgetDefaults = {
  phases: {
    allNetworks: {
      commitCountByDebugName: {
        'account-selector-modal': 100,
        'home-page': 220,
        'perp-header': 7,
        'perp-route': 6,
        'swap-route': 48,
        'unified-network-selector': 109,
      },
      slowCommitCount: 174,
    },
    autoSelect: {
      commitCountByDebugName: {
        'account-selector-modal': 94,
        'home-page': 162,
        'perp-header': 9,
        'perp-route': 8,
        'swap-route': 57,
      },
      slowCommitCount: 90,
    },
    bulkSendRemoval: {
      commitCountByDebugName: {
        'account-selector-modal': 37,
        // Verification runs reached 45 against calibration samples of 37-38,
        // so this entry carries observed max + 25% instead of sample max +25%.
        'bulk-send-address-input': 57,
        'home-page': 99,
        'perp-header': 4,
        'perp-route': 4,
        'swap-route': 32,
      },
      slowCommitCount: 52,
    },
    dapp: {
      commitCountByDebugName: {
        'account-selector-modal': 49,
        'dapp-connection-modal': 20,
        'home-page': 35,
        'swap-route': 14,
      },
      slowCommitCount: 48,
    },
    dappMultiOrigin: {
      commitCountByDebugName: {
        'account-selector-modal': 42,
        'dapp-connection-list:https://account-selector-e2e.test': 30,
        'dapp-connection-list:https://account-selector-secondary-e2e.test': 35,
        'dapp-connection-modal': 20,
        'home-page': 29,
        'swap-route': 12,
      },
      slowCommitCount: 39,
    },
    dappOps: {
      commitCountByDebugName: {
        'dapp-connection-list:https://account-selector-e2e.test': 18,
        'dapp-connection-list:https://account-selector-secondary-e2e.test': 20,
        'dapp-connection-modal': 59,
        'home-page': 72,
        'swap-route': 17,
      },
      slowCommitCount: 69,
    },
    initialization: {
      commitCountByDebugName: {
        'home-page': 99,
        'perp-header': 4,
        'perp-route': 5,
        'swap-route': 7,
      },
      slowCommitCount: 36,
    },
    marketSwapPanel: {
      commitCountByDebugName: {
        'account-selector-modal': 72,
        'home-page': 163,
        'perp-header': 7,
        'perp-route': 6,
        'swap-route': 45,
        'unified-network-selector': 65,
      },
      slowCommitCount: 135,
    },
    multiNumCustomNetwork: {
      commitCountByDebugName: {
        'home-page': 12,
        'swap-route': 37,
      },
      slowCommitCount: 50,
    },
    perps: {
      commitCountByDebugName: {
        'account-selector-modal': 49,
        'home-page': 59,
        'perp-header': 28,
        'perp-route': 113,
        'swap-route': 6,
      },
      slowCommitCount: 75,
    },
    postPerpsReset: {
      commitCountByDebugName: {
        'home-page': 73,
        'perp-header': 5,
        'perp-route': 5,
        'swap-route': 7,
      },
      slowCommitCount: 24,
    },
    sendAddressInput: {
      commitCountByDebugName: {
        'home-page': 50,
        'send-address-input': 73,
      },
      slowCommitCount: 12,
    },
    stress: {
      commitCountByDebugName: {
        'account-selector-modal': 818,
        'dapp-connection-modal': 165,
        'home-page': 1608,
        'perp-header': 60,
        'perp-route': 88,
        'swap-route': 457,
        'unified-network-selector': 589,
      },
      slowCommitCount: 1479,
    },
    swapInlineDerive: {
      commitCountByDebugName: {
        'account-selector-modal': 67,
        'home-page': 113,
        'perp-header': 6,
        'perp-route': 8,
        'swap-route': 62,
        'unified-network-selector': 27,
      },
      slowCommitCount: 171,
    },
  },
  runTotals: {
    commitCount: 6300,
    slowCommitCount: 2550,
  },
};

function mergePhaseRenderBudgets(defaults, overrides) {
  if (!overrides) return defaults;
  const merged = {
    phases: { ...defaults.phases },
    runTotals: { ...defaults.runTotals, ...overrides.runTotals },
  };
  for (const [phase, phaseOverride] of Object.entries(overrides.phases || {})) {
    const basePhase = merged.phases[phase] || { commitCountByDebugName: {} };
    merged.phases[phase] = {
      commitCountByDebugName: {
        ...basePhase.commitCountByDebugName,
        ...phaseOverride.commitCountByDebugName,
      },
      slowCommitCount:
        phaseOverride.slowCommitCount ?? basePhase.slowCommitCount,
    };
  }
  return merged;
}

const phaseRenderBudgets = mergePhaseRenderBudgets(
  phaseRenderBudgetDefaults,
  readJsonObjectEnv('ACCOUNT_SELECTOR_E2E_PHASE_COMMIT_BUDGETS'),
);

function evaluatePhaseRenderBudgets({ phaseSummaries, summary }) {
  const results = [];
  for (const [phase, phaseBudget] of Object.entries(
    phaseRenderBudgets.phases,
  )) {
    const providerRenders = phaseSummaries[phase]?.providerRenders;
    for (const [debugName, limit] of Object.entries(
      phaseBudget.commitCountByDebugName,
    )) {
      const observed = providerRenders?.byDebugName?.[debugName]?.commitCount;
      results.push({
        debugName,
        limit,
        metric: 'commitCount',
        observed,
        passed: typeof observed === 'number' && observed <= limit,
        phase,
        scope: 'phase',
      });
    }
    if (typeof phaseBudget.slowCommitCount === 'number') {
      const observed = providerRenders?.slowCommitCount;
      results.push({
        limit: phaseBudget.slowCommitCount,
        metric: 'slowCommitCount',
        observed,
        passed:
          typeof observed === 'number' &&
          observed <= phaseBudget.slowCommitCount,
        phase,
        scope: 'phase',
      });
    }
  }
  for (const metric of ['commitCount', 'slowCommitCount']) {
    const limit = phaseRenderBudgets.runTotals[metric];
    if (typeof limit === 'number') {
      const observed = summary.providerRenders[metric];
      results.push({
        limit,
        metric,
        observed,
        passed: typeof observed === 'number' && observed <= limit,
        scope: 'run-total',
      });
    }
  }
  return results;
}

function assertPhaseRenderBudgets(results) {
  const failures = results.filter((result) => !result.passed);
  assert.deepEqual(
    failures.map(({ debugName, limit, metric, observed, phase, scope }) => ({
      debugName,
      limit,
      metric,
      observed,
      phase,
      scope,
    })),
    [],
    'AccountSelector phase render budget exceeded',
  );
}

function log(message) {
  console.log(`[account-selector-e2e] ${message}`);
}

function collectCdpStackFrames(stackTrace, frames = []) {
  let current = stackTrace;
  while (current && frames.length < 40) {
    for (const frame of current.callFrames || []) {
      frames.push({
        columnNumber: frame.columnNumber,
        functionName: frame.functionName,
        lineNumber: frame.lineNumber,
        url: frame.url,
      });
      if (frames.length >= 40) break;
    }
    current = current.parent;
  }
  return frames;
}

function recordFanout(fanoutMap, { consumer, id, reason }) {
  if (typeof id !== 'number') return;
  const operation = fanoutMap.get(id) || {
    consumerCommitCounts: new Map(),
    id,
    reason: reason || 'unspecified',
  };
  operation.consumerCommitCounts.set(
    consumer,
    (operation.consumerCommitCounts.get(consumer) || 0) + 1,
  );
  fanoutMap.set(id, operation);
}

function summarizeFanout(fanoutMap) {
  const duplicateConsumers = [];
  const reasonCounts = {};
  let maxCommitsPerConsumer = 0;
  let maxConsumersPerOperation = 0;
  let totalConsumerCommits = 0;
  for (const operation of fanoutMap.values()) {
    reasonCounts[operation.reason] = (reasonCounts[operation.reason] || 0) + 1;
    maxConsumersPerOperation = Math.max(
      maxConsumersPerOperation,
      operation.consumerCommitCounts.size,
    );
    for (const [consumer, commitCount] of operation.consumerCommitCounts) {
      totalConsumerCommits += commitCount;
      maxCommitsPerConsumer = Math.max(maxCommitsPerConsumer, commitCount);
      if (commitCount > 1) {
        duplicateConsumers.push({
          commitCount,
          consumer,
          id: operation.id,
          reason: operation.reason,
        });
      }
    }
  }
  return {
    duplicateConsumers,
    maxCommitsPerConsumer,
    maxConsumersPerOperation,
    operationCount: fanoutMap.size,
    reasonCounts,
    totalConsumerCommits,
  };
}

function buildTraceSummary(events) {
  const eventCounts = {};
  const outcomeCounts = {};
  const activeReloadFanout = new Map();
  const selectionTransitionFanout = new Map();
  const providerRenders = {
    byDebugName: {},
    commitCount: 0,
    initialSnapshotCommitCount: 0,
    slowCommitCount: 0,
    totalActualDuration: 0,
    trackedCommitCount: 0,
    untrackedCommitCount: 0,
  };

  for (const event of events) {
    eventCounts[event.event] = (eventCounts[event.event] || 0) + 1;
    if (typeof event.outcome === 'string') {
      const key = `${event.event}:${event.outcome}`;
      outcomeCounts[key] = (outcomeCounts[key] || 0) + 1;
    }
    if (
      event.event === 'providerSubtreeCommit' ||
      event.event === 'providerUntrackedCommitBatch'
    ) {
      const isBatch = event.event === 'providerUntrackedCommitBatch';
      const commitCount = isBatch ? event.commitCount : 1;
      const duration = isBatch
        ? event.totalActualDuration
        : event.actualDuration;
      const safeCommitCount = typeof commitCount === 'number' ? commitCount : 0;
      const safeDuration = typeof duration === 'number' ? duration : 0;
      const debugName =
        typeof event.perfDebugName === 'string'
          ? event.perfDebugName
          : `unlabeled:${event.sceneName || 'unknown'}`;
      if (
        event.event === 'providerSubtreeCommit' &&
        event.attribution === 'tracked-account-state'
      ) {
        for (const stateChange of event.stateChanges || []) {
          const consumer = `${debugName}:num-${stateChange.num}`;
          recordFanout(selectionTransitionFanout, {
            consumer,
            id: stateChange.selectionTransitionId,
            reason: stateChange.selectionReason,
          });
          recordFanout(activeReloadFanout, {
            consumer,
            id: stateChange.activeReloadId,
            reason: stateChange.activeTrigger,
          });
        }
      }
      const debugSummary = providerRenders.byDebugName[debugName] || {
        commitCount: 0,
        initialSnapshotCommitCount: 0,
        slowCommitCount: 0,
        totalActualDuration: 0,
        trackedCommitCount: 0,
        untrackedCommitCount: 0,
      };
      debugSummary.commitCount += safeCommitCount;
      debugSummary.totalActualDuration += safeDuration;
      providerRenders.byDebugName[debugName] = debugSummary;
      providerRenders.commitCount += safeCommitCount;
      providerRenders.totalActualDuration += safeDuration;
      if (
        event.attribution === 'initial-provider-snapshot' ||
        event.attribution === 'scope-reset-snapshot'
      ) {
        debugSummary.initialSnapshotCommitCount += safeCommitCount;
        providerRenders.initialSnapshotCommitCount += safeCommitCount;
      } else if (isBatch || event.trackedStateChanged !== true) {
        debugSummary.untrackedCommitCount += safeCommitCount;
        providerRenders.untrackedCommitCount += safeCommitCount;
      } else {
        debugSummary.trackedCommitCount += safeCommitCount;
        providerRenders.trackedCommitCount += safeCommitCount;
      }
      if (event.slow === true) {
        debugSummary.slowCommitCount += 1;
        providerRenders.slowCommitCount += 1;
      }
    }
  }

  const { timingSummary, timingSummaryByEvent } =
    collectEventTimingSummary(events);

  return {
    eventCounts,
    fanout: {
      activeReloads: summarizeFanout(activeReloadFanout),
      selectionTransitions: summarizeFanout(selectionTransitionFanout),
    },
    outcomeCounts,
    providerRenders,
    timingSummary,
    timingSummaryByEvent,
    totalEvents: events.length,
  };
}

function evaluatePerformanceBudgets(summary) {
  return performanceBudgetDefinitions.map((budget) => {
    const observed =
      summary.timingSummaryByEvent[budget.event]?.[budget.field]?.[
        budget.statistic
      ];
    return {
      envName: budget.envName,
      event: budget.event,
      field: budget.field,
      limit: budget.limit,
      observed,
      passed: typeof observed === 'number' && observed <= budget.limit,
      statistic: budget.statistic,
    };
  });
}

function assertPerformanceBudgets(results) {
  const failures = results.filter((result) => !result.passed);
  assert.deepEqual(
    failures.map(({ event, field, limit, observed, statistic }) => ({
      event,
      field,
      limit,
      observed,
      statistic,
    })),
    [],
    'AccountSelector performance budget exceeded',
  );
}

function assertFanoutBudgets(results) {
  const failures = results.filter((result) => !result.passed);
  assert.deepEqual(
    failures.map(({ fanout, field, limit, observed }) => ({
      fanout,
      field,
      limit,
      observed,
    })),
    [],
    'AccountSelector update fan-out budget exceeded',
  );
}

function assertEventCountBudgets(results) {
  const failures = results.filter((result) => !result.passed);
  assert.deepEqual(
    failures.map(({ event, limit, observed }) => ({ event, limit, observed })),
    [],
    'AccountSelector hook/action execution budget exceeded',
  );
}

function assertTraceHealth({ droppedCount, events, phase }) {
  assert.equal(droppedCount, 0, `${phase}: trace buffer dropped events`);
  const errorEvents = events.filter((event) => {
    const outcome = typeof event.outcome === 'string' ? event.outcome : '';
    return (
      outcome === 'error' ||
      outcome === 'error-fallback' ||
      outcome === 'partial'
    );
  });
  assert.deepEqual(
    errorEvents.map((event) => ({
      event: event.event,
      outcome: event.outcome,
    })),
    [],
    `${phase}: AccountSelector trace contains error outcomes`,
  );
  const snapshotsWithCausalMetadata = events.filter(
    (event) =>
      event.event === 'providerSubtreeCommit' &&
      (event.attribution === 'initial-provider-snapshot' ||
        event.attribution === 'scope-reset-snapshot') &&
      event.stateChanges?.some(
        (change) =>
          change.selectionTransitionId !== undefined ||
          change.activeReloadId !== undefined,
      ),
  );
  assert.deepEqual(
    snapshotsWithCausalMetadata.map((event) => ({
      event: event.event,
      providerInstanceId: event.providerInstanceId,
    })),
    [],
    `${phase}: provider snapshots must not inherit stale transition metadata`,
  );
}

const requestResultPairs = [
  ['accountSelectRequested', 'accountSelectResult', 'operationId'],
  ['activeReloadStart', 'activeReloadResult', 'reloadId'],
  ['autoDeriveRequested', 'autoDeriveResult', 'operationId'],
  ['autoDeriveSyncRequested', 'autoDeriveSyncResult', 'operationId'],
  ['autoSelectAccountRequested', 'autoSelectAccountResult', 'operationId'],
  ['availableNetworksRequested', 'availableNetworksResult', 'operationId'],
  ['crossSceneSyncRequested', 'crossSceneSyncResult', 'operationId'],
  ['manualSceneSyncRequested', 'manualSceneSyncResult', 'operationId'],
  ['selectionUpdateRequested', 'selectionUpdateResult', 'attemptId'],
  ['storageInitRequested', 'storageInitResult', 'operationId'],
];

function countUnsettledRequests(events) {
  let unsettled = 0;
  for (const [requestEvent, resultEvent, key] of requestResultPairs) {
    const resultCounts = new Map();
    for (const event of events) {
      if (event.event === resultEvent) {
        resultCounts.set(event[key], (resultCounts.get(event[key]) || 0) + 1);
      }
    }
    for (const event of events) {
      if (event.event === requestEvent && resultCounts.get(event[key]) !== 1) {
        unsettled += 1;
      }
    }
  }
  return unsettled;
}

function assertTraceRequestResultPairs(events) {
  for (const [requestEvent, resultEvent, key] of requestResultPairs) {
    const requests = events.filter((event) => event.event === requestEvent);
    const results = events.filter((event) => event.event === resultEvent);
    const requestCounts = new Map();
    const resultCounts = new Map();
    for (const request of requests) {
      requestCounts.set(
        request[key],
        (requestCounts.get(request[key]) || 0) + 1,
      );
    }
    for (const result of results) {
      resultCounts.set(result[key], (resultCounts.get(result[key]) || 0) + 1);
    }
    const unmatched = requests.filter(
      (request) => resultCounts.get(request[key]) !== 1,
    );
    assert.deepEqual(
      unmatched.map((request) => ({ event: requestEvent, id: request[key] })),
      [],
      `${requestEvent}: every request must have exactly one ${resultEvent}`,
    );
    const orphaned = results.filter(
      (result) => requestCounts.get(result[key]) !== 1,
    );
    assert.deepEqual(
      orphaned.map((result) => ({ event: resultEvent, id: result[key] })),
      [],
      `${resultEvent}: every result must have exactly one ${requestEvent}`,
    );
  }
}

function assertStaleReloadPostProcessPairs(events) {
  const staleOutcomes = new Set([
    'stale-after-build',
    'stale-before-build',
    'stale-schedule-before-build',
  ]);
  const staleResults = events.filter(
    (event) =>
      event.event === 'activeReloadResult' &&
      event.scheduleId !== undefined &&
      staleOutcomes.has(event.outcome),
  );
  const postProcessCounts = new Map();
  for (const event of events) {
    if (
      event.event === 'activeReloadPostProcessResult' &&
      event.outcome === 'skip-stale-action'
    ) {
      postProcessCounts.set(
        `${event.scheduleId}:${event.actionOutcome}`,
        (postProcessCounts.get(`${event.scheduleId}:${event.actionOutcome}`) ||
          0) + 1,
      );
    }
  }
  const unmatched = staleResults.filter(
    (event) =>
      postProcessCounts.get(`${event.scheduleId}:${event.outcome}`) !== 1,
  );
  assert.deepEqual(
    unmatched.map((event) => ({
      outcome: event.outcome,
      scheduleId: event.scheduleId,
    })),
    [],
    'Every stale scheduled reload must skip post-processing exactly once',
  );
}

async function waitForAppReady(page) {
  await page.waitForFunction(
    () =>
      Boolean(
        globalThis.$$appGlobals?.$backgroundApiProxy?.serviceE2E
          ?.configureAccountSelectorPerfE2E &&
        globalThis.$$appGlobals?.$$platformEnv,
      ),
    undefined,
    { timeout: pageTimeoutMs },
  );
  const mode = await page.evaluate(() => ({
    isE2E: globalThis.$$appGlobals.$$platformEnv.isE2E,
    isWebDappMode: globalThis.$$appGlobals.$$platformEnv.isWebDappMode,
  }));
  assert.equal(mode.isE2E, true, 'Web renderer must run with E2E_MODE=true');
  assert.equal(
    mode.isWebDappMode,
    false,
    'CDP init script must switch Web to wallet mode before app bootstrap',
  );
}

async function configurePerfTrace(page, devOnlyPassword) {
  const result = await page.evaluate(
    ({ password }) =>
      globalThis.$$appGlobals.$backgroundApiProxy.serviceE2E.configureAccountSelectorPerfE2E(
        {
          $$devOnlyPassword: password,
          enabled: true,
        },
      ),
    { password: devOnlyPassword },
  );
  assert.equal(result.enabled, true, 'AccountSelector perf logger is disabled');
}

// Disabling attribution reproduces the production perf wiring (empty
// attribution WeakMaps, no perf traces) while isE2E stays true, so scenarios
// can verify behavior that must not depend on perf metadata.
async function configurePerfAttribution(page, devOnlyPassword, enabled) {
  const result = await page.evaluate(
    ({ attributionEnabled, password }) =>
      globalThis.$$appGlobals.$backgroundApiProxy.serviceE2E.configureAccountSelectorPerfE2E(
        {
          $$devOnlyPassword: password,
          attributionEnabled,
          enabled: true,
        },
      ),
    { attributionEnabled: enabled, password: devOnlyPassword },
  );
  assert.equal(
    result.attributionEnabled,
    enabled,
    'AccountSelector perf attribution override was not applied',
  );
}

async function drainPerfTrace(page, devOnlyPassword) {
  return page.evaluate(
    ({ password }) =>
      globalThis.$$appGlobals.$backgroundApiProxy.serviceE2E.drainAccountSelectorPerfE2ETrace(
        { $$devOnlyPassword: password },
      ),
    { password: devOnlyPassword },
  );
}

// Draining is destructive. The drains that only exist to isolate the next
// assertion window still delete whatever else was buffered, so a request kept
// in one window can have its result dropped with an unread one and read as a
// missing result. Retain those events instead; the per-window budget assertions
// keep their narrow window, and the whole-run pair check gets the full picture.
// Reset per page load: the operation id counter restarts with the runtime, so
// residuals from two runtimes must never be merged.
let residualTraceEvents = [];
let residualTraceDroppedCount = 0;

async function drainResidualPerfTrace(page, devOnlyPassword) {
  const trace = await drainPerfTrace(page, devOnlyPassword);
  residualTraceEvents.push(...trace.events);
  residualTraceDroppedCount += trace.droppedCount;
  return trace;
}

function takeResidualTrace() {
  const trace = {
    droppedCount: residualTraceDroppedCount,
    events: residualTraceEvents,
  };
  residualTraceEvents = [];
  residualTraceDroppedCount = 0;
  return trace;
}

// A reload started just before the last window closes reports its result a
// background round trip later. Wait for the operations already seen to report
// before asserting the pairs, so the assertion measures the app lifecycle and
// not where the final drain landed. A result that never arrives still fails:
// the loop gives up at the deadline and the assertion runs on what it has.
async function drainUntilRequestsSettled(
  page,
  devOnlyPassword,
  events,
  timeoutMs = 5000,
) {
  const collected = { droppedCount: 0, events: [] };
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const next = await drainPerfTrace(page, devOnlyPassword);
    collected.droppedCount += next.droppedCount;
    collected.events.push(...next.events);
    if (!countUnsettledRequests([...events, ...collected.events])) {
      return collected;
    }
    if (Date.now() >= deadline) {
      return collected;
    }
    await page.waitForTimeout(100);
  }
}

async function collectPerfTraceUntil(
  page,
  devOnlyPassword,
  predicate,
  timeoutMs = pageTimeoutMs,
) {
  const collected = { droppedCount: 0, events: [] };
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const next = await drainPerfTrace(page, devOnlyPassword);
    collected.droppedCount += next.droppedCount;
    collected.events.push(...next.events);
    if (predicate(collected.events)) {
      await page.waitForTimeout(350);
      const settled = await drainPerfTrace(page, devOnlyPassword);
      collected.droppedCount += settled.droppedCount;
      collected.events.push(...settled.events);
      return collected;
    }
    await page.waitForTimeout(100);
  }
  return collected;
}

function mergePerfTrace(...traces) {
  return {
    droppedCount: traces.reduce(
      (total, trace) => total + trace.droppedCount,
      0,
    ),
    events: traces.flatMap((trace) => trace.events),
  };
}

async function collectSelectionOperationTrace(
  page,
  devOnlyPassword,
  { expectActiveReload, num = 0, reason, sceneName = 'home' },
) {
  if (!expectActiveReload) {
    await page.waitForTimeout(350);
    return drainPerfTrace(page, devOnlyPassword);
  }
  return collectPerfTraceUntil(page, devOnlyPassword, (events) =>
    events.some(
      (event) =>
        event.event === 'activeReloadResult' &&
        event.num === num &&
        event.reason === reason &&
        event.sceneName === sceneName,
    ),
  );
}

async function createFixture(page, devOnlyPassword) {
  return page.evaluate(
    async ({
      accountCreationNetworkIds,
      addressNetworkIds,
      password,
      walletFixtures,
    }) => {
      const api = globalThis.$$appGlobals.$backgroundApiProxy;
      const e2eParams = { $$devOnlyPassword: password };
      await api.serviceE2E.clearWalletsAndAccounts(e2eParams);
      await api.serviceE2E.clearPassword(e2eParams);

      const rawPassword = `E2E-${globalThis.crypto.randomUUID()}-aA1!`;
      const encodedPassword = await api.servicePassword.encodeSensitiveText({
        text: rawPassword,
      });
      await api.servicePassword.setPassword(encodedPassword, 'password');

      const waitForIndexedAccount = async (indexedAccountId) => {
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const indexedAccount = await api.serviceAccount.getIndexedAccountSafe(
            {
              id: indexedAccountId,
            },
          );
          if (indexedAccount) {
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error(
          `Indexed account ${indexedAccountId} was not readable after creation`,
        );
      };

      const createWallet = async ({ accountNames, fixtureId, name }) => {
        const encodedMnemonic =
          await api.serviceE2E.getAccountSelectorE2EEncodedMnemonic({
            ...e2eParams,
            fixtureId,
          });
        const created = await api.serviceAccount.createHDWallet({
          isWalletBackedUp: true,
          mnemonic: encodedMnemonic,
          name,
        });
        await waitForIndexedAccount(created.indexedAccount.id);
        const second = await api.serviceAccount.addHDNextIndexedAccount({
          walletId: created.wallet.id,
        });
        const indexedAccountIds = [
          created.indexedAccount.id,
          second.indexedAccountId,
        ];

        for (
          let accountIndex = 0;
          accountIndex < indexedAccountIds.length;
          accountIndex += 1
        ) {
          const indexedAccountId = indexedAccountIds[accountIndex];
          await waitForIndexedAccount(indexedAccountId);
          await api.serviceAccount.setAccountName({
            indexedAccountId,
            name: accountNames[accountIndex],
            skipEventEmit: true,
            skipSaveLocalSyncItem: true,
          });
          const renamedAccount = await api.serviceAccount.getIndexedAccountSafe(
            {
              id: indexedAccountId,
            },
          );
          if (renamedAccount?.name !== accountNames[accountIndex]) {
            throw new Error(
              `Expected account ${indexedAccountId} to be named ${accountNames[accountIndex]}, received ${renamedAccount?.name}`,
            );
          }
          for (const networkId of accountCreationNetworkIds) {
            const deriveItems =
              await api.serviceNetwork.getDeriveInfoItemsOfNetwork({
                networkId,
              });
            for (const deriveItem of deriveItems) {
              await api.serviceAccount.addHDOrHWAccounts({
                deriveType: deriveItem.value,
                indexedAccountId,
                networkId,
                walletId: created.wallet.id,
              });
            }
          }
        }
        const savedWallet = await api.serviceAccount.getWalletSafe({
          walletId: created.wallet.id,
        });
        if (savedWallet?.name !== name) {
          throw new Error(
            `Expected wallet ${created.wallet.id} to be named ${name}, received ${savedWallet?.name}`,
          );
        }
        return {
          fixtureId,
          indexedAccountIds,
          walletId: created.wallet.id,
        };
      };

      const wallets = [];
      for (const walletFixture of walletFixtures) {
        wallets.push(await createWallet(walletFixture));
      }

      const addressFixtures = {};
      for (const wallet of wallets) {
        addressFixtures[wallet.fixtureId] = {};
        for (
          let accountIndex = 0;
          accountIndex < wallet.indexedAccountIds.length;
          accountIndex += 1
        ) {
          const indexedAccountId = wallet.indexedAccountIds[accountIndex];
          const accountAddresses = {};
          addressFixtures[wallet.fixtureId][accountIndex] = accountAddresses;
          for (const networkId of addressNetworkIds) {
            const deriveItems =
              await api.serviceNetwork.getDeriveInfoItemsOfNetwork({
                networkId,
              });
            const networkAddresses = {};
            accountAddresses[networkId] = networkAddresses;
            for (const deriveItem of deriveItems) {
              const { accounts } =
                await api.serviceAccount.getAccountsByIndexedAccounts({
                  deriveType: deriveItem.value,
                  indexedAccountIds: [indexedAccountId],
                  networkId,
                });
              const account = accounts[0];
              if (!account?.address) {
                throw new Error(
                  `Missing ${networkId}/${deriveItem.value} address for ${wallet.fixtureId} account ${accountIndex}`,
                );
              }
              networkAddresses[deriveItem.value] = account.address;
            }
          }
        }
      }
      return { addressFixtures, rawPassword, wallets };
    },
    {
      addressNetworkIds: expectedNetworks,
      accountCreationNetworkIds: defaultAccountCreationNetworkIds,
      password: devOnlyPassword,
      walletFixtures: accountSelectorE2EWalletFixtures,
    },
  );
}

// A page reload restarts the single web runtime and with it the in-memory
// wallet password cache (ServicePassword.cachedPassword). The first
// key-deriving call after a reload would then raise a passcode prompt dialog
// that nothing in the suite can answer (observed with the BulkSend perf-off
// account creation). Re-verify the fixture password through the real
// verifyPassword path — the same thing a user unlocking does — so the cache
// matches the pre-reload state.
async function restoreWalletPasswordCache(page, fixture) {
  await page.evaluate(
    async ({ rawPassword }) => {
      const api = globalThis.$$appGlobals.$backgroundApiProxy;
      const encoded = await api.servicePassword.encodeSensitiveText({
        text: rawPassword,
      });
      await api.servicePassword.verifyPassword({
        password: encoded,
        passwordMode: 'password',
        skipPostVerifyBackgroundTasks: true,
      });
    },
    { rawPassword: fixture.rawPassword },
  );
}

async function readPersistedSelection(
  page,
  sceneName = 'home',
  num = 0,
  sceneUrl,
) {
  return page.evaluate(
    async ({ scene, selectionNum, selectionSceneUrl }) => {
      const simpleDb = globalThis.$$appGlobals.$backgroundApiProxy.simpleDb;
      if (scene === 'discover' && selectionSceneUrl) {
        const dappMap = await simpleDb.dappConnection.getAccountSelectorMap({
          sceneUrl: selectionSceneUrl,
        });
        return dappMap?.[selectionNum];
      }
      return simpleDb.accountSelector.getSelectedAccount({
        num: selectionNum,
        sceneName: scene,
        sceneUrl: selectionSceneUrl,
      });
    },
    { scene: sceneName, selectionNum: num, selectionSceneUrl: sceneUrl },
  );
}

async function readAccountSelectorStateSnapshot(
  page,
  { num = 0, sceneName = 'home', sceneUrl },
) {
  return page.evaluate(
    ({ selectionNum, selectionSceneName, selectionSceneUrl }) => {
      const accessor =
        globalThis.$$appGlobals.$$accountSelectorE2EStateAccessor;
      if (!accessor?.getSnapshot) {
        throw new Error('AccountSelector E2E state accessor is unavailable');
      }
      return accessor.getSnapshot({
        num: selectionNum,
        sceneName: selectionSceneName,
        sceneUrl: selectionSceneUrl,
      });
    },
    {
      selectionNum: num,
      selectionSceneName: sceneName,
      selectionSceneUrl: sceneUrl,
    },
  );
}

function getExpectedAccountFixture(target) {
  const walletFixture = accountSelectorE2EWalletFixtures.find(
    (item) => item.fixtureId === target.fixtureId,
  );
  assert.ok(walletFixture, `Unknown wallet fixture ${target.fixtureId}`);
  const accountName = walletFixture.accountNames[target.index];
  assert.ok(
    accountName,
    `Missing account name for ${target.fixtureId}/${target.index}`,
  );
  return { accountName, walletName: walletFixture.name };
}

function shortenAddress(address) {
  return address.length <= 14
    ? address
    : `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function findFixtureTarget(fixture, selection) {
  for (const wallet of fixture.wallets) {
    const index = wallet.indexedAccountIds.indexOf(selection?.indexedAccountId);
    if (wallet.walletId === selection?.walletId && index >= 0) {
      return {
        fixtureId: wallet.fixtureId,
        index,
        indexedAccountId: wallet.indexedAccountIds[index],
        walletId: wallet.walletId,
      };
    }
  }
  assert.fail(
    `Selection does not match an E2E fixture: ${selection?.walletId}/${selection?.indexedAccountId}`,
  );
}

async function assertAccountSelectorStateConsistent(
  page,
  target,
  {
    assertPersistence = true,
    assertUI = true,
    // All Networks is opt-in: a caller that expects it gets the exact
    // all-networks state shape asserted, and every other caller fails loudly
    // if the app drifted into All Networks on its own.
    expectAllNetworks = false,
    num = 0,
    sceneName = 'home',
    sceneUrl,
  } = {},
) {
  await readAccountSelectorStateSnapshot(page, { num, sceneName, sceneUrl });
  try {
    await page.waitForFunction(
      ({
        expectedIndexedAccountId,
        expectedWalletId,
        selectionNum,
        selectionSceneName,
        selectionSceneUrl,
      }) => {
        const snapshot =
          globalThis.$$appGlobals.$$accountSelectorE2EStateAccessor?.getSnapshot?.(
            {
              num: selectionNum,
              sceneName: selectionSceneName,
              sceneUrl: selectionSceneUrl,
            },
          );
        return Boolean(
          snapshot?.active?.ready &&
          snapshot.selected?.walletId === expectedWalletId &&
          snapshot.selected?.indexedAccountId === expectedIndexedAccountId &&
          snapshot.active?.walletId === snapshot.selected?.walletId &&
          snapshot.active?.indexedAccountId ===
            snapshot.selected?.indexedAccountId &&
          snapshot.active?.networkId === snapshot.selected?.networkId &&
          snapshot.active?.deriveType === snapshot.selected?.deriveType,
        );
      },
      {
        expectedIndexedAccountId: target.indexedAccountId,
        expectedWalletId: target.walletId,
        selectionNum: num,
        selectionSceneName: sceneName,
        selectionSceneUrl: sceneUrl,
      },
      { timeout: pageTimeoutMs },
    );
  } catch (error) {
    const [persisted, snapshot] = await Promise.all([
      assertPersistence
        ? readPersistedSelection(page, sceneName, num, sceneUrl)
        : undefined,
      readAccountSelectorStateSnapshot(page, { num, sceneName, sceneUrl }),
    ]);
    throw new Error(
      `${sceneName} AccountSelector state did not converge: ${JSON.stringify({
        active: snapshot?.active
          ? {
              deriveType: snapshot.active.deriveType,
              indexedAccountId: snapshot.active.indexedAccountId,
              networkId: snapshot.active.networkId,
              ready: snapshot.active.ready,
              walletId: snapshot.active.walletId,
            }
          : undefined,
        persisted,
        selected: snapshot?.selected,
        target: {
          indexedAccountId: target.indexedAccountId,
          walletId: target.walletId,
        },
      })}`,
      { cause: error },
    );
  }

  const [persisted, snapshot] = await Promise.all([
    assertPersistence
      ? readPersistedSelection(page, sceneName, num, sceneUrl)
      : undefined,
    readAccountSelectorStateSnapshot(page, { num, sceneName, sceneUrl }),
  ]);
  const selected = snapshot?.selected;
  const active = snapshot?.active;
  assert.ok(selected, `${sceneName} selected Atom snapshot is missing`);
  assert.ok(active?.ready, `${sceneName} active Atom must be ready`);
  assert.equal(
    selected.networkId === allNetworksNetworkId,
    expectAllNetworks,
    expectAllNetworks
      ? `${sceneName} selected network must be All Networks (${allNetworksNetworkId}), got ${selected.networkId}`
      : `${sceneName} selected network must not be All Networks`,
  );
  if (expectAllNetworks) {
    assert.equal(
      selected.deriveType,
      allNetworksSelectedDeriveType,
      `${sceneName} All Networks selection must resolve deriveType '${allNetworksSelectedDeriveType}'`,
    );
  }
  if (assertPersistence) {
    if (expectAllNetworks) {
      // cloneAndFixSelectedAccount strips deriveType from the persisted
      // record whenever networkId is the all-network id, so `undefined` is
      // the exact persisted form, not a relaxation.
      assert.equal(
        persisted?.deriveType,
        undefined,
        `${sceneName} persisted All Networks selection must have no deriveType`,
      );
    }
    assert.deepEqual(
      {
        ...(expectAllNetworks ? {} : { deriveType: selected.deriveType }),
        indexedAccountId: selected.indexedAccountId,
        networkId: selected.networkId,
        othersWalletAccountId: selected.othersWalletAccountId,
        walletId: selected.walletId,
      },
      {
        ...(expectAllNetworks ? {} : { deriveType: persisted?.deriveType }),
        indexedAccountId: persisted?.indexedAccountId,
        networkId: persisted?.networkId,
        othersWalletAccountId: persisted?.othersWalletAccountId,
        walletId: persisted?.walletId,
      },
      `${sceneName} selected Atom must match persisted selection`,
    );
  }
  assert.deepEqual(
    {
      deriveType: active.deriveType,
      indexedAccountId: active.indexedAccountId,
      networkId: active.networkId,
      walletId: active.walletId,
    },
    {
      deriveType: selected.deriveType,
      indexedAccountId: selected.indexedAccountId,
      networkId: selected.networkId,
      walletId: selected.walletId,
    },
    `${sceneName} active Atom must match selected Atom`,
  );
  assert.equal(
    selected.walletId,
    target.walletId,
    `${sceneName} selected wallet must match the fixture`,
  );
  assert.equal(
    selected.indexedAccountId,
    target.indexedAccountId,
    `${sceneName} selected account must match the fixture`,
  );

  const expectedAddress = expectAllNetworks
    ? undefined
    : expectedAccountAddressFixtures[target.fixtureId]?.[target.index]?.[
        selected.networkId
      ]?.[selected.deriveType];
  if (expectAllNetworks) {
    assert.equal(
      expectedAccountAddressFixtures[target.fixtureId]?.[target.index]?.[
        selected.networkId
      ],
      undefined,
      'All Networks must not use a chain-specific golden address',
    );
    // buildActiveAccountInfoFromSelectedAccount swaps in the mocked
    // all-network account for HD indexed accounts.
    assert.equal(
      active.address,
      allNetworksMockAddress,
      `${sceneName} active All Networks account must expose the mocked all-network address`,
    );
  } else {
    assert.ok(
      expectedAddress,
      `Missing golden address for ${target.fixtureId}/${target.index}/${selected.networkId}/${selected.deriveType}`,
    );
    assert.equal(
      active.address,
      expectedAddress,
      `${sceneName} active account address must match the golden fixture`,
    );
  }

  const { accountName } = getExpectedAccountFixture(target);
  assert.equal(
    active.accountName,
    accountName,
    `${sceneName} active account name must match the fixture`,
  );
  if (assertUI) {
    const accountNames = await page
      .locator(visibleTestIDSelector(AccountSelectorTestIDs.triggerAccountName))
      .allTextContents();
    assert.ok(
      accountNames.some((name) => name.includes(accountName)),
      `Visible account name must include ${accountName}`,
    );
    const visibleAddressLocator = page.locator(
      visibleTestIDSelector(AccountSelectorTestIDs.addressText),
    );
    const visibleAddressCount = await visibleAddressLocator.count();
    assert.ok(
      visibleAddressCount <= 1,
      `Expected at most one visible element for testID ${AccountSelectorTestIDs.addressText}`,
    );
    if (expectedAddress && visibleAddressCount === 1) {
      const visibleAddress = await visibleAddressLocator.textContent();
      assert.equal(
        visibleAddress?.trim(),
        expectedAddress,
        'Visible account address must match the golden fixture',
      );
    }
    if (expectAllNetworks && visibleAddressCount === 1) {
      const visibleAddress = await visibleAddressLocator.textContent();
      assert.notEqual(
        visibleAddress?.trim(),
        allNetworksMockAddress,
        'The mocked all-network address must never be displayed',
      );
    }
  }
  return { persisted, snapshot };
}

async function assertDAppConnectionConsumer(
  page,
  target,
  origin = simulatedDAppOrigin,
) {
  const snapshot = await readAccountSelectorStateSnapshot(page, {
    sceneName: 'discover',
    sceneUrl: origin,
  });
  const selected = snapshot?.selected;
  assert.ok(selected, 'DApp consumer selected Atom snapshot is missing');
  const expectedAddress =
    expectedAccountAddressFixtures[target.fixtureId]?.[target.index]?.[
      selected.networkId
    ]?.[selected.deriveType];
  assert.ok(
    expectedAddress,
    `Missing DApp golden address for ${target.fixtureId}/${target.index}/${selected.networkId}/${selected.deriveType}`,
  );
  const { accountName } = getExpectedAccountFixture(target);
  const accountNameLocator = await getUniqueVisibleByTestID(
    page,
    AccountSelectorTestIDs.dappAccountName,
  );
  const addressLocator = await getUniqueVisibleByTestID(
    page,
    AccountSelectorTestIDs.dappAccountAddress,
  );
  assert.equal(
    (await accountNameLocator.textContent())?.trim(),
    accountName,
    'DApp connection card must render the selected fixture account name',
  );
  assert.equal(
    (await addressLocator.textContent())?.trim(),
    shortenAddress(expectedAddress),
    'DApp connection card must render the selected golden address',
  );
}

async function waitForPersistedSelection(
  page,
  expected,
  sceneName = 'home',
  num = 0,
) {
  await page.waitForFunction(
    async ({ expectedSelection, scene, selectionNum }) => {
      const selected =
        await globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.accountSelector.getSelectedAccount(
          {
            num: selectionNum,
            sceneName: scene,
          },
        );
      if (!selected) return false;
      return Object.entries(expectedSelection).every(
        ([key, value]) => selected[key] === value,
      );
    },
    { expectedSelection: expected, scene: sceneName, selectionNum: num },
    { timeout: pageTimeoutMs },
  );
}

function getDesktopSidebarTab(page, label) {
  return page
    .locator('.sidebar-tab-item')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .first();
}

async function readActiveRouteNames(page) {
  return page.evaluate(() => {
    const routeNames = [];
    let state = globalThis.$$appGlobals.$navigationRef?.current?.getRootState();
    while (state?.routes?.length) {
      const route = state.routes[state.index ?? 0];
      if (!route) break;
      routeNames.push(route.name);
      state = route.state;
    }
    return routeNames;
  });
}

async function switchAppTab(page, routeName) {
  await page.evaluate(async (targetRoute) => {
    const navigation = globalThis.$$appGlobals.$rootAppNavigation;
    if (!navigation?.switchTabAsync) {
      throw new Error('Root switchTabAsync navigation is unavailable');
    }
    await navigation.switchTabAsync(targetRoute);
  }, routeName);
  await page.waitForFunction(
    (targetRoute) => {
      let state =
        globalThis.$$appGlobals.$navigationRef?.current?.getRootState();
      while (state?.routes?.length) {
        const route = state.routes[state.index ?? 0];
        if (!route) break;
        if (route.name === targetRoute) return true;
        state = route.state;
      }
      return false;
    },
    routeName,
    { timeout: pageTimeoutMs },
  );
}

async function switchDesktopSidebarTab(page, label, routeName) {
  const tab = getDesktopSidebarTab(page, label);
  await tab.waitFor({ state: 'visible', timeout: pageTimeoutMs });
  await tab.click({ timeout: pageTimeoutMs });
  await page.waitForTimeout(250);

  let routeNames = await readActiveRouteNames(page);
  if (!routeNames.includes(routeName)) {
    await switchAppTab(page, routeName);
    routeNames = await readActiveRouteNames(page);
  }
  assert.ok(
    routeNames.includes(routeName),
    `Expected active route ${routeName}, received ${routeNames.join(' > ')}`,
  );
}

async function waitForHomeShell(page) {
  const onboardingClose = page.locator(
    '[data-testid="page-close-trigger"]:visible, ' +
      '[data-testid="onboardingv2-handle-back-icon-btn"]:visible, ' +
      '[data-testid="onboarding-layout-header-back-btn"]:visible, ' +
      '[data-testid="onboarding-icon-btn"]:visible',
  );
  const homeTab = getDesktopSidebarTab(page, 'Wallet');
  const accountTrigger = page.locator(
    visibleTestIDSelector(AccountSelectorTestIDs.trigger),
  );
  const deadline = Date.now() + pageTimeoutMs;
  let homeStableSince;

  while (Date.now() < deadline) {
    if (await onboardingClose.count()) {
      homeStableSince = undefined;
      await onboardingClose
        .first()
        .click({ timeout: 5000 })
        .catch(() => {});
    } else {
      if (await accountTrigger.count()) {
        homeStableSince ??= Date.now();
        if (Date.now() - homeStableSince >= 2000) {
          assert.equal(
            await accountTrigger.count(),
            1,
            `Expected one visible element for testID ${AccountSelectorTestIDs.trigger}`,
          );
          return;
        }
      } else {
        homeStableSince = undefined;
      }
      if (await homeTab.count()) {
        await switchDesktopSidebarTab(page, 'Wallet', 'Home').catch(() => {});
      }
    }
    await page.waitForTimeout(250);
  }
  await getUniqueVisibleByTestID(page, AccountSelectorTestIDs.trigger, {
    timeout: 1,
  });
}

async function openAccountSelector(page) {
  const trigger = await getUniqueVisibleByTestID(
    page,
    AccountSelectorTestIDs.trigger,
  );
  await trigger.click({ timeout: pageTimeoutMs });
  await getUniqueVisibleByTestID(page, AccountManagerTestIDs.walletList);
}

async function selectWalletAccount(
  page,
  { indexedAccountId, index, walletId },
  { waitForCommit = true } = {},
) {
  await openAccountSelector(page);
  const wallet = await getUniqueVisibleByTestID(
    page,
    AccountManagerTestIDs.wallet(walletId),
  );
  await wallet.click({ timeout: pageTimeoutMs });
  const account = await getUniqueVisibleByTestID(
    page,
    AccountManagerTestIDs.accountItem(index),
  );
  await account.click({ timeout: pageTimeoutMs });
  if (!waitForCommit) {
    await waitForNoVisibleTestID(page, AccountManagerTestIDs.walletList);
    return;
  }
  await waitForPersistedSelection(page, { indexedAccountId, walletId });
  await waitForNoVisibleTestID(page, AccountManagerTestIDs.walletList);
  await getUniqueVisibleByTestID(
    page,
    AccountSelectorTestIDs.triggerAccountName,
  );
}

// A press that never reaches the app leaves no trace in the perf log, so the
// only way to tell a swallowed press from a dismissal failure is to watch the
// DOM events themselves. Capture phase, no MutationObserver: the failure is a
// sub-millisecond timing window, and observing the subtree would perturb the
// very scheduling under investigation.
async function installPressProbe(page) {
  await page.evaluate(() => {
    if (globalThis.$$pressProbe) {
      return;
    }
    const entries = [];
    const record = (event) => {
      if (entries.length >= 400) {
        return;
      }
      const target =
        event.target instanceof globalThis.Element ? event.target : undefined;
      const holder = target?.closest?.('[data-testid]');
      entries.push({
        connected: target ? target.isConnected : undefined,
        testID: holder?.getAttribute('data-testid') ?? undefined,
        tMs: Math.round(globalThis.performance.now()),
        type: event.type,
      });
    };
    for (const type of [
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
    ]) {
      globalThis.document.addEventListener(type, record, true);
    }
    globalThis.$$pressProbe = {
      entries,
      reset: () => {
        entries.length = 0;
      },
    };
  });
}

async function resetPressProbe(page) {
  await page.evaluate(() => globalThis.$$pressProbe?.reset?.());
}

async function readPressProbe(page) {
  return page.evaluate(
    () => globalThis.$$pressProbe?.entries?.slice(-24) ?? [],
  );
}

// Playwright's default click is a zero-length press: down and up land in the
// same frame, so a row whose DOM node is replaced mid-press is never exercised.
// A human press is 50-150ms wide, which straddles the list's post-open settling
// burst. pressHoldMs reproduces that width so the suite can see what users see.
async function pressWithHold(page, locator, holdMs) {
  await locator.scrollIntoViewIfNeeded({ timeout: pageTimeoutMs });
  const box = await locator.boundingBox({ timeout: pageTimeoutMs });
  assert.ok(box, 'Press target must have a layout box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(holdMs);
  await page.mouse.up();
}

async function selectNetwork(
  page,
  networkId,
  { waitForCommit = true, pressHoldMs = 0 } = {},
) {
  await installPressProbe(page);
  const trigger = await getUniqueVisibleByTestIDs(page, [
    AccountSelectorTestIDs.networkTrigger,
    AccountSelectorTestIDs.allNetworksTrigger,
  ]);
  await trigger.click({ timeout: pageTimeoutMs });

  const networkTab = await getUniqueVisibleByTestID(
    page,
    'unified-network-selector-network-tab',
  );
  await networkTab.click({ timeout: pageTimeoutMs });

  const networkItem = await getUniqueVisibleByTestIDs(page, [
    networkId,
    `select-item-${networkId}`,
  ]);
  await resetPressProbe(page);
  if (pressHoldMs > 0) {
    await pressWithHold(page, networkItem, pressHoldMs);
  } else {
    await networkItem.click({ timeout: pageTimeoutMs });
  }
  // A selector that stays open means the press never reached the app. Report
  // what the app actually holds and which DOM events the row saw, so a
  // swallowed press is distinguishable from a selection that landed but failed
  // to dismiss — and, when swallowed, whether the row moved mid-press.
  try {
    await waitForNoVisibleTestID(page, 'unified-network-selector-network-tab');
  } catch (error) {
    const persisted = await readPersistedSelection(page).catch(() => undefined);
    const pressEvents = await readPressProbe(page).catch(() => []);
    assert.fail(
      `Network selector stayed open after clicking ${networkId}; persisted networkId=${
        persisted?.networkId ?? 'unknown'
      } (${
        persisted?.networkId === networkId
          ? 'press landed, dismissal failed'
          : 'press was swallowed'
      }); press events: ${JSON.stringify(pressEvents)}: ${error.message}`,
    );
  }
  if (waitForCommit) {
    await waitForPersistedSelection(page, { networkId });
  } else {
    const deadline = Date.now() + pageTimeoutMs;
    while (Date.now() < deadline) {
      if ((await networkItem.count()) === 0) {
        return;
      }
      await page.waitForTimeout(50);
    }
    assert.fail(`Network item ${networkId} remained visible`);
  }
}

// Production keeps the single-network tab identical to a plain chain list —
// it renders no All Networks row — so the unified selector's only real UI
// gesture that moves a single-chain selection to All Networks is the
// portfolio tab's confirm flow: handlePortfolioDone
// (UnifiedNetworkSelector/index.tsx) commits the selection with reason
// 'unifiedNetworkEnableFlow' and closes the modal via resetChainSelectorModal.
async function selectAllNetworksViaPortfolioDone(page) {
  const trigger = await getUniqueVisibleByTestIDs(page, [
    AccountSelectorTestIDs.networkTrigger,
    AccountSelectorTestIDs.allNetworksTrigger,
  ]);
  await trigger.click({ timeout: pageTimeoutMs });

  const portfolioTab = await getUniqueVisibleByTestID(
    page,
    'unified-network-selector-portfolio-tab',
  );
  await portfolioTab.click({ timeout: pageTimeoutMs });

  // ChainSelectorTestIDs.unifiedPortfolioConfirmBtn renders the footer button
  // as a real <button>, so disabled/aria-disabled mirror isConfirmDisabled.
  // The label must read exactly "Done" before the press: any other label means
  // the confirm would do more than switch the selection — "No networks
  // selected" means the enabled set never resolved, and the create-address
  // variant would mutate the fixture wallet with new addresses. Both are setup
  // bugs this scenario must fail on rather than absorb into the click.
  const confirmButton = await getUniqueVisibleByTestID(
    page,
    'page-footer-confirm',
  );
  const deadline = Date.now() + pageTimeoutMs;
  for (;;) {
    const state = await confirmButton.evaluate((node) => ({
      disabled:
        node.hasAttribute('disabled') ||
        node.getAttribute('aria-disabled') === 'true',
      label: node.textContent?.trim() ?? '',
    }));
    if (!state.disabled) {
      assert.equal(
        state.label,
        'Done',
        'Portfolio confirm must be a pure selection switch; another label means it would create addresses or has nothing enabled',
      );
      break;
    }
    assert.ok(
      Date.now() < deadline,
      `Portfolio confirm button stayed disabled (label: ${state.label})`,
    );
    await page.waitForTimeout(50);
  }
  await confirmButton.click({ timeout: pageTimeoutMs });
  await waitForNoVisibleTestID(page, 'unified-network-selector-portfolio-tab');
  await waitForPersistedSelection(page, { networkId: allNetworksNetworkId });
}

function getAccountDerivationSettingsNetworkId(networkId) {
  if (networkId.startsWith('evm--')) {
    return 'evm--1';
  }
  return networkId;
}

async function openAccountDerivationSettings(page, networkId) {
  const settingsNetworkId = getAccountDerivationSettingsNetworkId(networkId);
  await page.evaluate(() => {
    globalThis.$$appGlobals.$rootAppNavigation.pushModal('SettingModal', {
      screen: 'SettingAccountDerivationModal',
    });
  });
  const trigger = await getUniqueVisibleByTestID(
    page,
    `account-derivation-network-${settingsNetworkId}`,
  );
  return { settingsNetworkId, trigger };
}

async function closeAccountDerivationSettings(page) {
  await page.evaluate(() => {
    globalThis.$$appGlobals.$rootAppNavigation.pop();
  });
  await waitForHomeShell(page);
}

async function selectDeriveTypeViaUI(
  page,
  { deriveType, settingsNetworkId, trigger },
) {
  const itemTestID = `select-item-${deriveType}`;
  const anyVisibleOption = page.locator(
    '[data-testid^="select-item-"]:visible',
  );
  await trigger.click({ timeout: pageTimeoutMs });
  let item;
  try {
    item = await getUniqueVisibleByTestID(page, itemTestID, {
      timeout: uiSettleTimeoutMs,
    });
  } catch {
    // The trigger toggles. Clicking it again while the dropdown is already open
    // closes it and leaves nothing to wait for, which turns a slow first render
    // into a guaranteed timeout. Only re-open when it is really shut.
    if ((await anyVisibleOption.count()) === 0) {
      await trigger.click({ timeout: pageTimeoutMs });
    }
    item = await getUniqueVisibleByTestID(page, itemTestID);
  }
  await item.click({ force: true, timeout: pageTimeoutMs });
  await page.waitForFunction(
    async ({ expectedDeriveType, networkId }) => {
      const actual =
        await globalThis.$$appGlobals.$backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
          { networkId },
        );
      return actual === expectedDeriveType;
    },
    { expectedDeriveType: deriveType, networkId: settingsNetworkId },
    { timeout: pageTimeoutMs },
  );
}

async function verifyAllNetworkDeriveAddresses(
  page,
  target,
  networkId,
  devOnlyPassword,
) {
  const deriveTypes = await page.evaluate(
    async ({ selectedNetworkId }) => {
      const serviceNetwork =
        globalThis.$$appGlobals.$backgroundApiProxy.serviceNetwork;
      const items = await serviceNetwork.getDeriveInfoItemsOfNetwork({
        networkId: selectedNetworkId,
      });
      return items.map((item) => item.value);
    },
    { selectedNetworkId: networkId },
  );
  assert.ok(
    deriveTypes.length > 0,
    `${networkId} must expose at least one derive type`,
  );
  const traces = [];
  const initialSelection = await readPersistedSelection(page);
  const orderedDeriveTypes = [
    ...deriveTypes.filter(
      (deriveType) => deriveType !== initialSelection?.deriveType,
    ),
    ...deriveTypes.filter(
      (deriveType) => deriveType === initialSelection?.deriveType,
    ),
  ];
  const settings =
    deriveTypes.length > 1
      ? await openAccountDerivationSettings(page, networkId)
      : undefined;
  for (const deriveType of orderedDeriveTypes) {
    if (settings) {
      const previous = await readPersistedSelection(page);
      await drainResidualPerfTrace(page, devOnlyPassword);
      await selectDeriveTypeViaUI(page, { ...settings, deriveType });
      await waitForPersistedSelection(page, { deriveType, networkId });
      await assertAccountSelectorStateConsistent(page, target, {
        assertUI: false,
      });
      const changed = previous?.deriveType !== deriveType;
      const trace = await collectSelectionOperationTrace(
        page,
        devOnlyPassword,
        {
          expectActiveReload: changed,
          reason: 'autoDeriveGlobalSync',
        },
      );
      assertSelectionOperationBudget(trace, {
        expectedActiveReloads: changed ? 1 : 0,
        expectedSelectionUpdates: changed ? 1 : 0,
        label: `UI derive selection ${networkId}/${deriveType}`,
        reason: 'autoDeriveGlobalSync',
      });
      traces.push(trace);
    }
    await waitForPersistedSelection(page, { deriveType, networkId });
    await assertAccountSelectorStateConsistent(page, target);
  }
  if (settings) {
    const currentSelection = await readPersistedSelection(page);
    assert.ok(
      currentSelection?.deriveType,
      `${networkId} must keep a derive type before the no-op selection`,
    );
    await drainResidualPerfTrace(page, devOnlyPassword);
    await selectDeriveTypeViaUI(page, {
      ...settings,
      deriveType: currentSelection.deriveType,
    });
    await assertAccountSelectorStateConsistent(page, target, {
      assertUI: false,
    });
    const noOpTrace = await collectSelectionOperationTrace(
      page,
      devOnlyPassword,
      {
        expectActiveReload: false,
        reason: 'autoDeriveGlobalSync',
      },
    );
    assertSelectionOperationBudget(noOpTrace, {
      expectedActiveReloads: 0,
      expectedSelectionUpdates: 0,
      label: `no-op UI derive selection ${networkId}/${currentSelection.deriveType}`,
      reason: 'autoDeriveGlobalSync',
    });
    traces.push(noOpTrace);
    await closeAccountDerivationSettings(page);
    await assertAccountSelectorStateConsistent(page, target);
  }
  return mergePerfTrace(...traces);
}

async function runRapidSelectionBursts(page, fixture) {
  const accountTargets = [
    {
      fixtureId: fixture.wallets[0].fixtureId,
      index: 0,
      indexedAccountId: fixture.wallets[0].indexedAccountIds[0],
      walletId: fixture.wallets[0].walletId,
    },
    {
      fixtureId: fixture.wallets[1].fixtureId,
      index: 1,
      indexedAccountId: fixture.wallets[1].indexedAccountIds[1],
      walletId: fixture.wallets[1].walletId,
    },
    {
      fixtureId: fixture.wallets[0].fixtureId,
      index: 1,
      indexedAccountId: fixture.wallets[0].indexedAccountIds[1],
      walletId: fixture.wallets[0].walletId,
    },
  ];
  for (const target of accountTargets) {
    await selectWalletAccount(page, target, { waitForCommit: false });
  }
  const finalAccount = accountTargets[accountTargets.length - 1];

  // Reopening the selector writes focusedWallet from the active account, and it
  // lands here while the last pick's reload is still in flight. focusedWallet is
  // not an input to the active account, so nothing re-schedules a reload for it:
  // any reload dropped on account of it is dropped for good, and the active
  // account stays on the previous pick. Every other burst ends on a field that
  // does schedule one, so this is the only shape that exposes it.
  await openAccountSelector(page);
  await page.keyboard.press('Escape');
  await waitForNoVisibleTestID(page, AccountManagerTestIDs.walletList);

  await waitForPersistedSelection(page, {
    indexedAccountId: finalAccount.indexedAccountId,
    walletId: finalAccount.walletId,
  });

  const networkTargets = ['evm--1', 'btc--0', 'evm--137'];
  for (const networkId of networkTargets) {
    await selectNetwork(page, networkId, { waitForCommit: false });
  }
  await waitForPersistedSelection(page, {
    networkId: networkTargets[networkTargets.length - 1],
  });

  // A human-length press, issued right after the list opens, is the shape that
  // exposes rows whose DOM identity is destroyed by a re-render mid-press.
  await selectNetwork(page, 'btc--0', { pressHoldMs: 100 });
  const deriveBurst = await page.evaluate(async () => {
    const api = globalThis.$$appGlobals.$backgroundApiProxy;
    const selected = await api.simpleDb.accountSelector.getSelectedAccount({
      num: 0,
      sceneName: 'home',
    });
    const deriveItems = await api.serviceNetwork.getDeriveInfoItemsOfNetwork({
      networkId: 'btc--0',
    });
    const alternatives = deriveItems
      .map((item) => item.value)
      .filter((value) => value !== selected?.deriveType);
    const finalDeriveType = alternatives[0];
    if (!finalDeriveType) {
      return undefined;
    }
    const writes = [
      finalDeriveType,
      selected?.deriveType,
      alternatives[1] || finalDeriveType,
      finalDeriveType,
    ].filter(Boolean);
    for (const deriveType of writes) {
      await api.serviceNetwork.saveGlobalDeriveTypeForNetwork({
        deriveType,
        networkId: 'btc--0',
      });
    }
    return { finalDeriveType, writes: writes.length };
  });
  assert.ok(deriveBurst?.writes >= 3, 'BTC derive burst needs three writes');
  await waitForPersistedSelection(page, {
    deriveType: deriveBurst.finalDeriveType,
    networkId: 'btc--0',
  });

  // Guarantee the coalescing budget an in-window reload overlap. The rapid
  // picks above cannot promise one on a fast machine: every UI pick reopens
  // its selector, so consecutive selection commits land further apart than
  // the 150ms reload throttle, and the derive writes collapse into a single
  // dispatch before the UI sees them (SimpleDbEntityAccountSelector debounces
  // GlobalDeriveTypeUpdate per network impl). The only overlap left is a
  // cross-scene sync bunching on the swap scene — pure timing luck. Renaming
  // the selected account twice back-to-back emits AccountUpdate twice in the
  // same tick — the double-trigger shape the DApp connect flow produces
  // naturally — so every mounted Effects instance schedules two reloads
  // inside one throttle window and must coalesce them on any machine speed.
  const renameBurst = await page.evaluate(
    async ({ indexedAccountId }) => {
      const api = globalThis.$$appGlobals.$backgroundApiProxy;
      const indexedAccount = await api.serviceAccount.getIndexedAccount({
        id: indexedAccountId,
      });
      const originalName = indexedAccount?.name;
      if (!originalName) {
        return undefined;
      }
      await api.serviceAccount.setAccountName({
        indexedAccountId,
        name: `${originalName} (burst)`,
      });
      await api.serviceAccount.setAccountName({
        indexedAccountId,
        name: originalName,
      });
      return { originalName };
    },
    { indexedAccountId: finalAccount.indexedAccountId },
  );
  assert.ok(
    renameBurst?.originalName,
    'Rename burst must resolve the selected fixture account name',
  );

  await assertAccountSelectorStateConsistent(page, finalAccount);
}

async function assertSwapConsumer(page, target) {
  const swapTab = getDesktopSidebarTab(page, 'Trade');
  if (!(await swapTab.count())) return;
  await switchDesktopSidebarTab(page, 'Trade', 'Swap');
  await page
    .locator('[data-testid="swap-content-container"]:visible')
    .first()
    .waitFor({ state: 'visible', timeout: pageTimeoutMs });
  await page
    .locator('[data-testid="swap-from-amount-input"]:visible')
    .first()
    .waitFor({ state: 'visible', timeout: pageTimeoutMs });
  await page
    .locator('[data-testid="swap-to-amount-input"]:visible')
    .first()
    .waitFor({ state: 'visible', timeout: pageTimeoutMs });
  await waitForPersistedSelection(
    page,
    {
      indexedAccountId: target.indexedAccountId,
      walletId: target.walletId,
    },
    'swap',
  );
  await assertAccountSelectorStateConsistent(page, target, {
    assertUI: false,
    sceneName: 'swap',
  });
  await switchDesktopSidebarTab(page, 'Wallet', 'Home');
}

async function assertPerpsAccountConsumer(page, devOnlyPassword, target) {
  await page
    .locator('[data-testid="perp-header-settings-button"]:visible')
    .first()
    .waitFor({ state: 'visible', timeout: pageTimeoutMs });
  const homeSelection = await readPersistedSelection(page);
  const expectedAddress =
    expectedAccountAddressFixtures[target.fixtureId]?.[target.index]?.[
      'evm--1'
    ]?.[homeSelection?.deriveType ?? 'default'];
  assert.ok(
    expectedAddress,
    `Missing Perps golden address for ${target.fixtureId}/${target.index}/${
      homeSelection?.deriveType ?? 'default'
    }`,
  );
  await page.waitForFunction(
    async ({ expectedIndexedAccountId, expectedPerpsAddress, password }) => {
      const activePerpsAccount =
        await globalThis.$$appGlobals.$backgroundApiProxy.serviceE2E.getPerpsActiveAccountE2E(
          { $$devOnlyPassword: password },
        );
      return Boolean(
        activePerpsAccount?.indexedAccountId === expectedIndexedAccountId &&
        activePerpsAccount?.accountAddress?.toLowerCase() ===
          expectedPerpsAddress.toLowerCase(),
      );
    },
    {
      expectedIndexedAccountId: target.indexedAccountId,
      expectedPerpsAddress: expectedAddress,
      password: devOnlyPassword,
    },
    { timeout: pageTimeoutMs },
  );
  await page.waitForTimeout(500);
  const activePerpsAccount = await page.evaluate(
    ({ password }) =>
      globalThis.$$appGlobals.$backgroundApiProxy.serviceE2E.getPerpsActiveAccountE2E(
        { $$devOnlyPassword: password },
      ),
    { password: devOnlyPassword },
  );
  assert.equal(
    activePerpsAccount.indexedAccountId,
    target.indexedAccountId,
    'Perps business account must follow the Home Account Selector account',
  );
  assert.equal(
    activePerpsAccount.accountAddress?.toLowerCase(),
    expectedAddress.toLowerCase(),
    'Perps business account must resolve the selected fixture address',
  );
  await page
    .locator('[data-testid="perp-portfolio-button"]:visible')
    .first()
    .waitFor({ state: 'visible', timeout: pageTimeoutMs });
}

async function runPerpsAccountSyncScenario(page, devOnlyPassword, fixture) {
  const initialSelection = await readPersistedSelection(page);
  const initialTarget = findFixtureTarget(fixture, initialSelection);
  await drainResidualPerfTrace(page, devOnlyPassword);
  await switchAppTab(page, 'Perp');
  await assertAccountSelectorStateConsistent(page, initialTarget, {
    assertUI: false,
  });
  await assertPerpsAccountConsumer(page, devOnlyPassword, initialTarget);
  const initialTrace = await drainPerfTrace(page, devOnlyPassword);

  const preferredTarget = {
    fixtureId: fixture.wallets[1].fixtureId,
    index: 0,
    indexedAccountId: fixture.wallets[1].indexedAccountIds[0],
    walletId: fixture.wallets[1].walletId,
  };
  const target =
    preferredTarget.indexedAccountId === initialTarget.indexedAccountId
      ? {
          fixtureId: fixture.wallets[0].fixtureId,
          index: 0,
          indexedAccountId: fixture.wallets[0].indexedAccountIds[0],
          walletId: fixture.wallets[0].walletId,
        }
      : preferredTarget;

  await switchDesktopSidebarTab(page, 'Wallet', 'Home');
  await waitForHomeShell(page);
  await drainResidualPerfTrace(page, devOnlyPassword);
  await selectWalletAccount(page, target);
  const selectionTrace = await collectSelectionOperationTrace(
    page,
    devOnlyPassword,
    {
      expectActiveReload: true,
      reason: 'userSelectAccount',
    },
  );
  assertSelectionOperationBudget(selectionTrace, {
    expectedActiveReloads: 1,
    expectedSelectionUpdates: 1,
    label: 'Perps source account selection',
    reason: 'userSelectAccount',
  });

  await switchAppTab(page, 'Perp');
  await assertAccountSelectorStateConsistent(page, target, {
    assertUI: false,
  });
  await assertPerpsAccountConsumer(page, devOnlyPassword, target);
  const syncedTrace = await drainPerfTrace(page, devOnlyPassword);
  await switchDesktopSidebarTab(page, 'Wallet', 'Home');
  await waitForHomeShell(page);
  const trace = mergePerfTrace(initialTrace, selectionTrace, syncedTrace);
  assertTraceHealth({ ...trace, phase: 'perps-account-sync' });
  return trace;
}

async function addSimulatedCustomNetwork(page, cycle) {
  return page.evaluate(
    async ({ cycleNumber }) => {
      const serviceCustomRpc =
        globalThis.$$appGlobals.$$backgroundApi?.serviceCustomRpc;
      if (!serviceCustomRpc?.upsertCustomNetworkInfo) {
        throw new Error(
          'Direct ServiceCustomRpc is unavailable in the Web single runtime',
        );
      }
      const chainId = String(31_337 + cycleNumber);
      const networkId = `evm--${chainId}`;
      const networkName = `E2E Custom ${chainId}`;
      await serviceCustomRpc.upsertCustomNetworkInfo({
        networkInfo: {
          backendIndex: false,
          chainId,
          code: networkName,
          decimals: 18,
          defaultEnabled: true,
          explorerURL: 'https://account-selector-e2e.test/explorer',
          feeMeta: {
            decimals: 9,
            isEIP1559FeeEnabled: true,
            isWithL1BaseFee: false,
            symbol: 'Gwei',
          },
          id: networkId,
          impl: 'evm',
          isCustomNetwork: true,
          isTestnet: true,
          logoURI: '',
          name: networkName,
          shortcode: networkName,
          shortname: networkName,
          status: 'LISTED',
          symbol: 'E2E',
        },
        rpcUrl: 'http://127.0.0.1:8545',
        skipSaveLocalSyncItem: true,
      });
      return { networkId };
    },
    { cycleNumber: cycle },
  );
}

async function runMultiNumAndCustomNetworkScenario(
  page,
  devOnlyPassword,
  cycle,
  fixture,
) {
  const homeSelection = await readPersistedSelection(page);
  assert.ok(homeSelection?.walletId, 'Home selection must have a wallet');
  assert.ok(
    homeSelection?.indexedAccountId,
    'Home selection must have an indexed account',
  );
  const target = findFixtureTarget(fixture, homeSelection);

  await switchDesktopSidebarTab(page, 'Trade', 'Swap');
  await page
    .locator('[data-testid="swap-content-container"]:visible')
    .first()
    .waitFor({ state: 'visible', timeout: pageTimeoutMs });
  await waitForPersistedSelection(
    page,
    {
      indexedAccountId: homeSelection.indexedAccountId,
      walletId: homeSelection.walletId,
    },
    'swap',
    0,
  );
  await waitForPersistedSelection(
    page,
    {
      indexedAccountId: homeSelection.indexedAccountId,
      walletId: homeSelection.walletId,
    },
    'swap',
    1,
  );

  const mountTrace = await collectPerfTraceUntil(
    page,
    devOnlyPassword,
    (events) =>
      [0, 1].every((num) =>
        events.some(
          (event) =>
            event.event === 'effectsStateObserved' &&
            event.sceneName === 'swap' &&
            event.num === num &&
            event.selection?.hasWallet === true &&
            event.activeAccount?.ready === true,
        ),
      ),
  );
  for (const num of [0, 1]) {
    await assertAccountSelectorStateConsistent(page, target, {
      assertUI: false,
      num,
      sceneName: 'swap',
    });
  }

  const { networkId } = await addSimulatedCustomNetwork(page, cycle);
  await page.waitForFunction(
    async ({ expectedNetworkId }) => {
      const result =
        await globalThis.$$appGlobals.$backgroundApiProxy.serviceNetwork.getAllNetworkIds();
      return result.networkIds.includes(expectedNetworkId);
    },
    { expectedNetworkId: networkId },
    { timeout: pageTimeoutMs },
  );
  const customNetworkTrace = await collectPerfTraceUntil(
    page,
    devOnlyPassword,
    (events) =>
      [0, 1].every(
        (num) =>
          events.some(
            (event) =>
              event.event === 'availableNetworksResult' &&
              event.consumer === 'auto-select-network' &&
              event.num === num &&
              event.outcome === 'success' &&
              event.sceneName === 'swap' &&
              event.trigger === 'custom-network-event',
          ) &&
          events.some(
            (event) =>
              event.event === 'activeReloadResult' &&
              event.num === num &&
              event.sceneName === 'swap' &&
              event.trigger === 'custom-network-update',
          ),
      ),
  );
  const trace = mergePerfTrace(mountTrace, customNetworkTrace);
  assertTraceHealth({ ...trace, phase: 'multi-num-custom-network' });

  for (const num of [0, 1]) {
    const requests = customNetworkTrace.events.filter(
      (event) =>
        event.event === 'availableNetworksRequested' &&
        event.consumer === 'auto-select-network' &&
        event.num === num &&
        event.sceneName === 'swap' &&
        event.trigger === 'custom-network-event',
    );
    const schedules = customNetworkTrace.events.filter(
      (event) =>
        event.event === 'activeReloadScheduled' &&
        event.num === num &&
        event.sceneName === 'swap' &&
        event.trigger === 'custom-network-update',
    );
    assert.equal(
      requests.length,
      1,
      `Swap num ${num} must refresh available networks exactly once`,
    );
    assert.equal(
      schedules.length,
      1,
      `Swap num ${num} must schedule one custom-network reload`,
    );
  }
  assert.ok(
    customNetworkTrace.events.some(
      (event) =>
        event.event === 'availableNetworksResult' &&
        event.changed === true &&
        event.trigger === 'custom-network-event',
    ),
    'Custom network refresh must observe the changed network list',
  );
  for (const num of [0, 1]) {
    await assertAccountSelectorStateConsistent(page, target, {
      assertUI: false,
      num,
      sceneName: 'swap',
    });
  }

  await switchDesktopSidebarTab(page, 'Wallet', 'Home');
  await waitForHomeShell(page);
  return { networkId, trace };
}

async function deleteSimulatedDAppConnection(
  page,
  connectionOrigin = simulatedDAppOrigin,
) {
  await page.evaluate(
    ({ origin }) =>
      globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.dappConnection.deleteConnection(
        origin,
        'injectedProvider',
      ),
    { origin: connectionOrigin },
  );
}

function assertDAppAccountSelectorInitializationRefreshBudget(trace) {
  const mirrorCommits = trace.events.filter(
    (event) =>
      event.event === 'mirrorTrackerCommit' &&
      event.perfDebugName === 'dapp-connection-modal',
  );
  const mirrorRegistrations = trace.events.filter(
    (event) =>
      event.event === 'mirrorTrackerRegistration' &&
      event.perfDebugName === 'dapp-connection-modal',
  );
  const mirrorProviderInstanceIds = new Set(
    mirrorCommits.map((event) => event.providerInstanceId),
  );
  assert.equal(
    mirrorProviderInstanceIds.size,
    1,
    'DApp initialization must use one AccountSelector mirror tracker instance',
  );
  assert.equal(
    mirrorRegistrations.filter((event) => event.action === 'add').length,
    1,
    'DApp initialization must register one AccountSelector mirror tracker',
  );
  assert.equal(
    mirrorRegistrations.filter((event) => event.action === 'remove').length,
    0,
    'DApp initialization must not unregister its mirror tracker before approval',
  );
  assert.ok(
    mirrorCommits.length <= 1,
    `DApp AccountSelector mirror committed ${mirrorCommits.length} times during initialization (limit 1)`,
  );

  const effectsHostCommits = trace.events.filter(
    (event) =>
      event.event === 'effectsHostCommit' &&
      event.num === 0 &&
      event.sceneName === 'discover',
  );
  const effectsStateObservations = trace.events.filter(
    (event) =>
      event.event === 'effectsStateObserved' &&
      event.num === 0 &&
      event.sceneName === 'discover',
  );
  const effectInstanceIds = new Set(
    effectsHostCommits.map((event) => event.effectInstanceId),
  );
  assert.equal(
    effectInstanceIds.size,
    1,
    'DApp initialization must use one AccountSelectorEffects instance',
  );
  assert.ok(
    effectsHostCommits.length <= 5,
    `DApp AccountSelectorEffects host committed ${
      effectsHostCommits.length
    } times during initialization (limit 5): ${JSON.stringify(
      effectsStateObservations.map((event) => ({
        changedChannels: event.changedChannels,
        observationCount: event.observationCount,
        selectionReason: event.selectionReason,
        selectionTransitionId: event.selectionTransitionId,
      })),
    )}`,
  );
  assert.ok(
    effectsStateObservations.length <= 4,
    `DApp AccountSelectorEffects observed ${effectsStateObservations.length} semantic states during initialization (limit 4)`,
  );
  for (const channel of [
    'activeAccount',
    'selectedAccount',
    'storageReady',
    'updateMeta',
  ]) {
    const count = effectsStateObservations.filter((event) =>
      event.changedChannels?.includes(channel),
    ).length;
    assert.ok(
      count <= 1,
      `DApp AccountSelectorEffects observed ${channel} ${count} times during initialization (limit 1)`,
    );
  }
}

function assertDAppAccountSelectorMirrorLifecycle(trace) {
  const mirrorCommits = trace.events.filter(
    (event) =>
      event.event === 'mirrorTrackerCommit' &&
      event.perfDebugName === 'dapp-connection-modal',
  );
  const providerInstanceIds = new Set(
    mirrorCommits.map((event) => event.providerInstanceId),
  );
  assert.equal(
    providerInstanceIds.size,
    1,
    'DApp connection must keep one AccountSelector mirror tracker instance',
  );
  const providerInstanceId = mirrorCommits[0]?.providerInstanceId;
  const registrations = trace.events.filter(
    (event) =>
      event.event === 'mirrorTrackerRegistration' &&
      event.providerInstanceId === providerInstanceId,
  );
  assert.equal(
    registrations.filter((event) => event.action === 'add').length,
    1,
    'DApp connection must register its AccountSelector mirror once',
  );
  assert.equal(
    registrations.filter((event) => event.action === 'remove').length,
    1,
    'DApp connection must unregister its AccountSelector mirror once',
  );
  assert.equal(
    mirrorCommits.length,
    1,
    'DApp connection must not recommit its AccountSelector mirror',
  );
}

// Every count in assertSelectionOperationBudget is derived from transitionId /
// scheduleId attribution, which is recorded against the selection object's
// identity. When a count is off, the useful question is always which concrete
// events were matched — so each assertion carries them in its message.
function describeBudgetEvents(events) {
  return JSON.stringify(
    events.map((event) => ({
      activeScheduleId: event.activeScheduleId,
      changedChannels: event.changedChannels,
      coalescedCount: event.coalescedCount,
      coalescedTriggers: event.coalescedTriggers,
      effectInstanceId: event.effectInstanceId,
      outcome: event.outcome,
      reason: event.reason,
      scheduleId: event.scheduleId,
      transitionId: event.transitionId,
      trigger: event.trigger,
    })),
  );
}

// The saveToStorage outcomes where the call did NOT take responsibility for
// persisting this selection, so counting them would misreport how many times a
// selection was persisted. Everything else concluded: it wrote (persisted), ran
// the sequence for a scene that cannot persist (processed-nonpersistent), or
// determined there was nothing to write (skip-no-identity,
// skip-default-selection, skip-incompatible).
//   noop-already-saved — the record was already on disk, written by another
//     call. confirmAccountSelect awaits its own save so it can only close the
//     selector once the record is on disk, so a selection the selection-effect
//     already wrote legitimately lands here.
//   skip-not-ready     — storage was not ready yet.
//   stale-*            — a newer selection superseded this one mid-flight.
const storageNonPersistOutcomes = new Set([
  'noop-already-saved',
  'skip-not-ready',
  'stale-after-fix',
  'stale-after-write',
  'stale-before-fix',
  'stale-before-read',
  'stale-before-write',
]);

// A duplicated persist is only readable next to the coalescing decisions that
// were supposed to prevent it, so the storage assertion carries the whole
// selectionStorage timeline for the transitions it counted.
function describeStorageTimeline(events, transitionIds, num) {
  return JSON.stringify(
    events
      .filter(
        (event) =>
          typeof event.event === 'string' &&
          event.event.startsWith('selectionStorage') &&
          event.num === num &&
          (transitionIds.has(event.transitionId) ||
            event.event === 'selectionStorageCoalesced' ||
            event.event === 'selectionStorageSkipped'),
      )
      .map((event) => ({
        event: event.event,
        operationId: event.operationId,
        originalTrigger: event.originalTrigger,
        outcome: event.outcome,
        primaryPersisted: event.primaryPersisted,
        reason: event.reason,
        revision: event.revision,
        sceneName: event.sceneName,
        transitionId: event.transitionId,
        trigger: event.trigger,
      })),
  );
}

function assertSelectionOperationBudget(
  trace,
  {
    expectedActiveReloads,
    expectedSelectionUpdates,
    label,
    num = 0,
    reason,
    sceneName = 'home',
  },
) {
  assertTraceHealth({ ...trace, phase: label });
  const rawSelectionUpdates = trace.events.filter(
    (event) =>
      event.event === 'selectionStateUpdated' &&
      event.num === num &&
      event.reason === reason,
  );
  const rawTransitionIds = new Set(
    rawSelectionUpdates.map((event) => event.transitionId),
  );
  if (expectedSelectionUpdates === 0) {
    assert.equal(
      rawSelectionUpdates.length,
      0,
      `${label} must not commit a no-op selection update: ${describeBudgetEvents(rawSelectionUpdates)}`,
    );
  }
  const storageRequests = trace.events.filter(
    (event) =>
      event.event === 'selectionStorageRequested' &&
      event.num === num &&
      event.reason === reason &&
      event.sceneName === sceneName &&
      rawTransitionIds.has(event.transitionId),
  );
  const transitionIds = new Set(
    storageRequests.map((event) => event.transitionId),
  );
  const selectionUpdates = trace.events.filter(
    (event) =>
      event.event === 'selectionStateUpdated' &&
      event.num === num &&
      event.reason === reason &&
      transitionIds.has(event.transitionId),
  );
  assert.equal(
    selectionUpdates.length,
    expectedSelectionUpdates,
    `${label} must commit ${expectedSelectionUpdates} effective selection update(s): ${describeBudgetEvents(selectionUpdates)}`,
  );
  const activeSchedules = trace.events.filter(
    (event) =>
      event.event === 'activeReloadScheduled' &&
      event.num === num &&
      event.reason === reason &&
      event.sceneName === sceneName,
  );
  assert.equal(
    activeSchedules.length,
    expectedActiveReloads,
    `${label} must schedule ${expectedActiveReloads} active reload(s): ${describeBudgetEvents(
      activeSchedules,
    )}`,
  );
  const completedReloads = trace.events.filter(
    (event) =>
      event.event === 'activeReloadResult' &&
      event.num === num &&
      ['commit', 'noop'].includes(event.outcome) &&
      event.reason === reason &&
      event.sceneName === sceneName,
  );
  assert.equal(
    completedReloads.length,
    expectedActiveReloads,
    `${label} must complete ${expectedActiveReloads} active reload(s)`,
  );
  const committedScheduleIds = new Set(
    completedReloads
      .filter((event) => event.outcome === 'commit')
      .map((event) => event.scheduleId),
  );
  const selectedObservations = trace.events.filter(
    (event) =>
      event.event === 'effectsStateObserved' &&
      event.num === num &&
      event.sceneName === sceneName &&
      transitionIds.has(event.transitionId) &&
      event.changedChannels?.includes('selectedAccount'),
  );
  assert.equal(
    selectedObservations.length,
    expectedSelectionUpdates,
    `${label} must expose each selection update to Effects once: ${describeBudgetEvents(selectedObservations)}`,
  );
  const activeObservations = trace.events.filter(
    (event) =>
      event.event === 'effectsStateObserved' &&
      event.num === num &&
      event.sceneName === sceneName &&
      committedScheduleIds.has(event.activeScheduleId) &&
      event.changedChannels?.includes('activeAccount'),
  );
  assert.equal(
    activeObservations.length,
    committedScheduleIds.size,
    `${label} must expose each committed active account result to Effects once: ${describeBudgetEvents(activeObservations)}`,
  );
  const storageOperationIds = new Set(
    storageRequests.map((event) => event.operationId),
  );
  const storageResults = trace.events.filter(
    (event) =>
      event.event === 'selectionStorageResult' &&
      storageOperationIds.has(event.operationId),
  );
  assert.equal(
    storageResults.length,
    storageRequests.length,
    `${label} must complete each causally related storage request once`,
  );
  // Count the saves that took responsibility for persisting this selection, not
  // the calls that entered saveToStorage. A genuine double write still fails;
  // a read-back that finds the record already on disk no longer does.
  const storagePersists = storageResults.filter(
    (event) => !storageNonPersistOutcomes.has(event.outcome),
  );
  assert.equal(
    storagePersists.length,
    expectedSelectionUpdates,
    `${label} must persist each selection update once: ${describeBudgetEvents(
      storagePersists,
    )} | timeline: ${describeStorageTimeline(
      trace.events,
      rawTransitionIds,
      num,
    )}`,
  );
  const longLivedMirrorCommits = trace.events.filter(
    (event) =>
      event.event === 'mirrorTrackerCommit' &&
      ['home-page', 'swap-route'].includes(event.perfDebugName),
  );
  assert.deepEqual(
    longLivedMirrorCommits,
    [],
    `${label} must not recommit a long-lived AccountSelector mirror`,
  );
}

function assertLatestWinsBurstBudget(trace) {
  assertTraceHealth({ ...trace, phase: 'latest-wins-burst' });
  assert.ok(
    trace.events.some((event) => event.event === 'activeReloadCoalesced'),
    'Rapid selection must coalesce active reloads',
  );
  assert.ok(
    trace.events.some((event) => event.event === 'globalDeriveEventCoalesced'),
    'Rapid derive writes must coalesce global derive events',
  );
  const homeDeriveStorageRequests = trace.events.filter(
    (event) =>
      event.event === 'selectionStorageRequested' &&
      event.num === 0 &&
      event.reason === 'autoDeriveGlobalSync' &&
      event.sceneName === 'home',
  );
  assert.ok(
    homeDeriveStorageRequests.length > 0,
    'Rapid derive writes must produce a final Home selection',
  );
  const finalTransitionId =
    homeDeriveStorageRequests[homeDeriveStorageRequests.length - 1]
      .transitionId;
  const finalSchedules = trace.events.filter(
    (event) =>
      event.event === 'activeReloadScheduled' &&
      event.num === 0 &&
      event.sceneName === 'home' &&
      event.transitionId === finalTransitionId,
  );
  assert.equal(
    finalSchedules.length,
    1,
    'The latest derive selection must schedule one Home active reload',
  );
  const finalResults = trace.events.filter(
    (event) =>
      event.event === 'activeReloadResult' &&
      event.num === 0 &&
      event.sceneName === 'home' &&
      event.transitionId === finalTransitionId &&
      ['commit', 'noop'].includes(event.outcome),
  );
  assert.equal(
    finalResults.length,
    1,
    'The latest derive selection must complete one Home active reload',
  );
  assert.deepEqual(
    trace.events.filter(
      (event) =>
        event.event === 'mirrorTrackerCommit' &&
        ['home-page', 'swap-route'].includes(event.perfDebugName),
    ),
    [],
    'Rapid selection must not recommit long-lived AccountSelector mirrors',
  );
}

async function openAndApproveSimulatedDAppConnection(
  page,
  devOnlyPassword,
  {
    assertInitializationDetails = true,
    cleanupConnection = false,
    expectedNetworkId = 'evm--1',
    expectedSelection,
    origin: connectionOrigin = simulatedDAppOrigin,
    writeArtifacts = true,
  } = {},
) {
  await deleteSimulatedDAppConnection(page, connectionOrigin);
  const pendingTrace = await drainPerfTrace(page, devOnlyPassword);
  await page.evaluate(
    ({ origin }) => {
      const api = globalThis.$$appGlobals.$backgroundApiProxy;
      const state = {
        hasResult: false,
        outcome: 'pending',
      };
      globalThis.__accountSelectorE2EDappConnection = state;
      void api.serviceDApp
        .openConnectionModal({
          data: {
            method: 'eth_requestAccounts',
            params: [],
          },
          id: `account-selector-e2e-${Date.now()}`,
          origin,
          scope: 'ethereum',
        })
        .then((result) => {
          state.hasResult = Boolean(result);
          state.outcome = 'resolved';
        })
        .catch((error) => {
          state.error = error?.message || String(error);
          state.outcome = 'rejected';
        });
    },
    { origin: connectionOrigin },
  );

  const modal = await getUniqueVisibleByTestID(
    page,
    DAppConnectionTestIDs.ConnectionModal,
  );
  const accountItems = modal.locator(
    visibleTestIDSelector(DAppConnectionTestIDs.AccountListItem),
  );
  await accountItems
    .first()
    .waitFor({ state: 'visible', timeout: pageTimeoutMs });
  assert.ok(
    (await accountItems.count()) >= 1,
    'DApp connection modal must render at least one account item',
  );

  const initializationTrace = await collectPerfTraceUntil(
    page,
    devOnlyPassword,
    (events) =>
      events.some(
        (event) =>
          event.event === 'autoSelectAccountResult' &&
          event.num === 0 &&
          event.sceneName === 'discover' &&
          event.source === 'active-ready',
      ) &&
      events.some(
        (event) =>
          event.event === 'manualSceneSyncResult' &&
          event.num === 0 &&
          event.sourceNum === 0 &&
          event.sourceSceneName === 'home',
      ) &&
      events.some(
        (event) =>
          event.event === 'dappConnectionAccountObserved' &&
          event.num === 0 &&
          event.hasAddress === true,
      ) &&
      events.some(
        (event) =>
          event.event === 'providerSubtreeCommit' &&
          event.perfDebugName === 'dapp-connection-modal',
      ),
  );
  assertTraceHealth({
    ...initializationTrace,
    phase: 'dapp-connection-modal-initialization',
  });
  assertDAppAccountSelectorInitializationRefreshBudget(initializationTrace);
  if (expectedSelection) {
    await assertAccountSelectorStateConsistent(page, expectedSelection, {
      assertPersistence: false,
      sceneName: 'discover',
      sceneUrl: connectionOrigin,
    });
    await assertDAppConnectionConsumer(
      page,
      expectedSelection,
      connectionOrigin,
    );
  }
  if (writeArtifacts) {
    fs.mkdirSync(artifactDir, { recursive: true });
    fs.writeFileSync(
      path.join(artifactDir, 'dapp-connection-initialization-trace.json'),
      `${JSON.stringify(initializationTrace, null, 2)}\n`,
    );
  }

  if (assertInitializationDetails) {
    const autoSelectRequests = initializationTrace.events.filter(
      (event) =>
        event.event === 'autoSelectAccountRequested' &&
        event.num === 0 &&
        event.sceneName === 'discover' &&
        event.source === 'active-ready',
    );
    assert.equal(
      autoSelectRequests.length,
      1,
      'DApp connection modal must start auto-select exactly once',
    );
    const sceneSyncRequests = initializationTrace.events.filter(
      (event) =>
        event.event === 'manualSceneSyncRequested' &&
        event.num === 0 &&
        event.sourceNum === 0 &&
        event.sourceSceneName === 'home',
    );
    assert.equal(
      sceneSyncRequests.length,
      1,
      'DApp connection modal must sync Home selection exactly once',
    );
    const effectInstanceIds = new Set(
      initializationTrace.events
        .filter(
          (event) =>
            event.event === 'effectsStateObserved' &&
            event.num === 0 &&
            event.sceneName === 'discover',
        )
        .map((event) => event.effectInstanceId),
    );
    assert.equal(
      effectInstanceIds.size,
      1,
      'DApp connection modal must mount one AccountSelectorEffects instance',
    );
    const appliedAccountObservations = initializationTrace.events.filter(
      (event) =>
        event.event === 'dappConnectionAccountObserved' &&
        event.num === 0 &&
        event.appliedToModal === true,
    );
    assert.equal(
      appliedAccountObservations.length,
      1,
      'DApp connection modal must apply one usable account observation',
    );
    const accountObservations = initializationTrace.events.filter(
      (event) =>
        event.event === 'dappConnectionAccountObserved' && event.num === 0,
    );
    assert.ok(
      accountObservations.length <= 2,
      `DApp connection modal observed ${accountObservations.length} account states (limit 2)`,
    );
    const sceneSyncResults = initializationTrace.events.filter(
      (event) =>
        event.event === 'manualSceneSyncResult' &&
        event.num === 0 &&
        event.sourceSceneName === 'home',
    );
    assert.ok(
      sceneSyncResults.length >= 1,
      'DApp connection initialization must run a scene sync from home',
    );
    for (const syncResult of sceneSyncResults) {
      // A dropped sync leaves the modal on its own previously persisted account
      // while Home shows another one, and the sync has no retry. Asserted as an
      // allow-list rather than notEqual('stale'): every other outcome in the
      // selection-update vocabulary ('stale', 'skip-older-event',
      // 'skip-equal-event-conflict', 'skip-unversioned-event', 'skip-empty',
      // 'error') means the sync was discarded, and an exclusion check would
      // silently pass any drop outcome added after it was written.
      assert.ok(
        ['commit', 'noop'].includes(syncResult.outcome),
        `DApp connection scene sync must apply or noop, got '${syncResult.outcome}'`,
      );
    }
    const initializationSelectionUpdates = initializationTrace.events.filter(
      (event) =>
        event.event === 'selectionStateUpdated' &&
        event.num === 0 &&
        ['syncFromScene', 'autoSelectNetwork', 'autoDeriveFallback'].includes(
          event.reason,
        ),
    );
    assert.equal(
      initializationSelectionUpdates.length,
      1,
      `DApp connection initialization must update selection once, received ${initializationSelectionUpdates.length}`,
    );
    assert.equal(
      initializationSelectionUpdates[0]?.reason,
      'syncFromScene',
      'DApp connection initialization must atomically prepare the Home selection',
    );
    for (const field of [
      'walletId',
      'indexedAccountId',
      'networkId',
      'deriveType',
      'focusedWallet',
    ]) {
      assert.ok(
        initializationSelectionUpdates[0]?.changedFields?.includes(field),
        `DApp connection atomic selection update must include ${field}`,
      );
    }
    const initializationActiveReloads = initializationTrace.events.filter(
      (event) =>
        event.event === 'activeReloadResult' &&
        event.num === 0 &&
        event.sceneName === 'discover' &&
        event.outcome === 'commit' &&
        ['syncFromScene', 'autoSelectNetwork', 'autoDeriveFallback'].includes(
          event.reason,
        ),
    );
    assert.equal(
      initializationActiveReloads.length,
      1,
      `DApp connection initialization must reload the active account once, received ${initializationActiveReloads.length}`,
    );
    assert.equal(
      initializationActiveReloads[0]?.reason,
      'syncFromScene',
      'DApp connection initialization reload must use the atomic scene sync',
    );
  }

  const approveButton = await getUniqueVisibleByTestID(
    modal,
    DAppConnectionTestIDs.ConnectionApproveButton,
  );
  await approveButton.click({ timeout: pageTimeoutMs });
  await modal.waitFor({ state: 'hidden', timeout: pageTimeoutMs });
  await page.waitForFunction(
    () => globalThis.__accountSelectorE2EDappConnection?.outcome !== 'pending',
    undefined,
    { timeout: pageTimeoutMs },
  );
  const connectionResult = await page.evaluate(
    () => globalThis.__accountSelectorE2EDappConnection,
  );
  assert.deepEqual(
    {
      error: connectionResult?.error,
      hasResult: connectionResult?.hasResult,
      outcome: connectionResult?.outcome,
    },
    { error: undefined, hasResult: true, outcome: 'resolved' },
    'Simulated DApp connection request must resolve through the real modal',
  );
  await page.waitForTimeout(350);
  const completionTrace = await drainPerfTrace(page, devOnlyPassword);
  const trace = mergePerfTrace(
    pendingTrace,
    initializationTrace,
    completionTrace,
  );
  assertDAppAccountSelectorMirrorLifecycle(trace);
  const dappConnectionSummary = buildTraceSummary(trace.events);
  if (writeArtifacts) {
    fs.mkdirSync(artifactDir, { recursive: true });
    fs.writeFileSync(
      path.join(artifactDir, 'dapp-connection-trace.json'),
      JSON.stringify(
        {
          events: trace.events,
          summary: dappConnectionSummary,
        },
        null,
        2,
      ),
    );
  }
  const providerSummary =
    dappConnectionSummary.providerRenders.byDebugName['dapp-connection-modal'];
  assert.ok(providerSummary, 'DApp connection Provider trace is missing');
  assert.ok(
    providerSummary.commitCount <= dappConnectionProviderCommitLimit,
    `DApp connection Provider committed ${providerSummary.commitCount} times (limit ${dappConnectionProviderCommitLimit})`,
  );

  const dappMap = await page.evaluate(
    ({ origin }) =>
      globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.dappConnection.getAccountSelectorMap(
        { sceneUrl: origin },
      ),
    { origin: connectionOrigin },
  );
  assert.ok(dappMap?.[0]?.walletId, 'DApp approval must persist a wallet');
  assert.ok(
    dappMap?.[0]?.indexedAccountId || dappMap?.[0]?.othersWalletAccountId,
    'DApp approval must persist an account',
  );
  if (expectedSelection) {
    assert.equal(
      dappMap?.[0]?.walletId,
      expectedSelection.walletId,
      'DApp approval must persist the newly selected wallet',
    );
    assert.equal(
      dappMap?.[0]?.indexedAccountId,
      expectedSelection.indexedAccountId,
      'DApp approval must persist the newly selected account',
    );
  }
  if (expectedNetworkId) {
    assert.equal(
      dappMap?.[0]?.networkId,
      expectedNetworkId,
      'DApp approval must inherit the expected EVM network',
    );
  } else {
    assert.ok(
      dappMap?.[0]?.networkId?.startsWith('evm--'),
      'DApp approval must persist an EVM network',
    );
  }
  if (cleanupConnection) {
    await deleteSimulatedDAppConnection(page, connectionOrigin);
  }
  return trace;
}

async function openSimulatedDAppAccountSelector(
  page,
  { num = 0, origin: connectionOrigin = simulatedDAppOrigin } = {},
) {
  await page.waitForFunction(
    () => Boolean(globalThis.$$appGlobals.$rootAppNavigation?.pushModal),
    undefined,
    { timeout: pageTimeoutMs },
  );
  await page.evaluate(
    ({ origin, selectionNum }) => {
      globalThis.$$appGlobals.$rootAppNavigation.pushModal(
        'AccountManagerStacks',
        {
          params: {
            num: selectionNum,
            sceneName: 'discover',
            sceneUrl: origin,
          },
          screen: 'AccountSelectorStack',
        },
      );
    },
    { origin: connectionOrigin, selectionNum: num },
  );
  await getUniqueVisibleByTestID(page, AccountManagerTestIDs.walletList);
}

async function closeSimulatedDAppAccountSelector(page) {
  await page.evaluate(() => {
    globalThis.$$appGlobals.$rootAppNavigation.pop();
  });
  await waitForNoVisibleTestID(page, AccountManagerTestIDs.walletList).catch(
    () => undefined,
  );
  await waitForHomeShell(page);
}

async function buildSimulatedDAppAccountInfo(page, target) {
  return page.evaluate(
    async ({ indexedAccountId, walletId }) => {
      const api = globalThis.$$appGlobals.$backgroundApiProxy;
      const networkId = 'evm--1';
      const deriveType =
        (await api.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId,
        })) ?? 'default';
      const { accounts } =
        await api.serviceAccount.getAccountsByIndexedAccounts({
          deriveType,
          indexedAccountIds: [indexedAccountId],
          networkId,
        });
      const account = accounts[0];
      if (!account?.id || !account.address) {
        throw new Error(
          `Unable to build simulated DApp account for ${indexedAccountId}`,
        );
      }
      return {
        accountId: account.id,
        address: account.address,
        deriveType,
        focusedWallet: walletId,
        indexedAccountId,
        networkId,
        networkImpl: 'evm',
        walletId,
      };
    },
    {
      indexedAccountId: target.indexedAccountId,
      walletId: target.walletId,
    },
  );
}

function selectedAccountIdentity(selection) {
  return {
    deriveType: selection?.deriveType,
    indexedAccountId: selection?.indexedAccountId,
    networkId: selection?.networkId,
    othersWalletAccountId: selection?.othersWalletAccountId,
    walletId: selection?.walletId,
  };
}

// Every num a connection persists, not just one: assertions that must prove an
// event changed nothing need the whole map, since a stray write can land on a
// num the scenario never rendered.
async function readDAppAccountSelectorMap(page, origin) {
  return page.evaluate(
    ({ sceneUrl }) =>
      globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.dappConnection.getAccountSelectorMap(
        { sceneUrl },
      ),
    { sceneUrl: origin },
  );
}

async function openDAppConnectionList(page) {
  await page.evaluate(() => {
    globalThis.$$appGlobals.$rootAppNavigation.pushModal(
      'DAppConnectionModal',
      { screen: 'ConnectionList' },
    );
  });
  return getUniqueVisibleByTestID(page, DAppConnectionTestIDs.ConnectionList);
}

async function closeDAppConnectionList(page) {
  await page.evaluate(() => {
    globalThis.$$appGlobals.$rootAppNavigation.pop();
  });
  await waitForNoVisibleTestID(page, DAppConnectionTestIDs.ConnectionList);
  await waitForHomeShell(page);
}

async function runMultiOriginDAppScenario(page, devOnlyPassword, fixture) {
  await deleteSimulatedDAppConnection(page, simulatedDAppSecondaryOrigin);
  const homeSelection = await readPersistedSelection(page);
  const homeTarget = findFixtureTarget(fixture, homeSelection);
  const connectionTrace = await openAndApproveSimulatedDAppConnection(
    page,
    devOnlyPassword,
    {
      expectedSelection: homeTarget,
      writeArtifacts: false,
    },
  );

  const primaryNumOneTarget = {
    fixtureId: fixture.wallets[0].fixtureId,
    index: 1,
    indexedAccountId: fixture.wallets[0].indexedAccountIds[1],
    walletId: fixture.wallets[0].walletId,
  };
  const secondaryNumZeroTarget = {
    fixtureId: fixture.wallets[0].fixtureId,
    index: 0,
    indexedAccountId: fixture.wallets[0].indexedAccountIds[0],
    walletId: fixture.wallets[0].walletId,
  };
  const secondaryNumOneTarget = {
    fixtureId: fixture.wallets[1].fixtureId,
    index: 1,
    indexedAccountId: fixture.wallets[1].indexedAccountIds[1],
    walletId: fixture.wallets[1].walletId,
  };
  const secondaryNumOneUpdatedTarget = {
    fixtureId: fixture.wallets[1].fixtureId,
    index: 0,
    indexedAccountId: fixture.wallets[1].indexedAccountIds[0],
    walletId: fixture.wallets[1].walletId,
  };
  const [primaryNumOneInfo, secondaryNumZeroInfo, secondaryNumOneInfo] =
    await Promise.all([
      buildSimulatedDAppAccountInfo(page, primaryNumOneTarget),
      buildSimulatedDAppAccountInfo(page, secondaryNumZeroTarget),
      buildSimulatedDAppAccountInfo(page, secondaryNumOneTarget),
    ]);
  await page.evaluate(
    async ({
      primaryAccount,
      primaryOrigin,
      secondaryAccounts,
      secondaryOrigin,
    }) => {
      const dappConnection =
        globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.dappConnection;
      await dappConnection.upsertConnection({
        accountsInfo: [primaryAccount],
        imageURL: '',
        origin: primaryOrigin,
        storageType: 'injectedProvider',
      });
      await dappConnection.upsertConnection({
        accountsInfo: secondaryAccounts,
        imageURL: '',
        origin: secondaryOrigin,
        storageType: 'injectedProvider',
      });
    },
    {
      primaryAccount: primaryNumOneInfo,
      primaryOrigin: simulatedDAppOrigin,
      secondaryAccounts: [secondaryNumZeroInfo, secondaryNumOneInfo],
      secondaryOrigin: simulatedDAppSecondaryOrigin,
    },
  );

  await drainResidualPerfTrace(page, devOnlyPassword);
  const connectionList = await openDAppConnectionList(page);
  const connectionItems = connectionList.locator(
    visibleTestIDSelector(DAppConnectionTestIDs.ConnectionListItem),
  );
  await connectionItems
    .nth(1)
    .waitFor({ state: 'visible', timeout: pageTimeoutMs });
  assert.equal(
    await connectionItems.count(),
    2,
    'DApp connection list must render both simulated origins',
  );

  const scenarios = [
    {
      origin: simulatedDAppOrigin,
      targets: [homeTarget, primaryNumOneTarget],
    },
    {
      origin: simulatedDAppSecondaryOrigin,
      targets: [secondaryNumZeroTarget, secondaryNumOneTarget],
    },
  ];
  for (const scenario of scenarios) {
    const hostname = new URL(scenario.origin).hostname;
    const connectionItem = connectionItems.filter({ hasText: hostname });
    assert.equal(
      await connectionItem.count(),
      1,
      `DApp connection list must render one card for ${scenario.origin}`,
    );
    const accountCards = connectionItem.locator(
      visibleTestIDSelector(DAppConnectionTestIDs.AccountListItem),
    );
    await accountCards
      .nth(1)
      .waitFor({ state: 'visible', timeout: pageTimeoutMs });
    assert.equal(
      await accountCards.count(),
      2,
      `${scenario.origin} must render enabledNum 0 and 1`,
    );
    for (const [num, target] of scenario.targets.entries()) {
      await assertAccountSelectorStateConsistent(page, target, {
        assertUI: false,
        num,
        sceneName: 'discover',
        sceneUrl: scenario.origin,
      });
    }
  }
  const initializationTrace = await drainPerfTrace(page, devOnlyPassword);
  assertTraceHealth({
    ...initializationTrace,
    phase: 'dapp-multi-origin-initialization',
  });
  for (const scenario of scenarios) {
    assert.ok(
      initializationTrace.events.some(
        (event) =>
          event.event === 'providerSubtreeCommit' &&
          event.perfDebugName === `dapp-connection-list:${scenario.origin}` &&
          event.enabledNum?.join(',') === '0,1',
      ),
      `${scenario.origin} must mount one profiled Discover provider for enabledNum 0 and 1`,
    );
  }

  const mapsBeforeSelection = await Promise.all(
    scenarios.map(({ origin }) =>
      page.evaluate(
        ({ sceneUrl }) =>
          globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.dappConnection.getAccountSelectorMap(
            { sceneUrl },
          ),
        { sceneUrl: origin },
      ),
    ),
  );
  const secondaryConnectionItem = connectionItems.filter({
    hasText: new URL(simulatedDAppSecondaryOrigin).hostname,
  });
  const secondaryAccountCards = secondaryConnectionItem.locator(
    visibleTestIDSelector(DAppConnectionTestIDs.AccountListItem),
  );
  await page.evaluate(
    ({ origin }) => {
      const api = globalThis.$$appGlobals.$backgroundApiProxy;
      const methodKey = 'serviceDApp.updateConnectionSession';
      const originalUpdateConnectionSession =
        api.serviceDApp.updateConnectionSession;
      globalThis.$$accountSelectorE2EDAppUpdateHistory = [];
      globalThis.$$accountSelectorE2EOriginalDAppUpdate =
        originalUpdateConnectionSession;
      api._proxyServiceCache[methodKey] = async (...args) => {
        const [params] = args;
        if (params.origin === origin) {
          globalThis.$$accountSelectorE2EDAppUpdateHistory.push({
            at: Date.now(),
            params,
          });
        }
        return originalUpdateConnectionSession(...args);
      };
    },
    { origin: simulatedDAppSecondaryOrigin },
  );
  await drainResidualPerfTrace(page, devOnlyPassword);
  await secondaryAccountCards
    .nth(1)
    .locator(visibleTestIDSelector(AccountSelectorTestIDs.dappAccountName))
    .click({ timeout: pageTimeoutMs });
  await getUniqueVisibleByTestID(page, AccountManagerTestIDs.walletList);
  const wallet = await getUniqueVisibleByTestID(
    page,
    AccountManagerTestIDs.wallet(secondaryNumOneUpdatedTarget.walletId),
  );
  await wallet.click({ timeout: pageTimeoutMs });
  const account = await getUniqueVisibleByTestID(
    page,
    AccountManagerTestIDs.accountItem(secondaryNumOneUpdatedTarget.index),
  );
  await account.click({ timeout: pageTimeoutMs });
  await page.waitForFunction(
    async ({ expectedIndexedAccountId, origin }) => {
      const map =
        await globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.dappConnection.getAccountSelectorMap(
          { sceneUrl: origin },
        );
      const snapshot =
        globalThis.$$appGlobals.$$accountSelectorE2EStateAccessor?.getSnapshot?.(
          {
            num: 1,
            sceneName: 'discover',
            sceneUrl: origin,
          },
        );
      return Boolean(
        map?.[1]?.indexedAccountId === expectedIndexedAccountId &&
        snapshot?.selected?.indexedAccountId === expectedIndexedAccountId &&
        snapshot.active?.ready &&
        snapshot.active.indexedAccountId === expectedIndexedAccountId,
      );
    },
    {
      expectedIndexedAccountId: secondaryNumOneUpdatedTarget.indexedAccountId,
      origin: simulatedDAppSecondaryOrigin,
    },
    { timeout: pageTimeoutMs },
  );
  await page.waitForTimeout(500);
  await page.waitForFunction(
    ({ expectedIndexedAccountId, origin }) =>
      globalThis.$$accountSelectorE2EDAppUpdateHistory?.some(
        ({ params }) =>
          params.origin === origin &&
          params.accountSelectorNum === 1 &&
          params.updatedAccountInfo?.indexedAccountId ===
            expectedIndexedAccountId,
      ),
    {
      expectedIndexedAccountId: secondaryNumOneUpdatedTarget.indexedAccountId,
      origin: simulatedDAppSecondaryOrigin,
    },
    { timeout: pageTimeoutMs },
  );
  const dappUpdateHistory = await page.evaluate(() => {
    const api = globalThis.$$appGlobals.$backgroundApiProxy;
    const methodKey = 'serviceDApp.updateConnectionSession';
    const history = globalThis.$$accountSelectorE2EDAppUpdateHistory;
    api._proxyServiceCache[methodKey] =
      globalThis.$$accountSelectorE2EOriginalDAppUpdate;
    delete globalThis.$$accountSelectorE2EDAppUpdateHistory;
    delete globalThis.$$accountSelectorE2EOriginalDAppUpdate;
    return history;
  });
  assert.equal(
    dappUpdateHistory.length,
    1,
    'One Discover account selection must update one DApp session',
  );
  await assertAccountSelectorStateConsistent(
    page,
    secondaryNumOneUpdatedTarget,
    {
      assertUI: false,
      num: 1,
      sceneName: 'discover',
      sceneUrl: simulatedDAppSecondaryOrigin,
    },
  );
  const selectionTrace = await collectSelectionOperationTrace(
    page,
    devOnlyPassword,
    {
      expectActiveReload: true,
      num: 1,
      reason: 'userSelectAccount',
      sceneName: 'discover',
    },
  );
  assertSelectionOperationBudget(selectionTrace, {
    expectedActiveReloads: 1,
    expectedSelectionUpdates: 1,
    label: 'Discover secondary origin num 1 account selection',
    num: 1,
    reason: 'userSelectAccount',
    sceneName: 'discover',
  });

  const mapsAfterSelection = await Promise.all(
    scenarios.map(({ origin }) =>
      page.evaluate(
        ({ sceneUrl }) =>
          globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.dappConnection.getAccountSelectorMap(
            { sceneUrl },
          ),
        { sceneUrl: origin },
      ),
    ),
  );
  assert.deepEqual(
    [
      selectedAccountIdentity(mapsAfterSelection[0]?.[0]),
      selectedAccountIdentity(mapsAfterSelection[0]?.[1]),
      selectedAccountIdentity(mapsAfterSelection[1]?.[0]),
    ],
    [
      selectedAccountIdentity(mapsBeforeSelection[0]?.[0]),
      selectedAccountIdentity(mapsBeforeSelection[0]?.[1]),
      selectedAccountIdentity(mapsBeforeSelection[1]?.[0]),
    ],
    'Updating one Discover origin/num must not mutate the other three selections',
  );
  assert.equal(
    mapsAfterSelection[1]?.[1]?.indexedAccountId,
    secondaryNumOneUpdatedTarget.indexedAccountId,
    'The selected Discover origin/num must persist its new account',
  );

  await closeDAppConnectionList(page);
  await deleteSimulatedDAppConnection(page, simulatedDAppOrigin);
  await deleteSimulatedDAppConnection(page, simulatedDAppSecondaryOrigin);
  const trace = mergePerfTrace(
    connectionTrace,
    initializationTrace,
    selectionTrace,
  );
  assertTraceHealth({ ...trace, phase: 'dapp-multi-origin' });
  return trace;
}

async function runSimulatedDAppScenario(page, devOnlyPassword, fixture) {
  const homeSelection = await readPersistedSelection(page);
  const target = findFixtureTarget(fixture, homeSelection);
  const connectionTrace = await openAndApproveSimulatedDAppConnection(
    page,
    devOnlyPassword,
    { expectedSelection: target },
  );
  await drainResidualPerfTrace(page, devOnlyPassword);
  await openSimulatedDAppAccountSelector(page);

  const initializationTrace = await collectPerfTraceUntil(
    page,
    devOnlyPassword,
    (events) =>
      events.some(
        (event) =>
          event.event === 'storageInitResult' &&
          event.sceneName === 'discover' &&
          event.outcome !== 'error-finalized',
      ) &&
      events.some(
        (event) =>
          event.event === 'effectsStateObserved' &&
          event.num === 0 &&
          event.sceneName === 'discover' &&
          event.selection?.networkId === 'evm--1' &&
          event.selection?.hasWallet === true,
      ),
  );
  assertTraceHealth({ ...initializationTrace, phase: 'dapp-initialization' });
  await assertAccountSelectorStateConsistent(page, target, {
    sceneName: 'discover',
    sceneUrl: simulatedDAppOrigin,
  });

  const dappMapBeforeIgnoredEvents = await readDAppAccountSelectorMap(
    page,
    simulatedDAppOrigin,
  );
  await page.evaluate(
    ({ origin }) => {
      const eventBus = globalThis.$$appGlobals.$appEventBus;
      eventBus.emit('DAppNetworkUpdate', {
        networkId: 'evm--137',
        num: 0,
        sceneName: 'discover',
        sceneUrl: `${origin}.wrong`,
      });
      eventBus.emit('DAppNetworkUpdate', {
        networkId: 'evm--137',
        num: 1,
        sceneName: 'discover',
        sceneUrl: origin,
      });
    },
    { origin: simulatedDAppOrigin },
  );
  await page.waitForTimeout(500);
  const ignoredEventTrace = await drainPerfTrace(page, devOnlyPassword);
  // The two events above are rejected by different mechanisms, so they are
  // asserted separately rather than as one "no request at all" check.
  //
  // The wrong-origin event carries num 0 — this instance's OWN num — so the
  // only thing that can stop it is the sceneUrl guard in
  // AccountSelectorEffects' updateNetwork handler. A 'dappNetworkEvent'
  // request on num 0 therefore means one DApp origin steered another origin's
  // selection, which is the cross-origin isolation this phase exists to
  // protect.
  //
  // The origin-matching event carries num 1 and is deliberately NOT filtered
  // by num: updateNetwork routes on scene identity alone so that whichever
  // instance is mounted applies the event on behalf of params.num, because the
  // instance for that num may not be mounted at all (see the comment on
  // updateNetwork in AccountSelectorEffects.tsx). It may therefore legitimately
  // enter updateSelectedAccount — what it must never do is change a persisted
  // selection, which the map comparison below covers for every num.
  assert.deepEqual(
    ignoredEventTrace.events.filter(
      (event) =>
        event.event === 'selectionUpdateRequested' &&
        event.reason === 'dappNetworkEvent' &&
        event.num !== 1,
    ),
    [],
    'A DApp network event must only reach the num it targets; a request on any other num means the wrong-origin event crossed the sceneUrl guard',
  );
  assert.deepEqual(
    await readDAppAccountSelectorMap(page, simulatedDAppOrigin),
    dappMapBeforeIgnoredEvents,
    'Neither a wrong-origin nor a wrong-num DApp network event may change any persisted connection selection',
  );
  await assertAccountSelectorStateConsistent(page, target, {
    sceneName: 'discover',
    sceneUrl: simulatedDAppOrigin,
  });

  await page.evaluate(
    async ({ origin }) => {
      await globalThis.$$appGlobals.$backgroundApiProxy.serviceDApp.switchConnectedNetwork(
        {
          newNetworkId: 'evm--137',
          oldNetworkId: 'evm--1',
          origin,
          scope: 'ethereum',
        },
      );
    },
    { origin: simulatedDAppOrigin },
  );
  const updateTrace = await collectPerfTraceUntil(
    page,
    devOnlyPassword,
    (events) =>
      events.some(
        (event) =>
          event.event === 'selectionUpdateResult' &&
          event.reason === 'dappNetworkEvent',
      ) &&
      events.some(
        (event) =>
          event.event === 'effectsStateObserved' &&
          event.num === 0 &&
          event.sceneName === 'discover' &&
          event.selection?.networkId === 'evm--137',
      ) &&
      events.some(
        (event) =>
          event.event === 'activeReloadResult' &&
          event.num === 0 &&
          event.sceneName === 'discover',
      ),
  );
  const dappMap = await page.evaluate(
    ({ origin }) =>
      globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.dappConnection.getAccountSelectorMap(
        { sceneUrl: origin },
      ),
    { origin: simulatedDAppOrigin },
  );
  assert.equal(
    dappMap?.[0]?.networkId,
    'evm--137',
    'Simulated DApp connection must persist the switched network',
  );
  const dappRequests = updateTrace.events.filter(
    (event) =>
      event.event === 'selectionUpdateRequested' &&
      event.reason === 'dappNetworkEvent',
  );
  assert.equal(
    dappRequests.length,
    1,
    'A DApp network update must enter selection update exactly once',
  );
  assertSelectionOperationBudget(updateTrace, {
    expectedActiveReloads: 1,
    expectedSelectionUpdates: 1,
    label: 'DApp network selection',
    reason: 'dappNetworkEvent',
    sceneName: 'discover',
  });
  await assertAccountSelectorStateConsistent(page, target, {
    sceneName: 'discover',
    sceneUrl: simulatedDAppOrigin,
  });

  const trace = mergePerfTrace(
    connectionTrace,
    initializationTrace,
    ignoredEventTrace,
    updateTrace,
  );
  assertTraceHealth({ ...trace, phase: 'simulated-dapp' });
  await closeSimulatedDAppAccountSelector(page);
  await deleteSimulatedDAppConnection(page);
  return trace;
}

// The connection operations the other DApp phases never exercise: rejecting a
// connection request, disconnecting one origin from the connection list, and
// removing every connection at once. Each operation is asserted on both sides
// of the boundary — the background promise settlement / dappConnection storage
// AND the list UI — so a regression names which side broke.
async function runDAppConnectionOpsScenario(page, devOnlyPassword, fixture) {
  const homeSelectionBefore = await readPersistedSelection(page);
  const homeTarget = findFixtureTarget(fixture, homeSelectionBefore);

  // --- Reject: the openConnectionModal promise must reject, persist nothing.
  await deleteSimulatedDAppConnection(page, simulatedDAppRejectOrigin);
  const rejectPendingTrace = await drainPerfTrace(page, devOnlyPassword);
  await page.evaluate(
    ({ origin }) => {
      const api = globalThis.$$appGlobals.$backgroundApiProxy;
      const state = {
        hasResult: false,
        outcome: 'pending',
      };
      globalThis.__accountSelectorE2EDappRejection = state;
      void api.serviceDApp
        .openConnectionModal({
          data: {
            method: 'eth_requestAccounts',
            params: [],
          },
          id: `account-selector-e2e-reject-${Date.now()}`,
          origin,
          scope: 'ethereum',
        })
        .then((result) => {
          state.hasResult = Boolean(result);
          state.outcome = 'resolved';
        })
        .catch((error) => {
          state.errorCode = error?.code;
          state.errorMessage = error?.message || String(error);
          state.outcome = 'rejected';
        });
    },
    { origin: simulatedDAppRejectOrigin },
  );
  const rejectModal = await getUniqueVisibleByTestID(
    page,
    DAppConnectionTestIDs.ConnectionModal,
  );
  await rejectModal
    .locator(visibleTestIDSelector(DAppConnectionTestIDs.AccountListItem))
    .first()
    .waitFor({ state: 'visible', timeout: pageTimeoutMs });
  // The modal initializes identically whether it will be approved or rejected,
  // so the reject path must satisfy the same initialization budget.
  const rejectInitializationTrace = await collectPerfTraceUntil(
    page,
    devOnlyPassword,
    (events) =>
      events.some(
        (event) =>
          event.event === 'autoSelectAccountResult' &&
          event.num === 0 &&
          event.sceneName === 'discover' &&
          event.source === 'active-ready',
      ) &&
      events.some(
        (event) =>
          event.event === 'manualSceneSyncResult' &&
          event.num === 0 &&
          event.sourceNum === 0 &&
          event.sourceSceneName === 'home',
      ) &&
      events.some(
        (event) =>
          event.event === 'dappConnectionAccountObserved' &&
          event.num === 0 &&
          event.hasAddress === true,
      ) &&
      events.some(
        (event) =>
          event.event === 'providerSubtreeCommit' &&
          event.perfDebugName === 'dapp-connection-modal',
      ),
  );
  assertTraceHealth({
    ...rejectInitializationTrace,
    phase: 'dapp-reject-initialization',
  });
  assertDAppAccountSelectorInitializationRefreshBudget(
    rejectInitializationTrace,
  );

  const rejectButton = await getUniqueVisibleByTestID(
    rejectModal,
    DAppConnectionTestIDs.ConnectionRejectButton,
  );
  await rejectButton.click({ timeout: pageTimeoutMs });
  await rejectModal.waitFor({ state: 'hidden', timeout: pageTimeoutMs });
  await page.waitForFunction(
    () => globalThis.__accountSelectorE2EDappRejection?.outcome !== 'pending',
    undefined,
    { timeout: pageTimeoutMs },
  );
  const rejectionResult = await page.evaluate(() => {
    const state = globalThis.__accountSelectorE2EDappRejection;
    delete globalThis.__accountSelectorE2EDappRejection;
    return state;
  });
  assert.deepEqual(
    rejectionResult,
    {
      errorCode: 4001,
      errorMessage: 'User rejected the request.',
      hasResult: false,
      outcome: 'rejected',
    },
    'Rejecting the connection modal must settle the DApp request with the EIP-1193 userRejectedRequest error',
  );
  const rejectedMap = await page.evaluate(
    ({ origin }) =>
      globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.dappConnection.getAccountSelectorMap(
        { sceneUrl: origin },
      ),
    { origin: simulatedDAppRejectOrigin },
  );
  assert.equal(
    rejectedMap,
    undefined,
    'A rejected DApp connection must not persist any dappConnection entry',
  );
  await page.waitForTimeout(350);
  const rejectCompletionTrace = await drainPerfTrace(page, devOnlyPassword);
  const rejectTrace = mergePerfTrace(
    rejectPendingTrace,
    rejectInitializationTrace,
    rejectCompletionTrace,
  );
  assertDAppAccountSelectorMirrorLifecycle(rejectTrace);
  const rejectSummary = buildTraceSummary(rejectTrace.events);
  const rejectProviderSummary =
    rejectSummary.providerRenders.byDebugName['dapp-connection-modal'];
  assert.ok(rejectProviderSummary, 'DApp rejection Provider trace is missing');
  assert.ok(
    rejectProviderSummary.commitCount <= dappConnectionProviderCommitLimit,
    `DApp rejection Provider committed ${rejectProviderSummary.commitCount} times (limit ${dappConnectionProviderCommitLimit})`,
  );
  assertTraceHealth({ ...rejectTrace, phase: 'dapp-reject' });

  // --- Disconnect one origin: the other origin's storage must stay untouched.
  const primaryConnectionTrace = await openAndApproveSimulatedDAppConnection(
    page,
    devOnlyPassword,
    {
      assertInitializationDetails: false,
      expectedSelection: homeTarget,
      writeArtifacts: false,
    },
  );
  const secondaryConnectionTrace = await openAndApproveSimulatedDAppConnection(
    page,
    devOnlyPassword,
    {
      assertInitializationDetails: false,
      expectedSelection: homeTarget,
      origin: simulatedDAppSecondaryOrigin,
      writeArtifacts: false,
    },
  );

  await drainResidualPerfTrace(page, devOnlyPassword);
  const connectionList = await openDAppConnectionList(page);
  const connectionItems = connectionList.locator(
    visibleTestIDSelector(DAppConnectionTestIDs.ConnectionListItem),
  );
  await connectionItems
    .nth(1)
    .waitFor({ state: 'visible', timeout: pageTimeoutMs });
  assert.equal(
    await connectionItems.count(),
    2,
    'DApp connection list must render both approved origins',
  );
  const listInitializationTrace = await collectPerfTraceUntil(
    page,
    devOnlyPassword,
    (events) =>
      [simulatedDAppOrigin, simulatedDAppSecondaryOrigin].every((origin) =>
        events.some(
          (event) =>
            event.event === 'providerSubtreeCommit' &&
            event.perfDebugName === `dapp-connection-list:${origin}` &&
            event.enabledNum?.join(',') === '0',
        ),
      ),
  );
  assertTraceHealth({
    ...listInitializationTrace,
    phase: 'dapp-ops-list-initialization',
  });

  const mapsBeforeDisconnect = await Promise.all(
    [simulatedDAppOrigin, simulatedDAppSecondaryOrigin].map((origin) =>
      page.evaluate(
        ({ sceneUrl }) =>
          globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.dappConnection.getAccountSelectorMap(
            { sceneUrl },
          ),
        { sceneUrl: origin },
      ),
    ),
  );
  assert.ok(
    mapsBeforeDisconnect[0]?.[0]?.walletId &&
      mapsBeforeDisconnect[1]?.[0]?.walletId,
    'Both approved origins must have a persisted dappConnection entry',
  );

  const primaryCard = connectionItems.filter({
    hasText: new URL(simulatedDAppOrigin).hostname,
  });
  assert.equal(
    await primaryCard.count(),
    1,
    `DApp connection list must render one card for ${simulatedDAppOrigin}`,
  );
  const disconnectButton = await getUniqueVisibleByTestID(
    primaryCard,
    DAppConnectionTestIDs.ConnectionListDisconnectButton,
  );
  await disconnectButton.click({ timeout: pageTimeoutMs });
  await primaryCard.waitFor({ state: 'hidden', timeout: pageTimeoutMs });
  assert.equal(
    await connectionItems.count(),
    1,
    'Disconnecting one origin must leave exactly one connection card',
  );
  assert.equal(
    await connectionItems
      .filter({ hasText: new URL(simulatedDAppSecondaryOrigin).hostname })
      .count(),
    1,
    'The remaining connection card must belong to the untouched origin',
  );
  const mapsAfterDisconnect = await Promise.all(
    [simulatedDAppOrigin, simulatedDAppSecondaryOrigin].map((origin) =>
      page.evaluate(
        ({ sceneUrl }) =>
          globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.dappConnection.getAccountSelectorMap(
            { sceneUrl },
          ),
        { sceneUrl: origin },
      ),
    ),
  );
  assert.equal(
    mapsAfterDisconnect[0],
    undefined,
    'Disconnecting an origin must delete its dappConnection entry',
  );
  assert.deepEqual(
    mapsAfterDisconnect[1],
    mapsBeforeDisconnect[1],
    'Disconnecting one origin must not mutate the other origin selections',
  );

  // --- Remove all: every connection gone, HOME scene selection untouched.
  const removeAllButton = await getUniqueVisibleByTestID(
    page,
    DAppConnectionTestIDs.ConnectionListRemoveAllButton,
  );
  await removeAllButton.click({ timeout: pageTimeoutMs });
  await waitForNoVisibleTestID(page, DAppConnectionTestIDs.ConnectionListItem);
  const mapsAfterRemoveAll = await Promise.all(
    [simulatedDAppOrigin, simulatedDAppSecondaryOrigin].map((origin) =>
      page.evaluate(
        ({ sceneUrl }) =>
          globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.dappConnection.getAccountSelectorMap(
            { sceneUrl },
          ),
        { sceneUrl: origin },
      ),
    ),
  );
  assert.deepEqual(
    mapsAfterRemoveAll,
    [undefined, undefined],
    'Removing all connections must delete every origin dappConnection entry',
  );
  const homeSelectionAfter = await readPersistedSelection(page);
  assert.deepEqual(
    homeSelectionAfter,
    homeSelectionBefore,
    'DApp connection operations must not disturb the HOME scene selection',
  );

  await closeDAppConnectionList(page);
  await page.waitForTimeout(350);
  const operationsTrace = await drainPerfTrace(page, devOnlyPassword);
  const trace = mergePerfTrace(
    rejectTrace,
    primaryConnectionTrace,
    secondaryConnectionTrace,
    listInitializationTrace,
    operationsTrace,
  );
  assertTraceHealth({ ...trace, phase: 'dapp-ops' });
  return trace;
}

async function openBulkSendAddressInput(page, target) {
  await switchAppTab(page, 'Home');
  await page.evaluate(
    ({ indexedAccountId }) => {
      globalThis.$$appGlobals.$rootAppNavigation.navigate(
        'main',
        {
          screen: 'Home',
          params: {
            screen: 'TabHomeBulkSendAddressesInput',
            params: {
              accountId: undefined,
              bulkSendMode: 'oneToMany',
              indexedAccountId,
              networkId: 'evm--1',
            },
          },
        },
        { pop: true },
      );
    },
    { indexedAccountId: target.indexedAccountId },
  );
  await page.waitForFunction(
    () => {
      let state =
        globalThis.$$appGlobals.$navigationRef?.current?.getRootState();
      while (state?.routes?.length) {
        const route = state.routes[state.index ?? 0];
        if (!route) break;
        if (route.name === 'TabHomeBulkSendAddressesInput') return true;
        state = route.state;
      }
      return false;
    },
    undefined,
    { timeout: pageTimeoutMs },
  );
  await getUniqueVisibleByTestID(
    page,
    AddressInputTestIDs.accountSelectorButton,
  );
}

async function closeBulkSendAddressInput(page) {
  await page.evaluate(() => {
    globalThis.$$appGlobals.$rootAppNavigation.navigate(
      'main',
      {
        screen: 'Home',
        params: { screen: 'TabHome' },
      },
      { pop: true },
    );
  });
  await page.waitForFunction(
    () => {
      let state =
        globalThis.$$appGlobals.$navigationRef?.current?.getRootState();
      while (state?.routes?.length) {
        const route = state.routes[state.index ?? 0];
        if (!route) break;
        if (route.name === 'TabHome') return true;
        state = route.state;
      }
      return false;
    },
    undefined,
    { timeout: pageTimeoutMs },
  );
  await waitForHomeShell(page);
}

async function openSendAddressInput(page, senderTarget) {
  await page.evaluate(
    async ({ indexedAccountId }) => {
      const api = globalThis.$$appGlobals.$backgroundApiProxy;
      const { accounts } =
        await api.serviceAccount.getAccountsByIndexedAccounts({
          deriveType: 'default',
          indexedAccountIds: [indexedAccountId],
          networkId: 'evm--1',
        });
      const account = accounts[0];
      if (!account?.id) {
        throw new Error(`Missing Send sender account ${indexedAccountId}`);
      }
      const token = await api.serviceToken.getNativeToken({
        accountId: account.id,
        networkId: 'evm--1',
      });
      globalThis.$$appGlobals.$rootAppNavigation.pushModal(
        'SignatureConfirmModal',
        {
          screen: 'TxDataInput',
          params: {
            accountId: account.id,
            isNFT: false,
            networkId: 'evm--1',
            token,
          },
        },
      );
    },
    { indexedAccountId: senderTarget.indexedAccountId },
  );
  await page.waitForFunction(
    () => {
      let state =
        globalThis.$$appGlobals.$navigationRef?.current?.getRootState();
      while (state?.routes?.length) {
        const route = state.routes[state.index ?? 0];
        if (!route) break;
        if (route.name === 'TxDataInput') return true;
        state = route.state;
      }
      return false;
    },
    undefined,
    { timeout: pageTimeoutMs },
  );
  await getUniqueVisibleByTestID(page, SendTestIDs.dataInputPage);
}

async function closeSendFlow(page) {
  await page.evaluate(() => {
    globalThis.$$appGlobals.$rootAppNavigation.pop();
  });
  await waitForNoVisibleTestID(page, SendTestIDs.amountInput);
  await getUniqueVisibleByTestID(page, SendTestIDs.dataInputPage);
  await page.evaluate(() => {
    globalThis.$$appGlobals.$rootAppNavigation.pop();
  });
  await waitForNoVisibleTestID(page, SendTestIDs.dataInputPage);
  await waitForHomeShell(page);
}

async function runSendAddressInputScenario(page, devOnlyPassword, fixture) {
  const senderTarget = {
    fixtureId: fixture.wallets[0].fixtureId,
    index: 0,
    indexedAccountId: fixture.wallets[0].indexedAccountIds[0],
    walletId: fixture.wallets[0].walletId,
  };
  const recipientAddress =
    fixture.addressFixtures[fixture.wallets[1].fixtureId][0]['evm--1'].default;
  await selectWalletAccount(page, senderTarget);
  await selectNetwork(page, 'evm--1');
  await assertAccountSelectorStateConsistent(page, senderTarget);
  await drainResidualPerfTrace(page, devOnlyPassword);
  await openSendAddressInput(page, senderTarget);
  const initializationTrace = await drainPerfTrace(page, devOnlyPassword);
  assertTraceHealth({
    ...initializationTrace,
    phase: 'send-address-input-initialization',
  });
  assert.ok(
    initializationTrace.events.some(
      (event) =>
        event.event === 'providerSubtreeCommit' &&
        event.perfDebugName === 'send-address-input' &&
        event.enabledNum?.join(',') === '0',
    ),
    'Send must mount addressInput enabledNum 0',
  );
  const snapshot = await readAccountSelectorStateSnapshot(page, {
    num: 0,
    sceneName: 'addressInput',
    sceneUrl: '',
  });
  assert.equal(
    snapshot?.selected?.indexedAccountId,
    undefined,
    'Send addressInput must not inherit a selected recipient account',
  );

  await getUniqueVisibleByTestID(page, SendTestIDs.recipientInput, {
    timeout: uiSettleTimeoutMs,
  });
  const accountTab = await getUniqueVisibleByTestID(
    page,
    SendTestIDs.recipientQuickSelectAccountTab,
    { timeout: uiSettleTimeoutMs },
  );
  await accountTab.click({ timeout: pageTimeoutMs });
  const recipient = await getUniqueVisibleByTestID(
    page,
    SendTestIDs.recipientItem(recipientAddress),
  );
  await recipient.click({ timeout: pageTimeoutMs });
  await page.waitForFunction(
    () => {
      let state =
        globalThis.$$appGlobals.$navigationRef?.current?.getRootState();
      while (state?.routes?.length) {
        const route = state.routes[state.index ?? 0];
        if (!route) break;
        if (route.name === 'TxAmountInput') return true;
        state = route.state;
      }
      return false;
    },
    undefined,
    { timeout: pageTimeoutMs },
  );
  await getUniqueVisibleByTestID(page, SendTestIDs.amountInput);
  const selectionTrace = await drainPerfTrace(page, devOnlyPassword);
  await closeSendFlow(page);
  const closeTrace = await drainPerfTrace(page, devOnlyPassword);
  const trace = mergePerfTrace(initializationTrace, selectionTrace, closeTrace);
  assertTraceHealth({ ...trace, phase: 'send-address-input' });
  return trace;
}

async function runBulkSendAccountRemovalScenario(
  page,
  devOnlyPassword,
  fixture,
) {
  const removedTarget = {
    fixtureId: fixture.wallets[1].fixtureId,
    index: 1,
    indexedAccountId: fixture.wallets[1].indexedAccountIds[1],
    walletId: fixture.wallets[1].walletId,
  };
  await selectWalletAccount(page, removedTarget);
  await selectNetwork(page, 'evm--1');
  await assertAccountSelectorStateConsistent(page, removedTarget);
  await drainResidualPerfTrace(page, devOnlyPassword);
  await openBulkSendAddressInput(page, removedTarget);
  const initialTrace = await drainPerfTrace(page, devOnlyPassword);
  assertTraceHealth({
    ...initialTrace,
    phase: 'bulk-send-address-input-initialization',
  });
  assert.ok(
    initialTrace.events.some(
      (event) =>
        event.event === 'providerSubtreeCommit' &&
        event.perfDebugName === 'bulk-send-address-input' &&
        event.enabledNum?.join(',') === '0,1',
    ),
    'BulkSend must mount addressInput enabledNum 0 and 1',
  );
  for (const num of [0, 1]) {
    const snapshot = await readAccountSelectorStateSnapshot(page, {
      num,
      sceneName: 'addressInput',
      sceneUrl: '',
    });
    assert.equal(
      snapshot?.selected?.indexedAccountId,
      undefined,
      `BulkSend addressInput num ${num} must start without an account`,
    );
  }

  await drainResidualPerfTrace(page, devOnlyPassword);
  const selectorButton = await getUniqueVisibleByTestID(
    page,
    AddressInputTestIDs.accountSelectorButton,
  );
  await selectorButton.click({ timeout: pageTimeoutMs });
  await getUniqueVisibleByTestID(page, AccountManagerTestIDs.walletList);
  const wallet = await getUniqueVisibleByTestID(
    page,
    AccountManagerTestIDs.wallet(removedTarget.walletId),
  );
  await wallet.click({ timeout: pageTimeoutMs });
  const account = await getUniqueVisibleByTestID(
    page,
    AccountManagerTestIDs.accountItem(removedTarget.index),
  );
  await account.click({ timeout: pageTimeoutMs });
  await assertAccountSelectorStateConsistent(page, removedTarget, {
    assertPersistence: false,
    assertUI: false,
    num: 0,
    sceneName: 'addressInput',
    sceneUrl: '',
  });
  const selectionTrace = await collectSelectionOperationTrace(
    page,
    devOnlyPassword,
    {
      expectActiveReload: true,
      num: 0,
      reason: 'userSelectAccount',
      sceneName: 'addressInput',
    },
  );
  assertSelectionOperationBudget(selectionTrace, {
    expectedActiveReloads: 1,
    expectedSelectionUpdates: 1,
    label: 'BulkSend addressInput account selection',
    num: 0,
    reason: 'userSelectAccount',
    sceneName: 'addressInput',
  });

  await drainResidualPerfTrace(page, devOnlyPassword);
  await page.evaluate(
    async ({ indexedAccountId }) => {
      const serviceAccount =
        globalThis.$$appGlobals.$backgroundApiProxy.serviceAccount;
      const indexedAccount = await serviceAccount.getIndexedAccountSafe({
        id: indexedAccountId,
      });
      if (!indexedAccount) {
        throw new Error(`Missing BulkSend removal account ${indexedAccountId}`);
      }
      await serviceAccount.removeAccount({ indexedAccount });
    },
    { indexedAccountId: removedTarget.indexedAccountId },
  );
  await page.waitForFunction(
    () => {
      const snapshot =
        globalThis.$$appGlobals.$$accountSelectorE2EStateAccessor?.getSnapshot?.(
          {
            num: 0,
            sceneName: 'addressInput',
            sceneUrl: '',
          },
        );
      return Boolean(
        snapshot &&
        !snapshot.selected?.walletId &&
        !snapshot.selected?.indexedAccountId &&
        !snapshot.selected?.othersWalletAccountId &&
        !snapshot.active?.walletId &&
        !snapshot.active?.indexedAccountId,
      );
    },
    undefined,
    { timeout: pageTimeoutMs },
  );
  const removalTrace = await collectSelectionOperationTrace(
    page,
    devOnlyPassword,
    {
      expectActiveReload: true,
      num: 0,
      reason: 'removeAccountSelectionClear',
      sceneName: 'addressInput',
    },
  );
  assertSelectionOperationBudget(removalTrace, {
    expectedActiveReloads: 1,
    expectedSelectionUpdates: 1,
    label: 'BulkSend removed account clearing',
    num: 0,
    reason: 'removeAccountSelectionClear',
    sceneName: 'addressInput',
  });
  assert.ok(
    removalTrace.events.some(
      (event) =>
        event.event === 'autoSelectAccountResult' &&
        event.num === 0 &&
        event.outcome === 'cleared-removed-account' &&
        event.sceneName === 'addressInput',
    ),
    'BulkSend must clear the removed account without choosing a fallback',
  );
  const persistedAddressInput = await readPersistedSelection(
    page,
    'addressInput',
    0,
    '',
  );
  assert.equal(
    persistedAddressInput?.indexedAccountId,
    undefined,
    'BulkSend addressInput must not persist the removed account',
  );
  const numOneSnapshot = await readAccountSelectorStateSnapshot(page, {
    num: 1,
    sceneName: 'addressInput',
    sceneUrl: '',
  });
  assert.equal(
    numOneSnapshot?.selected?.indexedAccountId,
    undefined,
    'Removing num 0 must leave BulkSend addressInput num 1 empty',
  );

  // Perf-off regression: repeat the removal clearing with perf attribution
  // disabled at runtime. This is the production wiring — no perf metadata
  // exists, so the clearing must work through the formal reload payload
  // instead of trace attribution. Uses a disposable account so later
  // scenarios keep the wallet's index-0 account.
  const perfOffIndexedAccountId = await page.evaluate(
    async ({ walletId }) => {
      const api = globalThis.$$appGlobals.$backgroundApiProxy;
      const added = await api.serviceAccount.addHDNextIndexedAccount({
        walletId,
      });
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const indexedAccount = await api.serviceAccount.getIndexedAccountSafe({
          id: added.indexedAccountId,
        });
        if (indexedAccount) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      await api.serviceAccount.addHDOrHWAccounts({
        deriveType: 'default',
        indexedAccountId: added.indexedAccountId,
        networkId: 'evm--1',
        walletId,
      });
      return added.indexedAccountId;
    },
    { walletId: removedTarget.walletId },
  );
  await drainResidualPerfTrace(page, devOnlyPassword);
  await configurePerfAttribution(page, devOnlyPassword, false);
  const perfOffTarget = {
    // Row 1: the wallet keeps its index-0 account and the freshly added
    // account sorts after it. The disposable account reuses no fixture HD
    // index (removal never rolls the wallet's accountHdIndex counter back),
    // so it has no golden-address entry and the fixture-based consistency
    // helper does not apply to it.
    index: 1,
    indexedAccountId: perfOffIndexedAccountId,
    walletId: removedTarget.walletId,
  };
  const perfOffSelectorButton = await getUniqueVisibleByTestID(
    page,
    AddressInputTestIDs.accountSelectorButton,
  );
  await perfOffSelectorButton.click({ timeout: pageTimeoutMs });
  await getUniqueVisibleByTestID(page, AccountManagerTestIDs.walletList);
  const perfOffWallet = await getUniqueVisibleByTestID(
    page,
    AccountManagerTestIDs.wallet(perfOffTarget.walletId),
  );
  await perfOffWallet.click({ timeout: pageTimeoutMs });
  const perfOffAccount = await getUniqueVisibleByTestID(
    page,
    AccountManagerTestIDs.accountItem(perfOffTarget.index),
  );
  await perfOffAccount.click({ timeout: pageTimeoutMs });
  // The selection must land on the disposable account and resolve an active
  // address before its removal below can prove the perf-off clearing (the
  // regression this block guards kept the removed account's address alive).
  await page.waitForFunction(
    ({ expectedIndexedAccountId, expectedWalletId }) => {
      const snapshot =
        globalThis.$$appGlobals.$$accountSelectorE2EStateAccessor?.getSnapshot?.(
          {
            num: 0,
            sceneName: 'addressInput',
            sceneUrl: '',
          },
        );
      return Boolean(
        snapshot?.active?.ready &&
        snapshot.selected?.walletId === expectedWalletId &&
        snapshot.selected?.indexedAccountId === expectedIndexedAccountId &&
        snapshot.active?.walletId === expectedWalletId &&
        snapshot.active?.indexedAccountId === expectedIndexedAccountId &&
        Boolean(snapshot.active?.address),
      );
    },
    {
      expectedIndexedAccountId: perfOffTarget.indexedAccountId,
      expectedWalletId: perfOffTarget.walletId,
    },
    { timeout: pageTimeoutMs },
  );
  await page.evaluate(
    async ({ indexedAccountId }) => {
      const serviceAccount =
        globalThis.$$appGlobals.$backgroundApiProxy.serviceAccount;
      const indexedAccount = await serviceAccount.getIndexedAccountSafe({
        id: indexedAccountId,
      });
      if (!indexedAccount) {
        throw new Error(
          `Missing BulkSend perf-off removal account ${indexedAccountId}`,
        );
      }
      await serviceAccount.removeAccount({ indexedAccount });
    },
    { indexedAccountId: perfOffIndexedAccountId },
  );
  await page.waitForFunction(
    () => {
      const snapshot =
        globalThis.$$appGlobals.$$accountSelectorE2EStateAccessor?.getSnapshot?.(
          {
            num: 0,
            sceneName: 'addressInput',
            sceneUrl: '',
          },
        );
      return Boolean(
        snapshot &&
        !snapshot.selected?.walletId &&
        !snapshot.selected?.indexedAccountId &&
        !snapshot.selected?.othersWalletAccountId &&
        !snapshot.active?.walletId &&
        !snapshot.active?.indexedAccountId,
      );
    },
    undefined,
    { timeout: pageTimeoutMs },
  );
  const perfOffTrace = await drainPerfTrace(page, devOnlyPassword);
  assert.ok(
    !perfOffTrace.events.some(
      (event) =>
        event.event === 'selectionStateUpdated' ||
        event.event === 'autoSelectAccountResult',
    ),
    'Perf-off removal clearing must not depend on perf attribution events',
  );
  await configurePerfAttribution(page, devOnlyPassword, true);

  await closeBulkSendAddressInput(page);
  await page.waitForTimeout(1000);
  const closeTrace = await drainPerfTrace(page, devOnlyPassword);
  const trace = mergePerfTrace(
    initialTrace,
    selectionTrace,
    removalTrace,
    perfOffTrace,
    closeTrace,
  );
  assertTraceHealth({ ...trace, phase: 'bulk-send-account-removal' });
  return trace;
}

async function removeSelectedAccountAndWaitForFallback(page, fixture) {
  const selectedTarget = {
    index: 1,
    indexedAccountId: fixture.wallets[0].indexedAccountIds[1],
    walletId: fixture.wallets[0].walletId,
  };
  log('auto-select: select account scheduled for removal');
  await selectWalletAccount(page, selectedTarget);
  log('auto-select: remove selected indexed account');
  await page.evaluate(
    async ({ indexedAccountId }) => {
      const api = globalThis.$$appGlobals.$backgroundApiProxy;
      const indexedAccount = await api.serviceAccount.getIndexedAccountSafe({
        id: indexedAccountId,
      });
      await api.serviceAccount.removeAccount({ indexedAccount });
    },
    { indexedAccountId: selectedTarget.indexedAccountId },
  );
  log('auto-select: wait for account fallback');
  await page.waitForFunction(
    async ({ removedId }) => {
      const selected =
        await globalThis.$$appGlobals.$backgroundApiProxy.simpleDb.accountSelector.getSelectedAccount(
          { num: 0, sceneName: 'home' },
        );
      return Boolean(
        selected?.indexedAccountId && selected.indexedAccountId !== removedId,
      );
    },
    { removedId: selectedTarget.indexedAccountId },
    { timeout: pageTimeoutMs },
  );
  const fallbackTarget = {
    fixtureId: fixture.wallets[0].fixtureId,
    index: 0,
    indexedAccountId: fixture.wallets[0].indexedAccountIds[0],
    walletId: fixture.wallets[0].walletId,
  };
  await waitForPersistedSelection(page, {
    indexedAccountId: fallbackTarget.indexedAccountId,
    walletId: fallbackTarget.walletId,
  });
  await assertAccountSelectorStateConsistent(page, fallbackTarget);
  log('auto-select: account fallback completed');
}

async function removeSelectedWalletAndWaitForFallback(
  page,
  fixture,
  devOnlyPassword,
) {
  const removedWallet = fixture.wallets[1];
  log('auto-select: select wallet scheduled for removal');
  await selectWalletAccount(page, {
    index: 0,
    indexedAccountId: removedWallet.indexedAccountIds[0],
    walletId: removedWallet.walletId,
  });
  log('auto-select: remove isolated E2E wallet');
  await page.evaluate(
    ({ password, walletId }) =>
      globalThis.$$appGlobals.$backgroundApiProxy.serviceE2E.removeAccountSelectorE2EWallet(
        {
          $$devOnlyPassword: password,
          walletId,
        },
      ),
    { password: devOnlyPassword, walletId: removedWallet.walletId },
  );
  log('auto-select: wait for wallet fallback');
  const fallbackTarget = {
    fixtureId: fixture.wallets[0].fixtureId,
    index: 0,
    indexedAccountId: fixture.wallets[0].indexedAccountIds[0],
    walletId: fixture.wallets[0].walletId,
  };
  await waitForPersistedSelection(page, {
    indexedAccountId: fallbackTarget.indexedAccountId,
    walletId: fallbackTarget.walletId,
  });
  await assertAccountSelectorStateConsistent(page, fallbackTarget);
  log('auto-select: wallet fallback completed');
}

async function runStressInteractions(page, fixture, devOnlyPassword) {
  const targets = [
    {
      fixtureId: fixture.wallets[0].fixtureId,
      index: 0,
      indexedAccountId: fixture.wallets[0].indexedAccountIds[0],
      walletId: fixture.wallets[0].walletId,
    },
    {
      fixtureId: fixture.wallets[1].fixtureId,
      index: 1,
      indexedAccountId: fixture.wallets[1].indexedAccountIds[1],
      walletId: fixture.wallets[1].walletId,
    },
    {
      fixtureId: fixture.wallets[0].fixtureId,
      index: 1,
      indexedAccountId: fixture.wallets[0].indexedAccountIds[1],
      walletId: fixture.wallets[0].walletId,
    },
    {
      fixtureId: fixture.wallets[1].fixtureId,
      index: 0,
      indexedAccountId: fixture.wallets[1].indexedAccountIds[0],
      walletId: fixture.wallets[1].walletId,
    },
  ];

  const traces = [];
  for (let index = 0; index < iterations; index += 1) {
    const target = targets[index % targets.length];
    const previousAccount = await readPersistedSelection(page);
    await drainResidualPerfTrace(page, devOnlyPassword);
    await selectWalletAccount(page, target);
    await assertAccountSelectorStateConsistent(page, target);
    const accountChanged =
      previousAccount?.walletId !== target.walletId ||
      previousAccount?.indexedAccountId !== target.indexedAccountId;
    const accountTrace = await collectSelectionOperationTrace(
      page,
      devOnlyPassword,
      {
        expectActiveReload: accountChanged,
        reason: 'userSelectAccount',
      },
    );
    assertSelectionOperationBudget(accountTrace, {
      expectedActiveReloads: accountChanged ? 1 : 0,
      expectedSelectionUpdates: accountChanged ? 1 : 0,
      label: `account selection ${index + 1}`,
      reason: 'userSelectAccount',
    });
    const walletChanged = previousAccount?.walletId !== target.walletId;
    assertSelectionOperationBudget(accountTrace, {
      expectedActiveReloads: 0,
      expectedSelectionUpdates: walletChanged ? 1 : 0,
      label: `wallet focus selection ${index + 1}`,
      reason: 'userSelectWallet',
    });
    traces.push(accountTrace);
    await drainResidualPerfTrace(page, devOnlyPassword);
    await selectWalletAccount(page, target);
    await assertAccountSelectorStateConsistent(page, target);
    const noOpAccountTrace = await collectSelectionOperationTrace(
      page,
      devOnlyPassword,
      {
        expectActiveReload: false,
        reason: 'userSelectAccount',
      },
    );
    assertSelectionOperationBudget(noOpAccountTrace, {
      expectedActiveReloads: 0,
      expectedSelectionUpdates: 0,
      label: `no-op account selection ${index + 1}`,
      reason: 'userSelectAccount',
    });
    assertSelectionOperationBudget(noOpAccountTrace, {
      expectedActiveReloads: 0,
      expectedSelectionUpdates: 0,
      label: `no-op wallet focus selection ${index + 1}`,
      reason: 'userSelectWallet',
    });
    traces.push(noOpAccountTrace);
    log(
      `stress: verify DApp connection after account switch ${index + 1}/${iterations}`,
    );
    traces.push(
      await openAndApproveSimulatedDAppConnection(page, devOnlyPassword, {
        assertInitializationDetails: false,
        cleanupConnection: true,
        expectedNetworkId: null,
        expectedSelection: target,
        writeArtifacts: false,
      }),
    );
    const networkId = expectedNetworks[index % expectedNetworks.length];
    const previousNetwork = await readPersistedSelection(page);
    await drainResidualPerfTrace(page, devOnlyPassword);
    await selectNetwork(page, networkId);
    await assertAccountSelectorStateConsistent(page, target);
    const networkChanged = previousNetwork?.networkId !== networkId;
    const networkTrace = await collectSelectionOperationTrace(
      page,
      devOnlyPassword,
      {
        expectActiveReload: networkChanged,
        reason: 'userSelectNetwork',
      },
    );
    assertSelectionOperationBudget(networkTrace, {
      expectedActiveReloads: networkChanged ? 1 : 0,
      expectedSelectionUpdates: networkChanged ? 1 : 0,
      label: `network selection ${index + 1}/${networkId}`,
      reason: 'userSelectNetwork',
    });
    traces.push(networkTrace);
    await drainResidualPerfTrace(page, devOnlyPassword);
    await selectNetwork(page, networkId);
    await assertAccountSelectorStateConsistent(page, target);
    const noOpNetworkTrace = await collectSelectionOperationTrace(
      page,
      devOnlyPassword,
      {
        expectActiveReload: false,
        reason: 'userSelectNetwork',
      },
    );
    assertSelectionOperationBudget(noOpNetworkTrace, {
      expectedActiveReloads: 0,
      expectedSelectionUpdates: 0,
      label: `no-op network selection ${index + 1}/${networkId}`,
      reason: 'userSelectNetwork',
    });
    traces.push(noOpNetworkTrace);
    traces.push(
      await verifyAllNetworkDeriveAddresses(
        page,
        target,
        networkId,
        devOnlyPassword,
      ),
    );
    if (index % 3 === 2) {
      await assertSwapConsumer(page, target);
    }
  }
  return mergePerfTrace(...traces);
}

// All Networks (onekeyall--0) round-trip through the real UI:
// 1. enter All Networks through the portfolio tab's confirm flow — the
//    product keeps the single-network tab free of any All Networks row, so
//    the unified selector's only real entry is handlePortfolioDone, which
//    commits with reason 'unifiedNetworkEnableFlow'
//    (UnifiedNetworkSelector/index.tsx),
// 2. select a different account while All Networks is active — this walks
//    confirmAccountSelect's all-networks fallback end-to-end (the HD fixture
//    wallet has compatible enabled networks, so getAllNetworksFallbackNetworkId
//    returns undefined and the selection keeps onekeyall--0),
// 3. switch back to a concrete chain so later scenarios never inherit
//    All Networks.
// Each step asserts the strict all-networks state shape plus the selection
// operation budget for its reason.
async function runAllNetworksSelectionScenario(page, fixture, devOnlyPassword) {
  const traces = [];
  const firstTarget = {
    fixtureId: fixture.wallets[0].fixtureId,
    index: 0,
    indexedAccountId: fixture.wallets[0].indexedAccountIds[0],
    walletId: fixture.wallets[0].walletId,
  };
  const secondTarget = {
    fixtureId: fixture.wallets[1].fixtureId,
    index: 1,
    indexedAccountId: fixture.wallets[1].indexedAccountIds[1],
    walletId: fixture.wallets[1].walletId,
  };

  // Normalize to a known single-chain selection first so every budget below
  // measures exactly one deliberate transition.
  const preAccountSelection = await readPersistedSelection(page);
  const normalizeAccountChanged =
    preAccountSelection?.walletId !== firstTarget.walletId ||
    preAccountSelection?.indexedAccountId !== firstTarget.indexedAccountId;
  await drainResidualPerfTrace(page, devOnlyPassword);
  await selectWalletAccount(page, firstTarget);
  await assertAccountSelectorStateConsistent(page, firstTarget);
  traces.push(
    await collectSelectionOperationTrace(page, devOnlyPassword, {
      expectActiveReload: normalizeAccountChanged,
      reason: 'userSelectAccount',
    }),
  );
  const preNetworkSelection = await readPersistedSelection(page);
  const normalizeNetworkChanged = preNetworkSelection?.networkId !== 'evm--1';
  await drainResidualPerfTrace(page, devOnlyPassword);
  await selectNetwork(page, 'evm--1');
  await assertAccountSelectorStateConsistent(page, firstTarget);
  traces.push(
    await collectSelectionOperationTrace(page, devOnlyPassword, {
      expectActiveReload: normalizeNetworkChanged,
      reason: 'userSelectNetwork',
    }),
  );

  log('all-networks: enable All Networks via the portfolio tab confirm flow');
  await drainResidualPerfTrace(page, devOnlyPassword);
  await selectAllNetworksViaPortfolioDone(page);
  await assertAccountSelectorStateConsistent(page, firstTarget, {
    expectAllNetworks: true,
  });
  const enterTrace = await collectSelectionOperationTrace(
    page,
    devOnlyPassword,
    {
      expectActiveReload: true,
      reason: 'unifiedNetworkEnableFlow',
    },
  );
  assertSelectionOperationBudget(enterTrace, {
    expectedActiveReloads: 1,
    expectedSelectionUpdates: 1,
    label: 'all-networks portfolio enable flow',
    reason: 'unifiedNetworkEnableFlow',
  });
  traces.push(enterTrace);

  log('all-networks: select another account while All Networks is active');
  await drainResidualPerfTrace(page, devOnlyPassword);
  await selectWalletAccount(page, secondTarget);
  await assertAccountSelectorStateConsistent(page, secondTarget, {
    expectAllNetworks: true,
  });
  const accountTrace = await collectSelectionOperationTrace(
    page,
    devOnlyPassword,
    {
      expectActiveReload: true,
      reason: 'userSelectAccount',
    },
  );
  assertSelectionOperationBudget(accountTrace, {
    expectedActiveReloads: 1,
    expectedSelectionUpdates: 1,
    label: 'all-networks account selection',
    reason: 'userSelectAccount',
  });
  assertSelectionOperationBudget(accountTrace, {
    expectedActiveReloads: 0,
    expectedSelectionUpdates: 1,
    label: 'all-networks wallet focus selection',
    reason: 'userSelectWallet',
  });
  // confirmAccountSelect emits its result before the account selector modal
  // dismisses, so the confirm outcome is always inside this window. The
  // fallbackOutcome field proves the all-networks dead-end check really ran:
  // 'not-needed' here would mean the branch was skipped and this scenario
  // silently stopped covering it.
  const accountSelectResults = accountTrace.events.filter(
    (event) =>
      event.event === 'accountSelectResult' &&
      event.num === 0 &&
      event.reason === 'userSelectAccount',
  );
  assert.equal(
    accountSelectResults.length,
    1,
    `all-networks account selection must confirm exactly once: ${JSON.stringify(accountSelectResults)}`,
  );
  assert.equal(
    accountSelectResults[0].outcome,
    'commit',
    'all-networks account selection must commit',
  );
  assert.equal(
    accountSelectResults[0].fallbackOutcome,
    'success',
    'all-networks account selection must run the dead-end fallback check',
  );
  traces.push(accountTrace);

  log('all-networks: switch back to a concrete chain');
  await drainResidualPerfTrace(page, devOnlyPassword);
  await selectNetwork(page, 'evm--1');
  await assertAccountSelectorStateConsistent(page, secondTarget);
  const exitTrace = await collectSelectionOperationTrace(
    page,
    devOnlyPassword,
    {
      expectActiveReload: true,
      reason: 'userSelectNetwork',
    },
  );
  assertSelectionOperationBudget(exitTrace, {
    expectedActiveReloads: 1,
    expectedSelectionUpdates: 1,
    label: 'all-networks exit network selection',
    reason: 'userSelectNetwork',
  });
  traces.push(exitTrace);
  return mergePerfTrace(...traces);
}

// Import-token payloads for the Swap inline derive-type scenario. They mirror
// swapDefaultSetTokens['btc--0'].fromToken / ['evm--1'].fromToken
// (packages/shared/types/swap/SwapProvider.constants.ts) minus the remote logo
// URLs; useSwapInit only accepts import tokens whose network exists in the swap
// network list, so these must stay aligned with stubSwapNetworkIds above. The
// EVM to-token pins swap num 1 to evm--1 so the BTC derive switch below has a
// deterministic "must not move" scene to assert against.
const swapInlineDeriveFromToken = {
  contractAddress: '',
  decimals: 8,
  isNative: true,
  name: 'Bitcoin',
  networkId: 'btc--0',
  symbol: 'BTC',
};
const swapInlineDeriveToToken = {
  contractAddress: '',
  decimals: 18,
  isNative: true,
  name: 'Ethereum',
  networkId: 'evm--1',
  symbol: 'ETH',
};

// The AddressTypeSelector popover trigger toggles like the Settings derive
// Select does, so this follows the selectDeriveTypeViaUI retry pattern: only
// re-open when the dropdown is really shut, then click the derive row and wait
// for the global derive type write that AddressTypeSelector performs.
async function selectSwapInlineDeriveType(page, { deriveType, networkId }) {
  const trigger = await getUniqueVisibleByTestID(
    page,
    AccountSelectorTestIDs.walletDerivationPathTrigger,
  );
  const itemTestID = AccountSelectorTestIDs.addressTypeSelectorItem(deriveType);
  const anyVisibleItem = page.locator(
    `[data-testid^=${JSON.stringify(
      AccountSelectorTestIDs.addressTypeSelectorItem(''),
    )}]:visible`,
  );
  await trigger.click({ timeout: pageTimeoutMs });
  let item;
  try {
    item = await getUniqueVisibleByTestID(page, itemTestID, {
      timeout: uiSettleTimeoutMs,
    });
  } catch {
    if ((await anyVisibleItem.count()) === 0) {
      await trigger.click({ timeout: pageTimeoutMs });
    }
    item = await getUniqueVisibleByTestID(page, itemTestID);
  }
  await item.click({ timeout: pageTimeoutMs });
  await waitForNoVisibleTestID(page, itemTestID);
  await page.waitForFunction(
    async ({ expectedDeriveType, expectedNetworkId }) => {
      const actual =
        await globalThis.$$appGlobals.$backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
          { networkId: expectedNetworkId },
        );
      return actual === expectedDeriveType;
    },
    { expectedDeriveType: deriveType, expectedNetworkId: networkId },
    { timeout: pageTimeoutMs },
  );
}

// Swap's inline derive-type control (the branches icon next to the From
// address) is NOT the num-scoped DeriveTypeSelectorTrigger: ground truth is
// SwapAccountAddressContainer wrapping DeriveTypeSelectorTriggerIconRenderer
// in an AddressTypeSelector whose selection calls
// serviceNetwork.saveGlobalDeriveTypeForNetwork (AddressTypeSelector.tsx,
// changeDefaultAddressTypeAfterSelect defaults true, no onSelect wired). The
// GlobalDeriveTypeUpdate event then drives autoDeriveGlobalSync in every
// mounted scene whose selected network shares the impl — so one click must
// move swap num 0 AND home num 0 (both on btc--0) exactly once each, leave
// swap num 1 (evm--1) untouched, and never produce a 'userSelectDeriveType'
// selection update (that reason is only wired in WalletDetailsHeader for
// discover/addressInput scenes).
async function runSwapInlineDeriveTypeScenario(page, devOnlyPassword, fixture) {
  const traces = [];
  const homeTarget = {
    fixtureId: fixture.wallets[0].fixtureId,
    index: 0,
    indexedAccountId: fixture.wallets[0].indexedAccountIds[0],
    walletId: fixture.wallets[0].walletId,
  };
  const btcNetworkId = swapInlineDeriveFromToken.networkId;

  // Normalize Home to a known account on btc--0 so the swap-side BTC token
  // matches the active account and the inline trigger becomes visible.
  const preSelection = await readPersistedSelection(page);
  const preTarget = findFixtureTarget(fixture, preSelection);
  const normalizeAccountChanged =
    preSelection?.walletId !== homeTarget.walletId ||
    preSelection?.indexedAccountId !== homeTarget.indexedAccountId;
  await drainResidualPerfTrace(page, devOnlyPassword);
  await selectWalletAccount(page, homeTarget);
  await assertAccountSelectorStateConsistent(page, homeTarget);
  traces.push(
    await collectSelectionOperationTrace(page, devOnlyPassword, {
      expectActiveReload: normalizeAccountChanged,
      reason: 'userSelectAccount',
    }),
  );
  const normalizeNetworkChanged = preSelection?.networkId !== btcNetworkId;
  await drainResidualPerfTrace(page, devOnlyPassword);
  await selectNetwork(page, btcNetworkId);
  await assertAccountSelectorStateConsistent(page, homeTarget);
  traces.push(
    await collectSelectionOperationTrace(page, devOnlyPassword, {
      expectActiveReload: normalizeNetworkChanged,
      reason: 'userSelectNetwork',
    }),
  );

  const derivePlan = await page.evaluate(
    async ({ networkId }) => {
      const api = globalThis.$$appGlobals.$backgroundApiProxy;
      const items = await api.serviceNetwork.getDeriveInfoItemsOfNetwork({
        networkId,
      });
      const originalDeriveType =
        await api.serviceNetwork.getGlobalDeriveTypeOfNetwork({ networkId });
      const alternatives = items
        .map((item) => item.value)
        .filter((value) => value !== originalDeriveType);
      return { originalDeriveType, targetDeriveType: alternatives[0] };
    },
    { networkId: btcNetworkId },
  );
  assert.ok(
    derivePlan.originalDeriveType,
    `${btcNetworkId} must resolve a global derive type`,
  );
  assert.ok(
    derivePlan.targetDeriveType,
    `${btcNetworkId} must expose an alternative derive type`,
  );

  // Open the Swap modal with an imported BTC from-token: the real user path
  // (token-list Swap actions push the same route) and the only deterministic
  // one — the swap tab keeps previously selected tokens, so its from-token
  // depends on scenario order. The tab page is display:none under the modal,
  // so every swap testID below resolves to exactly one visible element.
  log('swap-inline-derive: open Swap modal with imported BTC from-token');
  await drainResidualPerfTrace(page, devOnlyPassword);
  await page.evaluate(
    ({ fromToken, toToken }) => {
      globalThis.$$appGlobals.$rootAppNavigation.pushModal('SwapModal', {
        params: {
          importFromToken: fromToken,
          importToToken: toToken,
        },
        screen: 'SwapMainLand',
      });
    },
    {
      fromToken: swapInlineDeriveFromToken,
      toToken: swapInlineDeriveToToken,
    },
  );
  await getUniqueVisibleByTestID(page, 'swap-content-container');
  await getUniqueVisibleByTestID(page, 'swap-from-amount-input');
  await waitForPersistedSelection(
    page,
    {
      indexedAccountId: homeTarget.indexedAccountId,
      networkId: btcNetworkId,
      walletId: homeTarget.walletId,
    },
    'swap',
    0,
  );
  await waitForPersistedSelection(
    page,
    { networkId: swapInlineDeriveToToken.networkId },
    'swap',
    1,
  );
  await getUniqueVisibleByTestID(
    page,
    AccountSelectorTestIDs.walletDerivationPathTrigger,
  );
  await assertAccountSelectorStateConsistent(page, homeTarget, {
    assertUI: false,
    num: 0,
    sceneName: 'swap',
  });
  await page.waitForTimeout(350);
  const setupTrace = await drainPerfTrace(page, devOnlyPassword);
  assertTraceHealth({ ...setupTrace, phase: 'swap-inline-derive-setup' });
  traces.push(setupTrace);

  // Switch to a different derive type, then restore the original through the
  // same control so later phases inherit the pre-scenario derive type.
  for (const [stepLabel, deriveType] of [
    ['switch', derivePlan.targetDeriveType],
    ['restore', derivePlan.originalDeriveType],
  ]) {
    log(`swap-inline-derive: ${stepLabel} to ${deriveType}`);
    const numOneBefore = selectedAccountIdentity(
      await readPersistedSelection(page, 'swap', 1),
    );
    await drainResidualPerfTrace(page, devOnlyPassword);
    await selectSwapInlineDeriveType(page, {
      deriveType,
      networkId: btcNetworkId,
    });
    await waitForPersistedSelection(
      page,
      { deriveType, networkId: btcNetworkId },
      'swap',
      0,
    );
    await waitForPersistedSelection(page, {
      deriveType,
      networkId: btcNetworkId,
    });
    await assertAccountSelectorStateConsistent(page, homeTarget, {
      assertUI: false,
      num: 0,
      sceneName: 'swap',
    });
    await assertAccountSelectorStateConsistent(page, homeTarget, {
      assertUI: false,
    });
    const trace = await collectPerfTraceUntil(page, devOnlyPassword, (events) =>
      ['home', 'swap'].every((sceneName) =>
        events.some(
          (event) =>
            event.event === 'activeReloadResult' &&
            event.num === 0 &&
            event.reason === 'autoDeriveGlobalSync' &&
            event.sceneName === sceneName,
        ),
      ),
    );
    assertSelectionOperationBudget(trace, {
      expectedActiveReloads: 1,
      expectedSelectionUpdates: 1,
      label: `swap inline derive ${stepLabel} swap num 0`,
      num: 0,
      reason: 'autoDeriveGlobalSync',
      sceneName: 'swap',
    });
    assertSelectionOperationBudget(trace, {
      expectedActiveReloads: 1,
      expectedSelectionUpdates: 1,
      label: `swap inline derive ${stepLabel} home follow`,
      reason: 'autoDeriveGlobalSync',
    });
    assertSelectionOperationBudget(trace, {
      expectedActiveReloads: 0,
      expectedSelectionUpdates: 0,
      label: `swap inline derive ${stepLabel} swap num 1`,
      num: 1,
      reason: 'autoDeriveGlobalSync',
      sceneName: 'swap',
    });
    // Guards the ground truth above: if this ever fires, the inline control
    // switched to the num-scoped userSelectDeriveType path and this scenario's
    // propagation assertions must be re-established from the source.
    assert.deepEqual(
      trace.events
        .filter((event) => event.reason === 'userSelectDeriveType')
        .map((event) => ({
          event: event.event,
          num: event.num,
          sceneName: event.sceneName,
        })),
      [],
      'Swap inline derive switching must use the global derive path, not userSelectDeriveType',
    );
    assert.deepEqual(
      selectedAccountIdentity(await readPersistedSelection(page, 'swap', 1)),
      numOneBefore,
      'A BTC derive switch must not move the evm-pinned swap num 1 selection',
    );
    traces.push(trace);
  }

  // Close the modal and restore the pre-scenario Home selection so the phases
  // after this one start from the state the stress/burst phases left behind.
  await page.evaluate(() => {
    globalThis.$$appGlobals.$rootAppNavigation.pop();
  });
  await waitForNoVisibleTestID(page, 'swap-content-container');
  await waitForHomeShell(page);
  if (
    preTarget.walletId !== homeTarget.walletId ||
    preTarget.indexedAccountId !== homeTarget.indexedAccountId
  ) {
    await drainResidualPerfTrace(page, devOnlyPassword);
    await selectWalletAccount(page, preTarget);
    traces.push(
      await collectSelectionOperationTrace(page, devOnlyPassword, {
        expectActiveReload: true,
        reason: 'userSelectAccount',
      }),
    );
  }
  if (preSelection?.networkId && preSelection.networkId !== btcNetworkId) {
    await drainResidualPerfTrace(page, devOnlyPassword);
    await selectNetwork(page, preSelection.networkId);
    traces.push(
      await collectSelectionOperationTrace(page, devOnlyPassword, {
        expectActiveReload: true,
        reason: 'userSelectNetwork',
      }),
    );
  }
  await assertAccountSelectorStateConsistent(page, preTarget);
  const trace = mergePerfTrace(...traces);
  assertTraceHealth({ ...trace, phase: 'swap-inline-derive' });
  return trace;
}

// Market detail swap panel ground truth (MarketDetailV2 on desktop web):
// - MarketDetailV2.tsx and SwapPanel.tsx both mount AccountSelectorProviderMirror
//   on the HOME scene num 0, so the panel's active account (useActiveAccount
//   num 0 inside useSpeedSwapActions) IS the home selection — same jotai store,
//   no cross-scene hop.
// - The swap scene appears inside the panel only where it borrows swap-side
//   UI: the payment-token selector popover mounts a swap/num 0 mirror lazily
//   on open (TokenSelectorPopover.tsx; Popover renders content only while
//   open), and the review dialog does the same. That is the exception among
//   Market views — everything else in Market mirrors home.
// - The swap scene follows home through TWO racing consumers of the same
//   AccountSelectorSelectedAccountUpdate event, both alive since the
//   multi-num phase visited the Swap tab:
//   1. The Swap page's own sync (useSwapGlobal.syncSwapSelectedAccountFromHome)
//      applies home's account to swap num 0 with the DEFAULT reason
//      'updateSelectedAccount' and updatedAt = Date.now() (receive time).
//   2. AccountSelectorEffects → syncHomeAndSwapSelectedAccount commits with
//      reason 'syncHomeAndSwapSelectedAccount' and the payload's origin
//      revision, for swap num 0 AND num 1.
//   Both merge ONLY the account identity (walletId/indexedAccountId/
//   othersWalletAccountId/focusedWallet), never the target's networkId or
//   deriveType. On swap num 0 the race winner commits and the loser settles
//   as a no-op, a 'stale-before-fix' drop (the pre-mutex early exit in
//   syncHomeAndSwapSelectedAccount), or a 'skip-older-event' drop (the
//   compare-if-newer guard inside the update mutex), so WHICH reason commits
//   is timing — but the TOTAL is exactly one commit and one reload. Swap num 1
//   has only path 2, so its reason is deterministic.
// - Because the account-manager wallet row writes focusedWallet with its own
//   'userSelectWallet' update (which also fans out to swap), the switch target
//   stays in the SAME wallet as the normalized account: the wallet click is
//   then a no-op and each swap num sees exactly one sync commit.
async function runMarketSwapPanelScenario(page, devOnlyPassword, fixture) {
  const traces = [];
  const homeTarget = {
    fixtureId: fixture.wallets[0].fixtureId,
    index: 0,
    indexedAccountId: fixture.wallets[0].indexedAccountIds[0],
    walletId: fixture.wallets[0].walletId,
  };
  // Same wallet as homeTarget on purpose — see the focusedWallet note above.
  const switchTarget = {
    fixtureId: fixture.wallets[0].fixtureId,
    index: 1,
    indexedAccountId: fixture.wallets[0].indexedAccountIds[1],
    walletId: fixture.wallets[0].walletId,
  };
  const panelNetworkId = marketSwapPanelToken.networkId;

  // Normalize Home to a known account on the panel token's network so the
  // panel's balance/network-support checks resolve against fixture accounts.
  const preSelection = await readPersistedSelection(page);
  const preTarget = findFixtureTarget(fixture, preSelection);
  const normalizeAccountChanged =
    preSelection?.walletId !== homeTarget.walletId ||
    preSelection?.indexedAccountId !== homeTarget.indexedAccountId;
  await drainResidualPerfTrace(page, devOnlyPassword);
  await selectWalletAccount(page, homeTarget);
  await assertAccountSelectorStateConsistent(page, homeTarget);
  traces.push(
    await collectSelectionOperationTrace(page, devOnlyPassword, {
      expectActiveReload: normalizeAccountChanged,
      reason: 'userSelectAccount',
    }),
  );
  const normalizeNetworkChanged = preSelection?.networkId !== panelNetworkId;
  await drainResidualPerfTrace(page, devOnlyPassword);
  await selectNetwork(page, panelNetworkId);
  await assertAccountSelectorStateConsistent(page, homeTarget);
  traces.push(
    await collectSelectionOperationTrace(page, devOnlyPassword, {
      expectActiveReload: normalizeNetworkChanged,
      reason: 'userSelectNetwork',
    }),
  );

  // Navigate straight to the detail route (the same nested navigate that
  // navigateToMarketTokenDetail performs) so the Market home list never
  // mounts and the phase only depends on the detail surface.
  log('market-swap-panel: open Market detail page and wait for the panel');
  await drainResidualPerfTrace(page, devOnlyPassword);
  await page.evaluate(
    ({ token }) => {
      globalThis.$$appGlobals.$navigationRef.current.navigate('main', {
        params: {
          params: {
            isNative: false,
            network: token.networkId,
            tokenAddress: token.contractAddress,
          },
          screen: 'MarketDetailV2',
        },
        screen: 'Market',
      });
    },
    { token: marketSwapPanelToken },
  );
  await getUniqueVisibleByTestID(page, MarketTestIDs.swapPanel);
  // The payment-token trigger appears once the (stubbed) speed-config default
  // tokens are in, i.e. the panel finished its own initialization.
  await getUniqueVisibleByTestID(
    page,
    MarketTestIDs.swapPanelPaymentTokenTrigger,
  );
  // The panel mirrors home directly; the swap scene must already hold the
  // normalized account from the selection fanout above. Neither store may
  // drift just because the Market page mounted.
  await assertAccountSelectorStateConsistent(page, homeTarget, {
    assertUI: false,
  });
  for (const num of [0, 1]) {
    await assertAccountSelectorStateConsistent(page, homeTarget, {
      assertUI: false,
      num,
      sceneName: 'swap',
    });
  }
  await page.waitForTimeout(350);
  const mountTrace = await drainPerfTrace(page, devOnlyPassword);
  assertTraceHealth({ ...mountTrace, phase: 'market-swap-panel-mount' });
  // Mounting the page attaches home mirrors to the existing store; that must
  // be a pure attach, not a selection operation.
  assert.deepEqual(
    mountTrace.events
      .filter((event) =>
        ['activeReloadScheduled', 'selectionStateUpdated'].includes(
          event.event,
        ),
      )
      .map((event) => ({
        event: event.event,
        num: event.num,
        reason: event.reason,
        sceneName: event.sceneName,
      })),
    [],
    'Mounting the Market detail page must not move any account selection',
  );
  traces.push(mountTrace);

  // Switch the home account through the standard selector UI (the Market
  // detail header has no account trigger, so this happens on the Wallet tab)
  // and pin the exact fanout: one home userSelectAccount operation plus one
  // syncHomeAndSwapSelectedAccount commit per swap num, nothing else.
  log('market-swap-panel: switch home account and verify swap-scene fanout');
  await switchDesktopSidebarTab(page, 'Wallet', 'Home');
  await waitForHomeShell(page);
  await drainResidualPerfTrace(page, devOnlyPassword);
  await selectWalletAccount(page, switchTarget);
  await assertAccountSelectorStateConsistent(page, switchTarget);
  const swapZeroFollowReasons = new Set([
    'syncHomeAndSwapSelectedAccount',
    'updateSelectedAccount',
  ]);
  const switchTrace = await collectPerfTraceUntil(
    page,
    devOnlyPassword,
    (events) =>
      events.some(
        (event) =>
          event.event === 'activeReloadResult' &&
          event.num === 0 &&
          event.reason === 'userSelectAccount' &&
          event.sceneName === 'home',
      ) &&
      events.some(
        (event) =>
          event.event === 'activeReloadResult' &&
          event.num === 0 &&
          event.sceneName === 'swap' &&
          swapZeroFollowReasons.has(event.reason),
      ) &&
      events.some(
        (event) =>
          event.event === 'activeReloadResult' &&
          event.num === 1 &&
          event.reason === 'syncHomeAndSwapSelectedAccount' &&
          event.sceneName === 'swap',
      ),
  );
  assertSelectionOperationBudget(switchTrace, {
    expectedActiveReloads: 1,
    expectedSelectionUpdates: 1,
    label: 'market swap panel home switch',
    reason: 'userSelectAccount',
  });
  // Same-wallet switch: the wallet row click must stay a no-op.
  assertSelectionOperationBudget(switchTrace, {
    expectedActiveReloads: 0,
    expectedSelectionUpdates: 0,
    label: 'market swap panel wallet focus',
    reason: 'userSelectWallet',
  });
  // Swap num 0 converges through whichever follow-home path wins the race
  // (ground truth above); the loser settles as a no-op or stale drop with no
  // second commit. Pin the TOTAL across both reasons: one committed
  // transition, one scheduled reload, one completed reload — a second one
  // would be exactly the double-apply this suite exists to catch.
  const swapZeroUpdates = switchTrace.events.filter(
    (event) =>
      event.event === 'selectionStateUpdated' &&
      event.num === 0 &&
      swapZeroFollowReasons.has(event.reason),
  );
  const swapZeroTransitionIds = new Set(
    swapZeroUpdates.map((event) => event.transitionId),
  );
  const swapZeroCommittedTransitions = new Set(
    switchTrace.events
      .filter(
        (event) =>
          event.event === 'selectionStorageRequested' &&
          event.num === 0 &&
          event.sceneName === 'swap' &&
          swapZeroTransitionIds.has(event.transitionId),
      )
      .map((event) => event.transitionId),
  );
  assert.equal(
    swapZeroCommittedTransitions.size,
    1,
    `market swap panel swap num 0 must follow home with exactly one commit: ${describeBudgetEvents(swapZeroUpdates)}`,
  );
  const swapZeroSchedules = switchTrace.events.filter(
    (event) =>
      event.event === 'activeReloadScheduled' &&
      event.num === 0 &&
      event.sceneName === 'swap' &&
      swapZeroFollowReasons.has(event.reason),
  );
  assert.equal(
    swapZeroSchedules.length,
    1,
    `market swap panel swap num 0 must schedule one follow reload: ${describeBudgetEvents(swapZeroSchedules)}`,
  );
  const swapZeroReloads = switchTrace.events.filter(
    (event) =>
      event.event === 'activeReloadResult' &&
      event.num === 0 &&
      event.sceneName === 'swap' &&
      ['commit', 'noop'].includes(event.outcome) &&
      swapZeroFollowReasons.has(event.reason),
  );
  assert.equal(
    swapZeroReloads.length,
    1,
    `market swap panel swap num 0 must complete one follow reload: ${describeBudgetEvents(swapZeroReloads)}`,
  );
  // Swap num 1 only has the cross-scene path, so its reason is deterministic.
  assertSelectionOperationBudget(switchTrace, {
    expectedActiveReloads: 1,
    expectedSelectionUpdates: 1,
    label: 'market swap panel swap num 1 follow',
    num: 1,
    reason: 'syncHomeAndSwapSelectedAccount',
    sceneName: 'swap',
  });
  traces.push(switchTrace);

  // Back on the still-mounted detail page, the panel (home scene) and the
  // swap scene it consults must both have converged on the new account.
  await switchAppTab(page, 'Market');
  await getUniqueVisibleByTestID(page, MarketTestIDs.swapPanel);
  await assertAccountSelectorStateConsistent(page, switchTarget, {
    assertUI: false,
  });
  for (const num of [0, 1]) {
    await assertAccountSelectorStateConsistent(page, switchTarget, {
      assertUI: false,
      num,
      sceneName: 'swap',
    });
  }

  // Open the payment-token popover: the panel's own swap-scene mirror mount
  // (the Market exception this phase exists for). The token list renders
  // under that mirror, so its appearance proves the swap store served it; the
  // attach must not produce any selection operation.
  log('market-swap-panel: open payment-token popover (swap-scene mirror)');
  await drainResidualPerfTrace(page, devOnlyPassword);
  const paymentTokenTrigger = await getUniqueVisibleByTestID(
    page,
    MarketTestIDs.swapPanelPaymentTokenTrigger,
  );
  await paymentTokenTrigger.click({ timeout: pageTimeoutMs });
  await getUniqueVisibleByTestID(
    page,
    MarketTestIDs.swapPanelTokenSelectorList,
  );
  await assertAccountSelectorStateConsistent(page, switchTarget, {
    assertUI: false,
    num: 0,
    sceneName: 'swap',
  });
  await page.keyboard.press('Escape');
  try {
    await waitForNoVisibleTestID(
      page,
      MarketTestIDs.swapPanelTokenSelectorList,
    );
  } catch {
    // Some floating panels only dismiss on outside press. The chart area in
    // the left column is outside the right-column panel at every supported
    // viewport and a click there has no navigation side effect.
    await page.mouse.click(600, 400);
    await waitForNoVisibleTestID(
      page,
      MarketTestIDs.swapPanelTokenSelectorList,
    );
  }
  await page.waitForTimeout(350);
  const popoverTrace = await drainPerfTrace(page, devOnlyPassword);
  assertTraceHealth({ ...popoverTrace, phase: 'market-swap-panel-popover' });
  assert.deepEqual(
    popoverTrace.events
      .filter((event) =>
        ['activeReloadScheduled', 'selectionStateUpdated'].includes(
          event.event,
        ),
      )
      .map((event) => ({
        event: event.event,
        num: event.num,
        reason: event.reason,
        sceneName: event.sceneName,
      })),
    [],
    'The payment-token popover must attach its swap mirror without moving any selection',
  );
  traces.push(popoverTrace);

  // Restore the pre-scenario Home selection. The Market detail page stays
  // mounted on its tab — like the Swap tab after earlier phases — so no
  // later phase inherits a Market home-list mount from this one.
  await switchDesktopSidebarTab(page, 'Wallet', 'Home');
  await waitForHomeShell(page);
  if (
    preTarget.walletId !== switchTarget.walletId ||
    preTarget.indexedAccountId !== switchTarget.indexedAccountId
  ) {
    await drainResidualPerfTrace(page, devOnlyPassword);
    await selectWalletAccount(page, preTarget);
    traces.push(
      await collectSelectionOperationTrace(page, devOnlyPassword, {
        expectActiveReload: true,
        reason: 'userSelectAccount',
      }),
    );
  }
  if (preSelection?.networkId && preSelection.networkId !== panelNetworkId) {
    await drainResidualPerfTrace(page, devOnlyPassword);
    await selectNetwork(page, preSelection.networkId);
    traces.push(
      await collectSelectionOperationTrace(page, devOnlyPassword, {
        expectActiveReload: true,
        reason: 'userSelectNetwork',
      }),
    );
  }
  await assertAccountSelectorStateConsistent(page, preTarget);
  const trace = mergePerfTrace(...traces);
  assertTraceHealth({ ...trace, phase: 'market-swap-panel' });
  return trace;
}

async function closeResidualE2EBrowserContexts(browser, phase) {
  const contexts = browser.contexts();
  const tabCount = contexts.reduce(
    (count, context) => count + context.pages().length,
    0,
  );
  if (contexts.length || tabCount) {
    log(
      `${phase}: close ${tabCount} residual tab(s) in ${contexts.length} E2E context(s)`,
    );
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
  assert.equal(
    browser.contexts().length,
    0,
    `${phase}: residual E2E browser contexts must be empty`,
  );
  log(`${phase}: verified 0 residual E2E tabs`);
}

async function runCycle({ browser, cycle, rendererUrl }) {
  const devOnlyPassword = getDevOnlyPassword();
  await closeResidualE2EBrowserContexts(browser, `cycle#${cycle} preflight`);
  const context = await browser.newContext();
  assert.equal(
    context.pages().length,
    0,
    `cycle#${cycle}: a new E2E context must start without tabs`,
  );
  if (stubWalletTokenApi) {
    await routeWalletTokenStub(context);
  }
  if (stubHyperliquidApi) {
    await routeHyperliquidStub(context);
  }
  if (stubSwapApi) {
    await routeSwapApiStub(context);
  }
  if (stubMarketApi) {
    await routeMarketApiStub(context);
  }
  await context.addInitScript(
    ({ key }) => {
      globalThis.localStorage.setItem(key, 'wallet');
    },
    { key: walletModeStorageKey },
  );
  const page = await context.newPage();
  page.setDefaultTimeout(pageTimeoutMs);

  const pageErrors = [];
  const cdpExceptions = [];
  page.on('pageerror', (error) =>
    pageErrors.push({
      message: error.message,
      name: error.name,
      stack: error.stack,
    }),
  );
  const cdp = await context.newCDPSession(page);
  await Promise.all([cdp.send('Runtime.enable'), cdp.send('Debugger.enable')]);
  await cdp.send('Debugger.setAsyncCallStackDepth', { maxDepth: 32 });
  cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    cdpExceptions.push({
      description: exceptionDetails.exception?.description,
      exceptionId: exceptionDetails.exceptionId,
      frames: collectCdpStackFrames(exceptionDetails.stackTrace),
      lineNumber: exceptionDetails.lineNumber,
      text: exceptionDetails.text,
      url: exceptionDetails.url,
    });
  });

  try {
    await page.goto(rendererUrl, {
      timeout: pageTimeoutMs,
      waitUntil: 'domcontentloaded',
    });
    await waitForAppReady(page);
    await configurePerfTrace(page, devOnlyPassword);
    await drainResidualPerfTrace(page, devOnlyPassword);

    log(`cycle#${cycle}: create isolated HD wallet fixture`);
    const fixture = await createFixture(page, devOnlyPassword);
    assert.deepEqual(
      fixture.addressFixtures,
      expectedAccountAddressFixtures,
      'Deterministic wallet addresses must match the golden vectors',
    );
    await waitForPersistedSelection(page, {
      walletId: fixture.wallets[0].walletId,
    });
    await page.waitForTimeout(500);

    log(`cycle#${cycle}: reload and verify atom/storage initialization`);
    await page.goto(rendererUrl, {
      timeout: pageTimeoutMs,
      waitUntil: 'domcontentloaded',
    });
    await waitForAppReady(page);
    await waitForHomeShell(page);
    await restoreWalletPasswordCache(page, fixture);
    // The reload replaced the runtime that produced them, and its ids restart.
    takeResidualTrace();
    const initTrace = await collectPerfTraceUntil(
      page,
      devOnlyPassword,
      (events) => events.some((event) => event.event === 'storageInitResult'),
    );
    assertTraceHealth({ ...initTrace, phase: 'initialization' });
    assert.ok(
      initTrace.events.some((event) => event.event === 'storageInitResult'),
      'Initialization trace must contain storageInitResult',
    );
    const restoredSelection = await readPersistedSelection(page);
    const restoredTarget = findFixtureTarget(fixture, restoredSelection);
    // A fresh install defaults the home scene to All Networks and no scenario
    // has selected a concrete chain yet, so the restored selection is the
    // all-networks shape by design — assert it strictly instead of tolerating
    // whatever the restore produced.
    await assertAccountSelectorStateConsistent(page, restoredTarget, {
      expectAllNetworks: true,
    });

    log(`cycle#${cycle}: verify Send address input account selection`);
    const sendAddressInputTrace = await runSendAddressInputScenario(
      page,
      devOnlyPassword,
      fixture,
    );

    log(`cycle#${cycle}: verify Perps account synchronization`);
    const perpsTrace = await runPerpsAccountSyncScenario(
      page,
      devOnlyPassword,
      fixture,
    );
    await page.goto(rendererUrl, {
      timeout: pageTimeoutMs,
      waitUntil: 'domcontentloaded',
    });
    await waitForAppReady(page);
    await waitForHomeShell(page);
    await restoreWalletPasswordCache(page, fixture);
    await configurePerfTrace(page, devOnlyPassword);
    const preReloadResidualTrace = takeResidualTrace();
    const perpsResetTrace = await collectPerfTraceUntil(
      page,
      devOnlyPassword,
      (events) => events.some((event) => event.event === 'storageInitResult'),
    );
    const postPerpsSelection = await readPersistedSelection(page);
    await assertAccountSelectorStateConsistent(
      page,
      findFixtureTarget(fixture, postPerpsSelection),
    );
    log(`cycle#${cycle}: verify Swap multi-num and custom-network refresh`);
    const multiNumResult = await runMultiNumAndCustomNetworkScenario(
      page,
      devOnlyPassword,
      cycle,
      fixture,
    );
    log(
      `cycle#${cycle}: verify simulated DApp connection modal and Discover network update`,
    );
    const dappTrace = await runSimulatedDAppScenario(
      page,
      devOnlyPassword,
      fixture,
    );
    log(`cycle#${cycle}: verify Discover multi-origin and multi-num isolation`);
    const multiOriginDAppTrace = await runMultiOriginDAppScenario(
      page,
      devOnlyPassword,
      fixture,
    );
    // Runs directly after the multi-origin phase on purpose: that phase deletes
    // both simulated origins on exit, so this one starts from empty
    // dappConnection storage and its remove-all step restores exactly that
    // state for the phases that follow.
    log(
      `cycle#${cycle}: verify DApp connection reject, disconnect and remove-all`,
    );
    const dappOpsTrace = await runDAppConnectionOpsScenario(
      page,
      devOnlyPassword,
      fixture,
    );
    // Runs before the stress iterations on purpose: the latest-wins burst
    // phase later relies on the pre-burst state the stress loop leaves behind
    // (its first rapid network pick must be a real change to overlap reloads),
    // so this scenario must not be the last thing that touches the selection.
    log(`cycle#${cycle}: verify All Networks selection round-trip`);
    const allNetworksTrace = await runAllNetworksSelectionScenario(
      page,
      fixture,
      devOnlyPassword,
    );
    assertTraceHealth({ ...allNetworksTrace, phase: 'all-networks' });
    log(
      `cycle#${cycle}: run ${iterations} wallet/account/network/derive iterations`,
    );
    const repeatedDAppTrace = await runStressInteractions(
      page,
      fixture,
      devOnlyPassword,
    );
    log(`cycle#${cycle}: run latest-wins account/network/derive bursts`);
    await drainResidualPerfTrace(page, devOnlyPassword);
    await runRapidSelectionBursts(page, fixture);
    await page.waitForTimeout(1000);
    const burstTrace = await drainPerfTrace(page, devOnlyPassword);
    assertLatestWinsBurstBudget(burstTrace);
    const stressTrace = mergePerfTrace(repeatedDAppTrace, burstTrace);
    assertTraceHealth({ ...stressTrace, phase: 'stress' });

    // Runs after the latest-wins bursts on purpose: the burst phase needs the
    // exact selection the stress loop leaves behind, while the BulkSend phase
    // below re-normalizes its own selection, so this slot disturbs neither.
    log(`cycle#${cycle}: verify Swap inline derive type switching`);
    const swapInlineDeriveTrace = await runSwapInlineDeriveTypeScenario(
      page,
      devOnlyPassword,
      fixture,
    );

    // Sits between the swap phases and BulkSend on purpose: it normalizes and
    // restores its own home selection, so the state the burst/derive phases
    // rely on is already consumed and BulkSend re-normalizes anyway.
    log(`cycle#${cycle}: verify Market detail swap panel account sync`);
    const marketSwapPanelTrace = await runMarketSwapPanelScenario(
      page,
      devOnlyPassword,
      fixture,
    );

    log(`cycle#${cycle}: verify BulkSend account removal semantics`);
    const bulkSendRemovalTrace = await runBulkSendAccountRemovalScenario(
      page,
      devOnlyPassword,
      fixture,
    );

    log(`cycle#${cycle}: verify account and wallet removal auto-selection`);
    await removeSelectedAccountAndWaitForFallback(page, fixture);
    const accountRemovalTrace = await collectSelectionOperationTrace(
      page,
      devOnlyPassword,
      {
        expectActiveReload: true,
        reason: 'autoSelectNextAccount',
      },
    );
    assertSelectionOperationBudget(accountRemovalTrace, {
      expectedActiveReloads: 1,
      expectedSelectionUpdates: 1,
      label: 'selected account removal fallback',
      reason: 'autoSelectNextAccount',
    });
    await removeSelectedWalletAndWaitForFallback(
      page,
      fixture,
      devOnlyPassword,
    );
    const walletRemovalTrace = await collectSelectionOperationTrace(
      page,
      devOnlyPassword,
      {
        expectActiveReload: true,
        reason: 'autoSelectNextAccount',
      },
    );
    assertSelectionOperationBudget(walletRemovalTrace, {
      expectedActiveReloads: 1,
      expectedSelectionUpdates: 1,
      label: 'selected wallet removal fallback',
      reason: 'autoSelectNextAccount',
    });
    await page.waitForTimeout(2300);
    const autoSelectTrace = mergePerfTrace(
      accountRemovalTrace,
      walletRemovalTrace,
      await drainPerfTrace(page, devOnlyPassword),
    );
    assertTraceHealth({ ...autoSelectTrace, phase: 'auto-select' });
    assert.ok(
      autoSelectTrace.events.some(
        (event) => event.event === 'autoSelectAccountResult',
      ),
      'Removal flow must produce autoSelectAccountResult',
    );
    assert.ok(
      autoSelectTrace.events.some(
        (event) =>
          event.event === 'autoSelectAccountResult' &&
          event.source === 'wallet-update',
      ),
      'Wallet removal must complete wallet-update auto-selection',
    );

    assert.equal(
      preReloadResidualTrace.droppedCount,
      0,
      'pre-reload residual: trace buffer dropped events',
    );
    const preReloadEvents = [
      ...initTrace.events,
      ...sendAddressInputTrace.events,
      ...perpsTrace.events,
      ...preReloadResidualTrace.events,
    ];
    assertTraceRequestResultPairs(preReloadEvents);
    assertStaleReloadPostProcessPairs(preReloadEvents);
    const preReloadSummary = buildTraceSummary(preReloadEvents);
    assert.deepEqual(
      preReloadSummary.fanout.selectionTransitions.duplicateConsumers,
      [],
      'A pre-reload selection transition must not commit twice in the same consumer',
    );
    assert.deepEqual(
      preReloadSummary.fanout.activeReloads.duplicateConsumers,
      [],
      'A pre-reload active reload must not commit twice in the same consumer',
    );

    const residualTrace = takeResidualTrace();
    assert.equal(
      residualTrace.droppedCount,
      0,
      'residual: trace buffer dropped events',
    );
    const collectedEvents = [
      ...perpsResetTrace.events,
      ...multiNumResult.trace.events,
      ...dappTrace.events,
      ...multiOriginDAppTrace.events,
      ...dappOpsTrace.events,
      ...allNetworksTrace.events,
      ...stressTrace.events,
      ...swapInlineDeriveTrace.events,
      ...marketSwapPanelTrace.events,
      ...bulkSendRemovalTrace.events,
      ...autoSelectTrace.events,
      ...residualTrace.events,
    ];
    const settleTrace = await drainUntilRequestsSettled(
      page,
      devOnlyPassword,
      collectedEvents,
    );
    const allEvents = [...collectedEvents, ...settleTrace.events];
    assertTraceRequestResultPairs(allEvents);
    assertStaleReloadPostProcessPairs(allEvents);
    // A run of stale drops with no commit in between means a caller kept losing
    // its update. The app reports it instead of throwing, so assert it here.
    assert.deepEqual(
      allEvents
        .filter((event) => event.event === 'repeatedStaleDropsDetected')
        .map((event) => ({
          consecutiveCount: event.consecutiveCount,
          num: event.num,
          reason: event.reason,
          sceneName: event.sceneName,
        })),
      [],
      'Selection updates must not be dropped as stale repeatedly without a commit',
    );
    const summary = buildTraceSummary(allEvents);
    const performanceBudgets = evaluatePerformanceBudgets(summary);
    const eventCountBudgets = evaluateEventCountBudgets(
      summary,
      eventCountBudgetDefinitions,
    );
    const fanoutBudgets = evaluateFanoutBudgets(
      summary,
      fanoutBudgetDefinitions,
    );
    assert.deepEqual(
      summary.fanout.selectionTransitions.duplicateConsumers,
      [],
      'A selection transition must not commit twice in the same consumer',
    );
    assert.deepEqual(
      summary.fanout.activeReloads.duplicateConsumers,
      [],
      'An active reload must not commit twice in the same consumer',
    );
    const phaseSummaries = {
      allNetworks: buildTraceSummary(allNetworksTrace.events),
      autoSelect: buildTraceSummary(autoSelectTrace.events),
      bulkSendRemoval: buildTraceSummary(bulkSendRemovalTrace.events),
      dapp: buildTraceSummary(dappTrace.events),
      dappMultiOrigin: buildTraceSummary(multiOriginDAppTrace.events),
      dappOps: buildTraceSummary(dappOpsTrace.events),
      initialization: buildTraceSummary(initTrace.events),
      marketSwapPanel: buildTraceSummary(marketSwapPanelTrace.events),
      multiNumCustomNetwork: buildTraceSummary(multiNumResult.trace.events),
      perps: buildTraceSummary(perpsTrace.events),
      postPerpsReset: buildTraceSummary(perpsResetTrace.events),
      sendAddressInput: buildTraceSummary(sendAddressInputTrace.events),
      stress: buildTraceSummary(stressTrace.events),
      swapInlineDerive: buildTraceSummary(swapInlineDeriveTrace.events),
    };
    const phaseRenderBudgetResults = evaluatePhaseRenderBudgets({
      phaseSummaries,
      summary,
    });
    const report = {
      cycle,
      cdpExceptionCount: cdpExceptions.length,
      cdpExceptions,
      eventCountBudgets,
      fanoutBudgets,
      iterations,
      pageErrorCount: pageErrors.length,
      pageErrors,
      phaseRenderBudgets: phaseRenderBudgetResults,
      phaseSummaries,
      performanceBudgets,
      summary,
    };
    fs.writeFileSync(
      path.join(artifactDir, `cycle-${cycle}-summary.json`),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(artifactDir, `cycle-${cycle}-trace.json`),
      `${JSON.stringify(
        {
          phases: {
            allNetworks: allNetworksTrace,
            autoSelect: autoSelectTrace,
            bulkSendRemoval: bulkSendRemovalTrace,
            dapp: dappTrace,
            dappMultiOrigin: multiOriginDAppTrace,
            dappOps: dappOpsTrace,
            initialization: initTrace,
            marketSwapPanel: marketSwapPanelTrace,
            multiNumCustomNetwork: multiNumResult.trace,
            perps: perpsTrace,
            postPerpsReset: perpsResetTrace,
            sendAddressInput: sendAddressInputTrace,
            stress: stressTrace,
            swapInlineDerive: swapInlineDeriveTrace,
          },
        },
        null,
        2,
      )}\n`,
    );
    assertPerformanceBudgets(performanceBudgets);
    assertEventCountBudgets(eventCountBudgets);
    assertFanoutBudgets(fanoutBudgets);
    assertPhaseRenderBudgets(phaseRenderBudgetResults);
    assert.deepEqual(pageErrors, [], 'Web page emitted uncaught errors');
    assert.deepEqual(
      cdpExceptions,
      [],
      'CDP Runtime emitted uncaught exceptions',
    );
    log(
      `cycle#${cycle}: stubbed wallet token requests: ${
        seenWalletTokenRequests.size
          ? [...seenWalletTokenRequests].toSorted().join(', ')
          : 'none'
      }`,
    );
    log(
      `cycle#${cycle}: stubbed Hyperliquid actions: ${
        seenHyperliquidActions.size
          ? [...seenHyperliquidActions].toSorted().join(', ')
          : 'none'
      }`,
    );
    log(
      `cycle#${cycle}: stubbed swap API requests: ${
        seenSwapApiRequests.size
          ? [...seenSwapApiRequests].toSorted().join(', ')
          : 'none'
      }`,
    );
    log(
      `cycle#${cycle}: stubbed market API requests: ${
        seenMarketApiRequests.size
          ? [...seenMarketApiRequests].toSorted().join(', ')
          : 'none'
      }`,
    );
    log(
      `cycle#${cycle}: passed (${summary.totalEvents} trace events, ` +
        `${summary.providerRenders.commitCount} provider commits)`,
    );
    return report;
  } catch (error) {
    const screenshotFileName = `cycle-${cycle}-failure.png`;
    const screenshotPath = path.join(artifactDir, screenshotFileName);
    fs.writeFileSync(
      path.join(artifactDir, `cycle-${cycle}-exceptions.json`),
      `${JSON.stringify({ cdpExceptions, pageErrors }, null, 2)}\n`,
    );
    await page
      .screenshot({ path: screenshotPath, fullPage: true })
      .catch(() => {});
    log(`cycle#${cycle}: failure screenshot saved as ${screenshotFileName}`);
    throw error;
  } finally {
    await context.close().catch(() => {});
    assert.equal(
      browser.contexts().length,
      0,
      `cycle#${cycle}: E2E context cleanup left residual tabs`,
    );
  }
}

async function main() {
  fs.mkdirSync(artifactDir, { recursive: true });
  const { child: rendererProcess, rendererUrl } = await startWebRenderer();
  let browser;
  let cleanupPromise;
  const cleanup = () => {
    cleanupPromise ||= (async () => {
      if (browser) {
        await closeResidualE2EBrowserContexts(browser, 'shutdown').catch(
          () => {},
        );
        await browser.close().catch(() => {});
      }
      await stopProcess(rendererProcess);
    })();
    return cleanupPromise;
  };
  const handleSignal = (signal) => {
    log(`${signal}: clean E2E tabs before exit`);
    void cleanup().finally(() => {
      process.exit(signal === 'SIGINT' ? 130 : 143);
    });
  };
  const handleSigInt = () => handleSignal('SIGINT');
  const handleSigTerm = () => handleSignal('SIGTERM');
  process.once('SIGINT', handleSigInt);
  process.once('SIGTERM', handleSigTerm);
  try {
    browser = await launchBrowser();
    await closeResidualE2EBrowserContexts(browser, 'startup preflight');
    if (configuredCycles === 0) {
      for (let cycle = 1; ; cycle += 1) {
        await runCycle({ browser, cycle, rendererUrl });
      }
    } else {
      for (let cycle = 1; cycle <= configuredCycles; cycle += 1) {
        await runCycle({ browser, cycle, rendererUrl });
      }
    }
  } finally {
    await cleanup();
    process.off('SIGINT', handleSigInt);
    process.off('SIGTERM', handleSigTerm);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
