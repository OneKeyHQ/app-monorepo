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
  IBaseValue,
  IChainValue,
  IMarketDetailValue,
  IQRCodeHandlerParse,
  IUrlAccountValue,
  IWalletConnectValue,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalRoutes,
  EModalSettingRoutes,
  EModalSignatureConfirmRoutes,
  EOnboardingPages,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EConnectDeviceChannel } from '@onekeyhq/shared/types/connectDevice';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';
import type { IToken } from '@onekeyhq/shared/types/token';

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
    async (value, params) => {
      if (!params) {
        return {
          type: EQRCodeHandlerType.UNKNOWN,
          data: {} as IBaseValue,
          raw: value,
        };
      }
      const { defaultHandler, popNavigation, ...options } = params;

      const closeScanPage = async () => {
        if (popNavigation) {
          popNavigation();
          await timerUtils.wait(120);
        }
      };

      const result = await backgroundApiProxy.serviceScanQRCode.parse(
        value,
        options,
      );

      if (!options?.autoHandleResult) {
        return result;
      }

      switch (result.type) {
        case EQRCodeHandlerType.URL_ACCOUNT: {
          const urlAccountData = result.data as IUrlAccountValue;
          await closeScanPage();
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
              await closeScanPage();
              void marketNavigation.pushDetailPageFromDeeplink(navigation, {
                coinGeckoId,
              });
            }
          }
          break;
        case EQRCodeHandlerType.SEND_PROTECTION:
          await closeScanPage();
          navigation.pushModal(EModalRoutes.SettingModal, {
            screen: EModalSettingRoutes.SettingProtectModal,
          });
          break;
        case EQRCodeHandlerType.BITCOIN:
        case EQRCodeHandlerType.ETHEREUM:
        case EQRCodeHandlerType.SOLANA:
        case EQRCodeHandlerType.SUI:
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

              await closeScanPage();
              navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
                screen: EModalSignatureConfirmRoutes.TxDataInput,
                params: {
                  accountId: account.id,
                  networkId: network.id,
                  activeAccountId: params.account?.id,
                  activeNetworkId: params.network?.id,
                  isNFT: false,
                  token: nativeToken,
                },
              });
              break;
            }

            const networkId = network?.id ?? '';
            const getAccountIdOnNetwork = async () => {
              if (account.indexedAccountId) {
                const { accounts } =
                  await backgroundApiProxy.serviceAccount.getAccountsInSameIndexedAccountId(
                    {
                      indexedAccountId: account.indexedAccountId,
                    },
                  );
                const networkAccount = accounts.find(
                  (item) => item.impl === network.impl,
                );
                if (networkAccount) {
                  return networkAccount.id;
                }
              }
            };
            let accountId = account.id;
            if (account.impl !== network.impl) {
              const newAccountId = await getAccountIdOnNetwork();
              if (newAccountId) {
                accountId = newAccountId;
              } else {
                showCopyDialog(value);
                break;
              }
            }

            let token: IToken | null;
            if (chainValue.tokenAddress) {
              token = await backgroundApiProxy.serviceToken.getToken({
                networkId,
                accountId,
                tokenIdOnNetwork: chainValue.tokenAddress,
              });
              if (!token) {
                // showCopyDialog(value);
                // navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
                //   screen: EModalSignatureConfirmRoutes.TxSelectToken,
                //   params: {
                //     title: intl.formatMessage({
                //       id: ETranslations.global_send,
                //     }),
                //     searchPlaceholder: intl.formatMessage({
                //       id: ETranslations.global_search_asset,
                //     }),
                //     networkId: network.id,
                //     accountId: account?.id ?? '',
                //     tokens: {
                //       data: allTokens.tokens,
                //       keys: allTokens.keys,
                //       map,
                //     },
                //     tokenListState,
                //     closeAfterSelect: false,
                //     onSelect: async (token: IToken) => {
                //       const settings =
                //         await backgroundApiProxy.serviceNetwork.getVaultSettings(
                //           {
                //             networkId: token.networkId ?? '',
                //           },
                //         );

                //       if (
                //         settings.mergeDeriveAssetsEnabled &&
                //         network.isAllNetworks &&
                //         !accountUtils.isOthersWallet({
                //           walletId: wallet?.id ?? '',
                //         })
                //       ) {
                //         const walletId = accountUtils.getWalletIdFromAccountId({
                //           accountId: token.accountId ?? '',
                //         });
                //         navigation.push(
                //           EModalSignatureConfirmRoutes.TxSelectDeriveAddress,
                //           {
                //             networkId: token.networkId ?? '',
                //             indexedAccountId: indexedAccount?.id ?? '',
                //             walletId,
                //             accountId: token.accountId ?? '',
                //             actionType: EDeriveAddressActionType.Select,
                //             token,
                //             tokenMap: map,
                //             onUnmounted: () => {},
                //             onSelected: ({
                //               account: a,
                //             }: {
                //               account: INetworkAccount;
                //             }) => {
                //               navigation.push(
                //                 EModalSignatureConfirmRoutes.TxDataInput,
                //                 {
                //                   accountId: a.id,
                //                   networkId: token.networkId ?? network.id,
                //                   isNFT: false,
                //                   token,
                //                   isAllNetworks: network?.isAllNetworks,
                //                 },
                //               );
                //             },
                //           },
                //         );
                //         return;
                //       }

                //       navigation.push(
                //         EModalSignatureConfirmRoutes.TxDataInput,
                //         {
                //           accountId: token.accountId ?? account?.id ?? '',
                //           networkId: token.networkId ?? network.id,
                //           isNFT: false,
                //           token,
                //           isAllNetworks: network?.isAllNetworks,
                //         },
                //       );
                //     },
                //   },
                // });
                break;
              }
            } else {
              token = await backgroundApiProxy.serviceToken.getNativeToken({
                networkId: network.id,
                accountId: account.id,
              });
            }
            await closeScanPage();
            navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
              screen: EModalSignatureConfirmRoutes.TxDataInput,
              params: {
                accountId,
                networkId,
                activeAccountId: params.account?.id,
                activeNetworkId: params.network?.id,
                isNFT: false,
                token,
                address: chainValue.address,
                amount: chainValue?.amount,
              },
            });
          }
          break;
        case EQRCodeHandlerType.WALLET_CONNECT:
          {
            await closeScanPage();
            const wcValue = result.data as IWalletConnectValue;
            void backgroundApiProxy.walletConnect.connectToDapp(wcValue.wcUri);
          }
          break;
        case EQRCodeHandlerType.ANIMATION_CODE:
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
                      onPressIn={async () => {
                        await closeScanPage();
                        await toast.close();
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
          if (defaultHandler) {
            defaultHandler(value);
          } else {
            await closeScanPage();
            showCopyDialog(value);
          }
        }
      }
      return result;
    },
    [navigation, showCopyDialog, intl],
  );
  return useMemo(() => ({ parse }), [parse]);
};

export default useParseQRCode;
