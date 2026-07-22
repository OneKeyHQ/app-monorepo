export const PORTFOLIO_TOKEN_ICON_NAMES = [
  'BTC',
  'ETH',
  'TRON',
  'SOL',
  'BNB',
  'USDT',
  'USDC',
] as const;

export type IPortfolioTokenIconName =
  (typeof PORTFOLIO_TOKEN_ICON_NAMES)[number];

const PORTFOLIO_TOKEN_OFFICIAL_COLORS: Record<IPortfolioTokenIconName, number> =
  {
    BTC: 0xf7_93_1a,
    ETH: 0xb8_c4_d6,
    TRON: 0xff_06_0a,
    SOL: 0x70_68_e8,
    BNB: 0xf3_ba_2f,
    USDT: 0x26_a1_7b,
    USDC: 0x27_75_ca,
  };

export const PORTFOLIO_TOKEN_FALLBACK_COLORS = [
  0x78_68_e6, 0x3e_7b_fa, 0xd0_63_d8, 0xe8_a0_4b, 0x47_b3_9c, 0x8d_8d_93,
] as const;

type IPortfolioTokenIconContractAllowlistItem = {
  contractAddress: string;
  iconName: IPortfolioTokenIconName;
  networkId: string;
};

const PORTFOLIO_TOKEN_ICON_CASE_SENSITIVE_NETWORK_IMPLS = new Set([
  'aptos',
  'sol',
  'sui',
  'ton',
  'tron',
]);

const PORTFOLIO_TOKEN_ICON_NATIVE_ALLOWLIST: Record<
  string,
  IPortfolioTokenIconName
> = {
  'btc--0': 'BTC',
  'evm--1': 'ETH',
  'evm--56': 'BNB',
  'sol--101': 'SOL',
  'tron--0x2b6653dc': 'TRON',
};

const PORTFOLIO_TOKEN_ICON_SYMBOL_ALLOWLIST: Record<
  string,
  IPortfolioTokenIconName
> = {
  BNB: 'BNB',
  BTC: 'BTC',
  ETH: 'ETH',
  SOL: 'SOL',
  TRON: 'TRON',
  TRX: 'TRON',
  USDC: 'USDC',
  USDT: 'USDT',
};

const PORTFOLIO_TOKEN_ICON_CONTRACT_ALLOWLIST_ITEMS: IPortfolioTokenIconContractAllowlistItem[] =
  [
    {
      contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      iconName: 'USDT',
      networkId: 'evm--1',
    },
    {
      contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      iconName: 'USDC',
      networkId: 'evm--1',
    },
    {
      contractAddress: '0x55d398326f99059ff775485246999027b3197955',
      iconName: 'USDT',
      networkId: 'evm--56',
    },
    {
      contractAddress: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      iconName: 'USDC',
      networkId: 'evm--56',
    },
    {
      contractAddress: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
      iconName: 'USDC',
      networkId: 'evm--137',
    },
    {
      contractAddress: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
      iconName: 'USDT',
      networkId: 'evm--137',
    },
    {
      contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      iconName: 'USDC',
      networkId: 'sol--101',
    },
    {
      contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      iconName: 'USDT',
      networkId: 'sol--101',
    },
    {
      contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      iconName: 'USDT',
      networkId: 'tron--0x2b6653dc',
    },
  ];

function getNetworkImpl(networkId: string): string {
  return networkId.split('--')[0] ?? '';
}

function shouldPreserveContractAddressCase(networkId: string): boolean {
  return PORTFOLIO_TOKEN_ICON_CASE_SENSITIVE_NETWORK_IMPLS.has(
    getNetworkImpl(networkId),
  );
}

export function normalizePortfolioTokenContractAddress({
  contractAddress,
  networkId,
}: {
  contractAddress: string;
  networkId: string;
}): string {
  const trimmed = contractAddress.trim();
  return shouldPreserveContractAddressCase(networkId)
    ? trimmed
    : trimmed.toLowerCase();
}

function buildPortfolioTokenIconContractAllowlistKey({
  contractAddress,
  networkId,
}: {
  contractAddress: string;
  networkId: string;
}): string {
  return `${networkId}:${normalizePortfolioTokenContractAddress({
    contractAddress,
    networkId,
  })}`;
}

const PORTFOLIO_TOKEN_ICON_CONTRACT_ALLOWLIST = new Map(
  PORTFOLIO_TOKEN_ICON_CONTRACT_ALLOWLIST_ITEMS.map((item) => [
    buildPortfolioTokenIconContractAllowlistKey(item),
    item.iconName,
  ]),
);

function resolvePortfolioTokenIconNameBySymbol(
  symbol: string,
): IPortfolioTokenIconName | null {
  const normalizedSymbol = symbol.trim().toUpperCase();
  return PORTFOLIO_TOKEN_ICON_SYMBOL_ALLOWLIST[normalizedSymbol] ?? null;
}

export function resolvePortfolioTokenIconName({
  contractAddress,
  isAllNetworks,
  isNative,
  networkId,
  symbol,
}: {
  contractAddress: string;
  isAllNetworks: boolean;
  isNative: boolean;
  networkId: string;
  symbol: string;
}): IPortfolioTokenIconName | null {
  if (isAllNetworks) {
    return resolvePortfolioTokenIconNameBySymbol(symbol);
  }

  if (isNative) {
    return PORTFOLIO_TOKEN_ICON_NATIVE_ALLOWLIST[networkId] ?? null;
  }

  if (!contractAddress) {
    return null;
  }

  return (
    PORTFOLIO_TOKEN_ICON_CONTRACT_ALLOWLIST.get(
      buildPortfolioTokenIconContractAllowlistKey({
        contractAddress,
        networkId,
      }),
    ) ?? null
  );
}

function hashPortfolioTokenIdentity(value: string): number {
  let hash = 0x81_1c_9d_c5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01_00_01_93);
  }
  return hash >>> 0;
}

export function resolvePortfolioTokenColor({
  contractAddress,
  iconName,
  networkId,
  symbol,
}: {
  contractAddress: string;
  iconName: IPortfolioTokenIconName | null;
  networkId: string;
  symbol: string;
}): number {
  if (iconName) {
    return PORTFOLIO_TOKEN_OFFICIAL_COLORS[iconName];
  }

  const identity = [
    networkId.trim().toLowerCase(),
    normalizePortfolioTokenContractAddress({
      contractAddress,
      networkId,
    }),
    symbol.trim().toUpperCase(),
  ].join('|');
  const colorIndex =
    hashPortfolioTokenIdentity(identity) %
    PORTFOLIO_TOKEN_FALLBACK_COLORS.length;
  return PORTFOLIO_TOKEN_FALLBACK_COLORS[colorIndex];
}
