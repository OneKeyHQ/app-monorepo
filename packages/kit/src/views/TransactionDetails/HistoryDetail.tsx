import type { FC } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Modal, Spinner } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import type { EVMDecodedItem } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/types';
import { EVMDecodedTxType } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/types';
import type { TransactionDetailRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/TransactionDetail';

import TxHistoryDetail from '../TxDetail/_legacy/TxHistoryDetail';

import type { TransactionDetailModalRoutes } from '../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/native';
import type { IntlShape } from 'react-intl';

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
