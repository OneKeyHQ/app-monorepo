import type { ComponentProps } from 'react';

import { Image, Text, VStack } from '@onekeyhq/components';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import type { IDecodedTxDirection } from '@onekeyhq/engine/src/vaults/types';
import OrdinalLogo from '@onekeyhq/kit/assets/Ordinal.png';

import {
  InscriptionContentType,
  getBTCListComponent,
} from '../../Wallet/NFT/NFTList/NFTBTCContent/getBTCListComponent';

import { TxActionAmountMetaDataWithDirection } from './TxActionElementAmount';
import { TxActionElementPressable } from './TxActionElementPressable';

function TxActionElementInscription(props: { asset: NFTBTCAssetModel }) {
  const { asset } = props;
  if (asset?.content_type.startsWith(InscriptionContentType.Text)) {
    return <Image source={OrdinalLogo} size="40px" />;
  }
  const { Component } = getBTCListComponent({
    data: asset,
    isList: true,
  });

  return <Component asset={asset} borderRadius="8px" size="32px" />;
}

export type Props = ComponentProps<typeof Text> & {
  direction?: IDecodedTxDirection;
  onPress?: (() => void) | null;
  title?: string | JSX.Element;
  subText?: string | JSX.Element;
};

function TxActionElementInscriptionContent(props: Props) {
  const { direction, title, onPress, subText, ...others } = props;
  const { color } = TxActionAmountMetaDataWithDirection(direction);

  const content = (
    <VStack flex="1">
      <Text
        testID="TxActionElementInscriptionContent"
        numberOfLines={2}
        isTruncated
        color={color}
        {...others}
      >
        {title}
      </Text>
      {subText}
    </VStack>
  );
  return onPress ? (
    <TxActionElementPressable onPress={onPress} flex={1}>
      {content}
    </TxActionElementPressable>
  ) : (
    content
  );
}

export { TxActionElementInscription, TxActionElementInscriptionContent };
