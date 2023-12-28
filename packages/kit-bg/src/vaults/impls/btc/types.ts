export type IBtcUTXO = {
  txid: string;
  vout: number;
  value: string;
  address: string;
  path: string;
  forceSelect?: boolean;
  //   inscriptions?: NFTBTCAssetModel[];
};

export type IOrdinalQueryStatus =
  | 'ERROR'
  | 'NO_QUERY'
  | 'FULL_QUERY'
  | 'PARTIAL_QUERY';

export type IBtcUTXOInfo = {
  utxos: IBtcUTXO[];
  ordQueryStatus?: IOrdinalQueryStatus;
  valueDetails?: {
    totalValue: string;
    availableValue: string;
    unavailableValue: string;

    unavailableValueOfInscription: string;
    unavailableValueOfUnconfirmed: string;
    unavailableValueOfUnchecked: string;
  };
};

export type ICoinSelectUTXOLite = {
  txId: string;
  vout: number;
  address: string;
};

export type ICollectUTXOsOptions = {
  checkInscription?: boolean;
  forceSelectUtxos?: ICoinSelectUTXOLite[];
};

export default {};
