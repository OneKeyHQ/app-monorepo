import axios from 'axios';
import { BigNumber, Contract, utils } from 'ethers';
import { getAddress, hexDataSlice } from 'ethers/lib/utils';

import { getFiatEndpoint } from '../endpoint';
import { OPENSEA_REGISTRY_ABI } from '../vaults/impl/evm/decoder/abi';

import type { Token } from '../types/token';
import type { Filter, Log, Provider } from '@ethersproject/abstract-provider';
import type { BigNumberish } from 'ethers';

export const revokeUrl = 'https://revoke.cash/';

export type Events = {
  transferEvents: Log[];
  approvalEvents: Log[];
  approvalForAllEvents: Log[];
};

export type ERC20TokenApproval = {
  token: Token;
  contract: Contract;
  approvals: Log[];
  totalSupply: string;
  balance: string;
};

export type ERC721TokenApproval = {
  token: Token;
  contract: Contract;
  approvals: Log[];
  balance: string;
  approvalsForAll: Log[];
};

export type ERC20TokenAllowance = {
  token: Token;
  balance: string;
  totalSupply: string;
  allowance: {
    spender: string;
    allowance: string;
  }[];
};

export interface ERC721Allowance {
  spender: string;
  tokenId?: string;
}

export type ERC721TokenAllowance = {
  token: Token;
  balance: string;
  allowance: ERC721Allowance[];
};

export const MOONBIRDS_ADDRESS = '0x23581767a106ae21c074b2276D25e5C3e136a68b';
export const ETHEREUM_LISTS_CONTRACTS =
  'https://raw.githubusercontent.com/ethereum-lists/contracts/main';
export const ADDRESS_ZERO_PADDED =
  '0x0000000000000000000000000000000000000000000000000000000000000000';
export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';
export const DUMMY_ADDRESS = '0x0000000000000000000000000000000000000001';
export const DUMMY_ADDRESS_2 = '0x0000000000000000000000000000000000000002';
export const DUMMY_ADDRESS_3 = '0x000000000000000000000000000000000000dead';
export const OPENSEA_REGISTRY_ADDRESS =
  '0xa5409ec958C83C3f309868babACA7c86DCB077c1';

enum ChainId {
  EthereumMainnet = 1,
  Ropsten = 3,
  Rinkeby = 4,
  Goerli = 5,
  Optimism = 10,
  CronosMainnetBeta = 25,
  RSKMainnet = 30,
  RSKTestnet = 31,
  TelosEVMMainnet = 40,
  TelosEVMTestnet = 41,
  Kovan = 42,
  BinanceSmartChainMainnet = 56,
  SyscoinMainnet = 57,
  BinanceSmartChainTestnet = 97,
  Gnosis = 100,
  FuseMainnet = 122,
  FuseSparknet = 123,
  HuobiECOChainMainnet = 128,
  PolygonMainnet = 137,
  BitTorrentChainMainnet = 199,
  FantomOpera = 250,
  HuobiECOChainTestnet = 256,
  Shiden = 336,
  CronosTestnet = 338,
  OptimisticEthereumTestnetGoerli = 420,
  MetisStardustTestnet = 588,
  Astar = 592,
  KlaytnTestnetBaobab = 1001,
  CLVParachain = 1024,
  BitTorrentChainTestnet = 1028,
  MetisAndromedaMainnet = 1088,
  Moonbeam = 1284,
  Moonriver = 1285,
  MoonbaseAlpha = 1287,
  FantomTestnet = 4002,
  IoTeXNetworkMainnet = 4689,
  IoTeXNetworkTestnet = 4690,
  SyscoinTanenbaumTestnet = 5700,
  KlaytnMainnetCypress = 8217,
  EvmosTestnet = 9000,
  Evmos = 9001,
  SmartBitcoinCash = 10000,
  SmartBitcoinCashTestnet = 10001,
  ArbitrumOne = 42161,
  CeloMainnet = 42220,
  AvalancheFujiTestnet = 43113,
  'AvalancheC-Chain' = 43114,
  CeloAlfajoresTestnet = 44787,
  GodwokenMainnet = 71402,
  Mumbai = 80001,
  ArbitrumRinkeby = 421611,
  Sepolia = 11155111,
  AuroraMainnet = 1313161554,
  AuroraTestnet = 1313161555,
  HarmonyMainnetShard0 = 1666600000,
  Palm = 11297108109,
}

