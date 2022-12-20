import { useEffect, useMemo, useState } from 'react';

import { map } from 'lodash';

import type {
  IDecodedTx,
  IDecodedTxInteractInfo,
  IDecodedTxLegacy,
  IEncodedTx,
} from '@onekeyhq/engine/src/vaults/types';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

// TODO move to serviceDapp getDappInteractInfo()
export function useInteractWithInfo({
  sourceInfo,
}: {
  sourceInfo?: IDappSourceInfo;
}) {
  const info: IDecodedTxInteractInfo | undefined = useMemo(() => {
    if (sourceInfo?.origin) {
      return {
        url: sourceInfo?.origin,
        name: '',
        description: '',
        icons: [],
        provider: sourceInfo?.scope,
      };
    }
  }, [sourceInfo?.origin, sourceInfo?.scope]);

  return info;
}

function useBatchSendConfirmDecodedTxs({
  networkId,
  accountId,
  encodedTxs = [],
  payload,
  sourceInfo,
}: {
  accountId: string;
  networkId: string;
  encodedTxs: IEncodedTx[];
  payload?: any;
  sourceInfo?: IDappSourceInfo;
}) {
  const [decodedTxsLegacy, setDecodedTxsLegacy] = useState<IDecodedTxLegacy[]>(
    [],
  );

  const [decodedTxs, setDecodedTxs] = useState<IDecodedTx[]>([]);
  const { engine } = backgroundApiProxy;
  const interactInfo = useInteractWithInfo({ sourceInfo });
  useEffect(() => {
    Promise.all(
      encodedTxs.map((encodedTx) =>
        engine.decodeTx({
          networkId,
          accountId,
          encodedTx,
          payload,
          interactInfo,
        }),
      ),
    ).then((resp) => {
      setDecodedTxs(map(resp, 'decodedTx'));
      setDecodedTxsLegacy(map(resp, 'decodedTxLegacy,'));
    });
  }, [accountId, encodedTxs, engine, interactInfo, networkId, payload]);
  return { decodedTxs, decodedTxsLegacy };
}

export { useBatchSendConfirmDecodedTxs };
