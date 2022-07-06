import React, { FC, useEffect } from 'react';

import { useRoute } from '@react-navigation/core';
import { RouteProp } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, Button, Modal, Spinner } from '@onekeyhq/components';
import {
  TransactionDetailModalRoutes,
  TransactionDetailRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/TransactionDetail';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { TxDetailStatusIcon } from '../TxDetail/components/TxDetailStatusIcon';
import { TxActionElementTime } from '../TxDetail/elements/TxActionElementTime';
import { TxDetailView } from '../TxDetail/TxDetailView';

type TransactionDetailRouteProp = RouteProp<
  TransactionDetailRoutesParams,
  TransactionDetailModalRoutes.HistoryDetailModal
>;

/* TODO status ICON
    switch (status) {
      case TxStatus.Pending:
        statusTitle = 'transaction__pending';
        statusIconName = 'DotsCircleHorizontalOutline';
        iconColor = 'icon-warning';
        textColor = 'text-warning';
        iconContainerColor = 'surface-warning-default';
        break;
      case TxStatus.Confirmed:
        statusTitle = 'transaction__success';
        statusIconName = 'CheckCircleOutline';
        iconColor = 'icon-success';
        textColor = 'text-success';
        iconContainerColor = 'surface-success-default';
        break;
      case TxStatus.Dropped:
        statusTitle = 'transaction__dropped';
        break;
      default:
        break;
    }
 */

const TxHistoryDetailModal: FC = () => {
  const intl = useIntl();

  const route = useRoute<TransactionDetailRouteProp>();
  const { decodedTx, historyTx } = route.params;
  useEffect(() => {
    if (!historyTx) {
      return;
    }
    const { accountId, networkId } = historyTx.decodedTx;
    const timer = setTimeout(() => {
      backgroundApiProxy.serviceHistory.updateHistoryStatus({
        networkId,
        accountId,
        items: [historyTx],
      });
    }, 1500);
    return () => {
      clearTimeout(timer);
    };
  }, [historyTx]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'transaction__transaction_details' })}
      headerDescription={
        <TxActionElementTime
          timestamp={decodedTx?.updatedAt ?? decodedTx?.createdAt}
        />
      }
      footer={null}
      height="560px"
      scrollViewProps={{
        children: decodedTx ? (
          <>
            <TxDetailStatusIcon decodedTx={decodedTx} />
            <Box h={4} />
            <TxDetailView decodedTx={decodedTx} historyTx={historyTx} />

            {platformEnv.isDev && (
              <Button
                mt={6}
                onPress={() => {
                  console.log({
                    decodedTx,
                    historyTx,
                  });
                }}
              >
                Show Tx Data
              </Button>
            )}
          </>
        ) : (
          <Spinner />
        ),
      }}
    />
  );
};

export { TxHistoryDetailModal };
