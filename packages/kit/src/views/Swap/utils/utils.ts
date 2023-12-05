import {
  CrossChainSwapProviders,
  type ISwapNetwork,
  type ISwapToken,
  SingleChainSwapProviders,
} from '@onekeyhq/kit-bg/src/services/ServiceSwap';

export function validateInput(text: string) {
  const regex = /^$|^0(\.\d{0,6})?$|^[1-9]\d*(\.\d{0,6})?$|^[1-9]\d*\.$|^0\.$/;
  if (!regex.test(text)) {
    return false;
  }
  return true;
}

export function swapTokenTrendingPairsSupported(
  from: ISwapToken,
  to: ISwapToken,
): { providers: string; protocolTypes: string } {
  const fromProvidersArr = from.providers.split(',');
  const toProvidersArr = to.providers.split(',');
  const fromProtocolTypesArr = from.protocolTypes.split(',');
  const toProtocolTypesArr = to.protocolTypes.split(',');
  const providers = fromProvidersArr.filter((item) =>
    toProvidersArr.includes(item),
  );
  const protocolTypes = fromProtocolTypesArr.filter((item) =>
    toProtocolTypesArr.includes(item),
  );
  return {
    providers: providers.join(','),
    protocolTypes: protocolTypes.join(','),
  };
}

export function checkSingleChainProviderIntersection(
  from: ISwapNetwork | ISwapToken,
  to: ISwapNetwork | ISwapToken,
) {
  const fromProvidersArr = from.providers.split(',');
  const toProvidersArr = to.providers.split(',');
  const fromSingleChainProviders = fromProvidersArr.filter((item) =>
    SingleChainSwapProviders.includes(item),
  );
  const toSingleChainProviders = toProvidersArr.filter((item) =>
    SingleChainSwapProviders.includes(item),
  );
  return fromSingleChainProviders.some((item) =>
    toSingleChainProviders.includes(item),
  );
}

export function checkCrossChainProviderIntersection(
  from: ISwapNetwork | ISwapToken,
  to: ISwapNetwork | ISwapToken,
) {
  const fromProvidersArr = from.providers.split(',');
  const toProvidersArr = to.providers.split(',');
  const fromSingleChainProviders = fromProvidersArr.filter((item) =>
    CrossChainSwapProviders.includes(item),
  );
  const toCrossChainProviders = toProvidersArr.filter((item) =>
    CrossChainSwapProviders.includes(item),
  );
  return fromSingleChainProviders.some((item) =>
    toCrossChainProviders.includes(item),
  );
}

export function checkProtocolTypesIntersection(
  from: ISwapNetwork | ISwapToken,
  to: ISwapNetwork | ISwapToken,
) {
  const fromProtocolTypesArr = from.protocolTypes.split(',');
  const toProtocolTypesArr = to.protocolTypes.split(',');
  return fromProtocolTypesArr.some((item) => toProtocolTypesArr.includes(item));
}

export function isOnlySupportSingleChainProvider(
  value: ISwapNetwork | ISwapToken,
) {
  const providers = value.providers.split(',');
  return providers.every((item) => SingleChainSwapProviders.includes(item));
}

export function filterTokenListByFromToken(
  tokenList: ISwapToken[],
  fromToken: ISwapToken,
) {
  return tokenList.filter((item) => {
    if (
      item.contractAddress === fromToken.contractAddress &&
      item.networkId === fromToken.networkId
    ) {
      // same token
      return false;
    }
    if (
      !checkSingleChainProviderIntersection(fromToken, item) ||
      !checkCrossChainProviderIntersection(fromToken, item)
    ) {
      // not support single chain or cross chain
      return false;
    }
    if (!checkProtocolTypesIntersection(fromToken, item)) {
      // not support protocol types
      return false;
    }
    return true;
  });
}
