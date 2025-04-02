import qs from 'querystring';

import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import { blockChains } from './assets';

import type { IQRCodeHandler, ITokenUriValue } from '../../type';

const tokenURI: IQRCodeHandler<ITokenUriValue> = async (value) => {
  // Example:
  // sui:0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC/transfer?address=0x325564989ad708fe26aa263286b0e8fb0ab922c6c518210e8b1e060fa2ed6bd8
  if (value.includes('/transfer?address=')) {
    const [path, query] = value.split('?');
    const [pathNetwork, action] = path.split('/');
    const pathSegments = pathNetwork.split(':');
    const networkString = pathSegments[0];
    const tokenIdOnNetwork = pathSegments.slice(1).join(':');
    const blockChain = blockChains[networkString as keyof typeof blockChains];
    if (blockChain) {
      const params = qs.parse(query || '') as {
        address: string;
      };
      const address = params.address || '';
      return {
        type: EQRCodeHandlerType.TOKEN_URI,
        data: {
          networkId: blockChain.networkId,
          tokenIdOnNetwork,
          address,
          action,
        },
      };
    }
  }
  return null;
};

export default tokenURI;