export const PROVIDER_SUPPORTED_CHAINS = [
  ChainId.EthereumMainnet,
  ChainId.Ropsten,
  ChainId.Rinkeby,
  ChainId.Goerli,
  ChainId.Kovan,
  ChainId.Sepolia,
  ChainId.TelosEVMMainnet,
  ChainId.TelosEVMTestnet,
  ChainId.Gnosis,
  ChainId.MetisAndromedaMainnet,
  ChainId.MetisStardustTestnet,
  ChainId.SmartBitcoinCash,
  ChainId.SmartBitcoinCashTestnet,
  ChainId.FuseMainnet,
  ChainId.FuseSparknet,
  ChainId.SyscoinTanenbaumTestnet,
  ChainId.SyscoinMainnet,
];

export const ETHERSCAN_SUPPORTED_CHAINS = [
  ChainId.BinanceSmartChainMainnet,
  ChainId.BinanceSmartChainTestnet,
  ChainId.PolygonMainnet,
  ChainId.Mumbai,
  ChainId['AvalancheC-Chain'],
  ChainId.AvalancheFujiTestnet,
  ChainId.FantomOpera,
  ChainId.FantomTestnet,
  ChainId.ArbitrumOne,
  ChainId.ArbitrumRinkeby,
  ChainId.HuobiECOChainMainnet,
  ChainId.HuobiECOChainTestnet,
  ChainId.Moonbeam,
  ChainId.Moonriver,
  ChainId.MoonbaseAlpha,
  ChainId.CronosMainnetBeta,
  ChainId.CronosTestnet,
  ChainId.CeloMainnet,
  ChainId.CeloAlfajoresTestnet,
  ChainId.AuroraMainnet,
  ChainId.AuroraTestnet,
  ChainId.BitTorrentChainMainnet,
  ChainId.BitTorrentChainTestnet,
  ChainId.CLVParachain,
];

// We disable some of these chains because there's not a lot of demand for them, but they are intensive on the backend
// We also disable testnets for the same reason
export const COVALENT_SUPPORTED_CHAINS = [
  ChainId.RSKMainnet,
  ChainId.RSKTestnet,
  ChainId.HarmonyMainnetShard0,
  // ChainId.HarmonyTestnetShard0,
  ChainId.IoTeXNetworkMainnet,
  // ChainId.IoTeXNetworkTestnet,
  ChainId.KlaytnMainnetCypress,
  // ChainId.KlaytnTestnetBaobab,
  ChainId.Evmos,
  ChainId.EvmosTestnet,
  ChainId.Palm,
  // ChainId.PalmTestnet,
  ChainId.Astar,
  ChainId.Shiden,
  ChainId.GodwokenMainnet,
  // ChainId.PolyjuiceTestnet,
  // ChainId['GodwokenTestnet(V1.1)'],
];

export const NODE_SUPPORTED_CHAINS = [
  ChainId.Optimism,
  ChainId.OptimisticEthereumTestnetGoerli,
];

export const SUPPORTED_CHAINS = [
  ...PROVIDER_SUPPORTED_CHAINS,
  ...ETHERSCAN_SUPPORTED_CHAINS,
  ...COVALENT_SUPPORTED_CHAINS,
  ...NODE_SUPPORTED_CHAINS,
];

export function isProviderSupportedChain(chainId: number): boolean {
  return PROVIDER_SUPPORTED_CHAINS.includes(chainId);
}

export function isCovalentSupportedChain(chainId: number): boolean {
  return COVALENT_SUPPORTED_CHAINS.includes(chainId);
}

export function isEtherscanSupportedChain(chainId: number): boolean {
  return ETHERSCAN_SUPPORTED_CHAINS.includes(chainId);
}

