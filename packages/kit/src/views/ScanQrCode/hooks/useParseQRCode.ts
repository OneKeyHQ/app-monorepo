import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, rootNavigationRef, useClipboard } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EAssetSelectorRoutes } from '@onekeyhq/kit/src/views/AssetSelector/router/types';
import { EModalSendRoutes } from '@onekeyhq/kit/src/views/Send/router';
import { EQRCodeHandlerType } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import type {
  IAnimationValue,
  IBaseValue,
  IChainValue,
  IQRCodeHandlerParse,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

const useParseQRCode = () => {
  const navigation = useAppNavigation();
  const clipboard = useClipboard();
  const intl = useIntl();
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });
  const parse: IQRCodeHandlerParse<IBaseValue> = useCallback(
    async (value, options) => {
      const result = await backgroundApiProxy.serviceScanQRCode.parse(
        value,
        options,
      );
      if (
        result.type !== EQRCodeHandlerType.ANIMATION_CODE ||
        (result.data as IAnimationValue).fullData
      ) {
        rootNavigationRef?.current?.goBack();
      }

      if (!options?.autoHandleResult) {
        return result;
      }
      switch (result.type) {
        case EQRCodeHandlerType.BITCOIN:
        case EQRCodeHandlerType.ETHEREUM: {
          if (!account) {
            break;
          }
          const chainValue = result.data as IChainValue;
          const network = chainValue?.network;
          if (!network) {
            break;
          }
          navigation.pushModal(EModalRoutes.AssetSelectorModal, {
            screen: EAssetSelectorRoutes.TokenSelector,
            params: {
              networkId: network.id,
              accountId: account.id,
              networkName: network.name,
              // tokens,
              onSelect: async (token) => {
                await timerUtils.wait(600);
                navigation.pushModal(EModalRoutes.SendModal, {
                  screen: EModalSendRoutes.SendDataInput,
                  params: {
                    accountId: account.id,
                    networkId: network.id,
                    isNFT: false,
                    token,
                    address: chainValue?.address,
                    amount: chainValue?.amount,
                  },
                });
              },
            },
          });
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
    [navigation, clipboard, intl, account],
  );
  return { parse };
};

export default useParseQRCode;
