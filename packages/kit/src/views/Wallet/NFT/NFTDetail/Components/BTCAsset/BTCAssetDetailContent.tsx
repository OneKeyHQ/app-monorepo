/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  Button,
  CustomSkeleton,
  HStack,
  IconButton,
  Text,
  ToastManager,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { TaprootAddressError } from '@onekeyhq/engine/src/errors';
import { getWalletIdFromAccountId } from '@onekeyhq/engine/src/managers/account';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/engine/src/types/wallet';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import { parseBRC20Content } from '@onekeyhq/shared/src/utils/tokenUtils';

import backgroundApiProxy from '../../../../../../background/instance/backgroundApiProxy';
import { useAccount, useNetwork, useWallet } from '../../../../../../hooks';
import useFormatDate from '../../../../../../hooks/useFormatDate';
import {
  ModalRoutes,
  RootRoutes,
  SendModalRoutes,
} from '../../../../../../routes/routesEnum';
import { openUrl } from '../../../../../../utils/openUrl';
import { showDialog } from '../../../../../../utils/overlayUtils';
import { RecycleDialog } from '../../../../../InscriptionControl/RecycleDialog';
import BaseMenu from '../../../../../Overlay/BaseMenu';
import { DetailItem } from '../DetailItem';

import {
  UnListBTCAssetExplicitDialog,
  UnListBTCAssetUnexpectedDialog,
} from './UnListBTCAssetDialog';

import type { CollectiblesRoutesParams } from '../../../../../../routes/Root/Modal/Collectibles';
import type { ModalScreenProps } from '../../../../../../routes/types';

type NavigationProps = ModalScreenProps<CollectiblesRoutesParams>;

