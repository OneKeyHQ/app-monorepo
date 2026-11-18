import BigNumber from 'bignumber.js';
import { isEqual } from 'lodash';

import { EEarnProviderEnum } from '../../types/earn';
import { EApproveType } from '../../types/staking';
import { getNetworkIdsMap } from '../config/networkIds';
import {
  EtherFiLiquidReferContract,
  MorphoBaseBundlerContract,
  MorphoBundlerContract,
  MorphoKatanaBundlerContract,
  PendleRouterContract,
} from '../consts/addresses';
import { OneKeyLocalError } from '../errors';

import networkUtils from './networkUtils';

import type { IEarnPermitCacheKey } from '../../types/earn';
import type {
  IEarnPermit2ApproveSignData,
  IEarnText,
  IEarnToken,
  IEarnUtmParams,
  IEarnWithdrawType,
  IStakeProtocolListItem,
} from '../../types/staking';
import type { IToken } from '../../types/token';

function getEarnProviderEnumKey(
  providerString: string,
): EEarnProviderEnum | undefined {
  const normalizedInput = providerString.toLowerCase();

  for (const key in EEarnProviderEnum) {
    if (
      EEarnProviderEnum[key as keyof typeof EEarnProviderEnum].toLowerCase() ===
      normalizedInput
    ) {
      return EEarnProviderEnum[key as keyof typeof EEarnProviderEnum];
    }
  }

  return undefined;
}

function createProviderCheck(provider: EEarnProviderEnum) {
  return ({ providerName }: { providerName: string }) =>
    providerName.toLowerCase() === provider.toLowerCase();
}