export function isNodeSupportedChain(chainId: number): boolean {
  return NODE_SUPPORTED_CHAINS.includes(chainId);
}

export function isBackendSupportedChain(chainId: number): boolean {
  return (
    isCovalentSupportedChain(chainId) ||
    isEtherscanSupportedChain(chainId) ||
    isNodeSupportedChain(chainId) ||
    isProviderSupportedChain(chainId)
  );
}

export class BackendProvider {
  constructor(public chainId: number) {
    this.chainId = chainId;
  }

  async getLogs(filter: Filter): Promise<Log[]> {
    const endpoint = getFiatEndpoint();
    try {
      const { data } = await axios.post<Log[]>(
        `${endpoint}/revoke/${this.chainId}/logs`,
        filter,
      );
      return data;
    } catch (error: any) {
      const errorMessage =
        // eslint-disable-next-line
        error?.response?.data?.message ??
        // eslint-disable-next-line
        error?.error?.message ??
        // eslint-disable-next-line
        error?.data?.message ??
        // eslint-disable-next-line
        error?.message;
      throw new Error(errorMessage);
    }
  }
}

export const getLogs = async (
  provider: Pick<Provider, 'getLogs'>,
  baseFilter: Filter,
  fromBlock: number,
  toBlock: number,
): Promise<Log[]> => {
  const filter = { ...baseFilter, fromBlock, toBlock };
  try {
    const result = await provider.getLogs(filter);
    return result;
  } catch (error) {
    const errorMessage =
      // @ts-ignore
      // eslint-disable-next-line
      error?.error?.message ?? error?.data?.message ?? error?.message;
    if (errorMessage !== 'query returned more than 10000 results') {
      throw error;
    }

    const middle = fromBlock + Math.floor((toBlock - fromBlock) / 2);
    const leftPromise = getLogs(provider, baseFilter, fromBlock, middle);
    const rightPromise = getLogs(provider, baseFilter, middle + 1, toBlock);
    const [left, right] = await Promise.all([leftPromise, rightPromise]);
    return [...left, ...right];
  }
};

export function toFloat(n: number, decimals: number): string {
  return (n / 10 ** decimals).toFixed(3);
}

export function formatAllowance(
  allowance: string,
  decimals: number,
  totalSupply: string,
): string {
  const allowanceBN = BigNumber.from(allowance);
  const totalSupplyBN = BigNumber.from(totalSupply);

  if (allowanceBN.gt(totalSupplyBN)) {
    return 'Unlimited';
  }

  return toFloat(Number(allowanceBN), decimals);
}

export function compareBN(a: BigNumberish, b: BigNumberish): number {
  const ba = BigNumber.from(a);
  const bb = BigNumber.from(b);
  const diff = ba.sub(bb);
  // eslint-disable-next-line
  return diff.isZero() ? 0 : diff.lt(0) ? -1 : 1;
}

export const isSpamToken = (token: Token) => {
  const includesHttp = /https?:\/\//i.test(token.symbol);
  // This is not exhaustive, but we can add more TLDs to the list as needed, better than nothing
  const includesTld =
    /\.(com|io|xyz|org|me|site|net|fi|vision|team|app|exchange|cash|finance)/i.test(
      token.symbol,
    );
  return includesHttp || includesTld;
};

export const getNameFromEthereumList = async (
  address: string,
  chainId: string,
): Promise<string | undefined> => {
  try {
    const contractRes = await axios.get<{ project: string }>(
      `${ETHEREUM_LISTS_CONTRACTS}/contracts/${chainId}/${getAddress(
        address,
      )}.json`,
    );

    try {
      const projectRes = await axios.get<{ name: string }>(
        `${ETHEREUM_LISTS_CONTRACTS}/projects/${contractRes.data.project}.json`,
      );
      return projectRes.data.name;
    } catch {
      // pass
    }
    return contractRes.data.project;
  } catch {
    return undefined;
  }
};

