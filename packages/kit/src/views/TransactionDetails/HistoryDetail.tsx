import React, { FC } from 'react';

import { useRoute } from '@react-navigation/core';
import { RouteProp } from '@react-navigation/native';
import { IntlShape, useIntl } from 'react-intl';

import { Modal, Spinner } from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import {
  EVMDecodedItem,
  EVMDecodedTxType,
} from '@onekeyhq/engine/src/vaults/impl/evm/decoder/types';
import {
  TransactionDetailModalRoutes,
  TransactionDetailRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/TransactionDetail';

import TxHistoryDetail from '../TxDetail/_legacy/TxHistoryDetail';

type TransactionDetailRouteProp = RouteProp<
  TransactionDetailRoutesParams,
  TransactionDetailModalRoutes.HistoryDetailModal
>;

const getTransactionTypeStr = (
  intl: IntlShape,
  decodedItem: EVMDecodedItem | null | undefined,
): string => {
  let id: LocaleIds = 'action__send';
  if (!decodedItem) {
    return intl.formatMessage({ id });
  }
  const { txType, fromType } = decodedItem;

  if (fromType === 'IN') {
    id = 'action__receive';
  } else if (
    txType === EVMDecodedTxType.SWAP ||
    txType === EVMDecodedTxType.INTERNAL_SWAP
  ) {
    id = 'transaction__exchange';
  } else if (txType === EVMDecodedTxType.TRANSACTION) {
    id = 'transaction__contract_interaction';
  }
  return intl.formatMessage({ id });
};

const HistoryDetail: FC = () => {
  const intl = useIntl();

  const route = useRoute<TransactionDetailRouteProp>();
  const { decodedItem } = route.params;

  return (
    <Modal
      header={getTransactionTypeStr(intl, decodedItem)}
      headerDescription={shortenAddress(decodedItem?.toAddress ?? '')}
      footer={null}
      height="560px"
      scrollViewProps={{
        pt: 4,
        children: decodedItem ? (
          <TxHistoryDetail tx={decodedItem} />
        ) : (
          <Spinner />
        ),
      }}
    />
  );
};

export default HistoryDetail;
