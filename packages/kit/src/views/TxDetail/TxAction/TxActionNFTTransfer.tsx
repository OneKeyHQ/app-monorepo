import { useMemo } from 'react';

import { useNavigation } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { HStack, Icon, ListItem, Text } from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import type { IDecodedTxAction } from '@onekeyhq/engine/src/vaults/types';
import {
  IDecodedTxActionType,
  IDecodedTxDirection,
} from '@onekeyhq/engine/src/vaults/types';

import {
  CollectiblesModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';
import NFTListImage from '../../Wallet/NFT/NFTList/NFTListImage';
import { TxDetailActionBox } from '../components/TxDetailActionBox';
import { TxListActionBox } from '../components/TxListActionBox';
import { getTxActionElementAddressWithSecurityInfo } from '../elements/TxActionElementAddress';
import {
  TxActionAmountMetaDataWithDirection,
  TxActionElementAmountNormal,
} from '../elements/TxActionElementAmount';
import {
  TxActionElementTitleHeading,
  TxActionElementTitleNormal,
} from '../elements/TxActionElementTitle';
import { useTxDetailContext } from '../TxDetailContext';

import type {
  ITxActionCardProps,
  ITxActionElementDetail,
  ITxActionMetaIcon,
  ITxActionMetaTitle,
} from '../types';

const NOBODY = '0x0000000000000000000000000000000000000000';

export function getTitleInfo({
  type,
  send,
  receive,
  account,
  from,
}: {
  type: IDecodedTxActionType;
  send: string;
  receive: string;
  account: string;
  from: string;
}): ITxActionMetaTitle | undefined {
  if (
    (send === account && receive === NOBODY) ||
    type === IDecodedTxActionType.NFT_BURN
  ) {
    return {
      titleKey: 'form_burn_nft',
    };
  }
  if (type === IDecodedTxActionType.NFT_MINT) {
    if (from.toLowerCase() !== receive.toLowerCase()) {
      return {
        titleKey: 'form_receive_airdrop_nft',
      };
    }
    return {
      titleKey: 'form_mint_nft',
    };
  }
  if (type === IDecodedTxActionType.NFT_SALE) {
    return {
      titleKey: 'form_trade_nft',
    };
  }
  if (type === IDecodedTxActionType.NFT_TRANSFER) {
    if (send === account) {
      return {
        titleKey: 'form_send_nft',
      };
    }
    if (receive === account) {
      return {
        titleKey: 'form_receive_nft',
      };
    }
  }
  return undefined;
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

export function getTxActionNFTInfo(props: ITxActionCardProps) {
  const { action, decodedTx } = props;
  const nftInfo = nftInfoFromAction(action);
  const account = decodedTx.owner;
  const amount = nftInfo?.amount ?? '0';
  const symbol = nftInfo?.asset.name ?? nftInfo?.asset.contractName ?? '';
  const send = nftInfo?.send ?? '';
  const receive = nftInfo?.receive ?? '';
  const from = nftInfo?.from ?? '';
  const iconUrl = nftInfo?.asset.collection.logoUrl;

  const displayDecimals: number | undefined = 100;

  let direction = IDecodedTxDirection.OTHER;
  if (send === receive && send === account) {
    direction = IDecodedTxDirection.SELF;
  }
  if (send && send === account) {
    direction = IDecodedTxDirection.OUT;
  }
  if (receive && receive === account) {
    direction = IDecodedTxDirection.IN;
  }
  action.direction = direction;

  const isOut =
    direction === IDecodedTxDirection.OUT ||
    direction === IDecodedTxDirection.SELF ||
    direction === IDecodedTxDirection.OTHER;
  const titleInfo = getTitleInfo({
    type: action.type,
    send,
    receive,
    account,
    from,
  });

  let iconInfo: ITxActionMetaIcon | undefined;
  if (iconUrl) {
    iconInfo = {
      icon: {
        url: iconUrl,
      },
    };
  }

  return {
    titleInfo,
    iconInfo,
    amount,
    symbol,
    displayDecimals,
    send,
    receive,
    isOut,
    action,
    asset: nftInfo?.asset,
  };
}

export function TxActionNFTTransfer(props: ITxActionCardProps) {
  const { meta, network } = props;
  const intl = useIntl();
  const { symbol, send, receive, isOut, asset } = getTxActionNFTInfo(props);
  const detailContext = useTxDetailContext();
  const isCollapse = detailContext?.context.isCollapse;
  const navigation = useNavigation();

  const details: ITxActionElementDetail[] = [
    {
      title: intl.formatMessage({ id: 'content__from' }),
      content: getTxActionElementAddressWithSecurityInfo({
        address: send,
        networkId: network?.id,
        withSecurityInfo: !isOut,
      }),
    },
    {
      title: intl.formatMessage({ id: 'content__to' }),
      content: getTxActionElementAddressWithSecurityInfo({
        address: receive,
        networkId: network?.id,
        withSecurityInfo: isOut,
      }),
    },
  ];

  let titleView = <TxActionElementTitleHeading titleInfo={meta?.titleInfo} />;

  if (isCollapse) {
    titleView = (
      <HStack space={2} alignItems="center" flex={1}>
        <TxActionElementTitleNormal titleInfo={meta?.titleInfo} />
        <Text
          typography="Body1Strong"
          color="text-subdued"
          flexWrap="nowrap"
          ellipsizeMode="middle"
          numberOfLines={1}
        >
          {symbol}
        </Text>
      </HStack>
    );
  }

  return (
    <TxDetailActionBox
      icon={
        asset ? (
          <NFTListImage asset={asset} borderRadius="6px" size={32} />
        ) : undefined
      }
      title={titleView}
      content={
        <ListItem
          px={0}
          py="12px"
          onPress={() => {
            if (network && asset) {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.Collectibles,
                params: {
                  screen: CollectiblesModalRoutes.NFTDetailModal,
                  params: {
                    asset,
                    network,
                    isOwner: false,
                  },
                },
              });
            }
          }}
        >
          <Text numberOfLines={1} typography="DisplayXLarge">
            {symbol}
          </Text>
          <Icon name="ChevronRightSolid" size={20} />
        </ListItem>
      }
      showTitleDivider
      details={details}
    />
  );
}

export function TxActionNFTTransferT0(props: ITxActionCardProps) {
  const { action, meta } = props;
  const { amount, symbol, send, receive, isOut, asset } =
    getTxActionNFTInfo(props);
  const { color } = TxActionAmountMetaDataWithDirection(action.direction);
  const amountBN = useMemo(() => new BigNumber(amount), [amount]);

  return (
    <TxListActionBox
      symbol={symbol}
      icon={
        asset ? (
          <NFTListImage asset={asset} borderRadius="6px" size={32} />
        ) : undefined
      }
      titleInfo={meta?.titleInfo}
      content={
        <TxActionElementAmountNormal
          textAlign="right"
          justifyContent="flex-end"
          amount={amountBN.gt(1) ? amount : undefined}
          symbol={symbol}
          color={color}
          direction={amountBN.gt(1) ? action.direction : undefined}
        />
      }
      subTitle={isOut ? shortenAddress(receive) : shortenAddress(send)}
    />
  );
}