export async function getOpenSeaProxyAddress(
  userAddress: string,
  provider: Provider,
): Promise<string | undefined> {
  try {
    const contract = new Contract(
      OPENSEA_REGISTRY_ADDRESS,
      OPENSEA_REGISTRY_ABI,
      provider,
    );
    const [proxyAddress]: string[] = await contract.functions.proxies(
      userAddress,
    );
    if (!proxyAddress || proxyAddress === ADDRESS_ZERO) return undefined;
    return proxyAddress;
  } catch {
    return undefined;
  }
}

// This function is a hardcoded patch to show Moonbirds' OpenSea allowances,
// which do not show up normally because of a bug in their contract
export function generatePatchedAllowanceEvents(
  userAddress: string,
  openseaProxyAddress?: string,
  allEvents: Log[] = [],
): Log[] {
  if (!userAddress || !openseaProxyAddress) return [];
  // Only add the Moonbirds approval event if the account has interacted with Moonbirds at all
  if (!allEvents.some((ev) => ev.address === MOONBIRDS_ADDRESS)) return [];

  const baseDummyEventLog = {
    blockNumber: 0,
    blockHash: '0x',
    transactionIndex: 0,
    removed: false,
    data: '0x',
    transactionHash: '0x',
    logIndex: 0,
  };

  return [
    {
      ...baseDummyEventLog,
      address: MOONBIRDS_ADDRESS,
      topics: [
        utils.id('ApprovalForAll(address,address,approved)'),
        utils.hexZeroPad(userAddress, 32),
        utils.hexZeroPad(openseaProxyAddress, 32),
      ],
    },
  ];
}

async function getLimitedAllowanceFromApproval(
  multicallContract: Contract,
  approval: Log,
) {
  // Wrap this in a try-catch since it's possible the NFT has been burned
  try {
    // Some contracts (like CryptoStrikers) may not implement ERC721 correctly
    // by making tokenId a non-indexed parameter, in which case it needs to be
    // taken from the event data rather than topics
    const tokenId =
      approval.topics.length === 4
        ? BigNumber.from(approval.topics[3]).toString()
        : BigNumber.from(approval.data).toString();

    const [spender] = await multicallContract.functions.getApproved(tokenId);
    if (spender === ADDRESS_ZERO) return undefined;

    return { spender, tokenId };
  } catch {
    return undefined;
  }
}

export async function getLimitedAllowancesFromApprovals(
  contract: Contract,
  approvals: Log[],
) {
  const deduplicatedApprovals = approvals.filter(
    (approval, i) =>
      i ===
      approvals.findIndex((other) => approval.topics[2] === other.topics[2]),
  );

  const allowances = await Promise.all(
    deduplicatedApprovals.map((approval) =>
      getLimitedAllowanceFromApproval(contract, approval),
    ),
  );

  return allowances;
}

async function getUnlimitedAllowanceFromApproval(
  multicallContract: Contract,
  ownerAddress: string,
  approval: Log,
) {
  const spender = getAddress(hexDataSlice(approval.topics[2], 12));

  const [isApprovedForAll] = await multicallContract.functions.isApprovedForAll(
    ownerAddress,
    spender,
  );
  if (!isApprovedForAll) return undefined;

  return { spender };
}

export async function getUnlimitedAllowancesFromApprovals(
  contract: Contract,
  ownerAddress: string,
  approvals: Log[],
) {
  const deduplicatedApprovals = approvals.filter(
    (approval, i) =>
      i ===
      approvals.findIndex((other) => approval.topics[2] === other.topics[2]),
  );

  const allowances = await Promise.all(
    deduplicatedApprovals.map((approval) =>
      getUnlimitedAllowanceFromApproval(contract, ownerAddress, approval),
    ),
  );

  return allowances;
}

// eslint-disable-next-line
export const unpackResult = async (promise: Promise<any>) => (await promise)[0];

export const withFallback = async (promise: Promise<any>, fallback: any) => {
  try {
    // eslint-disable-next-line
    return await promise;
  } catch {
    // eslint-disable-next-line
    return fallback;
  }
};

export const convertString = async (promise: Promise<any>) =>
  String(await promise);
