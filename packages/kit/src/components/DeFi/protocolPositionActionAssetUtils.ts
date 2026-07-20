import {
  EDeFiPositionAction,
  type IResolvedDeFiPositionActionAsset,
} from '@onekeyhq/shared/types/defi';

type IProtocolPositionActionAssetIdentitySource = Pick<
  IResolvedDeFiPositionActionAsset,
  'symbol'
> & {
  asset: { meta: { logoUrl?: string } };
  underlyingAssets?: Array<{
    symbol: string;
    meta: { logoUrl?: string };
  }>;
};

export type IProtocolPositionActionAssetBalanceLabel =
  | 'available'
  | 'availableToWithdraw'
  | 'remainingDebt';

export function resolveProtocolPositionActionAssetBalanceLabel(
  action: EDeFiPositionAction,
): IProtocolPositionActionAssetBalanceLabel {
  if (action === EDeFiPositionAction.Withdraw) return 'availableToWithdraw';
  if (action === EDeFiPositionAction.Repay) return 'remainingDebt';
  return 'available';
}

export function resolveProtocolPositionActionAssetPill({
  action,
  selectedAsset,
}: {
  action: EDeFiPositionAction;
  selectedAsset: IProtocolPositionActionAssetIdentitySource;
}) {
  const underlyingAssets =
    action === EDeFiPositionAction.RemoveLiquidity
      ? selectedAsset.underlyingAssets
      : undefined;
  const pairSymbol = underlyingAssets
    ?.map((asset) => asset.symbol)
    .filter(Boolean)
    .join(' / ');
  const logoURIs = underlyingAssets
    ?.map((asset) => asset.meta.logoUrl)
    .filter((logoURI): logoURI is string => Boolean(logoURI));

  return {
    symbol: pairSymbol || selectedAsset.symbol,
    logoURI: selectedAsset.asset.meta.logoUrl,
    logoURIs: logoURIs?.length ? logoURIs : undefined,
  };
}
