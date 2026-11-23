import type {
  IAddressBadge,
  ICexSupportedInfo,
} from '@onekeyhq/shared/types/address';

export function getBadgeQueryTokenAddress({
  isNFT,
  isNative,
  tokenAddress,
  nativeTokenAddress,
}: {
  isNFT?: boolean;
  isNative?: boolean;
  tokenAddress?: string;
  nativeTokenAddress?: string;
}): string | undefined {
  if (isNFT) {
    return undefined;
  }
  const isNativeToken =
    isNative ??
    (nativeTokenAddress !== undefined && tokenAddress === nativeTokenAddress);
  return isNativeToken ? '' : tokenAddress;
}

export function isCexDepositExplicitlyDisabled(
  depositEnable?: boolean | null,
): boolean {
  return depositEnable === false;
}

const MAX_CEX_ANALYTICS_LABEL_LENGTH = 32;

export function getCexDepositWarningExchange(cexLabel?: string): string {
  const label = cexLabel?.trim().toLowerCase();
  if (!label || label.length > MAX_CEX_ANALYTICS_LABEL_LENGTH) {
    return 'unknown';
  }
  return label;
}

export function getCexDepositWarningFacts({
  tokenSymbol,
  networkName,
  exchangeLabel,
  exchangeDisplayName,
  addressBadges,
}: {
  tokenSymbol?: string;
  networkName?: string;
  exchangeLabel?: string;
  exchangeDisplayName?: string;
  addressBadges?: IAddressBadge[];
}): {
  tokenSymbol?: string;
  networkName?: string;
  exchangeName?: string;
} {
  const token = tokenSymbol?.trim();
  const network = networkName?.trim();
  const exchange = exchangeLabel?.trim();
  // Server label badges read like "Binance · CEX"; the brand is the part
  // before the separator.
  const badgeName = addressBadges
    ?.filter((badge) => badge.type === 'default' || badge.type === 'info')
    .map((badge) => badge.label.split('·')[0].trim())
    .find((name) => name.toLowerCase() === exchange?.toLowerCase());
  const displayName = badgeName || exchangeDisplayName?.trim();
  const exchangeName =
    exchange && displayName?.toLowerCase() === exchange.toLowerCase()
      ? displayName
      : exchange;
  return {
    ...(token ? { tokenSymbol: token } : {}),
    ...(network ? { networkName: network } : {}),
    ...(exchangeName ? { exchangeName } : {}),
  };
}

export function mergeCexSupportedInfo(
  infos: Array<ICexSupportedInfo | undefined>,
): ICexSupportedInfo | undefined {
  let first: ICexSupportedInfo | undefined;
  let lastDisabled: ICexSupportedInfo | undefined;
  let firstEnabled: ICexSupportedInfo | undefined;
  for (const info of infos) {
    if (info) {
      first ??= info;
      if (isCexDepositExplicitlyDisabled(info.depositEnable)) {
        lastDisabled = info;
      } else if (info.depositEnable === true) {
        firstEnabled ??= info;
      }
    }
  }
  return lastDisabled ?? firstEnabled ?? first;
}
