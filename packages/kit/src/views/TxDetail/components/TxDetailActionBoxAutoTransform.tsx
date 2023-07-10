import { Box } from '@onekeyhq/components';
import type {
  IDecodedTx,
  IDecodedTxDirection,
} from '@onekeyhq/engine/src/vaults/types';

import {
  TxActionElementAmountLarge,
  TxActionElementAmountSmall,
} from '../elements/TxActionElementAmount';
import {
  TxActionElementIconLarge,
  TxActionElementIconXLarge,
} from '../elements/TxActionElementIcon';
import {
  TxActionElementTitleHeading,
  TxActionElementTitleNormal,
} from '../elements/TxActionElementTitle';
import { useTxDetailContext } from '../TxDetailContext';

import { TxDetailActionBox } from './TxDetailActionBox';
import { TxStatusBarInDetail } from './TxStatusBar';

import type {
  ITxActionCardViewProps,
  ITxActionMetaIcon,
  ITxActionMetaTitle,
} from '../types';

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
    desc,
    ...others
  } = props;
  const detailContext = useTxDetailContext();
  const isMultipleActions = detailContext?.context?.isMultipleActions;
  const isHistoryDetail = detailContext?.context?.isHistoryDetail;
  const isSingleTransformMode = !isMultipleActions;

  let amountView;
  let descView = desc;
  if (amountInfo) {
    amountView = (
      <TxActionElementAmountLarge
        direction={amountInfo.direction}
        amount={amountInfo.amount}
        symbol={amountInfo.symbol}
        mb={4}
      />
    );
    descView = (
      <TxActionElementAmountSmall
        direction={amountInfo.direction}
        amount={amountInfo.amount}
        symbol={amountInfo.symbol}
        decimals={8}
        color="text-subdued"
        typography="Body2Strong"
      />
    );
  }

  let iconView = icon;
  if (!iconView) {
    iconView = (
      <TxActionElementIconLarge
        iconInfo={iconInfo}
        name={amountInfo?.symbol ?? ''}
      />
    );
    if (isSingleTransformMode) {
      iconView = (
        <Box py="6px">
          <TxActionElementIconXLarge
            iconInfo={iconInfo}
            name={amountInfo?.symbol ?? ''}
          />
        </Box>
      );
    }
  }

  let titleView = title;
  if (!titleView) {
    titleView = <TxActionElementTitleNormal titleInfo={titleInfo} />;
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
      desc={descView}
      isSingleTransformMode={isSingleTransformMode}
      showTitleDivider={!isSingleTransformMode}
    />
  );
}
