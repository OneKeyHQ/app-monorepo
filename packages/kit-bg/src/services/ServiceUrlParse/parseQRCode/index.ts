import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import * as handlers from './handlers';
import * as deeplinkHandler from './handlers/deeplink';
import * as urlHandler from './handlers/url';
import { EQRCodeHandlerType } from './type';

import type {
  IBaseValue,
  IQRCodeHandler,
  IQRCodeHandlerParse,
  IQRCodeHandlerParseResult,
} from './type';

const handlerList = handlers as Record<string, IQRCodeHandler<IBaseValue>>;

const getNetworkFromImplListAndChainId = memoizee(
  async (implList: string[], chainId: string) => {
    const { networks } =
      await backgroundApiProxy.serviceNetwork.getNetworksByImpls({
        impls: implList,
      });
    return networks.find((n) => n.chainId === chainId);
  },
);

export const parseQRCode: IQRCodeHandlerParse<IBaseValue> = async (
  value,
  options,
) => {
  let result: IQRCodeHandlerParseResult<IBaseValue> | undefined;
  const urlResult = await urlHandler.url(value);
  const deeplinkResult = await deeplinkHandler.deeplink(value, { urlResult });
  for (const handler of Object.values(handlerList)) {
    try {
      const itemResult = await handler(value, {
        ...options,
        urlResult,
        deeplinkResult,
        getNetwork: getNetworkFromImplListAndChainId,
      });
      if (itemResult) {
        result = {
          ...itemResult,
          raw: value,
        };
        break;
      }
    } catch (e) {
      console.log('parse next');
    }
  }
  if (!result) {
    const itemResult = deeplinkResult ??
      urlResult ?? { type: EQRCodeHandlerType.UNKNOWN, data: value };
    result = { ...itemResult, raw: value };
  }
  return result;
};
