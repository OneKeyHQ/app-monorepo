import { checkWrappedTokenPair } from '@onekeyhq/shared/src/utils/tokenUtils';

import { shouldUseAaveNativeGateway } from '../../../Borrow/components/borrowNativeReserve.utils';

import { getLoanPayPath } from './loanRouter.utils';

import type {
  ILoanPayPath,
  ILoanRoute,
  ILoanRouterToken,
} from './loanRouter.utils';
import type { IEarnDesktopMarketReserves } from '../../components/desktopHome/earnDesktopHome.utils';
import type { IEarnRouterPayToken } from '../EarnRouter/earnRouter.utils';

export function getLoanPayPathForToken({
  route,
  payToken,
  wrappedFundingToken,
}: {
  route: ILoanRoute;
  payToken?: IEarnRouterPayToken;
  wrappedFundingToken?: ILoanRouterToken;
}): ILoanPayPath {
  const path = getLoanPayPath({
    payToken: payToken && {
      networkId: payToken.networkId,
      symbol: payToken.token.symbol,
    },
    collateral: route.collateral,
  });
  if (
    path === 'direct' &&
    !route.collateral.address &&
    shouldUseAaveNativeGateway({
      networkId: route.market.networkId,
      providerName: route.market.provider,
      reserveAddress: route.collateral.reserveAddress,
    }) &&
    payToken &&
    payToken.networkId === route.market.networkId &&
    !payToken.token.isNative &&
    !wrappedFundingToken
  ) {
    return 'swap';
  }
  return path;
}

export function isValidLoanWrappedFundingToken({
  route,
  token,
}: {
  route: ILoanRoute;
  token: ILoanRouterToken;
}) {
  return (
    !route.collateral.address &&
    shouldUseAaveNativeGateway({
      networkId: route.market.networkId,
      providerName: route.market.provider,
      reserveAddress: route.collateral.reserveAddress,
    }) &&
    token.networkId === route.market.networkId &&
    Boolean(token.address) &&
    token.address.toLowerCase() === token.reserveAddress.toLowerCase() &&
    token.decimals === route.collateral.decimals &&
    checkWrappedTokenPair({
      fromToken: {
        networkId: token.networkId,
        contractAddress: token.address,
        isNative: false,
      },
      toToken: {
        networkId: route.market.networkId,
        contractAddress: '',
        isNative: true,
      },
    })
  );
}

// Aave exposes the same reserve as a native gateway and an ERC20 supply.
// Keep the gateway route for position accounting, but bind payment to the
// exact ERC20 reserve returned for this market.
export function getLoanWrappedFundingToken({
  route,
  payToken,
  accountId,
  markets,
}: {
  route?: ILoanRoute;
  payToken?: IEarnRouterPayToken;
  accountId?: string;
  markets: IEarnDesktopMarketReserves[];
}): ILoanRouterToken | undefined {
  if (
    !route ||
    !payToken ||
    !accountId ||
    payToken.accountId !== accountId ||
    payToken.networkId !== route.market.networkId ||
    payToken.token.isNative ||
    !payToken.token.address ||
    route.collateral.address ||
    !shouldUseAaveNativeGateway({
      networkId: route.market.networkId,
      providerName: route.market.provider,
      reserveAddress: route.collateral.reserveAddress,
    }) ||
    !checkWrappedTokenPair({
      fromToken: {
        networkId: payToken.networkId,
        contractAddress: payToken.token.address,
        isNative: false,
      },
      toToken: {
        networkId: route.market.networkId,
        contractAddress: '',
        isNative: true,
      },
    })
  ) {
    return undefined;
  }

  const matches = markets.flatMap(({ market, reserves }) => {
    if (
      market.networkId !== route.market.networkId ||
      market.provider.toLowerCase() !== route.market.provider.toLowerCase() ||
      market.marketAddress.toLowerCase() !==
        route.market.marketAddress.toLowerCase()
    ) {
      return [];
    }
    return (reserves?.supply?.assets ?? []).filter(
      (asset) =>
        asset.canBeCollateral &&
        asset.reserveAddress.toLowerCase() ===
          payToken.token.address.toLowerCase() &&
        asset.token.address.toLowerCase() ===
          payToken.token.address.toLowerCase() &&
        asset.token.decimals === route.collateral.decimals &&
        asset.token.decimals === payToken.token.decimals,
    );
  });
  if (matches.length !== 1) return undefined;
  const { token, reserveAddress } = matches[0];
  const result = {
    symbol: token.symbol,
    name: token.name,
    logoURI: token.logoURI,
    address: token.address,
    decimals: token.decimals,
    networkId: route.market.networkId,
    reserveAddress,
  };
  return isValidLoanWrappedFundingToken({ route, token: result })
    ? result
    : undefined;
}
