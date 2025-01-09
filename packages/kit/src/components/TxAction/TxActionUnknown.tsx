import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSendRoutes,
  IModalSendParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useFeeInfoInDecodedTx } from '../../hooks/useTxFeeInfo';
import { AddressInfo } from '../AddressInfo';

import {
  TxActionCommonDetailView,
  TxActionCommonListView,
} from './TxActionCommon';

import type { ITxActionCommonListViewProps, ITxActionProps } from './types';
import type { RouteProp } from '@react-navigation/core';

function getTxActionUnknownInfo(props: ITxActionProps) {
  const { action } = props;
  const { unknownAction } = action;
  const unknownFrom = unknownAction?.from ?? '';
  const unknownTo = unknownAction?.to ?? '';
  const unknownIcon = unknownAction?.icon ?? '';
  const unknownLabel = unknownAction?.label ?? '';

  return {
    unknownFrom,
    unknownTo,
    unknownIcon,
    unknownLabel,
  };
}

function TxActionUnknownListView(props: ITxActionProps) {
  const intl = useIntl();
  const { tableLayout, decodedTx, componentProps, showIcon, replaceType } =
    props;
  const { unknownTo, unknownIcon, unknownLabel } =
    getTxActionUnknownInfo(props);
  const { txFee, txFeeFiatValue, txFeeSymbol, hideFeeInfo } =
    useFeeInfoInDecodedTx({
      decodedTx,
    });

  const title =
    unknownLabel ||
    intl.formatMessage({
      id: ETranslations.transaction__contract_interaction,
    });
  const avatar: ITxActionCommonListViewProps['avatar'] = {
    src: unknownIcon,
    fallbackIcon: 'Document2Outline',
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
      replaceType={replaceType}
      status={decodedTx.status}
      networkId={decodedTx.networkId}
      networkLogoURI={decodedTx.networkLogoURI}
      {...componentProps}
    />
  );
}

function TxActionUnknownDetailView(props: ITxActionProps) {
  const intl = useIntl();
  const { decodedTx } = props;
  const { unknownFrom, unknownTo, unknownIcon } = getTxActionUnknownInfo(props);

  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.SendConfirm>>();
  const sourceInfo = route.params?.sourceInfo;

  return (
    <TxActionCommonDetailView
      networkId={decodedTx.networkId}
      overview={{
        title: intl.formatMessage({
          id: ETranslations.global_estimated_results,
        }),
        content: intl.formatMessage({
          id:
            sourceInfo && sourceInfo.origin
              ? ETranslations.global_dapp_interaction
              : ETranslations.transaction__contract_interaction,
        }),
        avatar: {
          src: unknownIcon,
          fallbackIcon: 'Document2Outline',
        },
      }}
      target={{
        title: intl.formatMessage({
          id: ETranslations.interact_with_contract,
        }),
        content: unknownTo,
        description: {
          content: (
            <AddressInfo
              address={unknownTo}
              networkId={decodedTx.networkId}
              accountId={decodedTx.accountId}
            />
          ),
        },
      }}
      source={{
        content: unknownFrom,
        description: {
          content: (
            <AddressInfo
              address={unknownFrom}
              networkId={decodedTx.networkId}
              accountId={decodedTx.accountId}
            />
          ),
        },
      }}
    />
  );
}

export { TxActionUnknownListView, TxActionUnknownDetailView };