function BTCAssetDetailContent({
  asset: outerAsset,
  isOwner,
  networkId,
  accountId,
  onRecycleUtxo,
}: {
  asset: NFTBTCAssetModel;
  isOwner: boolean;
  networkId: string;
  accountId?: string;
  onRecycleUtxo?: () => void;
}) {
  const intl = useIntl();
  const [isBRC20, setIsBRC20] = useState(false);
  const isVertical = useIsVerticalLayout();
  const { format } = useFormatDate();
  const { serviceNFT, serviceInscribe } = backgroundApiProxy;

  const { network } = useNetwork({
    networkId: outerAsset?.networkId ?? '',
  });

  const walletId = useMemo(() => {
    if (accountId) {
      return getWalletIdFromAccountId(accountId);
    }
    return null;
  }, [accountId]);

  const { account } = useAccount({ accountId: accountId ?? '', networkId });

  const { wallet } = useWallet({ walletId });

  const navigation = useNavigation<NavigationProps['navigation']>();
  const modalClose = useModalClose();

  const [asset, updateAsset] = useState(outerAsset);
  const isDisabled =
    wallet?.type === WALLET_TYPE_WATCHING ||
    asset.owner !== outerAsset.accountAddress ||
    !accountId ||
    !isOwner;

  const sendAction = useCallback(() => {
    if (!networkId || !accountId) {
      return;
    }
    const validateAddress = async (address: string) => {
      try {
        await serviceInscribe.checkValidTaprootAddress({
          address,
          networkId,
          accountId,
        });
      } catch (error) {
        throw new TaprootAddressError();
      }
    };
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Send,
      params: {
        screen: SendModalRoutes.PreSendAddress,
        params: {
          accountId,
          networkId,
          isNFT: true,
          from: '',
          to: '',
          amount: '0',
          nftTokenId: asset.inscription_id,
          validateAddress: async (_, address) => {
            await validateAddress(address);
          },
          nftInscription: {
            address: asset.owner,
            inscriptionId: asset.inscription_id,
            output: asset.output,
            location: asset.location,
          },
          closeModal: modalClose,
        },
      },
    });
  }, [
    accountId,
    asset.inscription_id,
    asset.location,
    asset.output,
    asset.owner,
    modalClose,
    navigation,
    networkId,
    serviceInscribe,
  ]);

  const handleSendOnPress = useCallback(() => {
    if (!networkId || !accountId) {
      return;
    }
    if (asset.listed) {
      showDialog(
        <UnListBTCAssetUnexpectedDialog onConfirm={() => sendAction()} />,
      );
    } else {
      sendAction();
    }
  }, [accountId, asset.listed, networkId, sendAction]);

  useEffect(() => {
    (async () => {
      if (network?.id) {
        const data = (await serviceNFT.fetchAsset({
          chain: network.id,
          tokenId: outerAsset.inscription_id,
        })) as NFTBTCAssetModel;
        if (data) {
          updateAsset({
            ...data,
            listed: outerAsset.listed,
          });
          const { isBRC20Content } = await parseBRC20Content({
            content: data.content,
            contentType: data.content_type,
            contentUrl: data.contentUrl,
          });
          setIsBRC20(isBRC20Content);
        }
      }
    })();
  }, [
    network?.id,
    outerAsset,
    outerAsset.inscription_id,
    outerAsset.listed,
    serviceNFT,
  ]);

  const handleUnListNFT = useCallback(
    async (onClose?: () => void) => {
      if (!networkId || !account) return;

      const transferInfo = {
        from: account.address,
        to: account.address,
        amount: '0',
        isNFT: true,
        nftTokenId: asset.inscription_id,
        nftInscription: {
          address: asset.owner,
          inscriptionId: asset.inscription_id,
          output: asset.output,
          location: asset.location,
        },
      };

      const encodedTx =
        await backgroundApiProxy.engine.buildEncodedTxFromTransfer({
          networkId,
          accountId: account.id,
          transferInfo,
        });
      onClose?.();
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendModalRoutes.SendConfirm,
          params: {
            ...transferInfo,
            networkId,
            accountId: account.id,
            encodedTx,
            feeInfoUseFeeInTx: false,
            feeInfoEditable: true,
            payloadInfo: {
              type: 'Transfer',
              nftInfo: {
                asset,
                amount: transferInfo.amount,
                from: account.address,
                to: account.address,
              },
            },
            onModalClose: modalClose,
          },
        },
      });
    },
    [account, asset, modalClose, navigation, networkId],
  );

  const detailMoreMenu = useMemo(
    () => (
      <BaseMenu
        options={[
          {
            id: 'action__deoccupy',
            onPress: () =>
              showDialog(
                <RecycleDialog
                  amount={`${new BigNumber(asset.output_value_sat)
                    .shiftedBy(-(network?.decimals ?? 0))
                    .toFixed()} ${network?.symbol ?? ''}`}
                  onConfirm={async () => {
                    const [txid, vout] = asset.output.split(':');
                    const voutNum = parseInt(vout, 10);

                    await backgroundApiProxy.serviceUtxos.updateRecycle({
                      networkId: networkId ?? '',
                      accountId: accountId ?? '',
                      utxo: {
                        txid,
                        vout: voutNum,
                        address: asset.owner,
                        value: String(asset.output_value_sat),
                        path: '',
                        height: NaN,
                      },
                      recycle: true,
                    });

                    ToastManager.show(
                      {
                        title: intl.formatMessage({
                          id: 'msg__inscription_deoccupied',
                        }),
                      },
                      {
                        type: 'default',
                      },
                    );
                    appUIEventBus.emit(
                      AppUIEventBusNames.InscriptionRecycleChanged,
                    );
                    onRecycleUtxo?.();
                    navigation.goBack();
                  }}
                />,
              ),
            icon: 'RestoreMini',
            variant: 'desctructive',
          },
          asset?.listed && {
            id: 'action__unlist_on_sale_inscription',
            icon: 'MinusCircleMini',
            onPress: () => {
              showDialog(
                <UnListBTCAssetExplicitDialog onConfirm={handleUnListNFT} />,
              );
            },
          },
        ]}
      >
        <IconButton
          iconColor="icon-subdued"
          mr={isVertical ? 0 : 10}
          type="basic"
          size={isVertical ? 'sm' : 'xs'}
          circle
          name="EllipsisVerticalMini"
        />
      </BaseMenu>
    ),
    [
      accountId,
      asset?.listed,
      asset.output,
      asset.output_value_sat,
      asset.owner,
      handleUnListNFT,
      intl,
      isVertical,
      navigation,
      network?.decimals,
      network?.symbol,
      networkId,
      onRecycleUtxo,
    ],
  );

  return (
    <VStack space="24px" mb="50px">
      <VStack>
        <HStack alignItems="center" justifyContent="space-between">
          <Text
            typography={{ sm: 'DisplayLarge', md: 'DisplayLarge' }}
            fontWeight="700"
            alignItems="center"
          >
            Inscription #{' '}
            {asset?.inscription_number > 0 ? (
              <Text>{asset?.inscription_number}</Text>
            ) : (
              <CustomSkeleton borderRadius="10px" width={120} height="20px" />
            )}
          </Text>
          {isDisabled ? null : detailMoreMenu}
        </HStack>
        <HStack space={1}>
          {isBRC20 ? <Badge type="default" size="sm" title="brc20" /> : null}
          {asset.listed ? (
            <Badge
              type="warning"
              size="sm"
              title={intl.formatMessage({ id: 'content__listed__uppercase' })}
            />
          ) : null}
        </HStack>
      </VStack>

      {isOwner && (
        <HStack space="16px">
          <Button
            type="primary"
            isDisabled={isDisabled}
            width="full"
            size="lg"
            leftIconName="ArrowUpMini"
            onPress={handleSendOnPress}
          >
            {intl.formatMessage({
              id: 'action__send',
            })}
          </Button>
          {/* More button in future */}
        </HStack>
      )}

      {/* Details */}
      <Box>
        <Typography.Heading mb="16px">
          {intl.formatMessage({ id: 'content__details' })}
        </Typography.Heading>
        <VStack space="16px">
          {!!asset.content_type && (
            <DetailItem
              title="ID"
              value={shortenAddress(asset.inscription_id, 6)}
              icon="Square2StackMini"
              onPress={() => {
                copyToClipboard(asset.inscription_id ?? '');
                ToastManager.show({
                  title: intl.formatMessage({ id: 'msg__copied' }),
                });
              }}
            />
          )}
          {!!asset.owner && (
            <DetailItem
              title={intl.formatMessage({ id: 'form__ordinal_owner' })}
              icon="Square2StackMini"
              value={shortenAddress(asset.owner, 6)}
              onPress={() => {
                copyToClipboard(asset.owner ?? '');
                ToastManager.show({
                  title: intl.formatMessage({ id: 'msg__copied' }),
                });
              }}
            />
          )}
          {!!asset.content_type && (
            <DetailItem
              title={intl.formatMessage({ id: 'form__ordinal_type' })}
              value={asset.content_type}
            />
          )}
          {!!asset.output_value_sat && (
            <DetailItem
              title={intl.formatMessage({ id: 'form__ordinal_value' })}
              value={`${asset.output_value_sat} sats`}
            />
          )}
          {!!asset.content_length && (
            <DetailItem
              title={intl.formatMessage({ id: 'form__ordinal_size' })}
              value={`${asset.content_length} bytes`}
            />
          )}
          {!!asset.timestamp && (
            <DetailItem
              onPress={() => {
                const isMainNet = network?.id === OnekeyNetwork.btc;
                const host = isMainNet
                  ? 'https://ordinals.com'
                  : 'https://tbtc-ordinals.onekey.so';
                openUrl(`${host}/inscription/${asset.inscription_id}`);
              }}
              title={intl.formatMessage({
                id: 'form__ordinal_inscription_date',
              })}
              icon="ArrowTopRightOnSquareOutline"
              value={format(
                new Date(Number(asset.timestamp) * 1000),
                'MMM d, yyyy, HH:mm',
              )}
            />
          )}
          {/* {!!asset.location && (
            <DetailItem
              title={intl.formatMessage({
                id: 'form__ordinal_location',
              })}
              icon="Square2StackMini"
              value={shortenAddress(asset.location, 6)}
              onPress={() => {
                copyToClipboard(asset.location ?? '');
                ToastManager.show({
                  title: intl.formatMessage({ id: 'msg__copied' }),
                });
              }}
            />
          )} */}
          {/* {!!asset.genesis_transaction_hash && (
            <DetailItem
              onPress={() => {
                openUrl(
                  `https://ordinals.com/tx/${asset.genesis_transaction_hash}`,
                );
              }}
              title={intl.formatMessage({
                id: 'form__ordinal_genesis_tx',
              })}
              icon="ArrowTopRightOnSquareOutline"
              value={shortenAddress(asset.genesis_transaction_hash, 6)}
            />
          )} */}
        </VStack>
      </Box>
    </VStack>
  );
}

export { BTCAssetDetailContent };
