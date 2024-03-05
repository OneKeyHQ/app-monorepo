import { useIntl } from 'react-intl';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useFeeInfoInDecodedTx } from '../../hooks/useTxFeeInfo';

import {
  TxActionCommonDetailView,
  TxActionCommonListView,
} from './TxActionCommon';

import type { ITxActionCommonListViewProps, ITxActionProps } from './types';

function getTxActionFunctionCallInfo(props: ITxActionProps) {
  const { action } = props;
  const { functionCall } = action;
  const functionFrom = functionCall?.from ?? '';
  const functionTo = functionCall?.to ?? '';
  const functionName = functionCall?.functionName ?? '';
  const functionHash = functionCall?.functionHash ?? '';
  const functionSignature = functionCall?.functionSignature ?? '';
  const functionIcon = functionCall?.icon ?? '';
  const args = functionCall?.args ?? [];

  return {
    functionFrom,
    functionTo,
    functionIcon,
    functionName,
    functionHash,
    functionSignature,
    args,
  };
}

function TxActionFunctionCallListView(props: ITxActionProps) {
  const { tableLayout, decodedTx, componentProps, showIcon } = props;
  const { txFee, txFeeFiatValue, txFeeSymbol } = useFeeInfoInDecodedTx({
    decodedTx,
  });

  const { functionTo, functionName, functionIcon } =
    getTxActionFunctionCallInfo(props);

  const title = functionName;
  const avatar: ITxActionCommonListViewProps['avatar'] = {
    src: functionIcon,
    fallbackIcon: 'ImageMountainSolid',
  };
  const description = {
    children: accountUtils.shortenAddress({ address: functionTo }),
  };

  return (
    <TxActionCommonListView
      showIcon={showIcon}
      title={title}
      avatar={avatar}
      description={description}
      tableLayout={tableLayout}
      timestamp={decodedTx.updatedAt ?? decodedTx.createdAt}
      fee={txFee}
      feeFiatValue={txFeeFiatValue}
      feeSymbol={txFeeSymbol}
      {...componentProps}
    />
  );
}

function TxActionFunctionCallDetailView(props: ITxActionProps) {
  const intl = useIntl();
  const { functionFrom, functionTo, functionName, functionIcon } =
    getTxActionFunctionCallInfo(props);

  return (
    <TxActionCommonDetailView
      overview={{
        title: intl.formatMessage({ id: 'transaction__contract_interaction' }),
        content: functionName,
        avatar: {
          src: functionIcon,
          circular: true,
        },
      }}
      target={{ title: 'To Contract', content: functionTo }}
      source={{ content: functionFrom }}
    />
  );
}

export { TxActionFunctionCallListView, TxActionFunctionCallDetailView };
