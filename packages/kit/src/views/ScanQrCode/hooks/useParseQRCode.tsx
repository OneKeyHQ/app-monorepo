import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Stack,
  Toast,
  ToastContent,
  rootNavigationRef,
  useClipboard,
} from '@onekeyhq/components';
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EAssetSelectorRoutes,
  EModalRoutes,
  EModalSendRoutes,
  EOnboardingPages,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EConnectDeviceChannel } from '@onekeyhq/shared/types/connectDevice';

import { urlAccountNavigation } from '../../Home/pages/urlAccount/urlAccountUtils';
import { marketNavigation } from '../../Market/marketUtils';

const useParseQRCode = () => {
  const navigation = useAppNavigation();
  const clipboard = useClipboard();
  const intl = useIntl();
  const showCopyDialog = useCallback(
    (content: string) => {
      Dialog.confirm({
        title: intl.formatMessage({ id: ETranslations.global_info }),
        description: content,
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_copy,
        }),
        confirmButtonProps: {
          icon: 'Copy3Outline',
        },
        onConfirm: ({ preventClose }) => {
          preventClose();
          clipboard?.copyText(content);
        },
      });
    },
    [clipboard, intl],
  );
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
          void urlAccountNavigation.pushUrlAccountPage(navigation, {
            networkId: urlAccountData.networkId,
            address: urlAccountData.address,
          });
          break;
        }
        case EQRCodeHandlerType.MARKET_DETAIL:
          {
            const { coinGeckoId } = result.data as IMarketDetailValue;
            if (coinGeckoId) {
              void marketNavigation.pushDetailPageFromDeeplink(navigation, {
                coinGeckoId,
              });
            }
          }
          break;
        case EQRCodeHandlerType.BITCOIN:
        case EQRCodeHandlerType.ETHEREUM:
        case EQRCodeHandlerType.SOLANA:
          {
            const account = options?.account;
            if (!account) {
              console.error('missing the account in the useParseQRCode.start');
              break;
            }
            const chainValue = result.data as IChainValue;
            const network = chainValue?.network;
            if (!network) {
              break;
            }
            const { isSingleToken } =
              await backgroundApiProxy.serviceNetwork.getVaultSettings({
                networkId: network?.id ?? '',
              });
            if (isSingleToken) {
              const nativeToken =
                await backgroundApiProxy.serviceToken.getNativeToken({
                  networkId: network.id,
                  accountId: account.id,
                });
              navigation.pushModal(EModalRoutes.SendModal, {
                screen: EModalSendRoutes.SendDataInput,
                params: {
                  accountId: account.id,
                  networkId: network.id,
                  isNFT: false,
                  token: nativeToken,
                },
              });
              break;
            }
            if (account.impl !== network.impl) {
              showCopyDialog(value);
              break;
            }
            navigation.pushModal(EModalRoutes.AssetSelectorModal, {
              screen: EAssetSelectorRoutes.TokenSelector,
              params: {
                networkId: network.id,
                accountId: account.id,

                tokens: options?.tokens,
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
        case EQRCodeHandlerType.ANIMATION_CODE:
          rootNavigationRef?.current?.goBack();
          // eslint-disable-next-line no-case-declarations
          const toast = Toast.show({
            children: (
              <Stack p="$4">
                <ToastContent
                  title=""
                  message={intl.formatMessage({
                    id: ETranslations.scan_qr_wallet_detected,
                  })}
                  actionsAlign="left"
                  actions={[
                    <Button
                      key="1"
                      variant="primary"
                      size="small"
                      onPressIn={() => {
                        void toast.close();
                        navigation.pushModal(EModalRoutes.OnboardingModal, {
                          screen: EOnboardingPages.ConnectYourDevice,
                          params: {
                            channel: EConnectDeviceChannel.qr,
                          },
                        });
                      }}
                    >
                      {intl.formatMessage({
                        id: ETranslations.global_connect,
                      })}
                    </Button>,
                    <Button
                      key="2"
                      size="small"
                      onPressIn={() => {
                        void toast.close();
                      }}
                    >
                      {intl.formatMessage({
                        id: ETranslations.global_ignore,
                      })}
                    </Button>,
                  ]}
                />
              </Stack>
            ),
          });
          break;
        default: {
          showCopyDialog(value);
        }
      }
      return result;
    },
    [navigation, showCopyDialog, intl],
  );
  return useMemo(() => ({ parse }), [parse]);
};

export default useParseQRCode;
