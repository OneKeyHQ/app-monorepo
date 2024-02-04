import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, useClipboard } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
// import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
// import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
// import { EModalSendRoutes } from '@onekeyhq/kit/src/views/Send/router';

import { parseQRCode } from '../utils/parseQRCode';
import { EQRCodeHandlerType } from '../utils/parseQRCode/type';

import type {
  IAnimationValue,
  IBaseValue,
  IQRCodeHandlerParse,
} from '../utils/parseQRCode/type';

const useParseQRCode = () => {
  const navigation = useAppNavigation();
  const clipboard = useClipboard();
  const intl = useIntl();
  // const {
  //   activeAccount: { account, network },
  // } = useActiveAccount({ num: 0 });
  const parse: IQRCodeHandlerParse<IBaseValue> = useCallback(
    (value, options) => {
      const result = parseQRCode(value, options);
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
