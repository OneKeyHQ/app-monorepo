import type { IGetTokensListParams } from '@onekeyhq/shared/types/fiatCrypto';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

export const useSupportNetworkId = (params: IGetTokensListParams) =>
  usePromiseResult(
    async () => backgroundApiProxy.serviceFiatCrypto.isNetworkSupported(params),
    [params],
    {
      initResult: false,
    },
  );

export const useSupportToken = (
  params: IGetTokensListParams & { tokenAddress: string },
) =>
  usePromiseResult(
    async () => backgroundApiProxy.serviceFiatCrypto.isTokenSupported(params),
    [params],
    { initResult: false },
  );

export const useGetTokensList = (params: IGetTokensListParams) =>
  usePromiseResult(
    async () => backgroundApiProxy.serviceFiatCrypto.getTokensList(params),
    [params],
    { initResult: [] },
  );
