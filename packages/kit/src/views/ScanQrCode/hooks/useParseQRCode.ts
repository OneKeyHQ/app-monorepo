import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, useClipboard } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
// import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
// import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
// import { EModalSendRoutes } from '@onekeyhq/kit/src/views/Send/router';

import * as handlers from '../utils/parseQRCodeHandler';
import * as deeplinkHandler from '../utils/parseQRCodeHandler/deeplink';
import { EQRCodeHandlerType } from '../utils/parseQRCodeHandler/type';
import * as urlHandler from '../utils/parseQRCodeHandler/url';

import type {
  IAnimationValue,
  IBaseValue,
  IQRCodeHandler,
  IQRCodeHandlerParse,
  IQRCodeHandlerParseResult,
} from '../utils/parseQRCodeHandler/type';

const handlerList = handlers as Record<string, IQRCodeHandler<IBaseValue>>;

const useParseQRCode = () => {
  const navigation = useAppNavigation();
  const clipboard = useClipboard();
  const intl = useIntl();
  // const {
  //   activeAccount: { account, network },
  // } = useActiveAccount({ num: 0 });
  const parse: IQRCodeHandlerParse<IBaseValue> = useCallback(
    (value, options) => {
      let result: IQRCodeHandlerParseResult<IBaseValue> | undefined;
      const urlResult = urlHandler.url(value);
      const deeplinkResult = deeplinkHandler.deeplink(value, { urlResult });
      for (const handler of Object.values(handlerList)) {
        try {
          const itemResult = handler(value, {
            ...options,
            urlResult,
            deeplinkResult,
          });
          if (itemResult) {
            result = {
              type: itemResult.type,
              data: itemResult.data,
              raw: value,
            };
            break;
          }
        } catch (e) {
          console.log(e);
        }
      }
      if (!result) {
        const itemResult = deeplinkResult ??
          urlResult ?? { type: EQRCodeHandlerType.UNKNOWN, data: value };
        result = { ...itemResult, raw: value };
      }

      if (
        result.type !== EQRCodeHandlerType.ANIMATION_CODE ||
        (result.data as IAnimationValue).fullData
      ) {
        navigation?.navigation?.getParent()?.getParent()?.goBack?.();
      }

      if (!options?.autoHandleResult) {
        return result;
      }
      switch (result.type) {
        case (EQRCodeHandlerType.BITCOIN, EQRCodeHandlerType.ETHEREUM): {
          // if (!account || !network) {
          //   break;
          // }
          // navigation.pushModal(EModalRoutes.SendModal, {
          //   screen: EModalSendRoutes.SendDataInput,
          //   params: {
          //     networkId: network.id,
          //     accountId: account.id,
          //     isNFT: false,
          //     to: (result.data as IChainValue).address,
          //   },
          // });
          break;
        }
        default: {
          Dialog.confirm({
            title: intl.formatMessage({ id: 'content__info' }),
            description: value,
            onConfirmText: intl.formatMessage({
              id: 'action__copy',
            }),
            confirmButtonProps: {
              icon: 'Copy3Outline',
            },
            onConfirm: ({ preventClose }) => {
              preventClose();
              clipboard?.copyText(value);
            },
          });
          break;
        }
      }
      return result;
    },
    [navigation, clipboard, intl],
  );
  return { parse };
};

export default useParseQRCode;
