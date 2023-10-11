import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Modal, Spinner } from '@onekeyhq/components';
import { OneKeyError } from '@onekeyhq/engine/src/errors';
import type { IEncodedTxBtc } from '@onekeyhq/engine/src/vaults/impl/btc/types';
import type { BlockBookTxDetail } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import type { TransactionDetailRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/TransactionDetail';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { TxUtxoDetailBlock } from './TxUtxoDetailBlock';

import type { TransactionDetailModalRoutes } from '../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/native';

type TransactionDetailRouteProp = RouteProp<
  TransactionDetailRoutesParams,
  TransactionDetailModalRoutes.UtxoDetailModal
>;

function TxUtxosDetailModal() {
  const route = useRoute<TransactionDetailRouteProp>();
  const intl = useIntl();
  const [isLoading, setIsLoading] = useState(false);
  const [inputs, setInputs] = useState<IEncodedTxBtc['inputs']>([]);
  const [outputs, setOutputs] = useState<IEncodedTxBtc['outputs']>([]);
  const { decodedTx } = route.params;

  const fetchTxDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      const txDetail =
        (await backgroundApiProxy.serviceTransaction.getTransactionDetail({
          txId: decodedTx.txid,
          networkId: decodedTx.networkId,
        })) as BlockBookTxDetail;

      setInputs(
        txDetail.vin.map((item) => ({
          txid: item.txid,
          address: item.addresses[0],
          vout: item.n,
          value: item.value,
          path: '',
        })),
      );
      setOutputs(
        txDetail.vout.map((item) => ({
          address: item.addresses[0],
          vout: item.n,
          value: item.value,
          path: '',
        })),
      );
    } catch (e) {
      throw new OneKeyError("Can't get transaction detail info.");
    }
    setIsLoading(false);
  }, [decodedTx.networkId, decodedTx.txid]);

  useEffect(() => {
    const encodedTx = decodedTx.encodedTx as IEncodedTxBtc;
    if (encodedTx && encodedTx.inputs && encodedTx.outputs) {
      setInputs(encodedTx.inputs);
      setOutputs(encodedTx.outputs);
    } else {
      fetchTxDetail();
    }
  }, [decodedTx.encodedTx, fetchTxDetail]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__inputs_and_outputs' })}
      footer={null}
      height="560px"
      scrollViewProps={{
        children: isLoading ? (
          <Spinner />
        ) : (
          <>
            <TxUtxoDetailBlock
              title={intl.formatMessage(
                { id: 'form__inputs_int__uppercase' },
                { 0: inputs.length },
              )}
              utxos={inputs}
              decodedTx={decodedTx}
              type="inputs"
            />
            <TxUtxoDetailBlock
              title={intl.formatMessage(
                { id: 'form__outputs_int__uppercase' },
                { 0: outputs.length },
              )}
              utxos={outputs}
              decodedTx={decodedTx}
              style={{ mt: 6 }}
              type="outputs"
            />
          </>
        ),
      }}
    />
  );
}

export { TxUtxosDetailModal };