function findEarnProtocol({
  protocols,
  networkId,
  providerName,
  protocolVault,
}: {
  protocols: IStakeProtocolListItem[];
  networkId: string;
  providerName: string;
  protocolVault?: string;
}) {
  const normalize = (address: string) =>
    networkUtils.isEvmNetwork({ networkId }) ? address.toLowerCase() : address;
  const matches = protocols.filter(
    (item) =>
      item.network.networkId === networkId &&
      item.provider.name.toLowerCase() === providerName.toLowerCase() &&
      (!protocolVault ||
        normalize(item.provider.vault ?? '') === normalize(protocolVault)),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

const isLidoProvider = createProviderCheck(EEarnProviderEnum.Lido);

const isBabylonProvider = createProviderCheck(EEarnProviderEnum.Babylon);

const isEverstakeProvider = createProviderCheck(EEarnProviderEnum.Everstake);

const isMorphoProvider = createProviderCheck(EEarnProviderEnum.Morpho);

const isEtherFiProvider = createProviderCheck(EEarnProviderEnum.EtherFi);

const isSparkProvider = createProviderCheck(EEarnProviderEnum.Spark);

const isPendleProvider = createProviderCheck(EEarnProviderEnum.Pendle);

const isNativeProvider = createProviderCheck(EEarnProviderEnum.Native);

const isBitwayProvider = createProviderCheck(EEarnProviderEnum.Bitway);

const isUnitasProvider = createProviderCheck(EEarnProviderEnum.Unitas);

const isListaProvider = createProviderCheck(EEarnProviderEnum.Lista);

const isStakefishProvider = createProviderCheck(EEarnProviderEnum.Stakefish);

const isFalconProvider = createProviderCheck(EEarnProviderEnum.Falcon);

const isEthenaProvider = createProviderCheck(EEarnProviderEnum.Ethena);

const isMomentumProvider = createProviderCheck(EEarnProviderEnum.Momentum);

function isEarnApprovalReady({
  networkId,
  tokenIsNative,
  approveSpenderAddress,
}: {
  networkId: string;
  tokenIsNative?: boolean;
  approveSpenderAddress?: string;
}) {
  return (
    !networkUtils.isEvmNetwork({ networkId }) ||
    tokenIsNative === true ||
    (!!approveSpenderAddress &&
      /^0x[0-9a-f]{40}$/iu.test(approveSpenderAddress) &&
      !/^0x0{40}$/iu.test(approveSpenderAddress))
  );
}

function resolveEarnPermitSpenderAddress({
  providerName,
  networkId,
}: {
  providerName: string;
  networkId: string;
}): string | undefined {
  const networks = getNetworkIdsMap();
  if (isEtherFiProvider({ providerName })) {
    return networkId === networks.eth ? EtherFiLiquidReferContract : undefined;
  }
  if (!isMorphoProvider({ providerName })) return undefined;
  return {
    [networks.eth]: MorphoBundlerContract,
    [networks.base]: MorphoBaseBundlerContract,
    [networks.katana]: MorphoKatanaBundlerContract,
  }[networkId];
}

function resolveEarnAllowanceSpenderAddress({
  providerName,
  networkId,
  approveType,
  approveSpenderAddress,
}: {
  providerName: string;
  networkId: string;
  approveType?: EApproveType;
  approveSpenderAddress?: string;
}) {
  if (!approveSpenderAddress) return '';
  if (
    approveType === EApproveType.Permit &&
    isMorphoProvider({ providerName })
  ) {
    return resolveEarnPermitSpenderAddress({ providerName, networkId }) ?? '';
  }
  return approveSpenderAddress;
}

const earnPermitDomainFields = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];
const standardPermitFields = [
  { name: 'owner', type: 'address' },
  { name: 'spender', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
];
const daiPermitFields = [
  { name: 'holder', type: 'address' },
  { name: 'spender', type: 'address' },
  { name: 'nonce', type: 'uint256' },
  { name: 'expiry', type: 'uint256' },
  { name: 'allowed', type: 'bool' },
];

function assertEarnPermit({
  providerName,
  data,
  networkId,
  accountAddress,
  token,
  amount,
}: {
  providerName: string;
  data: IEarnPermit2ApproveSignData;
  networkId: string;
  accountAddress: string;
  token: Pick<IToken, 'address' | 'symbol' | 'decimals'>;
  amount: string;
}) {
  const spender = resolveEarnPermitSpenderAddress({ providerName, networkId });
  const value = new BigNumber(amount).shiftedBy(token.decimals);
  const sameAddress = (a?: string, b?: string) =>
    !!a && !!b && a.toLowerCase() === b.toLowerCase();
  const isDai =
    isMorphoProvider({ providerName }) &&
    token.symbol === 'DAI' &&
    networkId === getNetworkIdsMap().eth;
  const expiry = Number(isDai ? data.message.expiry : data.message.deadline);
  if (
    !spender ||
    !value.isFinite() ||
    !value.isInteger() ||
    !value.isGreaterThan(0) ||
    data.primaryType !== 'Permit' ||
    !isEqual(data.types, {
      EIP712Domain: earnPermitDomainFields,
      Permit: isDai ? daiPermitFields : standardPermitFields,
    }) ||
    data.domain.chainId !== Number(networkId.split('--')[1]) ||
    !sameAddress(data.domain.verifyingContract, token.address) ||
    !sameAddress(data.message.spender, spender) ||
    !sameAddress(
      isDai ? data.message.holder : data.message.owner,
      accountAddress,
    ) ||
    !Number.isFinite(expiry) ||
    expiry <= Date.now() / 1000 ||
    (isDai
      ? data.message.allowed !== true
      : !new BigNumber(data.message.value ?? '').eq(value))
  )
    throw new OneKeyLocalError(
      isEtherFiProvider({ providerName })
        ? 'Invalid EtherFi permit data'
        : 'Invalid Earn permit authorization',
    );
}

const isVaultBasedProvider = ({ providerName }: { providerName: string }) => {
  return (
    isMorphoProvider({ providerName }) ||
    isEtherFiProvider({ providerName }) ||
    isSparkProvider({ providerName }) ||
    isPendleProvider({ providerName }) ||
    isListaProvider({ providerName }) ||
    isMomentumProvider({ providerName }) ||
    isBitwayProvider({ providerName }) ||
    isUnitasProvider({ providerName })
  );
};

// Unitas (OK-61790): every withdraw is a queued path; waiting for the server
// declared withdrawType keeps the receipt approve step ahead of the redeem order.
const requiresEarnWithdrawPath = ({ providerName }: { providerName: string }) =>
  isSparkProvider({ providerName }) ||
  isBitwayProvider({ providerName }) ||
  isUnitasProvider({ providerName });

// Unitas (OK-66931): the protocol submits the deposit itself once the allowance
// lands, so the approve is the only step the user signs and the button says so.
const isProtocolExecutedStake = ({ providerName }: { providerName: string }) =>
  isUnitasProvider({ providerName });

// Unitas (OK-66931): the only withdraw that needs an approve is the gold-vault
// redeem request, which the protocol submits once the receipt allowance lands.
const isProtocolExecutedWithdraw = ({
  providerName,
}: {
  providerName: string;
}) => isUnitasProvider({ providerName });

const isEarnWithdrawPathReady = ({
  providerName,
  isLoading,
  withdrawType,
}: {
  providerName: string;
  isLoading: boolean;
  withdrawType?: IEarnWithdrawType;
}) =>
  !requiresEarnWithdrawPath({ providerName }) ||
  (!isLoading && Boolean(withdrawType));

const shouldSendEarnProtocolVault = ({
  providerName,
}: {
  providerName: string;
}) => {
  return (
    isVaultBasedProvider({ providerName }) || isNativeProvider({ providerName })
  );
};

function resolveEarnApproveSpenderAddress({
  providerName,
  verifiedProtocolVault,
  backendApproveTarget,
}: {
  providerName: string;
  verifiedProtocolVault?: string;
  backendApproveTarget?: string;
}) {
  if (isEtherFiProvider({ providerName })) return backendApproveTarget ?? '';
  if (isPendleProvider({ providerName })) return PendleRouterContract;
  if (isListaProvider({ providerName })) return verifiedProtocolVault ?? '';
  if (backendApproveTarget) return backendApproveTarget;
  if (isUnitasProvider({ providerName })) return '';
  return shouldSendEarnProtocolVault({ providerName })
    ? (verifiedProtocolVault ?? '')
    : '';
}

const isValidatorProvider = ({ providerName }: { providerName: string }) => {
  return (
    isEverstakeProvider({ providerName }) ||
    isStakefishProvider({ providerName })
  );
};

function getEarnProviderName({
  providerName,
}: {
  providerName: string;
}): string {
  const normalizedInput = providerName.toLowerCase();
  const enumValues = Object.values(EEarnProviderEnum);

  return (
    enumValues.find((value) => value.toLowerCase() === normalizedInput) ??
    'Unknown'
  );
}

function getEarnPermitCacheKey(payload: IEarnPermitCacheKey) {
  // A token allowance signed for one spender cannot authorize another protocol.
  return `${payload.accountId}_${payload.networkId}_${payload.providerName.toLowerCase()}_${payload.approveSpenderAddress.toLowerCase()}_${payload.tokenAddress}_${payload.amount}`;
}

function isUSDTonETHNetwork({
  networkId,
  symbol,
}: {
  networkId?: string;
  symbol?: string;
}) {
  return networkId === 'evm--1' && symbol === 'USDT';
}

function convertEarnTokenToIToken(earnToken?: IEarnToken): IToken | undefined {
  if (!earnToken?.address) {
    return undefined;
  }

  return {
    address: earnToken.address,
    decimals: earnToken.decimals,
    isNative: earnToken.isNative,
    logoURI: earnToken.logoURI,
    name: earnToken.name,
    symbol: earnToken.symbol,
    uniqueKey: earnToken.uniqueKey,
  };
}

/**
 * Resolves the label a token should be shown under.
 *
 * `symbol` stays the protocol identifier — it is the request param, the route
 * segment and the key the server matches on, so it must never be swapped for a
 * label. `displaySymbol` is an optional server-supplied relabel (e.g. Katana's
 * vbUSDC reads as "USDC for Katana (vbUSDC)") that only ever affects rendering,
 * and is absent for almost every token.
 *
 * Use this for identity surfaces — list rows, search results, page titles.
 * Do NOT use it as an amount unit: a relabel can be far longer than a symbol
 * and would wreck "0.00 <symbol>" layouts.
 */
function getDisplaySymbol(
  token?: { symbol?: string; displaySymbol?: string } | null,
): string {
  return token?.displaySymbol || token?.symbol || '';
}

/**
 * Whether a keyword matches a token by either of its labels, so search still
 * finds a relabelled token by the symbol users already know.
 */
function matchesSymbolKeyword(
  token: { symbol?: string; displaySymbol?: string } | null | undefined,
  keyword: string,
): boolean {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return true;
  }
  return [token?.symbol, token?.displaySymbol].some((label) =>
    label?.toLowerCase().includes(normalizedKeyword),
  );
}

function extractAmountFromText(text?: IEarnText): string {
  if (!text?.text) return '0';

  const match = text.text.match(/[\d,.]+/);
  return match ? match[0].replace(/,/g, '') : '0';
}

function buildEarnAccountKey({
  accountId,
  indexAccountId,
  networkId,
}: {
  accountId?: string;
  indexAccountId?: string;
  networkId: string;
}) {
  return `${accountId || indexAccountId || ''}-${networkId}`;
}

// Borrow-stack address normalization: the earn server's market/reserve
// lookups are case-sensitive and its markets list is lowercase, while
// indexer position data usually carries checksum-cased EVM addresses
// (test env returns 500 on checksum marketAddress). EVM addresses are
// case-insensitive by semantics, so lowercase them; base58 (Solana) is
// case-sensitive and must pass through untouched.
function normalizeBorrowAddress({
  networkId,
  address,
}: {
  networkId: string;
  address: string;
}): string {
  if (!networkUtils.isEvmNetwork({ networkId })) {
    return address;
  }
  return address.toLowerCase();
}

function normalizeBorrowAddressParams<
  T extends {
    networkId: string;
    marketAddress?: string;
    reserveAddress?: string;
    collateralReserveAddress?: string;
  },
>(params: T): T {
  if (!networkUtils.isEvmNetwork({ networkId: params.networkId })) {
    return params;
  }
  return {
    ...params,
    ...(params.marketAddress
      ? { marketAddress: params.marketAddress.toLowerCase() }
      : {}),
    ...(params.reserveAddress
      ? { reserveAddress: params.reserveAddress.toLowerCase() }
      : {}),
    // repay-with-collateral / setup-LUT / check-amount forward this sibling
    // reserve too; it comes from the same checksum-cased indexer data, so it
    // needs the same lowercasing to survive the case-sensitive earn service.
    ...(params.collateralReserveAddress
      ? {
          collateralReserveAddress:
            params.collateralReserveAddress.toLowerCase(),
        }
      : {}),
  };
}

// Mirrors the server rule for the order DTO: visible ASCII, 1-100 chars.
// Anything else is dropped so a malformed campaign link never blocks the
// order with a validation error.
const EARN_UTM_VALUE_PATTERN = /^[\x21-\x7e]{1,100}$/;

function normalizeEarnUtmValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return EARN_UTM_VALUE_PATTERN.test(trimmed) ? trimmed : undefined;
}

