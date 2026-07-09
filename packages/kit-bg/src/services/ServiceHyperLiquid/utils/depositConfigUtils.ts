import type { IServerNetwork } from '@onekeyhq/shared/types';

import type {
  IPerpsDepositNetwork,
  IPerpsDepositToken,
} from '../../../states/jotai/atoms';
import type { IPerpServerDepositTokensByNetworkConfig } from '../../ServiceWebviewPerp/ServiceWebviewPerp';

function buildDepositNetwork(network: IServerNetwork): IPerpsDepositNetwork {
  return {
    networkId: network.id,
    name: network.name,
    code: network.code,
    shortcode: network.shortcode,
    shortname: network.shortname,
    logoURI: network.logoURI,
    symbol: network.symbol,
    decimals: network.decimals,
  };
}

export async function buildDepositConfigFromTokensByNetwork({
  tokensByNetwork,
  getNetworkSafe,
}: {
  tokensByNetwork: IPerpServerDepositTokensByNetworkConfig;
  getNetworkSafe: (params: {
    networkId: string;
  }) => Promise<IServerNetwork | undefined>;
}) {
  const networks: IPerpsDepositNetwork[] = [];
  const tokensMap: Record<string, IPerpsDepositToken[]> = {};
  const defaultTokens: IPerpsDepositToken[] = [];

  for (const [networkId, tokens] of Object.entries(tokensByNetwork)) {
    const network = await getNetworkSafe({ networkId });
    if (network) {
      networks.push(buildDepositNetwork(network));
      tokensMap[networkId] = tokens.map((token) => {
        const depositToken: IPerpsDepositToken = {
          networkId,
          contractAddress: token.contractAddress,
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals,
          networkLogoURI: network.logoURI,
          logoURI: token.logoURI,
          isNative: token.isNative,
          isDefault: token.isDefault,
        };
        if (depositToken.isDefault) {
          defaultTokens.push(depositToken);
        }
        return depositToken;
      });
    }
  }

  return {
    networks,
    tokensMap,
    defaultTokens,
  };
}
