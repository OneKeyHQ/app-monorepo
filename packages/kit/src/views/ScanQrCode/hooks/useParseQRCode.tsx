import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Stack,
  Toast,
  ToastContent,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type {
  IAnimationValue,
  IBaseValue,
  IChainValue,
  IEthereumValue,
  IMarketDetailValue,
  IQRCodeHandlerParse,
  IUrlAccountValue,
  IWalletConnectValue,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRewardCenterRoutes,
  EModalRoutes,
  EModalSettingRoutes,
  EModalSignatureConfirmRoutes,
  EOnboardingPages,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EConnectDeviceChannel } from '@onekeyhq/shared/types/connectDevice';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';
import type { IToken } from '@onekeyhq/shared/types/token';

import { urlAccountNavigation } from '../../Home/pages/urlAccount/urlAccountUtils';
import { marketNavigation } from '../../Market/marketUtils';

export const parseOnChainAmount = async (
  value: {
    type: EQRCodeHandlerType;
    data: IBaseValue;
  },
  token: IToken | null,
): Promise<string> => {
  const data = value.data as IChainValue;
  if (
    data.network &&
    data.network.id &&
    value.type === EQRCodeHandlerType.ETHEREUM
  ) {
    const chainValue = value.data as IEthereumValue;
    if (chainValue.value && token) {
      return chainValueUtils.convertTokenChainValueToAmount({
        value: chainValue.value,
        token,
      });
    }

    if (chainValue.amount) {
      return String(chainValue.amount);
    }

    if (token && chainValue.uint256) {
      return chainValueUtils.convertTokenChainValueToAmount({
        value: chainValue.uint256,
        token,
      });
    }
  }
  return data.amount ? String(data.amount) : '';
};

export const getAccountIdOnNetwork = async ({
  account,
  network,
}: {
  account?: INetworkAccount;
  network: IChainValue['network'];
}) => {
  if (account?.indexedAccountId) {
    const { accounts } =
      await backgroundApiProxy.serviceAccount.getAccountsInSameIndexedAccountId(
        {
          indexedAccountId: account?.indexedAccountId ?? '',
        },
      );
    const networkAccount = accounts.find((item) => item.impl === network?.impl);
    if (networkAccount) {
      return networkAccount.id;
    }
    // need create account on network
    if (account?.id) {
      const newAccount =
        await backgroundApiProxy.serviceAccount.createAddressIfNotExists(
          {
            walletId: accountUtils.getWalletIdFromAccountId({
              accountId: account?.id || '',
            }),
            networkId: network?.id || '',
            accountId: account?.id,
            indexedAccountId: account.indexedAccountId,
          },
          {
            allowWatchAccount: false,
          },
        );
      return newAccount?.id;
    }
  }
};

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
          await timerUtils.wait(platformEnv.isNative ? 1200 : 250);
        }
      };

      const result = await backgroundApiProxy.serviceScanQRCode.parse(
        value,
        options,
      );

      if (!options?.autoHandleResult) {
        if (
          result.type !== EQRCodeHandlerType.ANIMATION_CODE ||
          (result.type === EQRCodeHandlerType.ANIMATION_CODE &&
            (result.data as IAnimationValue).progress === 1)
        ) {
          await closeScanPage();
        }
        return result;
      }
      switch (result.type) {
        case EQRCodeHandlerType.REWARD_CENTER: {
          await closeScanPage();
          navigation.pushModal(EModalRoutes.MainModal, {
            screen: EModalRewardCenterRoutes.RewardCenter,
            params: {
              accountId: options?.account?.id ?? '',
              networkId: options?.network?.id ?? '',
              walletId: options?.wallet?.id ?? '',
            },
          });
          break;
        }
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
        case EQRCodeHandlerType.LIGHTNING_NETWORK:
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
            const networkId = network?.id ?? '';

            let accountId = account.id;
            if (account.impl !== network.impl) {
              const newAccountId = await getAccountIdOnNetwork({
                account,
                network,
              });
              if (newAccountId) {
                accountId = newAccountId;
              } else {
                await closeScanPage();
                showCopyDialog(value);
                break;
              }
            }

            const { isSingleToken } =
              await backgroundApiProxy.serviceNetwork.getVaultSettings({
                networkId: network?.id ?? '',
              });
            if (isSingleToken) {
              const nativeToken =
                await backgroundApiProxy.serviceToken.getNativeToken({
                  networkId: network.id,
                  accountId,
                });

              await closeScanPage();
              const newNetworkId =
                nativeToken?.networkId ||
                network.id ||
                params.network?.id ||
                '';
              navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
                screen: EModalSignatureConfirmRoutes.TxDataInput,
                params: {
                  accountId,
                  networkId: newNetworkId,
                  activeAccountId: accountId,
                  activeNetworkId: newNetworkId,
                  isNFT: false,
                  token: nativeToken,
                  address: chainValue.address,
                  amount: await parseOnChainAmount(result, nativeToken),
                },
              });
              break;
            }

            let selectedToken: IToken | null = null;
            if (chainValue.tokenAddress) {
              selectedToken = await backgroundApiProxy.serviceToken.getToken({
                networkId,
                accountId,
                tokenIdOnNetwork: chainValue.tokenAddress,
              });
            }

            if (!selectedToken) {
              selectedToken =
                await backgroundApiProxy.serviceToken.getNativeToken({
                  networkId,
                  accountId,
                });
            }

            await closeScanPage();
            navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
              screen: EModalSignatureConfirmRoutes.TxDataInput,
              params: {
                accountId,
                networkId,
                activeAccountId: params.account?.id,
                activeNetworkId: selectedToken?.networkId || params.network?.id,
                isNFT: false,
                token: selectedToken,
                address: chainValue.address,
                amount: await parseOnChainAmount(result, selectedToken),
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
    [navigation, intl, showCopyDialog],
  );
  return useMemo(() => ({ parse }), [parse]);
};

export default useParseQRCode;