/**
 * Reads campaign attribution from a parsed Earn link or from route params.
 * Accepts the link spelling (utm_source) and the route spelling (utmSource)
 * because the web router hands query params through unchanged.
 * @returns undefined when nothing usable is present, so callers can spread
 * the result into request params without leaving empty keys behind.
 */
function normalizeEarnUtmParams(
  params?: Record<string, unknown> | null,
): IEarnUtmParams | undefined {
  if (!params) return undefined;
  const utmSource = normalizeEarnUtmValue(
    params.utmSource ?? params.utm_source,
  );
  const utmMedium = normalizeEarnUtmValue(
    params.utmMedium ?? params.utm_medium,
  );
  const utmCampaign = normalizeEarnUtmValue(
    params.utmCampaign ?? params.utm_campaign,
  );
  if (!utmSource && !utmMedium && !utmCampaign) return undefined;
  return {
    ...(utmSource ? { utmSource } : {}),
    ...(utmMedium ? { utmMedium } : {}),
    ...(utmCampaign ? { utmCampaign } : {}),
  };
}

export default {
  assertEarnPermit,
  resolveEarnAllowanceSpenderAddress,
  resolveEarnPermitSpenderAddress,
  findEarnProtocol,
  resolveEarnApproveSpenderAddress,
  isEarnApprovalReady,
  buildEarnAccountKey,
  getEarnProviderEnumKey,
  isMorphoProvider,
  isEtherFiProvider,
  isSparkProvider,
  isPendleProvider,
  isNativeProvider,
  isBitwayProvider,
  isUnitasProvider,
  isListaProvider,
  isLidoProvider,
  isBabylonProvider,
  isEverstakeProvider,
  isStakefishProvider,
  isFalconProvider,
  isEthenaProvider,
  isMomentumProvider,
  getEarnProviderName,
  getEarnPermitCacheKey,
  isUSDTonETHNetwork,
  isVaultBasedProvider,
  requiresEarnWithdrawPath,
  isEarnWithdrawPathReady,
  isProtocolExecutedStake,
  isProtocolExecutedWithdraw,
  shouldSendEarnProtocolVault,
  normalizeEarnUtmParams,
  isValidatorProvider,
  convertEarnTokenToIToken,
  getDisplaySymbol,
  matchesSymbolKeyword,
  extractAmountFromText,
  normalizeBorrowAddress,
  normalizeBorrowAddressParams,
};
