import React from 'react';

import { isNil } from 'lodash';

import { Box, Divider, HStack, VStack } from '@onekeyhq/components';
import {
  IDecodedTx,
  IDecodedTxDirection,
} from '@onekeyhq/engine/src/vaults/types';

import { TxActionElementAmountLarge } from '../elements/TxActionElementAmount';
import { TxActionElementDetailCell } from '../elements/TxActionElementDetailCell';
import {
  TxActionElementIconNormal,
  TxActionElementIconXLarge,
} from '../elements/TxActionElementIcon';
import { TxActionElementTitleHeading } from '../elements/TxActionElementTitle';
import { useTxDetailContext } from '../TxDetailContext';
import {
  ITxActionCardViewProps,
  ITxActionMetaIcon,
  ITxActionMetaTitle,
} from '../types';

import { TxStatusBarInDetail } from './TxStatusBar';

export function TxDetailActionBox(props: ITxActionCardViewProps) {
  const {
    title,
    subTitle,
    icon,
    content,
    details,
    showTitleDivider,
    isSingleTransformMode,
  } = props;

  const iconView = icon;
  const titleView = title;

  const contentView = (
    <>
      {!!titleView && (
        <>
          <HStack space={2} pb={4} alignItems="center">
            {iconView}
            <VStack>
              {titleView}
              {subTitle}
            </VStack>
          </HStack>
          {showTitleDivider ? (
            <Divider mb={4} ml={-4} mr={-4} w="auto" />
          ) : null}
        </>
      )}
      {content}
      <VStack space={4}>
        {(details ?? [])
          .filter(Boolean)
          .map((detail, index) =>
            !isNil(detail) ? (
              <TxActionElementDetailCell key={index} {...detail} />
            ) : null,
          )}
      </VStack>
    </>
  );

  if (isSingleTransformMode) {
    return <Box>{contentView}</Box>;
  }
  return (
    <Box bg="surface-default" borderRadius={12} p={4}>
      {contentView}
    </Box>
  );
}

export function TxDetailActionBoxAutoTransform(
  props: ITxActionCardViewProps & {
    titleInfo?: ITxActionMetaTitle;
    iconInfo?: ITxActionMetaIcon;
    decodedTx: IDecodedTx;
    amountInfo?: {
      direction?: IDecodedTxDirection;
      amount: string;
      symbol: string;
    };
  },
) {
  const {
    amountInfo,
    decodedTx,
    content,
    icon,
    iconInfo,
    title,
    titleInfo,
    ...others
  } = props;
  const detailContext = useTxDetailContext();
  const isMultipleActions = detailContext?.context?.isMultipleActions;
  const isHistoryDetail = detailContext?.context?.isHistoryDetail;
  const isSingleTransformMode = !isMultipleActions;

  let amountView;
  if (amountInfo) {
    amountView = (
      <TxActionElementAmountLarge
        direction={amountInfo.direction}
        amount={amountInfo.amount}
        symbol={amountInfo.symbol}
        mb={4}
      />
    );
  }

  let iconView = icon;
  if (!iconView) {
    iconView = <TxActionElementIconNormal iconInfo={iconInfo} />;
    if (isSingleTransformMode) {
      iconView = <TxActionElementIconXLarge iconInfo={iconInfo} />;
    }
  }

  let titleView = title;
  if (!titleView) {
    titleView = <TxActionElementTitleHeading titleInfo={titleInfo} />;
    if (isSingleTransformMode) {
      titleView = <TxActionElementTitleHeading titleInfo={titleInfo} />;
    }
  }

  let subTitleView;
  if (isSingleTransformMode && isHistoryDetail) {
    subTitleView = <TxStatusBarInDetail decodedTx={decodedTx} />;
  }

  return (
    <TxDetailActionBox
      {...others}
      content={amountView || content}
      icon={iconView}
      title={titleView}
      subTitle={subTitleView}
      isSingleTransformMode={isSingleTransformMode}
      showTitleDivider={!isSingleTransformMode}
    />
  );
}
