import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useFeeInfoInDecodedTx } from '../../hooks/useTxFeeInfo';
import { AddressInfo } from '../AddressInfo';

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
  const { tableLayout, decodedTx, componentProps, showIcon, replaceType } =
    props;
  const { txFee, txFeeFiatValue, txFeeSymbol, hideFeeInfo } =
    useFeeInfoInDecodedTx({
      decodedTx,
    });

  const { functionTo, functionName, functionIcon } =
    getTxActionFunctionCallInfo(props);

  const title = functionName;
  const avatar: ITxActionCommonListViewProps['avatar'] = {
    src: functionIcon,
    fallbackIcon: 'Document2Outline',
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
      hideFeeInfo={hideFeeInfo}
      replaceType={replaceType}
      status={decodedTx.status}
      {...componentProps}
    />
  );
}

function TxActionFunctionCallDetailView(props: ITxActionProps) {
  const intl = useIntl();
  const { decodedTx } = props;
  const { functionFrom, functionTo, functionName, functionIcon } =
    getTxActionFunctionCallInfo(props);

  return (
    <TxActionCommonDetailView
      networkId={decodedTx.networkId}
      overview={{
        title: intl.formatMessage({
          id: ETranslations.transaction__contract_interaction,
        }),
        content: functionName,
        avatar: {
          src: functionIcon,
          fallbackIcon: 'Document2Outline',
        },
      }}
      target={{
        title: intl.formatMessage({
          id: ETranslations.interact_with_contract,
        }),
        content: functionTo,
      }}
      source={{
        content: functionFrom,
        description: {
          content: (
            <AddressInfo
              address={functionFrom}
              networkId={decodedTx.networkId}
              accountId={decodedTx.accountId}
            />
          ),
        },
      }}
    />
  );
}

export { TxActionFunctionCallListView, TxActionFunctionCallDetailView };
