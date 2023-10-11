import { useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { HStack, Icon, ListItem, Pressable, Text } from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import type { IDecodedTxAction } from '@onekeyhq/engine/src/vaults/types';
import {
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
} from '@onekeyhq/engine/src/vaults/types';

import { useAccount, useNetwork } from '../../../hooks';
import {
  ModalRoutes,
  RootRoutes,
  SendModalRoutes,
} from '../../../routes/routesEnum';
import { TxDetailActionBox } from '../components/TxDetailActionBox';
import {
  TxListActionBox,
  TxListActionBoxExtraText,
} from '../components/TxListActionBox';
import { getTxActionElementAddressWithSecurityInfo } from '../elements/TxActionElementAddress';
import {
  TxActionElementInscription,
  TxActionElementInscriptionContent,
} from '../elements/TxActionElementInscription';
import { TxActionElementTitleHeading } from '../elements/TxActionElementTitle';

import type { SendRoutesParams } from '../../../routes';
import type { RootRoutesParams } from '../../../routes/types';
import type {
  ITxActionCardProps,
  ITxActionElementDetail,
  ITxActionMetaIcon,
  ITxActionMetaTitle,
} from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StackNavigationProp } from '@react-navigation/stack';

const SHOW_ASSETS_DEFAULT = 3;

export function getTitleInfo({
  type,
  direction,
}: {
  type: IDecodedTxActionType;
  direction?: IDecodedTxDirection;
}): ITxActionMetaTitle | undefined {
  if (type === IDecodedTxActionType.NFT_INSCRIPTION) {
    return {
      titleKey: 'form_receive_nft',
    };
  }
  if (type === IDecodedTxActionType.NFT_TRANSFER_BTC) {
    if (direction === IDecodedTxDirection.OUT) {
      return {
        titleKey: 'form_send_nft',
      };
    }
    return {
      titleKey: 'form_receive_nft',
    };
  }
}

export function nftInfoFromAction(action: IDecodedTxAction) {
  const { nftTransfer, nftTrade } = action;
  if (action.type === IDecodedTxActionType.NFT_SALE) {
    if (nftTrade) {
      return nftTrade;
    }
  }
  return nftTransfer;
}

export function getTxActionInscriptionInfo(props: ITxActionCardProps) {
  const { action } = props;
  const { inscriptionInfo, direction } = action;
  const isInscribeTransfer = !!inscriptionInfo?.isInscribeTransfer;
  const send = inscriptionInfo?.send ?? '';
  const receive = inscriptionInfo?.receive ?? '';
  const displayDecimals: number | undefined = 100;

  action.direction = direction;

  const isOut =
    direction === IDecodedTxDirection.OUT ||
    direction === IDecodedTxDirection.SELF ||
    direction === IDecodedTxDirection.OTHER;
  const titleInfo = getTitleInfo({
    type: action.type,
    direction,
  });

  let iconInfo: ITxActionMetaIcon | undefined;

  return {
    titleInfo,
    iconInfo,
    displayDecimals,
    send,
    receive,
    isOut,
    action,
    isInscribeTransfer,
    asset: inscriptionInfo?.asset,
    assetsInSameUtxo: inscriptionInfo?.assetsInSameUtxo,
  };
}

type NavigationProps = StackNavigationProp<
  SendRoutesParams,
  SendModalRoutes.NFTDetailModal
> &
  NativeStackNavigationProp<RootRoutesParams, RootRoutes.Main>;

