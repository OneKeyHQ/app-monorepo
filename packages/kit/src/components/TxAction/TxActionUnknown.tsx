import { useIntl } from 'react-intl';

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
  const { tableLayout, decodedTx } = props;
  const { unknownTo, unknownIcon } = getTxActionUnknownInfo(props);
  const { txFee, txFeeFiatValue } = useFeeInfoInDecodedTx({ decodedTx });

  const title = intl.formatMessage({
    id: 'transaction__contract_interaction',
  });
  const avatar: ITxActionCommonListViewProps['avatar'] = {
    circular: true,
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
      timestamp={decodedTx.updatedAt ?? decodedTx.createdAt}
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
          id: 'transaction__contract_interaction',
        }),
        avatar: {
          src: unknownIcon,
          circular: true,
        },
      }}
      target={{ title: 'To Contract', content: unknownTo }}
      source={{ content: unknownFrom }}
    />
  );
}

export { TxActionUnknownListView, TxActionUnknownDetailView };
