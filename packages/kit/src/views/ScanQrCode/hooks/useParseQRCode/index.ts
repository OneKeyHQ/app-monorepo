import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, useClipboard } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
// import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
// import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
// import { EModalSendRoutes } from '@onekeyhq/kit/src/views/Send/router';

import * as handlers from './handlers';
import { EQRCodeHandlerType } from './handlers/type';

import type {
  IAnimationValue,
  IBaseValue,
  IQRCodeHandler,
  IQRCodeHandlerParse,
  IQRCodeHandlerParseResult,
} from './handlers/type';

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
      Object.keys(handlerList).forEach((key) => {
        const handler = handlerList[key];
        if (!result) {
          const itemResult = handler(value, options);
          if (itemResult) {
            result = {
              type: itemResult.type,
              data: itemResult.data,
              raw: value,
            };
          }
        }
      });
      if (!result) {
        result = { type: EQRCodeHandlerType.UNKNOWN, raw: value, data: value };
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
          Dialog.show({
            title: intl.formatMessage({ id: 'content__info' }),
            description: value,
            onConfirmText: intl.formatMessage({
              id: 'action__copy',
            }),
            confirmButtonProps: {
              icon: 'Copy3Outline',
            },
            showCancelButton: false,
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
