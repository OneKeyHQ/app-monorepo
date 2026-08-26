import type {
  IAddressBadge,
  ICexSupportedInfo,
} from '@onekeyhq/shared/types/address';

const CEX_BADGE_LABEL = 'cex';

export function getBadgeQueryTokenAddress({
  isNFT,
  tokenAddress,
}: {
  isNFT?: boolean;
  tokenAddress?: string;
}): string {
  if (isNFT) {
    return '';
  }
  return tokenAddress ?? '';
}

export function isCexDepositExplicitlyDisabled(
  depositEnable?: boolean | null,
): boolean {
  return depositEnable === false;
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

function normalizeBadgeLabel(label?: string): string {
  return (label ?? '').trim().toLowerCase();
}

export function pickCexDepositSupportBadge({
  badges,
  cexLabel,
  addressLabel,
}: {
  badges?: IAddressBadge[];
  cexLabel?: string;
  addressLabel?: string;
}): IAddressBadge | undefined {
  const skipLabels = new Set(
    [
      CEX_BADGE_LABEL,
      normalizeBadgeLabel(cexLabel),
      normalizeBadgeLabel(addressLabel),
    ].filter(Boolean),
  );

  return (badges ?? []).find((badge) => {
    const type = badge.type ?? 'default';
    if (type !== 'default' && type !== 'info') {
      return false;
    }
    const label = normalizeBadgeLabel(badge.label);
    return Boolean(label) && !skipLabels.has(label);
  });
}

export function getCexDepositUnsupportedDialogCopy({
  badges,
  cexLabel,
  addressLabel,
}: {
  badges?: IAddressBadge[];
  cexLabel?: string;
  addressLabel?: string;
}): {
  title?: string;
  description?: string;
} {
  const depositBadge = pickCexDepositSupportBadge({
    badges,
    cexLabel,
    addressLabel,
  });
  if (depositBadge?.label || depositBadge?.tip) {
    return {
      title: depositBadge.label,
      description: depositBadge.tip,
    };
  }
  const cexBadge = (badges ?? []).find(
    (badge) => normalizeBadgeLabel(badge.label) === CEX_BADGE_LABEL,
  );
  return {
    title: cexBadge?.label,
    description: cexBadge?.tip,
  };
}
