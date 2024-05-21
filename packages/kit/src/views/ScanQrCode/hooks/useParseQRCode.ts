import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, rootNavigationRef, useClipboard } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EQRCodeHandlerType } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import type {
  IAnimationValue,
  IBaseValue,
  IChainValue,
  IQRCodeHandlerParse,
  IUrlAccountValue,
  IWalletConnectValue,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import {
  EAssetSelectorRoutes,
  EModalRoutes,
  EModalSendRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { urlAccountNavigation } from '../../Home/pages/urlAccount/urlAccountUtils';

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
        case EQRCodeHandlerType.URL_ACCOUNT: {
          const urlAccountData = result.data as IUrlAccountValue;
          urlAccountNavigation.pushUrlAccountPage(navigation, {
            networkId: urlAccountData.networkId,
            address: urlAccountData.address,
          });
          break;
        }

        case EQRCodeHandlerType.BITCOIN:
        case EQRCodeHandlerType.ETHEREUM:
        case EQRCodeHandlerType.SOLANA:
          {
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
          }
          break;
        case EQRCodeHandlerType.WALLET_CONNECT:
          {
            const wcValue = result.data as IWalletConnectValue;
            void backgroundApiProxy.walletConnect.connectToDapp(wcValue.wcUri);
          }
          break;
        case EQRCodeHandlerType.ANIMATION_CODE: {
          const animationValue = result.data as IAnimationValue;
          // if (animationValue.fullData) {
          console.log('🥺', animationValue);
          // }
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
        }
      }
      return result;
    },
    [navigation, clipboard, intl, account],
  );
  return useMemo(() => ({ parse }), [parse]);
};

export default useParseQRCode;
