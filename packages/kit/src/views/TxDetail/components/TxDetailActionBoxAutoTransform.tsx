import React from 'react';

import { Box } from '@onekeyhq/components';
import {
  IDecodedTx,
  IDecodedTxDirection,
} from '@onekeyhq/engine/src/vaults/types';

import { TxActionElementAmountLarge } from '../elements/TxActionElementAmount';
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

import { TxDetailActionBox } from './TxDetailActionBox';
import { TxStatusBarInDetail } from './TxStatusBar';

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
      iconView = (
        <Box py="6px">
          <TxActionElementIconXLarge iconInfo={iconInfo} />
        </Box>
      );
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
