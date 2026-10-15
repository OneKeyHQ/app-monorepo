import { EBinanceDepositSessionStatus } from '../../types/exchange';
import {
  BINANCE_DEPOSIT_BIND_WINDOW_MS,
  BINANCE_DEPOSIT_LINK_HOST_ALLOWLIST,
  BINANCE_DEPOSIT_RETURN_HOST,
  BINANCE_DEPOSIT_RETURN_NONCE_PARAM,
  BINANCE_DEPOSIT_RETURN_PATH,
  BINANCE_DEPOSIT_RETURN_SCHEME,
  BINANCE_DEPOSIT_SESSION_TTL_MS,
  BINANCE_DEPOSIT_TOKEN_REGEX,
} from '../consts/binanceDepositConsts';
import { IMPL_EVM, IMPL_TRON, IMPL_XRP } from '../engine/engineConsts';
import { OneKeyLocalError } from '../errors';

import bufferUtils from './bufferUtils';
import networkUtils from './networkUtils';

import type {
  IBinanceDepositAsset,
  IBinanceDepositAuthorizedDestination,
  IBinanceDepositLocalSession,
  IBinanceDepositPhase,
  IBinanceSupportedAssets,
} from '../../types/exchange';

const SESSION_KEY_BYTE_LENGTH = 32;
const RETURN_URL_PREFIX = `${BINANCE_DEPOSIT_RETURN_SCHEME}://`;
// Printable ASCII without the backslash: URL parsers disagree on '\' and
// whitespace, so a link carrying them could resolve to another host.
const LINK_SAFE_CHARS_REGEX = /^[\x21-\x5b\x5d-\x7e]+$/;
const LINK_RAW_AUTHORITY_REGEX = /^https:\/\/([^/?#]*)/i;
const HEX_64_REGEX = /^[0-9a-fA-F]{64}$/;
const PREFIXED_HEX_64_REGEX = /^0x[0-9a-fA-F]{64}$/;
// The server still confirms an INIT session for 2 minutes after its deadline
// and only then opens the bind window.
const RETURN_GRACE_MS = 2 * 60 * 1000 + BINANCE_DEPOSIT_BIND_WINDOW_MS;

// CSPRNG, 32 bytes, base64url without padding (43 chars).
export function generateBinanceDepositSessionKey(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new OneKeyLocalError('Secure random source is unavailable');
  }
  const bytes = cryptoApi.getRandomValues(
    new Uint8Array(SESSION_KEY_BYTE_LENGTH),
  );
  // A stubbed source that leaves the buffer untouched would still encode.
  if (bytes.every((byte) => byte === 0)) {
    throw new OneKeyLocalError('Secure random source returned no entropy');
  }
  // The Buffer polyfill on native has no 'base64url' encoding.
  const sessionKey = bufferUtils
    .bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  if (!BINANCE_DEPOSIT_TOKEN_REGEX.test(sessionKey)) {
    throw new OneKeyLocalError('Generated session key is malformed');
  }
  return sessionKey;
}

// The nonce of a return URL that carries exactly one well-formed `rn`. Other
// parameters are ignored, never decoded.
export function parseBinanceDepositReturnNonce(
  url: string,
): string | undefined {
  const [withoutFragment] = url.split('#');
  const queryIndex = withoutFragment.indexOf('?');
  if (queryIndex < 0) {
    return undefined;
  }
  const base = withoutFragment.slice(0, queryIndex);
  if (
    base.slice(0, RETURN_URL_PREFIX.length).toLowerCase() !== RETURN_URL_PREFIX
  ) {
    return undefined;
  }
  const [host, ...pathParts] = base.slice(RETURN_URL_PREFIX.length).split('/');
  const path = pathParts.join('/');
  if (
    host.toLowerCase() !== BINANCE_DEPOSIT_RETURN_HOST ||
    (path !== BINANCE_DEPOSIT_RETURN_PATH &&
      path !== `${BINANCE_DEPOSIT_RETURN_PATH}/`)
  ) {
    return undefined;
  }
  const nonceValues = withoutFragment
    .slice(queryIndex + 1)
    .split('&')
    .filter((segment) =>
      segment.startsWith(`${BINANCE_DEPOSIT_RETURN_NONCE_PARAM}=`),
    )
    .map((segment) =>
      segment.slice(BINANCE_DEPOSIT_RETURN_NONCE_PARAM.length + 1),
    );
  if (nonceValues.length !== 1) {
    return undefined;
  }
  // The charset needs no escaping, so a matching raw value is the nonce.
  return BINANCE_DEPOSIT_TOKEN_REGEX.test(nonceValues[0])
    ? nonceValues[0]
    : undefined;
}

// Same acceptance as the server: https, a hostname exactly on the allowlist,
// no userinfo and no explicit port. The raw authority has to equal the parsed
// hostname, so a parser disagreement can only reject.
export function isAllowedBinanceDepositLink(link: string): boolean {
  if (typeof link !== 'string' || !LINK_SAFE_CHARS_REGEX.test(link)) {
    return false;
  }
  const rawAuthority = LINK_RAW_AUTHORITY_REGEX.exec(link)?.[1] ?? '';
  try {
    const parsed = new URL(link);
    const hostname = parsed.hostname.toLowerCase();
    return (
      parsed.protocol === 'https:' &&
      rawAuthority.toLowerCase() === hostname &&
      BINANCE_DEPOSIT_LINK_HOST_ALLOWLIST.includes(hostname)
    );
  } catch {
    return false;
  }
}

export function isSameBinanceDepositAddress({
  networkId,
  a,
  b,
}: {
  networkId: string;
  a: string;
  b: string;
}): boolean {
  return networkUtils.isEvmNetwork({ networkId })
    ? a.toLowerCase() === b.toLowerCase()
    : a === b;
}

// The server sends the frozen destination in one canonical form, so every
// identity field has to match exactly. Absent and '' mean the same.
export function isSameBinanceDepositDestination(
  a: IBinanceDepositAuthorizedDestination,
  b: IBinanceDepositAuthorizedDestination,
): boolean {
  return (
    a.address === b.address &&
    a.networkId === b.networkId &&
    a.binanceNetwork === b.binanceNetwork &&
    a.cryptoCurrency === b.cryptoCurrency &&
    (a.addressTag ?? '') === (b.addressTag ?? '') &&
    (a.contractAddress ?? '') === (b.contractAddress ?? '')
  );
}

// Exact match only: same network, same symbol and the same contract. A native
// token needs an entry without a contract.
export function findBinanceDepositAsset({
  assets,
  networkId,
  symbol,
  contractAddress,
  isNative,
}: {
  assets: IBinanceSupportedAssets | undefined;
  networkId: string;
  symbol: string;
  contractAddress?: string;
  isNative: boolean;
}): IBinanceDepositAsset | undefined {
  const symbols = assets?.[networkId];
  if (!symbols || !symbol) {
    return undefined;
  }
  const entryKey = Object.keys(symbols).find(
    (key) => key.toUpperCase() === symbol.toUpperCase(),
  );
  const entry = entryKey ? symbols[entryKey] : undefined;
  if (!entryKey || !entry || entry.depositEnable !== true) {
    return undefined;
  }
  const listedContract = entry.contractAddress ?? '';
  const tokenContract = isNative ? '' : (contractAddress ?? '');
  const isSameContract =
    listedContract && tokenContract
      ? isSameBinanceDepositAddress({
          networkId,
          a: listedContract,
          b: tokenContract,
        })
      : listedContract === tokenContract;
  if (!isSameContract) {
    return undefined;
  }
  return {
    networkId,
    cryptoCurrency: entryKey,
    contractAddress: entry.contractAddress || undefined,
    requiresAddressTag: entry.requiresAddressTag === true,
  };
}

// The report endpoint wants `0x` + 64 hex on EVM and bare 64 hex on TRON and
// XRP. Anything else is passed on and left for the server to judge.
export function normalizeBinanceDepositTxHash({
  networkId,
  txid,
}: {
  networkId: string;
  txid: string;
}): string {
  const value = txid.trim();
  const impl = networkUtils.getNetworkImpl({ networkId });
  if (impl === IMPL_EVM && HEX_64_REGEX.test(value)) {
    return `0x${value}`;
  }
  if (
    (impl === IMPL_TRON || impl === IMPL_XRP) &&
    PREFIXED_HEX_64_REGEX.test(value)
  ) {
    return value.slice(2);
  }
  return value;
}

// The bind deadline once the server reported one; before that, the session
// deadline plus the server's grace and bind window.
export function getBinanceDepositReturnDeadline(
  session: IBinanceDepositLocalSession,
): number {
  if (session.bindDeadline) {
    return session.bindDeadline;
  }
  const sessionDeadline = Math.min(
    session.createdAt + BINANCE_DEPOSIT_SESSION_TTL_MS,
    session.linkExpireTime ?? Number.POSITIVE_INFINITY,
  );
  return sessionDeadline + RETURN_GRACE_MS;
}

// A return is accepted only for a session started on this device whose link
// was opened and whose bind deadline has not passed.
export function isBinanceDepositAwaitingReturn(
  session: IBinanceDepositLocalSession,
  now: number,
): boolean {
  return (
    (session.status === EBinanceDepositSessionStatus.INIT ||
      session.status === EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND) &&
    !!session.sessionId &&
    !!session.linkOpenedAt &&
    !session.destination &&
    !session.failReason &&
    now < getBinanceDepositReturnDeadline(session)
  );
}

// The server keeps one in-progress session per asset and has no cancel
// call, so a session still usable for the same asset is picked up again: a
// new one would be refused until the old one expires.
export function isBinanceDepositResumable(
  session: IBinanceDepositLocalSession,
  asset: IBinanceDepositAsset,
  now: number,
): boolean {
  if (
    session.failReason ||
    session.networkId !== asset.networkId ||
    session.cryptoCurrency !== asset.cryptoCurrency ||
    (session.contractAddress ?? '') !== (asset.contractAddress ?? '')
  ) {
    return false;
  }
  if (session.status === EBinanceDepositSessionStatus.AUTHORIZED) {
    return !!session.destination;
  }
  return now < getBinanceDepositReturnDeadline(session);
}

export function getBinanceDepositPhase(
  session: IBinanceDepositLocalSession,
  isBinding: boolean,
): IBinanceDepositPhase {
  if (session.failReason) {
    return 'failed';
  }
  if (
    session.status === EBinanceDepositSessionStatus.AUTHORIZED &&
    session.destination
  ) {
    return 'authorized';
  }
  if (
    session.status === 'LOCAL_PENDING_CREATE' ||
    session.status === EBinanceDepositSessionStatus.CREATING
  ) {
    return session.createFailed ? 'create_failed' : 'creating';
  }
  // AUTHORIZED_UNBOUND without a return stays here: it carries no address.
  return isBinding || session.returnReceivedAt ? 'confirming' : 'awaiting';
}
