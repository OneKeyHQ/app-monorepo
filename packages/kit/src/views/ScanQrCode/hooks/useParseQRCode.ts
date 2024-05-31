import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, rootNavigationRef, useClipboard } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type {
  IAnimationValue,
  IBaseValue,
  IChainValue,
  IMarketDetailValue,
  IQRCodeHandlerParse,
  IUrlAccountValue,
  IWalletConnectValue,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { EQRCodeHandlerType } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import {
  EAssetSelectorRoutes,
  EModalRoutes,
  EModalSendRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { urlAccountNavigation } from '../../Home/pages/urlAccount/urlAccountUtils';
import { marketNavigation } from '../../Market/marketUtils';

const useParseQRCode = () => {
  const navigation = useAppNavigation();
  const clipboard = useClipboard();
  const intl = useIntl();
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
        case EQRCodeHandlerType.MARKET_DETAIL:
          {
            const marketDetailData = result.data as IMarketDetailValue;
            void marketNavigation.pushDetailPageFromDeeplink(navigation, {
              coinGeckoId: marketDetailData.coinGeckoId,
            });
          }
          break;
        case EQRCodeHandlerType.BITCOIN:
        case EQRCodeHandlerType.ETHEREUM:
        case EQRCodeHandlerType.SOLANA:
          {
            const accountId = options?.accountId;
            if (!accountId) {
              console.error(
                'missing the accountId in the useParseQRCode.start',
              );
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
                accountId,

                networkName: network.name,
                // tokens,
                onSelect: async (token) => {
                  await timerUtils.wait(600);
                  navigation.pushModal(EModalRoutes.SendModal, {
                    screen: EModalSendRoutes.SendDataInput,
                    params: {
                      accountId,
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
          if (animationValue.fullData) {
            console.log('🥺', animationValue);
          }
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
    [navigation, clipboard, intl],
  );
  return useMemo(() => ({ parse }), [parse]);
};

export default useParseQRCode;
