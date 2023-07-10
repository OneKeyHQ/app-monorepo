import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Icon, ListItem } from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
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
import { TxDetailActionBox } from '../components/TxDetailActionBox';
import { TxListActionBox } from '../components/TxListActionBox';
import { getTxActionElementAddressWithSecurityInfo } from '../elements/TxActionElementAddress';
import {
  TxActionElementInscription,
  TxActionElementInscriptionContent,
} from '../elements/TxActionElementInscription';
import { TxActionElementTitleHeading } from '../elements/TxActionElementTitle';

import type {
  ITxActionCardProps,
  ITxActionElementDetail,
  ITxActionMetaIcon,
  ITxActionMetaTitle,
} from '../types';

export function getTitleInfo({
  type,
  send,
  receive,
  account,
}: {
  type: IDecodedTxActionType;
  send: string;
  receive: string;
  account: string;
}): ITxActionMetaTitle | undefined {
  if (type === IDecodedTxActionType.NFT_INSCRIPTION) {
    return {
      titleKey: 'form_receive_nft',
    };
  }
  if (type === IDecodedTxActionType.NFT_TRANSFER_BTC) {
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
  const { action, decodedTx } = props;
  const { inscriptionInfo, direction } = action;
  const account = decodedTx.owner;
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
    send,
    receive,
    account,
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
    asset: inscriptionInfo?.asset,
  };
}

export function TxActionNFTInscription(props: ITxActionCardProps) {
  const { action, meta, network, isShortenAddress = false } = props;
  const intl = useIntl();
  const { send, receive, isOut, asset } = getTxActionInscriptionInfo(props);
  const navigation = useNavigation();

  const details: ITxActionElementDetail[] = [
    {
      title: intl.formatMessage({ id: 'content__from' }),
      content: getTxActionElementAddressWithSecurityInfo({
        address: send,
        networkId: network?.id,
        withSecurityInfo: !isOut,
        isShorten: isShortenAddress,
      }),
    },
    {
      title: intl.formatMessage({ id: 'content__to' }),
      content: getTxActionElementAddressWithSecurityInfo({
        address: receive,
        networkId: network?.id,
        withSecurityInfo: isOut,
        isShorten: isShortenAddress,
      }),
    },
  ];

  const titleView = <TxActionElementTitleHeading titleInfo={meta?.titleInfo} />;

  return (
    <TxDetailActionBox
      icon={<TxActionElementInscription asset={asset as NFTBTCAssetModel} />}
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
          <TxActionElementInscriptionContent
            typography="DisplayXLarge"
            direction={action.direction}
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            title={`Inscription #${asset?.inscription_number}`}
          />
          <Icon name="ChevronRightSolid" size={20} />
        </ListItem>
      }
      showTitleDivider
      details={details}
    />
  );
}

export function TxActionNFTInscriptionT0(props: ITxActionCardProps) {
  const { action, meta } = props;
  const { send, receive, isOut, asset } = getTxActionInscriptionInfo(props);

  return (
    <TxListActionBox
      symbol="symbol"
      icon={<TxActionElementInscription asset={asset as NFTBTCAssetModel} />}
      titleInfo={meta?.titleInfo}
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
      subTitle={isOut ? shortenAddress(receive) : shortenAddress(send)}
    />
  );
}
