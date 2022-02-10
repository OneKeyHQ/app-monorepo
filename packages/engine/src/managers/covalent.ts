import axios from 'axios';

import {
  HistoryDetilList,
  HistoryQuery,
  TxDetail,
  TxQuery,
} from '../types/covalent';

const COVALENT_API_KEY = 'ckey_26a30671d9c941069612f10ac53';

function getHistories(query: HistoryQuery): Promise<HistoryDetilList> {
  let request = `https://api.covalenthq.com/v1/${query.chainId}/address/${query.address}/transactions_v2/?key=${COVALENT_API_KEY}&`;

  if (query.pageNumber) {
    request += `page-number=${query.pageNumber}&`;
  }
  if (query.pageSize) {
    request += `page-size=${query.pageSize}&`;
  }
  if (query.quoteCurrency) {
    request += `quote-currency=${query.quoteCurrency}&`;
  }
  if (query.format) {
    request += `format=${query.format}&`;
  }
  if (query.blockSignedAtAsc) {
    request += `block-signed-at-asc=${query.blockSignedAtAsc.toString()}&`;
  }
  if (query.noLogs) {
    request += `no-logs=${query.noLogs.toString()}&`;
  }

  return axios.get<HistoryDetilList>(request).then((response) => response.data);
}

function getTxDetail(query: TxQuery): Promise<TxDetail> {
  let request = `https://api.covalenthq.com/v1/${query.chainId}/transaction_v2/${query.txHash}/?key=${COVALENT_API_KEY}&`;
  if (query.quoteCurrency) {
    request += `quote-currency=${query.quoteCurrency}&`;
  }
  if (query.format) {
    request += `format=${query.format}&`;
  }
  if (query.noLogs) {
    request += `no-logs=${query.noLogs.toString()}&`;
  }

  return axios.get<TxDetail>(request).then((response) => response.data);
}

export { getHistories, getTxDetail };