export function TxActionNFTInscription(props: ITxActionCardProps) {
  const { decodedTx, action, meta, network, isShortenAddress = false } = props;
  const { accountId, networkId } = decodedTx;
  const intl = useIntl();
  const { account } = useAccount({ accountId, networkId });
  const { send, receive, isOut, asset, assetsInSameUtxo, isInscribeTransfer } =
    getTxActionInscriptionInfo(props);
  const navigation = useNavigation<NavigationProps>();
  const [showAllAssets, setShowAllAssets] = useState(false);

  const assets = [asset, assetsInSameUtxo].flat().filter(Boolean);

  const details: ITxActionElementDetail[] = [
    {
      title: intl.formatMessage({ id: 'content__from' }),
      content: getTxActionElementAddressWithSecurityInfo({
        address: send,
        networkId: network?.id,
        withSecurityInfo: !isOut,
        isShorten: isShortenAddress,
        isInscribeTransfer: isInscribeTransfer && account?.address !== send,
      }),
    },
    {
      title: intl.formatMessage({ id: 'content__to' }),
      content: getTxActionElementAddressWithSecurityInfo({
        address: receive,
        networkId: network?.id,
        withSecurityInfo: isOut,
        isShorten: isShortenAddress,
        isInscribeTransfer: isInscribeTransfer && account?.address !== receive,
      }),
    },
  ];

  const titleView = <TxActionElementTitleHeading titleInfo={meta?.titleInfo} />;

  return (
    <TxDetailActionBox
      icon={<TxActionElementInscription asset={asset as NFTBTCAssetModel} />}
      title={titleView}
      content={
        <>
          {assets
            .slice(0, showAllAssets ? undefined : SHOW_ASSETS_DEFAULT)
            .map((item) => (
              <ListItem
                key={item.inscription_id}
                px={0}
                py="12px"
                onPress={() => {
                  if (network && item) {
                    navigation.navigate(RootRoutes.Modal, {
                      screen: ModalRoutes.Send,
                      params: {
                        screen: SendModalRoutes.NFTDetailModal,
                        params: {
                          asset: item,
                          networkId,
                          accountId,
                          isOwner: false,
                        },
                      },
                    });
                  }
                }}
              >
                <TxActionElementInscriptionContent
                  typography="DisplayXLarge"
                  direction={action.direction}
                  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                  title={`Inscription #${item?.inscription_number}`}
                />
                <Icon name="ChevronRightSolid" size={20} />
              </ListItem>
            ))}
          {showAllAssets || assets.length <= SHOW_ASSETS_DEFAULT ? null : (
            <Pressable
              p="8px"
              borderRadius="12px"
              _hover={{ bgColor: 'surface-hovered' }}
              _pressed={{ bgColor: 'surface-pressed' }}
              onPress={() => setShowAllAssets(true)}
            >
              <HStack alignItems="center" justifyContent="center" space={2}>
                <Text color="text-subdued">
                  {intl.formatMessage({ id: 'form__show_all' })}
                </Text>
                <Icon name="ChevronDownMini" size={12} color="icon-subdued" />
              </HStack>
            </Pressable>
          )}
        </>
      }
      showTitleDivider
      details={details}
    />
  );
}

export function TxActionNFTInscriptionT0(props: ITxActionCardProps) {
  const intl = useIntl();
  const { action, meta, decodedTx } = props;
  const { status } = decodedTx;
  const { send, receive, isOut, asset } = getTxActionInscriptionInfo(props);

  const { network } = useNetwork({ networkId: decodedTx.networkId });

  const subTitleFormated = isOut
    ? shortenAddress(receive)
    : shortenAddress(send);

  return (
    <TxListActionBox
      symbol="symbol"
      icon={<TxActionElementInscription asset={asset as NFTBTCAssetModel} />}
      titleInfo={
        status === IDecodedTxStatus.Offline
          ? { titleKey: 'form__partially_sign' }
          : meta?.titleInfo
      }
      content={
        <TxActionElementInscriptionContent
          direction={action.direction}
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          title={`Inscription #${asset?.inscription_number}`}
          typography="Body1Strong"
          textAlign="right"
          justifyContent="flex-end"
        />
      }
      subTitle={
        status === IDecodedTxStatus.Offline ? (
          <Text typography="Body2" color="text-warning">
            {intl.formatMessage({ id: 'form__not_broadcast' })}
          </Text>
        ) : (
          subTitleFormated
        )
      }
      extra={
        network && asset ? (
          <TxListActionBoxExtraText>{`${new BigNumber(asset.output_value_sat)
            .shiftedBy(-network.decimals)
            .toFixed()} ${network.symbol}`}</TxListActionBoxExtraText>
        ) : undefined
      }
    />
  );
}
