import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useFeeInfoInDecodedTx } from '../../hooks/useTxFeeInfo';

import {
  TxActionCommonDetailView,
  TxActionCommonListView,
} from './TxActionCommon';

import type { ITxActionCommonListViewProps, ITxActionProps } from './types';

function getTxActionUnknownInfo(props: ITxActionProps) {
  const { action } = props;
  const { unknownAction } = action;
  const unknownFrom = unknownAction?.from ?? '';
  const unknownTo = unknownAction?.to ?? '';
  const unknownIcon = unknownAction?.icon ?? '';

  return {
    unknownFrom,
    unknownTo,
    unknownIcon,
  };
}

function TxActionUnknownListView(props: ITxActionProps) {
  const intl = useIntl();
  const { tableLayout, decodedTx, componentProps, showIcon } = props;
  const { unknownTo, unknownIcon } = getTxActionUnknownInfo(props);
  const { txFee, txFeeFiatValue, txFeeSymbol, hideFeeInfo } =
    useFeeInfoInDecodedTx({
      decodedTx,
    });

  const title = intl.formatMessage({
    id: ETranslations.transaction__contract_interaction,
  });
  const avatar: ITxActionCommonListViewProps['avatar'] = {
    src: unknownIcon,
    fallbackIcon: 'QuestionmarkOutline',
  };
  const description = {
    children: accountUtils.shortenAddress({ address: unknownTo }),
  };

  return (
    <TxActionCommonListView
      title={title}
      avatar={avatar}
      description={description}
      tableLayout={tableLayout}
      fee={txFee}
      feeFiatValue={txFeeFiatValue}
      feeSymbol={txFeeSymbol}
      timestamp={decodedTx.updatedAt ?? decodedTx.createdAt}
      showIcon={showIcon}
      hideFeeInfo={hideFeeInfo}
      {...componentProps}
    />
  );
}

function TxActionUnknownDetailView(props: ITxActionProps) {
  const intl = useIntl();
  const { unknownFrom, unknownTo, unknownIcon } = getTxActionUnknownInfo(props);

  return (
    <TxActionCommonDetailView
      overview={{
        content: intl.formatMessage({
          id: ETranslations.transaction__contract_interaction,
        }),
        avatar: {
          src: unknownIcon,
        },
      }}
      target={{
        title: intl.formatMessage({
          id: ETranslations.transaction_to_contract,
        }),
        content: unknownTo,
      }}
      source={{ content: unknownFrom }}
    />
  );
}

export { TxActionUnknownListView, TxActionUnknownDetailView };
