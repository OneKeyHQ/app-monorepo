import {
  type IBorrowAsset,
  type IBorrowToken,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { isAaveBorrowProvider } from './borrowNativeReserve.utils';

export {
  shouldUseAaveNativeGateway,
  isAaveBorrowProvider,
  isUnsupportedAaveNativeReserve,
  filterUnsupportedAaveNativeReserveAssets,
} from './borrowNativeReserve.utils';

function isSameBorrowReserveAddress({
  reserveAddress,
  targetReserveAddress,
}: {
  reserveAddress?: string;
  targetReserveAddress?: string;
}) {
  if (reserveAddress === undefined || targetReserveAddress === undefined) {
    return false;
  }

  if (reserveAddress === targetReserveAddress) {
    return true;
  }

  if (!reserveAddress || !targetReserveAddress) {
    return false;
  }

  if (
    reserveAddress.startsWith('0x') &&
    targetReserveAddress.startsWith('0x')
  ) {
    return reserveAddress.toLowerCase() === targetReserveAddress.toLowerCase();
  }

  return false;
}

export function getBorrowAssetByReserveAddress<
  T extends { reserveAddress: string },
>({ assets, reserveAddress }: { assets?: T[]; reserveAddress?: string }) {
  return assets?.find((asset) =>
    isSameBorrowReserveAddress({
      reserveAddress: asset.reserveAddress,
      targetReserveAddress: reserveAddress,
    }),
  );
}

export function getBorrowReserveTokenByAddress({
  reserves,
  reserveAddress,
}: {
  reserves?: Partial<
    Record<
      'supply' | 'borrow' | 'supplied' | 'borrowed',
      {
        assets: {
          reserveAddress: string;
          token: IBorrowToken;
        }[];
      }
    >
  >;
  reserveAddress?: string;
}): IBorrowToken | undefined {
  const assetGroups = [
    reserves?.supply?.assets,
    reserves?.borrow?.assets,
    reserves?.supplied?.assets,
    reserves?.borrowed?.assets,
  ];

  for (const assets of assetGroups) {
    const asset = getBorrowAssetByReserveAddress({
      assets,
      reserveAddress,
    });
    if (asset) {
      return asset.token;
    }
  }

  return undefined;
}

export function getValidBorrowSelectedAsset({
  assets,
  selectedAsset,
}: {
  assets?: IBorrowAsset[];
  selectedAsset?: IBorrowAsset | null;
}) {
  if (!selectedAsset) {
    return undefined;
  }

  return getBorrowAssetByReserveAddress({
    assets,
    reserveAddress: selectedAsset.reserveAddress,
  });
}

export function buildBorrowTokenFromAsset({
  asset,
  networkId,
}: {
  asset?: {
    reserveAddress: string;
    token: IBorrowAsset['token'] | IToken;
  } | null;
  networkId: string;
}) {
  if (!asset) {
    return undefined;
  }

  const isNativeReserve = asset.reserveAddress === '';

  return {
    ...asset.token,
    address: isNativeReserve ? '' : asset.token.address,
    isNative: isNativeReserve,
    networkId,
  } as IToken;
}

export function buildAaveNativeGatewayReceiveToken({
  token,
  nativeToken,
  networkId,
}: {
  token?: IToken;
  nativeToken?: IToken;
  networkId: string;
}) {
  const baseToken = nativeToken ?? token;
  if (!baseToken) {
    return undefined;
  }

  return {
    ...baseToken,
    address: '',
    isNative: true,
    networkId,
    name: nativeToken?.name ?? 'Ether',
    symbol: nativeToken?.symbol ?? 'ETH',
  } as IToken;
}

export function resolveBorrowTokenApproveSpenderAddress({
  providerName,
  marketAddress,
  backendApproveTarget,
  tokenIsNative,
}: {
  providerName?: string;
  marketAddress?: string;
  backendApproveTarget?: string;
  tokenIsNative?: boolean;
}) {
  if (backendApproveTarget) {
    return backendApproveTarget;
  }

  if (
    isAaveBorrowProvider({ providerName }) &&
    tokenIsNative === false &&
    marketAddress
  ) {
    return marketAddress;
  }

  return '';
}
