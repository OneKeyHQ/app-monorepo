import type {
  IFiatCryptoType,
  IGetTokensListParams,
} from '@onekeyhq/shared/types/fiatCrypto';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

export const useSupportNetworkId = (
  type: IFiatCryptoType,
  networkId: string | undefined,
) =>
  usePromiseResult(
    async () => {
      if (!networkId) return false;
      return backgroundApiProxy.serviceFiatCrypto.isNetworkSupported({
        networkId,
        type,
      });
    },
    [networkId, type],
    {
      initResult: false,
      debounced: 100,
    },
  );

export const useSupportToken = (
  networkId: string,
  tokenAddress: string,
  type: IFiatCryptoType,
) =>
  usePromiseResult(
    async () =>
      backgroundApiProxy.serviceFiatCrypto.isTokenSupported({
        networkId,
        tokenAddress,
        type,
      }),
    [networkId, tokenAddress, type],
    { initResult: false, debounced: 100 },
  );

export const useGetTokensList = (params: IGetTokensListParams) =>
  usePromiseResult(
    async () => {
      const data = await backgroundApiProxy.serviceFiatCrypto.getTokensList(
        params,
      );
      return data;
    },
    [params],
    { initResult: [] },
  );
