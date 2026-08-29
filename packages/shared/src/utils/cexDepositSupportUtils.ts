import type { ICexSupportedInfo } from '@onekeyhq/shared/types/address';

export function getBadgeQueryTokenAddress({
  isNFT,
  isNative,
  tokenAddress,
}: {
  isNFT?: boolean;
  isNative?: boolean;
  tokenAddress?: string;
}): string | undefined {
  if (isNFT) {
    return undefined;
  }
  return isNative ? '' : tokenAddress;
}

export function isCexDepositExplicitlyDisabled(
  depositEnable?: boolean | null,
): boolean {
  return depositEnable === false;
}

export function getCexDepositWarningFacts({
  tokenSymbol,
  networkName,
  exchangeLabel,
  fallbackExchangeLabel,
}: {
  tokenSymbol?: string;
  networkName?: string;
  exchangeLabel?: string;
  fallbackExchangeLabel: string;
}): {
  tokenSymbol?: string;
  networkName?: string;
  exchangeName: string;
} {
  const token = tokenSymbol?.trim();
  const network = networkName?.trim();
  return {
    ...(token ? { tokenSymbol: token } : {}),
    ...(network ? { networkName: network } : {}),
    exchangeName: exchangeLabel?.trim() || fallbackExchangeLabel.trim(),
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
      if (info.depositEnable === false) {
        lastDisabled = info;
      } else if (info.depositEnable === true) {
        firstEnabled ??= info;
      }
    }
  }
  return lastDisabled ?? firstEnabled ?? first;
}
